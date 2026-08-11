// src/report-generator.js
// Executive CISO Briefing & Threat Intelligence Report Generator
// Generates strategic Markdown and PDF-ready HTML reports summarizing recent critical incidents, CISA KEV zero-days, and ransomware trends.

const { initDb, getSeenArticles } = require('./db');
const logger = require('./logger');

/**
 * Generate an Executive CISO Threat Intelligence Briefing object.
 *
 * @param {number} [limit=15]
 * @returns {object}
 */
function generateCisoBriefing(limit = 15) {
  const db = initDb();

  // 1. Fetch recent articles
  const recentArticles = getSeenArticles(limit) || [];

  // 2. Fetch CISA KEV entries
  let cisaKevs = [];
  try {
    cisaKevs = db.prepare(`
      SELECT cve_id as cveId, vendor_project as vendor, product, vulnerability_name as name, date_added as dateAdded, required_action as action, known_ransomware_use as ransomwareUse
      FROM cisa_kev_cache
      ORDER BY date_added DESC
      LIMIT 10
    `).all();
  } catch {}

  // 3. Fetch Ransomware Victims
  let ransomwareVictims = [];
  try {
    ransomwareVictims = db.prepare(`
      SELECT group_name as groupName, victim_name as victimName, country, sector, discovered_at as discoveredAt
      FROM ransomware_victims
      ORDER BY discovered_at DESC
      LIMIT 10
    `).all();
  } catch {}

  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const strategicActionItems = [
    'Immediate Patching: Prioritize emergency patching for all CVEs actively tracked in CISA KEV catalog.',
    'Credential Hygiene: Enforce hardware MFA and review privileged service accounts for anomalous activity.',
    'Ransomware Defense: Validate immutable offline backups and isolate critical OT/database segments.',
    'Threat Hunting: Ingest extracted IOCs (IPs, hashes, domains) into SIEM/EDR detection rules.'
  ];

  return {
    title: 'Executive Cybersecurity & Threat Intelligence Briefing',
    date: dateStr,
    generatedAt: new Date().toISOString(),
    metrics: {
      totalArticlesProcessed: recentArticles.length,
      activeCisaKevZeroDays: cisaKevs.length,
      ransomwareDisclosures: ransomwareVictims.length
    },
    executiveSummary: `This executive briefing synthesizes threat intelligence across ${recentArticles.length} recent security events. Currently monitoring ${cisaKevs.length} actively exploited vulnerabilities in the CISA KEV catalog and ${ransomwareVictims.length} dark web ransomware disclosures across enterprise sectors.`,
    cisaKevWatchlist: cisaKevs,
    ransomwareActivity: ransomwareVictims,
    recentIncidents: recentArticles.slice(0, 8),
    strategicActionItems
  };
}

/**
 * Format executive briefing as clean Markdown.
 * @param {object} briefing
 * @returns {string}
 */
