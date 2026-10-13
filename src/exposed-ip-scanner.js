// src/exposed-ip-scanner.js
// Scrapes publicly exposed IPs and open-port data from free public threat-intel
// sources that require NO API key:
//   1. Shodan InternetDB  — https://internetdb.shodan.io/<ip>  (per-IP enrichment)
//   2. GreyNoise Community GNQL — https://api.greynoise.io/v3/community/<ip>
//   3. Shadowserver "tags" feed — daily CSV/JSON summary feed
//   4. ipinfo.io batch  — free tier, no key needed (basic geo)
//
// IMPORTANT: This scanner only queries IPs that have already been observed in
// threat intelligence feeds (ransomware victims, CVE articles, IOCs).  It does
// NOT perform active scanning / probing of any host.  All data is sourced from
// public APIs that index the internet themselves.

'use strict';

const logger = require('./logger');

// ---------------------------------------------------------------------------
// Helper: safe fetch with timeout + User-Agent
// ---------------------------------------------------------------------------
async function safeFetch(url, opts = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...opts,
      signal: controller.signal,
      headers: {
        'User-Agent': 'NewsFeederBot/3.x SecurityResearch (github.com/cyberlog69/news-feeder-bot)',
        'Accept': 'application/json',
        ...(opts.headers || {})
      }
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Geo lookup via ipinfo.io (free, no key)
// Returns { ip, city, region, country, org, timezone } or null
// ---------------------------------------------------------------------------
async function geoLookup(ip) {
  try {
    const res = await safeFetch(`https://ipinfo.io/${ip}/json`);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      ip:       data.ip   || ip,
      city:     data.city || '',
      region:   data.region || '',
      country:  data.country || '',
      org:      data.org  || '',
      timezone: data.timezone || ''
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Shodan InternetDB enrichment
// Returns { ports, cves, tags, hostnames, vulns } or null
// Rate limit: respectful — 1 req/sec cap enforced by caller
// ---------------------------------------------------------------------------
async function shodanInternetDb(ip) {
  try {
    const res = await safeFetch(`https://internetdb.shodan.io/${ip}`);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      ports:     data.ports     || [],
      cves:      data.cves      || [],
      tags:      data.tags      || [],
      hostnames: data.hostnames || [],
      vulns:     data.vulns     || []
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// GreyNoise Community lookup (free, no key)
// Returns { noise, riot, classification, name, link, message } or null
// ---------------------------------------------------------------------------
async function greyNoiseLookup(ip) {
  try {
    const res = await safeFetch(`https://api.greynoise.io/v3/community/${ip}`);
    if (res.status === 404) return { noise: false, riot: false, classification: 'unknown' };
    if (!res.ok) return null;
    const data = await res.json();
    return {
      noise:          data.noise          || false,
      riot:           data.riot           || false,
      classification: data.classification || 'unknown',
      name:           data.name           || '',
      link:           data.link           || ''
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Shadowserver public "uniquely-tagged" top-IPs feed
// Returns array of { ip, tag, port, proto, country } objects
// Source: https://www.shadowserver.org/what-we-do/network-reporting/
// We use their open JSON summary endpoint (no key required)
// ---------------------------------------------------------------------------
async function shadowserverTopIps() {
  // Shadowserver public dashboard stats — returns JSON list of tag/IP summaries
  const SHADOW_ENDPOINTS = [
    'https://api.shadowserver.org/net/top/tags',
  ];

  const results = [];
  for (const endpoint of SHADOW_ENDPOINTS) {
    try {
      const res = await safeFetch(endpoint, {}, 10000);
      if (!res.ok) continue;
      const data = await res.json();
      if (Array.isArray(data)) {
        for (const item of data.slice(0, 50)) {
          results.push({
            ip:      item.ip      || item.src_ip    || '',
            tag:     item.tag     || item.category  || 'unknown',
            port:    item.port    || item.dst_port  || 0,
            proto:   item.proto   || 'tcp',
            country: item.country || item.cc        || ''
          });
        }
      }
    } catch {
      // Non-critical — skip endpoint if unavailable
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Collect a seed list of IPs to enrich from the local DB (threat intel IOCs)
// ---------------------------------------------------------------------------
function getSeedIps(limit = 40) {
  try {
    const { initDb } = require('./db');
    const db = initDb();

    // Pull IPs extracted from article threat-intel IOCs (stored as JSON blobs)
    // and ransomware victim IPs if available
    const ips = new Set();

    // Pull distinct IPs from our IOC data if we have a separate table
    try {
      const rows = db.prepare(
        `SELECT DISTINCT ip FROM exposed_ips ORDER BY last_seen DESC LIMIT ?`
      ).all(limit);
      rows.forEach(r => r.ip && ips.add(r.ip));
    } catch {
      // Table may not exist yet on first run
    }

    return [...ips].slice(0, limit);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Fetch a fresh batch of globally notable exposed IPs from public sources
// Uses GreyNoise GNQL stats endpoint (no key needed for metadata-level data)
// ---------------------------------------------------------------------------
async function fetchGlobalNotableIps() {
  const results = [];

  // Source 1: GreyNoise "noise" stats by country/tag (no-auth community endpoint)
  const gnEndpoints = [
    { url: 'https://api.greynoise.io/v3/meta/metadata', label: 'GreyNoise Metadata' }
  ];

  for (const ep of gnEndpoints) {
    try {
      const res = await safeFetch(ep.url, {}, 8000);
      if (!res.ok) continue;
      const data = await res.json();

      // GreyNoise metadata returns countries, sensor counts, etc.
      if (data && Array.isArray(data.countries)) {
        for (const c of data.countries.slice(0, 20)) {
          results.push({
            source:      'GreyNoise',
            ip:          `${c.country_code}-SCANNER-NET`,
            country:     c.country      || 'Unknown',
            countryCode: c.country_code || '--',
            ports:       [],
            services:    [],
            tags:        ['mass-scanner', `noise:${c.noise_ip_count || 0}`],
            cves:        [],
            isNoise:     true,
            isRiot:      false,
            riskScore:   Math.min(10, Math.round((c.noise_ip_count || 0) / 5000)),
            org:         `${c.noise_ip_count || 0} noisy IPs`,
            hostnames:   [],
            firstSeen:   new Date().toISOString(),
            lastSeen:    new Date().toISOString(),
          });
        }
      }
    } catch {
      // skip
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Core enrichment function: take an IP, query all sources, return a record
// ---------------------------------------------------------------------------
async function enrichIp(ip, source = 'manual') {
  const [shodan, greynoise, geo] = await Promise.all([
    shodanInternetDb(ip).catch(() => null),
    greyNoiseLookup(ip).catch(() => null),
    geoLookup(ip).catch(() => null)
  ]);

  // Build service labels from Shodan ports
  const SERVICE_MAP = {
    21: 'FTP', 22: 'SSH', 23: 'Telnet', 25: 'SMTP', 53: 'DNS',
    80: 'HTTP', 110: 'POP3', 143: 'IMAP', 443: 'HTTPS', 445: 'SMB',
    993: 'IMAPS', 995: 'POP3S', 1433: 'MSSQL', 1723: 'PPTP',
    2222: 'SSH-Alt', 3306: 'MySQL', 3389: 'RDP', 4444: 'Metasploit',
    5432: 'PostgreSQL', 5900: 'VNC', 6379: 'Redis', 7001: 'WebLogic',
    8080: 'HTTP-Alt', 8443: 'HTTPS-Alt', 8888: 'Jupyter',
    9200: 'Elasticsearch', 9300: 'Elasticsearch-Cluster',
    27017: 'MongoDB', 27018: 'MongoDB-Shard', 50070: 'Hadoop-HDFS'
  };

  const ports = shodan?.ports || [];
  const services = ports.map(p => SERVICE_MAP[p] || `port-${p}`);

  // Compute a simple risk score (0–10)
  let riskScore = 0;
  const criticalPorts = [23, 445, 3389, 4444, 5900];
  const highRiskPorts = [1433, 3306, 5432, 6379, 9200, 27017];
  for (const p of ports) {
    if (criticalPorts.includes(p))  riskScore += 2;
    if (highRiskPorts.includes(p))  riskScore += 1;
  }
  if ((shodan?.cves || []).length > 0) riskScore += Math.min(4, shodan.cves.length);
  if (greynoise?.noise)  riskScore += 1;
  if (greynoise?.classification === 'malicious') riskScore += 3;
  riskScore = Math.min(10, riskScore);

  return {
    ip,
    source,
    country:     geo?.country || '',
    countryCode: (geo?.country || '').toUpperCase(),
    city:        geo?.city    || '',
    org:         geo?.org     || '',
    timezone:    geo?.timezone || '',
    ports,
    services,
    cves:        shodan?.cves      || [],
    tags:        shodan?.tags      || [],
    hostnames:   shodan?.hostnames || [],
    vulns:       shodan?.vulns     || [],
    isNoise:     greynoise?.noise  ?? false,
    isRiot:      greynoise?.riot   ?? false,
    gnClass:     greynoise?.classification || 'unknown',
    gnName:      greynoise?.name   || '',
    riskScore,
    lastSeen:    new Date().toISOString(),
    firstSeen:   new Date().toISOString()
  };
}

// ---------------------------------------------------------------------------
// Save or update an enriched IP record in SQLite
// ---------------------------------------------------------------------------
function saveExposedIp(record) {
  try {
    const { initDb } = require('./db');
    const db = initDb();
    db.prepare(`
      INSERT OR REPLACE INTO exposed_ips (
        ip, source, country, country_code, city, org, timezone,
        ports_json, services_json, cves_json, tags_json, hostnames_json, vulns_json,
        is_noise, is_riot, gn_class, gn_name, risk_score, first_seen, last_seen
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      record.ip,
      record.source || 'scan',
      record.country || '',
      record.countryCode || '',
      record.city || '',
      record.org || '',
      record.timezone || '',
      JSON.stringify(record.ports    || []),
      JSON.stringify(record.services || []),
      JSON.stringify(record.cves     || []),
      JSON.stringify(record.tags     || []),
      JSON.stringify(record.hostnames || []),
      JSON.stringify(record.vulns    || []),
      record.isNoise  ? 1 : 0,
      record.isRiot   ? 1 : 0,
      record.gnClass  || 'unknown',
      record.gnName   || '',
      record.riskScore || 0,
      record.firstSeen || new Date().toISOString(),
      record.lastSeen  || new Date().toISOString()
    );
  } catch (err) {
    logger.warn(`[ExposedIP] DB save failed for ${record.ip}: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Daily scan: collect IPs from all public sources + enrich existing seed IPs
// ---------------------------------------------------------------------------
async function runDailyScan() {
  logger.info('[ExposedIP] 🌐 Starting daily exposed-IP scan…');

  const saved = new Set();
  let totalSaved = 0;

  // ── Phase 1: Fetch global notable IPs from GreyNoise metadata ──────────────
  try {
    const globalIps = await fetchGlobalNotableIps();
    for (const record of globalIps) {
      if (!record.ip || saved.has(record.ip)) continue;
      saved.add(record.ip);
      saveExposedIp(record);
      totalSaved++;
    }
    logger.info(`[ExposedIP] Phase 1 (GreyNoise global): ${globalIps.length} records`);
  } catch (err) {
    logger.warn(`[ExposedIP] Phase 1 failed: ${err.message}`);
  }

  // ── Phase 2: Shadowserver public tag feed ──────────────────────────────────
  try {
    const shadowIps = await shadowserverTopIps();
    for (const item of shadowIps) {
      if (!item.ip || saved.has(item.ip)) continue;
      // Only enrich real IPs (skip aggregate rows)
      const isRealIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(item.ip);
      if (!isRealIp) {
        // Save as a stub record for display purposes
        saveExposedIp({
          ip:          item.ip,
          source:      'Shadowserver',
          country:     item.country || '',
          countryCode: item.country || '',
          city:        '',
          org:         '',
          timezone:    '',
          ports:       item.port ? [item.port] : [],
          services:    item.tag ? [item.tag] : [],
          cves:        [],
          tags:        [item.tag || 'unknown'],
          hostnames:   [],
          vulns:       [],
          isNoise:     false,
          isRiot:      false,
          gnClass:     'unknown',
          gnName:      '',
          riskScore:   3,
          firstSeen:   new Date().toISOString(),
          lastSeen:    new Date().toISOString()
        });
        saved.add(item.ip);
        totalSaved++;
        continue;
      }
      // Real IP — enrich it
      const record = await enrichIp(item.ip, 'Shadowserver');
      record.tags = [...new Set([...(record.tags || []), item.tag])];
      saveExposedIp(record);
      saved.add(item.ip);
      totalSaved++;
      // Rate limit: 1 req/sec
      await new Promise(r => setTimeout(r, 1100));
    }
    logger.info(`[ExposedIP] Phase 2 (Shadowserver): ${shadowIps.length} records`);
  } catch (err) {
    logger.warn(`[ExposedIP] Phase 2 failed: ${err.message}`);
  }

  // ── Phase 3: Enrich existing seed IPs from local threat intel ──────────────
  try {
    const seedIps = getSeedIps(20);
    let enriched = 0;
    for (const ip of seedIps) {
      if (saved.has(ip)) continue;
      const isRealIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(ip);
      if (!isRealIp) continue;
      const record = await enrichIp(ip, 'ThreatIntel-IOC');
      saveExposedIp(record);
      saved.add(ip);
      enriched++;
      totalSaved++;
      await new Promise(r => setTimeout(r, 1100));
    }
    logger.info(`[ExposedIP] Phase 3 (IOC enrichment): ${enriched} IPs enriched`);
  } catch (err) {
    logger.warn(`[ExposedIP] Phase 3 failed: ${err.message}`);
  }

  logger.success(`[ExposedIP] ✅ Daily scan complete — ${totalSaved} records saved`);
  return totalSaved;
}

// ---------------------------------------------------------------------------
// Enrich a single IP on-demand (called from dashboard API)
// ---------------------------------------------------------------------------
async function enrichSingleIp(ip) {
  const record = await enrichIp(ip, 'on-demand');
  saveExposedIp(record);
  return record;
}

module.exports = {
  runDailyScan,
  enrichSingleIp,
  enrichIp,
  saveExposedIp
};
