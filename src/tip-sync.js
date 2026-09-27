// src/tip-sync.js
// Threat Intelligence Platform (TIP) Integration & STIX 2.1 / MISP Engine
// Exports extracted threat intelligence into STIX 2.1 bundles, MISP event objects,
// and serves TAXII 2.1 compliant discovery & collection endpoints.

const crypto = require('crypto');
const { getSeenArticles } = require('./db');
const logger = require('./logger');

/**
 * Generate a deterministic or random UUIDv4 for STIX 2.1 objects.
 * @param {string} [seed]
 * @returns {string}
 */
function generateStixId(type, seed = null) {
  if (seed) {
    const hash = crypto.createHash('sha256').update(seed).digest('hex');
    const uuid = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
    return `${type}--${uuid}`;
  }
  return `${type}--${crypto.randomUUID()}`;
}

/**
 * Export an article with threat intel to a standards-compliant STIX 2.1 JSON Bundle.
 * @param {object} article - { title, url, source, publishedAt }
 * @param {object} threatIntel - { cves, iocs, mitreTechniques, cvss }
 * @returns {object} - STIX 2.1 Bundle
 */
function exportToStix21(article = {}, threatIntel = {}) {
  const timestamp = new Date(article.publishedAt || Date.now()).toISOString();
  const bundleId = generateStixId('bundle');
  const objects = [];

  const cves = threatIntel.cves || [];
  const iocs = threatIntel.iocs || {};
  const mitreTechniques = threatIntel.mitreTechniques || [];

  // 1. Vulnerability objects
  const vulnObjects = [];
  for (const cve of cves) {
    const cveId = (typeof cve === 'string' ? cve : cve.cveId || '').toUpperCase();
    if (!cveId) continue;

    const vulnObj = {
      type: 'vulnerability',
      spec_version: '2.1',
      id: generateStixId('vulnerability', cveId),
      created: timestamp,
      modified: timestamp,
      name: cveId,
      description: article.title || `Vulnerability ${cveId}`,
      external_references: [
        {
          source_name: 'cve',
          external_id: cveId,
          url: `https://nvd.nist.gov/vuln/detail/${cveId}`
        }
      ]
    };
    vulnObjects.push(vulnObj);
    objects.push(vulnObj);
  }

  // 2. Attack-Pattern objects (MITRE ATT&CK)
  const attackObjects = [];
  for (const tech of mitreTechniques) {
    const techId = (typeof tech === 'string' ? tech : tech.id || '').toUpperCase();
    const techName = tech.name || techId;
    if (!techId) continue;

    const attackObj = {
      type: 'attack-pattern',
      spec_version: '2.1',
      id: generateStixId('attack-pattern', techId),
      created: timestamp,
      modified: timestamp,
      name: techName,
      external_references: [
        {
          source_name: 'mitre-attack',
          external_id: techId,
          url: `https://attack.mitre.org/techniques/${techId.replace(/\./g, '/')}/`
        }
      ]
    };
    attackObjects.push(attackObj);
    objects.push(attackObj);
  }

  // 3. Indicator objects (IPs, hashes, domains)
  const indicatorObjects = [];

  // IP Indicators
  if (Array.isArray(iocs.ips)) {
    for (const ip of iocs.ips) {
      const indObj = {
        type: 'indicator',
        spec_version: '2.1',
        id: generateStixId('indicator', `ip-${ip}`),
        created: timestamp,
        modified: timestamp,
        name: `Malicious / Suspicious IP ${ip}`,
        pattern: `[ipv4-addr:value = '${ip}']`,
        pattern_type: 'stix',
        valid_from: timestamp,
        indicator_types: ['malicious-activity']
      };
      indicatorObjects.push(indObj);
      objects.push(indObj);
    }
  }

  // Domain Indicators
  if (Array.isArray(iocs.domains)) {
    for (const domain of iocs.domains) {
      const indObj = {
        type: 'indicator',
        spec_version: '2.1',
        id: generateStixId('indicator', `domain-${domain}`),
        created: timestamp,
        modified: timestamp,
        name: `Suspicious Domain ${domain}`,
        pattern: `[domain-name:value = '${domain}']`,
        pattern_type: 'stix',
        valid_from: timestamp,
        indicator_types: ['malicious-activity']
      };
      indicatorObjects.push(indObj);
      objects.push(indObj);
    }
  }

  // File Hash Indicators
  if (Array.isArray(iocs.hashes)) {
    for (const hash of iocs.hashes) {
      const isSha256 = hash.length === 64;
      const hashType = isSha256 ? 'SHA-256' : hash.length === 40 ? 'SHA-1' : 'MD5';
      const indObj = {
        type: 'indicator',
        spec_version: '2.1',
        id: generateStixId('indicator', `hash-${hash}`),
        created: timestamp,
        modified: timestamp,
        name: `Malware Hash ${hash.slice(0, 12)}...`,
        pattern: `[file:hashes.'${hashType}' = '${hash}']`,
        pattern_type: 'stix',
        valid_from: timestamp,
        indicator_types: ['malicious-activity']
      };
      indicatorObjects.push(indObj);
      objects.push(indObj);
    }
  }

  // 4. Relationships (Indicator -> indicates -> Vulnerability)
  for (const ind of indicatorObjects) {
    for (const vuln of vulnObjects) {
      objects.push({
        type: 'relationship',
        spec_version: '2.1',
        id: generateStixId('relationship'),
        created: timestamp,
        modified: timestamp,
        relationship_type: 'indicates',
        source_ref: ind.id,
        target_ref: vuln.id
      });
    }
  }

  return {
    type: 'bundle',
    id: bundleId,
    spec_version: '2.1',
    objects
  };
}

