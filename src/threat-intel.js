// src/threat-intel.js
// Deep Threat Intelligence & Security Enrichment Engine
// Extracts CVEs, fetches CVSS & EPSS scores, parses IOCs (IPs/Hashes/Domains), and maps MITRE ATT&CK techniques.

const { getCveCache, setCveCache } = require('./db');
const logger = require('./logger');

// ── Known safe domains to exclude from IOC extraction ─────────────────────────
const WHITELISTED_DOMAINS = new Set([
  'github.com', 'google.com', 'microsoft.com', 'twitter.com',
  'apple.com', 'amazon.com', 'cisa.gov', 'nvd.nist.gov',
  'schema.org', 'w3.org', 'wikipedia.org', 'youtube.com'
]);

// ── MITRE ATT&CK Technique Mapping ───────────────────────────────────────────
const MITRE_TECHNIQUES = [
  { id: 'T1059', name: 'Command and Scripting Interpreter', pattern: /\b(powershell|bash script|shell script|cmd\.exe|python script|vbs)\b/i },
  { id: 'T1190', name: 'Exploit Public-Facing Application', pattern: /\b(public-facing|unauthenticated rce|remote code execution|zero-day exploit|web vulnerability)\b/i },
  { id: 'T1486', name: 'Data Encrypted for Impact',         pattern: /\b(ransomware|encrypt(?:ed|ing)? files?|ransom note|lockbit|blackcat|clop)\b/i },
  { id: 'T1566', name: 'Phishing',                         pattern: /\b(phishing|spear-phishing|malicious email|phishing attachment)\b/i },
  { id: 'T1068', name: 'Exploitation for Privilege Escalation', pattern: /\b(privilege escalation|elevation of privilege|local privilege|kernel exploit)\b/i },
  { id: 'T1003', name: 'OS Credential Dumping',             pattern: /\b(credential dump(?:ing)?|mimikatz|lsass|hashdump|password theft)\b/i },
  { id: 'T1071', name: 'Application Layer Protocol',         pattern: /\b(command and control|c2 server|dns tunneling|http c2)\b/i },
  { id: 'T1055', name: 'Process Injection',                pattern: /\b(process injection|dll injection|reflective dll|code injection)\b/i },
  { id: 'T1189', name: 'Drive-by Compromise',               pattern: /\b(drive-by download|watering hole|malicious web page)\b/i },
  { id: 'T1078', name: 'Valid Accounts',                   pattern: /\b(stolen credentials|credential stuffing|compromised account|access token)\b/i }
];

/**
 * Extract unique CVE identifiers from text.
 * @param {string} text
 * @returns {string[]}
 */
function extractCVEs(text) {
  if (!text) return [];
  const matches = text.match(/\bCVE-\d{4}-\d{4,7}\b/gi) || [];
  return [...new Set(matches.map((c) => c.toUpperCase()))];
}

/**
 * Fetch CVSS and EPSS scores for a CVE ID with local SQLite caching.
 * @param {string} cveId
 * @returns {Promise<object>}
 */
async function fetchCveAndEpss(cveId) {
  const cached = getCveCache(cveId);
  if (cached) {
    return cached;
  }

  const result = { cveId, cvss: null, severity: null, epss: null, percentile: null };

  try {
    // 1. Fetch EPSS score from FIRST.org API
    const epssRes = await fetchWithTimeout(`https://api.first.org/data/v1/epss?cve=${cveId}`, 4000);
    if (epssRes.ok) {
      const epssData = await epssRes.json();
      const item = epssData?.data?.[0];
      if (item) {
        result.epss = parseFloat(item.epss);
        result.percentile = parseFloat(item.percentile);
      }
    }
  } catch {
    // Non-fatal
  }

  try {
    // 2. Fetch CVSS details from CIRCL API
    const circlRes = await fetchWithTimeout(`https://cve.circl.lu/api/cve/${cveId}`, 4000);
    if (circlRes.ok) {
      const circlData = await circlRes.json();
      if (circlData) {
        result.cvss = parseFloat(circlData.cvss) || null;

        if (result.cvss >= 9.0) result.severity = 'CRITICAL';
        else if (result.cvss >= 7.0) result.severity = 'HIGH';
        else if (result.cvss >= 4.0) result.severity = 'MEDIUM';
        else if (result.cvss > 0)    result.severity = 'LOW';
      }
    }
  } catch {
    // Non-fatal
  }

  // Cache in SQLite
  setCveCache(cveId, result);
  return result;
}

