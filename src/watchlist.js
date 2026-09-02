// src/watchlist.js
// Organization Tech Stack Watchlist & Priority Targeting Engine
// Monitors articles and security advisories for matching organization technologies.

const { getWatchlist, addWatchlistKeyword, removeWatchlistKeyword } = require('./db');
const logger = require('./logger');

// ── Default enterprise technology seeds if watchlist is empty ─────────────────
const DEFAULT_TECH_SEEDS = [
  { keyword: 'cisco',       category: 'Networking' },
  { keyword: 'fortinet',    category: 'Firewall/VPN' },
  { keyword: 'citrix',      category: 'Remote Access' },
  { keyword: 'ivanti',      category: 'VPN/Gateway' },
  { keyword: 'vmware',      category: 'Virtualization' },
  { keyword: 'palo alto',   category: 'Firewall' },
  { keyword: 'nginx',       category: 'Web Server' },
  { keyword: 'kubernetes',  category: 'Cloud/Containers' },
  { keyword: 'aws',         category: 'Cloud Infrastructure' },
  { keyword: 'windows',     category: 'Operating System' },
  { keyword: 'linux',       category: 'Operating System' }
];

let seeded = false;

function ensureWatchlistSeeded() {
  if (seeded) return;
  try {
    const current = getWatchlist();
    if (current.length === 0) {
      for (const item of DEFAULT_TECH_SEEDS) {
        addWatchlistKeyword(item.keyword, item.category, 'system');
      }
      logger.info(`[Watchlist] Initialized default technology watchlist with ${DEFAULT_TECH_SEEDS.length} enterprise vendors.`);
    }
    seeded = true;
  } catch {}
}

/**
 * Match article text against the organization's tech stack watchlist.
 * @param {string} text - Title and content to evaluate
 * @returns {object} - { matched: boolean, matches: Array<{ keyword, category }> }
 */
function matchTechWatchlist(text = '') {
  ensureWatchlistSeeded();
  if (!text) return { matched: false, matches: [] };

  const lower = String(text).toLowerCase();
  const watchlist = getWatchlist();
  const matches = [];

  for (const item of watchlist) {
    const escaped = item.keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'i');
    if (regex.test(lower)) {
      matches.push({ keyword: item.keyword, category: item.category });
    }
  }

  return {
    matched: matches.length > 0,
    matches
  };
}

/**
 * Add a technology to the organization watchlist.
 * @param {string} keyword
 * @param {string} category
 * @param {string} addedBy
 */
function addTechnology(keyword, category = 'General', addedBy = 'admin') {
  ensureWatchlistSeeded();
  addWatchlistKeyword(keyword, category, addedBy);
}

/**
 * Remove a technology from the watchlist.
 * @param {string} keyword
 */
function removeTechnology(keyword) {
  ensureWatchlistSeeded();
  removeWatchlistKeyword(keyword);
}

/**
 * Retrieve all currently monitored technologies.
 * @returns {Array<object>}
 */
function getMonitoredTechnologies() {
  ensureWatchlistSeeded();
  return getWatchlist();
}

module.exports = {
  matchTechWatchlist,
  addTechnology,
  removeTechnology,
  getMonitoredTechnologies
};