/**
 * Export threat intelligence into a MISP Event JSON structure.
 * @param {object} article
 * @param {object} threatIntel
 * @returns {object} - MISP Event structure
 */
function exportToMISPEvent(article = {}, threatIntel = {}) {
  const dateStr = new Date(article.publishedAt || Date.now()).toISOString().split('T')[0];
  const title = (article.title || 'Cyber Threat Advisory').slice(0, 180);

  const attributes = [];
  const tags = [
    { name: 'tlp:amber+strict' },
    { name: 'source:news-feeder-bot' }
  ];

  // CVE attributes
  if (threatIntel.cves) {
    for (const cve of threatIntel.cves) {
      const cveId = typeof cve === 'string' ? cve : cve.cveId;
      if (cveId) {
        attributes.push({
          type: 'vulnerability',
          category: 'External analysis',
          to_ids: true,
          value: cveId.toUpperCase(),
          comment: 'Identified CVE from threat intelligence feed'
        });
      }
    }
  }

  // IOC attributes
  if (threatIntel.iocs?.ips) {
    for (const ip of threatIntel.iocs.ips) {
      attributes.push({
        type: 'ip-dst',
        category: 'Network activity',
        to_ids: true,
        value: ip,
        comment: 'Target / C2 IP address extracted from intelligence report'
      });
    }
  }

  if (threatIntel.iocs?.domains) {
    for (const d of threatIntel.iocs.domains) {
      attributes.push({
        type: 'domain',
        category: 'Network activity',
        to_ids: true,
        value: d,
        comment: 'Observed adversary infrastructure domain'
      });
    }
  }

  if (threatIntel.iocs?.hashes) {
    for (const h of threatIntel.iocs.hashes) {
      const type = h.length === 64 ? 'sha256' : h.length === 40 ? 'sha1' : 'md5';
      attributes.push({
        type,
        category: 'Payload delivery',
        to_ids: true,
        value: h,
        comment: 'Extracted malware payload hash'
      });
    }
  }

  // MITRE ATT&CK tags
  if (threatIntel.mitreTechniques) {
    for (const tech of threatIntel.mitreTechniques) {
      const id = typeof tech === 'string' ? tech : tech.id;
      if (id) {
        tags.push({ name: `misp-galaxy:mitre-attack-pattern="${id}"` });
      }
    }
  }

  return {
    Event: {
      info: `[NewsFeederBot] ${title}`,
      date: dateStr,
      threat_level_id: '1', // 1 = High, 2 = Medium
      analysis: '2',        // 2 = Completed
      distribution: '1',    // 1 = This community only
      published: true,
      Attribute: attributes,
      Tag: tags
    }
  };
}