function formatBriefingMarkdown(briefing) {
  const lines = [
    `# 🏛️ ${briefing.title}`,
    `**Date:** ${briefing.date} | **Classification:** TLP:AMBER | **Audience:** CISO & Executive Leadership`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    '',
    `## 📊 Executive Overview`,
    briefing.executiveSummary,
    '',
    `* **Monitored Incidents:** ${briefing.metrics.totalArticlesProcessed}`,
    `* **Active CISA KEV Zero-Days:** ${briefing.metrics.activeCisaKevZeroDays}`,
    `* **Ransomware Disclosures:** ${briefing.metrics.ransomwareDisclosures}`,
    '',
    `---`,
    '',
    `## 🚨 CISA KEV Active Exploitation Watchlist`
  ];

  if (briefing.cisaKevWatchlist.length > 0) {
    lines.push(`| CVE ID | Vendor / Product | Vulnerability | Ransomware Flag |`);
    lines.push(`|---|---|---|---|`);
    briefing.cisaKevWatchlist.forEach((k) => {
      const rwBadge = k.ransomwareUse ? '🏴‍☠️ **YES**' : 'No';
      lines.push(`| **${k.cveId}** | ${k.vendor} (${k.product}) | ${k.name || 'Critical Flaw'} | ${rwBadge} |`);
    });
  } else {
    lines.push(`_No newly added CISA KEV vulnerabilities in the current reporting window._`);
  }

  lines.push('', `---`, '', `## 🏴‍☠️ Ransomware Dark Web Intelligence`);
  if (briefing.ransomwareActivity.length > 0) {
    lines.push(`| Gang | Victim Organization | Sector | Country |`);
    lines.push(`|---|---|---|---|`);
    briefing.ransomwareActivity.forEach((r) => {
      lines.push(`| **${r.groupName}** | ${r.victimName} | ${r.sector || 'Commercial'} | ${r.country || 'Global'} |`);
    });
  } else {
    lines.push(`_No new ransomware victim disclosures recorded in this cycle._`);
  }

  lines.push('', `---`, '', `## 📋 Strategic CISO Action Items`);
  briefing.strategicActionItems.forEach((action, i) => {
    lines.push(`${i + 1}. **${action.split(':')[0]}:** ${action.split(':').slice(1).join(':').trim()}`);
  });

  lines.push('', `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, `_Generated automatically by News Feeder Bot SOC Intelligence Engine._`);
  return lines.join('\n');
}

/**
 * Format executive briefing as print/PDF-ready HTML.
 * @param {object} briefing
 * @returns {string}
 */
function formatBriefingHtml(briefing) {
  const md = formatBriefingMarkdown(briefing);

  const kevRows = briefing.cisaKevWatchlist.map((k) => `
    <tr>
      <td style="font-weight:700;color:#dc2626">${k.cveId}</td>
      <td>${k.vendor} (${k.product})</td>
      <td>${k.name || 'Critical Flaw'}</td>
      <td>${k.ransomwareUse ? '<span class="badge badge-rw">🏴‍☠️ Known Use</span>' : 'Standard'}</td>
    </tr>
  `).join('');

  const rwRows = briefing.ransomwareActivity.map((r) => `
    <tr>
      <td style="font-weight:700;color:#7c3aed">${r.groupName}</td>
      <td>${r.victimName}</td>
      <td>${r.sector || 'Enterprise'}</td>
      <td>${r.country || 'Global'}</td>
    </tr>
  `).join('');

  const actionList = briefing.strategicActionItems.map((a) => `
    <li style="margin-bottom:8px"><strong>${a.split(':')[0]}:</strong> ${a.split(':').slice(1).join(':')}</li>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${briefing.title}</title>
  <style>
    body { font-family: 'Segoe UI', -apple-system, system-ui, sans-serif; line-height: 1.6; color: #1e293b; background: #f8fafc; padding: 40px; }
    .report-card { max-width: 900px; margin: 0 auto; background: #ffffff; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); padding: 40px; border: 1px solid #e2e8f0; }
    h1 { color: #0f172a; margin-top: 0; font-size: 24px; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; }
    h2 { color: #1e293b; font-size: 18px; margin-top: 28px; margin-bottom: 12px; }
    .meta { font-size: 13px; color: #64748b; margin-bottom: 24px; }
    .badge { display: inline-block; padding: 3px 8px; border-radius: 99px; font-size: 11px; font-weight: 700; }
    .badge-rw { background: #fee2e2; color: #991b1b; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 13px; }
    th, td { text-align: left; padding: 10px; border-bottom: 1px solid #e2e8f0; }
    th { background: #f1f5f9; color: #475569; font-weight: 600; }
    .summary-box { background: #f0fdf4; border-left: 4px solid #16a34a; padding: 16px; border-radius: 4px; font-size: 14px; margin: 20px 0; }
    @media print {
      body { background: #fff; padding: 0; }
      .report-card { border: none; box-shadow: none; padding: 0; }
    }
  </style>
</head>
<body>
  <div class="report-card">
    <h1>🏛️ ${briefing.title}</h1>
    <div class="meta">
      <strong>Date:</strong> ${briefing.date} &nbsp;|&nbsp; <strong>Classification:</strong> TLP:AMBER &nbsp;|&nbsp; <strong>Generated by:</strong> News Feeder Bot SOC Intelligence
    </div>

    <div class="summary-box">
      <strong>Executive Overview:</strong> ${briefing.executiveSummary}
    </div>

    <h2>🚨 CISA KEV Active Exploitation Watchlist</h2>
    <table>
      <thead><tr><th>CVE ID</th><th>Product</th><th>Vulnerability</th><th>Ransomware Flag</th></tr></thead>
      <tbody>${kevRows || '<tr><td colspan="4">No active KEV records</td></tr>'}</tbody>
    </table>

    <h2>🏴‍☠️ Ransomware Dark Web Intelligence</h2>
    <table>
      <thead><tr><th>Gang</th><th>Victim Organization</th><th>Sector</th><th>Country</th></tr></thead>
      <tbody>${rwRows || '<tr><td colspan="4">No active disclosures</td></tr>'}</tbody>
    </table>

    <h2>📋 Strategic CISO Action Items</h2>
    <ul>${actionList}</ul>
  </div>
</body>
</html>`;
}

module.exports = {
  generateCisoBriefing,
  formatBriefingMarkdown,
  formatBriefingHtml
};
