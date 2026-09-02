// src/sigma-generator.js
// Automated Sigma & YARA Detection Rule Generator
// Generates standards-compliant Sigma rules (YAML) and YARA rules based on extracted CVEs, IOCs, and MITRE techniques.

const crypto = require('crypto');
const { getCachedDetectionRule, setCachedDetectionRule } = require('./db');
const logger = require('./logger');

/**
 * Generate a standards-compliant Sigma YAML rule for a threat alert.
 * @param {object} article - { title, url, source }
 * @param {object} threatIntel - { cves, mitreTechniques, iocs }
 * @returns {string} - Sigma YAML definition
 */
function generateSigmaRule(article = {}, threatIntel = {}) {
  const cveId = threatIntel.cves?.[0]?.cveId || (article.title?.match(/CVE-\d{4}-\d{4,7}/i)?.[0] || '').toUpperCase();
  const ruleId = crypto.randomUUID();
  const sanitizedTitle = (article.title || 'Suspicious Security Incident').replace(/["\n\r]/g, ' ').slice(0, 100).trim();
  const dateStr = new Date().toISOString().split('T')[0];

  // Derive MITRE technique tags
  const tags = ['attack.initial_access', 'attack.t1190'];
  if (threatIntel.mitreTechniques && Array.isArray(threatIntel.mitreTechniques)) {
    for (const t of threatIntel.mitreTechniques) {
      if (t.id) tags.push(`attack.${t.id.toLowerCase()}`);
    }
  }
  if (cveId) {
    tags.push(`cve.${cveId.toLowerCase()}`);
  }

  // Derive detection criteria based on IOCs or vulnerability context
  const ips = threatIntel.iocs?.ips || [];
  const hashes = threatIntel.iocs?.hashes || [];
  const domains = threatIntel.iocs?.domains || [];

  let detectionSection = '';
  if (ips.length > 0 || domains.length > 0) {
    detectionSection = `detection:
  selection_network:
    DestinationIp:
${ips.slice(0, 5).map((ip) => `      - '${ip}'`).join('\n')}
${domains.length > 0 ? `    DestinationHostname:\n${domains.slice(0, 5).map((d) => `      - '${d}'`).join('\n')}` : ''}
  condition: selection_network`;
  } else if (cveId) {
    detectionSection = `detection:
  selection_web:
    c-uri|contains:
      - '${cveId.toLowerCase()}'
      - '/api/'
      - '/vulnerable/'
    cs-method:
      - 'POST'
      - 'GET'
  selection_process:
    Image|endswith:
      - '\\powershell.exe'
      - '\\cmd.exe'
      - '/bin/sh'
      - '/bin/bash'
    CommandLine|contains:
      - '${cveId}'
  condition: selection_web or selection_process`;
  } else {
    detectionSection = `detection:
  selection_generic:
    CommandLine|contains:
      - 'exploit'
      - 'bypass'
      - 'unauthenticated'
  condition: selection_generic`;
  }

  return `title: Detect Potential Exploitation of ${cveId || sanitizedTitle}
id: ${ruleId}
status: experimental
description: Auto-generated detection rule for ${sanitizedTitle}. Monitors for suspicious indicators and exploitation attempts.
references:
  - ${article.url || 'https://cve.mitre.org'}
author: News Feeder Bot SOC Threat Engine
date: ${dateStr}
modified: ${dateStr}
tags:
${tags.map((t) => `  - ${t}`).join('\n')}
logsource:
  category: process_creation
  product: windows
${detectionSection}
falsepositives:
  - Legitimate administrative maintenance or vulnerability scanning
level: high`;
}

/**
 * Generate a standards-compliant YARA rule for malware / threat alert.
 * @param {object} article
 * @param {object} threatIntel
 * @returns {string} - YARA rule definition
 */
function generateYaraRule(article = {}, threatIntel = {}) {
  const cveId = threatIntel.cves?.[0]?.cveId || (article.title?.match(/CVE-\d{4}-\d{4,7}/i)?.[0] || '').toUpperCase();
  const ruleName = `Detect_${cveId ? cveId.replace(/-/g, '_') : 'Threat_' + Date.now()}`;
  const dateStr = new Date().toISOString().split('T')[0];

  const hashes = threatIntel.iocs?.hashes || [];
  const domains = threatIntel.iocs?.domains || [];

  const strings = [];
  if (cveId) strings.push(`$cve = "${cveId}" ascii wide nocase`);
  if (domains.length > 0) {
    domains.slice(0, 3).forEach((d, i) => strings.push(`$dom_${i} = "${d}" ascii wide nocase`));
  }
  if (hashes.length > 0) {
    hashes.slice(0, 2).forEach((h, i) => strings.push(`$hash_${i} = "${h}" ascii`));
  }
  strings.push(`$exp1 = "powershell -enc" ascii wide nocase`);
  strings.push(`$exp2 = "wget " ascii wide nocase`);
  strings.push(`$exp3 = "curl " ascii wide nocase`);

  return `rule ${ruleName} {
    meta:
        description = "Automated rule for ${article.title ? article.title.replace(/["\n\r]/g, ' ').slice(0, 80) : 'Threat IOCs'}"
        author = "News Feeder Bot SOC Intelligence"
        date = "${dateStr}"
        reference = "${article.url || 'https://nvd.nist.gov'}"
        threat_level = "High"

    strings:
        ${strings.join('\n        ')}

    condition:
        uint16(0) == 0x5A4D or uint32(0) == 0x464C457F or any of them
}`;
}

/**
 * Get or generate cached detection rules for an article.
 * @param {object} article
 * @param {object} threatIntel
 * @returns {object} - { sigmaYaml, yaraRule }
 */
function getOrGenerateDetectionRules(article = {}, threatIntel = {}) {
  const cveId = threatIntel.cves?.[0]?.cveId;
  if (cveId) {
    const cached = getCachedDetectionRule(cveId);
    if (cached) {
      return { sigmaYaml: cached.sigmaYaml, yaraRule: cached.yaraRule, cached: true };
    }
  }

  const sigmaYaml = generateSigmaRule(article, threatIntel);
  const yaraRule = generateYaraRule(article, threatIntel);

  if (cveId) {
    setCachedDetectionRule(cveId, sigmaYaml, yaraRule);
  }

  return { sigmaYaml, yaraRule, cached: false };
}

module.exports = {
  generateSigmaRule,
  generateYaraRule,
  getOrGenerateDetectionRules
};