/**
 * TAXII 2.1 Server Discovery object.
 * @param {string} baseUrl
 * @returns {object}
 */
function getTaxiiDiscovery(baseUrl = 'http://localhost:3000') {
  const cleanBase = baseUrl.replace(/\/$/, '');
  return {
    title: 'News Feeder Bot Threat Intelligence TAXII 2.1 Server',
    description: 'Autonomous cyber threat intelligence, CVE indicators, and detection signatures.',
    contact: 'soc@cyberlog.local',
    default: `${cleanBase}/taxii2/root/`,
    api_roots: [`${cleanBase}/taxii2/root/`]
  };
}

/**
 * TAXII 2.1 API Root definition.
 * @param {string} baseUrl
 * @returns {object}
 */
function getTaxiiApiRoot(baseUrl = 'http://localhost:3000') {
  return {
    title: 'News Feeder Bot Primary Threat Root',
    description: 'STIX 2.1 / TAXII 2.1 cyber threat indicator stream',
    versions: ['application/taxii+json;version=2.1'],
    max_content_length: 10485760
  };
}

/**
 * TAXII 2.1 Collections list.
 * @param {string} baseUrl
 * @returns {object}
 */
function getTaxiiCollections(baseUrl = 'http://localhost:3000') {
  return {
    collections: [
      {
        id: 'newsbot-threat-intel',
        title: 'News Feeder Bot Real-Time Threat Indicators',
        description: 'Automated IOCs, CVEs, and MITRE ATT&CK patterns extracted from monitored sources',
        can_read: true,
        can_write: false,
        media_types: ['application/stix+json;version=2.1']
      },
      {
        id: 'cisa-kev-catalog',
        title: 'CISA Known Exploited Vulnerabilities (KEV)',
        description: 'Real-time synchronization of actively weaponized vulnerabilities',
        can_read: true,
        can_write: false,
        media_types: ['application/stix+json;version=2.1']
      }
    ]
  };
}

/**
 * Build aggregated STIX 2.1 collection objects for TAXII delivery.
 * @returns {object} - STIX 2.1 Bundle
 */
function getAggregatedStixBundle() {
  const recentArticles = getSeenArticles(20);
  const allObjects = [];

  for (const art of recentArticles) {
    const text = `${art.title} ${art.description || ''}`;
    const cveMatches = text.match(/CVE-\d{4}-\d{4,7}/gi) || [];
    const uniqueCves = [...new Set(cveMatches.map((c) => c.toUpperCase()))];

    const ipMatches = text.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g) || [];
    const hashMatches = text.match(/\b[a-f0-9]{32,64}\b/gi) || [];

    if (uniqueCves.length > 0 || ipMatches.length > 0 || hashMatches.length > 0) {
      const bundle = exportToStix21(art, {
        cves: uniqueCves,
        iocs: {
          ips: ipMatches.slice(0, 3),
          hashes: hashMatches.slice(0, 2)
        }
      });
      allObjects.push(...bundle.objects);
    }
  }

  // Deduplicate objects by ID
  const seenIds = new Set();
  const dedupedObjects = [];
  for (const obj of allObjects) {
    if (!seenIds.has(obj.id)) {
      seenIds.add(obj.id);
      dedupedObjects.push(obj);
    }
  }

  return {
    type: 'bundle',
    id: generateStixId('bundle'),
    spec_version: '2.1',
    objects: dedupedObjects
  };
}

module.exports = {
  generateStixId,
  exportToStix21,
  exportToMISPEvent,
  getTaxiiDiscovery,
  getTaxiiApiRoot,
  getTaxiiCollections,
  getAggregatedStixBundle
};
