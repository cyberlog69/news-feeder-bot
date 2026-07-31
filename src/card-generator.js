// src/card-generator.js
// Dynamic Visual Alert Card Generator
// Generates SVG social alert graphics for critical cybersecurity news.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const logger = require('./logger');

const CARD_DIR = path.join(process.cwd(), 'data', 'cards');

function ensureCardDir() {
  if (!fs.existsSync(CARD_DIR)) {
    fs.mkdirSync(CARD_DIR, { recursive: true });
  }
}

function escapeXml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generate a visual SVG Alert Card graphic.
 *
 * @param {object} article
 * @param {boolean} isCritical
 * @param {object|null} threatIntel
 * @returns {{ cardPath: string, svgString: string }}
 */
function generateAlertCard(article, isCritical = false, threatIntel = null) {
  ensureCardDir();

  const title = escapeXml(article.title || 'Security News Alert');
  const source = escapeXml(article.source || 'News Feeder');
  const category = escapeXml(article.category || 'Security');
  const dateStr = new Date(article.publishedAt || Date.now()).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  });

  const headerBg = isCritical ? '#dc2626' : '#2563eb';
  const headerText = isCritical ? '🚨 CRITICAL SECURITY ALERT' : '📰 NEWS FEEDER BOT';

  let cveBadge = '';
  if (threatIntel && threatIntel.cves && threatIntel.cves.length > 0) {
    const primaryCve = threatIntel.cves[0];
    const scoreStr = primaryCve.cvss ? `CVSS ${primaryCve.cvss}` : '';
    const epssStr = primaryCve.epss ? `EPSS ${Math.round(primaryCve.epss * 100)}%` : '';
    cveBadge = escapeXml(`${primaryCve.cveId}  ${scoreStr}  ${epssStr}`.trim());
  }

  const hash = crypto.createHash('sha256').update(`${title}_${headerBg}`).digest('hex').slice(0, 16);
  const cardPath = path.join(CARD_DIR, `card_${hash}.svg`);

  const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="420" viewBox="0 0 800 420">
  <rect width="800" height="420" fill="#0f172a" rx="16"/>
  <rect width="800" height="80" fill="${headerBg}" rx="16 16 0 0"/>
  <text x="32" y="50" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="24" font-weight="bold" fill="#ffffff">${headerText}</text>
  
  <rect x="32" y="105" width="auto" height="28" fill="#1e293b" rx="6"/>
  <text x="44" y="124" font-family="Segoe UI,sans-serif" font-size="13" font-weight="600" fill="#94a3b8">${source} • ${category}</text>
  
  <text x="32" y="175" font-family="Segoe UI,sans-serif" font-size="22" font-weight="bold" fill="#f8fafc" width="736">
    <tspan x="32" dy="0">${title.slice(0, 50)}</tspan>
    <tspan x="32" dy="32">${title.slice(50, 105)}</tspan>
  </text>
  
  ${cveBadge ? `
  <rect x="32" y="270" width="400" height="44" fill="#7f1d1d" rx="8" stroke="#ef4444" stroke-width="1.5"/>
  <text x="48" y="298" font-family="Consolas,monospace" font-size="15" font-weight="bold" fill="#fca5a5">🛡️ ${cveBadge}</text>
  ` : ''}
  
  <line x1="32" y1="360" x2="768" y2="360" stroke="#334155" stroke-width="1"/>
  <text x="32" y="390" font-family="Segoe UI,sans-serif" font-size="13" fill="#64748b">News Feeder Bot • ${dateStr}</text>
</svg>`;

  fs.writeFileSync(cardPath, svgString, 'utf-8');
  logger.info(`Generated Alert Card SVG: ${path.basename(cardPath)}`);

  return { cardPath, svgString };
}

module.exports = {
  generateAlertCard
};
