// src/ransomware-tracker.js
// Dark Web Ransomware Gang & Victim Tracker
// Ingests real-time victim disclosures from ransomware gang leak sites.

const { isRansomwareVictimSeen, markRansomwareVictimSeen } = require('./db');
const logger = require('./logger');

const RANSOMWARE_FEED_API = 'https://raw.githubusercontent.com/joshhighet/ransomwatch/main/posts.json';

/**
 * Fetch recent ransomware leak announcements from dark web tracker.
 * @returns {Promise<Array<object>>}
 */
async function fetchRansomwareVictims(limit = 10) {
  try {
    const res = await fetchWithTimeout(RANSOMWARE_FEED_API, {
      headers: { 'User-Agent': 'NewsFeederBot/3.7 (+https://github.com/cyberlog69/news-feeder-bot)' }
    }, 10000);

    if (!res.ok) return [];

    const data = await res.json();
    if (!Array.isArray(data)) return [];

    const unseenVictims = [];

    for (const post of data.slice(0, 50)) {
      const groupName  = post.group_name || 'Unknown Group';
      const victimName = post.post_title || 'Undisclosed Victim';
      const discoveredAt = post.discovered || new Date().toISOString();
      const victimId   = `${groupName}_${victimName}`.toLowerCase().replace(/[^a-z0-9_]/g, '_');

      if (!isRansomwareVictimSeen(victimId)) {
        unseenVictims.push({
          victimId,
          groupName,
          victimName,
          country: post.country || 'Global',
          sector: post.activity || 'Enterprise',
          discoveredAt,
          description: post.description || ''
        });

        if (unseenVictims.length >= limit) break;
      }
    }

    return unseenVictims;
  } catch (err) {
    logger.warn(`Ransomware tracker fetch failed: ${err.message.split('\n')[0]}`);
    return [];
  }
}

/**
 * Format a dark web ransomware victim alert for messaging platforms.
 * @param {object} victim
 * @returns {string} Formatted text
 */
function formatRansomwareAlert(victim) {
  const gangEmoji = getGangBadge(victim.groupName);
  const discovered = new Date(victim.discoveredAt).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  });

  return [
    `🏴‍☠️ *RANSOMWARE LEAK ALERT*`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `${gangEmoji} *Ransomware Group:* ${victim.groupName.toUpperCase()}`,
    `🎯 *Target Victim:* ${victim.victimName}`,
    `🌍 *Country:* ${victim.country}  •  💼 *Sector:* ${victim.sector}`,
    `📅 *Disclosed:* ${discovered}`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `⚠️ *Threat Notice:* The threat group has published data or extortion demands regarding this organization on their dark web leak portal.`
  ].join('\n');
}

function getGangBadge(groupName) {
  const g = String(groupName || '').toLowerCase();
  if (g.includes('lockbit'))   return '🔒 [LockBit]';
  if (g.includes('ransomhub')) return '🐙 [RansomHub]';
  if (g.includes('blackcat') || g.includes('alphv')) return '🐈 [BlackCat/ALPHV]';
  if (g.includes('akira'))     return '⚡ [Akira]';
  if (g.includes('play'))      return '🎮 [Play]';
  if (g.includes('qilin'))     return '🐲 [Qilin]';
  return '☠️ [Gang]';
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
  fetchRansomwareVictims,
  formatRansomwareAlert
};
