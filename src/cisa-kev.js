// src/cisa-kev.js
// CISA Known Exploited Vulnerabilities (KEV) Catalog Integration
// Identifies actively exploited CVEs and ransomware campaign associations.

const { getCisaKev, setCisaKev } = require('./db');
const logger = require('./logger');

const CISA_KEV_FEED_URL = 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json';

let lastSyncTimestamp = 0;
const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000; // Daily sync

/**
 * Sync the CISA KEV catalog into SQLite cache.
 */
async function syncCisaKevCatalog(force = false) {
  if (!force && Date.now() - lastSyncTimestamp < SYNC_INTERVAL_MS) {
    return;
  }

  logger.info('Syncing CISA Known Exploited Vulnerabilities (KEV) catalog…');
  try {
    const res = await fetchWithTimeout(CISA_KEV_FEED_URL, {
      headers: { 'User-Agent': 'NewsFeederBot/3.7 (+https://github.com/cyberlog69/news-feeder-bot)' }
    }, 15000);

    if (!res.ok) {
      logger.warn(`CISA KEV fetch failed: HTTP ${res.status}`);
      return;
    }

    const data = await res.json();
    const vulnerabilities = data?.vulnerabilities || [];
    let count = 0;

    for (const v of vulnerabilities) {
      if (v.cveID) {
        setCisaKev(v.cveID, {
          vendorProject: v.vendorProject,
          product: v.product,
          vulnerabilityName: v.vulnerabilityName,
          dateAdded: v.dateAdded,
          requiredAction: v.requiredAction,
          dueDate: v.dueDate,
          knownRansomwareUse: String(v.knownRansomwareCampaignUse || '').toLowerCase() === 'known'
        });
        count++;
      }
    }

    lastSyncTimestamp = Date.now();
    logger.success(`CISA KEV catalog synced: ${count} actively exploited CVEs cached`);
  } catch (err) {
    logger.warn(`CISA KEV sync error: ${err.message.split('\n')[0]}`);
  }
}

/**
 * Check if a CVE ID is in CISA's KEV catalog.
 * @param {string} cveId
 * @returns {Promise<object|null>}
 */
async function checkCisaKev(cveId) {
  if (!cveId) return null;
  const formattedId = cveId.toUpperCase().trim();

  // 1. Check local SQLite cache
  const cached = getCisaKev(formattedId);
  if (cached) {
    return {
      isKev: true,
      cveId: formattedId,
      ...cached
    };
  }

  return null;
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  syncCisaKevCatalog,
  checkCisaKev
};