/**
 * Extract Indicators of Compromise (IOCs) from text.
 * @param {string} text
 * @returns {object} { ips, hashes, domains }
 */
function extractIOCs(text) {
  if (!text) return { ips: [], hashes: [], domains: [] };

  // IPv4 regex (handles clean IPs and defanged 192.0.2[.]1)
  const rawIps = text.match(/\b(?:\d{1,3}[.\[\(]{1,3}){3}\d{1,3}\b/g) || [];
  const cleanIps = rawIps
    .map((ip) => ip.replace(/[\[\(\]]/g, ''))
    .filter((ip) => {
      const parts = ip.split('.').map(Number);
      if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) return false;
      // Exclude private / local ranges
      if (parts[0] === 10 || parts[0] === 127 || parts[0] === 0) return false;
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return false;
      if (parts[0] === 192 && parts[1] === 168) return false;
      // Exclude common version strings like 2.4.1.0 or 1.0.0.0
      if (parts[3] === 0) return false;
      return true;
    });

  // Hashes (MD5: 32 hex, SHA1: 40 hex, SHA256: 64 hex)
  const sha256s = (text.match(/\b[a-fA-F0-9]{64}\b/g) || []);
  const md5s    = (text.match(/\b[a-fA-F0-9]{32}\b/g) || []);
  const sha1s   = (text.match(/\b[a-fA-F0-9]{40}\b/g) || []);

  const allHashes = [...new Set([...sha256s, ...md5s, ...sha1s])].slice(0, 5);

  // Defanged domains / URLs (e.g., bad-domain[.]com)
  const rawDomains = text.match(/\b[a-zA-Z0-9-]{2,63}\[\.\][a-zA-Z]{2,10}\b/gi) || [];
  const cleanDomains = [...new Set(rawDomains.map((d) => d.toLowerCase()))]
    .filter((d) => !WHITELISTED_DOMAINS.has(d.replace('[.]', '.')))
    .slice(0, 5);

  return {
    ips: [...new Set(cleanIps)].slice(0, 5),
    hashes: allHashes,
    domains: cleanDomains
  };
}

/**
 * Detect MITRE ATT&CK techniques in text.
 * @param {string} text
 * @returns {object[]} Array of { id, name }
 */
function detectMitreAttck(text) {
  if (!text) return [];
  const detected = [];
  for (const tech of MITRE_TECHNIQUES) {
    if (tech.pattern.test(text)) {
      detected.push({ id: tech.id, name: tech.name });
    }
  }
  return detected.slice(0, 4);
}

/**
 * Main enrichment entry point.
 * Combines CVE lookups, EPSS scoring, IOC parsing, and MITRE ATT&CK mapping.
 *
 * @param {object} article
 * @param {string} fullText
 * @returns {Promise<object|null>}
 */
async function enrichArticle(article, fullText = '') {
  const combinedText = `${article.title || ''} ${article.description || ''} ${fullText || ''}`;

  const cveIds = extractCVEs(combinedText);
  const iocs = extractIOCs(combinedText);
  const mitre = detectMitreAttck(combinedText);

  // If no threat intel triggers, return null
  if (cveIds.length === 0 && iocs.ips.length === 0 && iocs.hashes.length === 0 && iocs.domains.length === 0 && mitre.length === 0) {
    return null;
  }

  // Fetch CVE & EPSS scores and CISA KEV status for detected CVEs (max 3)
  const { checkCisaKev } = require('./cisa-kev');
  const cveDetails = await Promise.all(
    cveIds.slice(0, 3).map(async (id) => {
      const basic = await fetchCveAndEpss(id);
      const cisa = await checkCisaKev(id).catch(() => null);
      return {
        ...basic,
        cisaKev: cisa || null
      };
    })
  );

  return {
    cves: cveDetails,
    iocs,
    mitre
  };
}

// ── Helper ────────────────────────────────────────────────────────────────────
async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  extractCVEs,
  fetchCveAndEpss,
  extractIOCs,
  detectMitreAttck,
  enrichArticle
};
