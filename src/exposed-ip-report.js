// src/exposed-ip-report.js
// Generates professional, executive-ready CISO / SOC Threat Intelligence Reports
// for Exposed IP & WAN Perimeter data:
//   1. Printable HTML / PDF view with dedicated print styling and auto-print trigger
//   2. Microsoft Word Document (.doc) export with styled tables and metadata headers

'use strict';

function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getRiskColor(score) {
  if (score >= 8) return '#dc2626'; // Red
  if (score >= 5) return '#ea580c'; // Orange
  if (score >= 3) return '#ca8a04'; // Yellow
  return '#16a34a'; // Green
}

function getRiskLabel(score) {
  if (score >= 8) return 'CRITICAL';
  if (score >= 5) return 'HIGH';
  if (score >= 3) return 'MEDIUM';
  return 'LOW';
}

/**
 * Generate a standalone printable HTML page optimized for browser printing & saving as PDF.
 * @param {object[]} records
 * @param {object} stats
 * @param {object} options - { month, countryCode, sortBy }
 * @returns {string} HTML document
 */
function generatePrintableHtml(records = [], stats = {}, options = {}) {
  const generatedAt = new Date().toLocaleString('en-IN', {
    dateStyle: 'full',
    timeStyle: 'medium'
  });
  const monthLabel = options.month ? `Month: ${options.month}` : 'All Recorded Months';
  const scopeLabel = options.countryCode ? `Scope: ${options.countryCode} (India)` : 'Scope: Global Intelligence';
  const sortLabel = options.sortBy ? `Sort: ${options.sortBy}` : 'Sort: Risk (High to Low)';

  const rowsHtml = records.map((r, i) => {
    const riskCol = getRiskColor(r.riskScore || 0);
    const riskBadge = `<span style="background:${riskCol};color:#fff;padding:2px 6px;border-radius:3px;font-size:10px;font-weight:bold;">${getRiskLabel(r.riskScore)} ${(r.riskScore || 0).toFixed(1)}</span>`;
    const services = (r.services || []).join(', ') || '—';
    const cves = (r.cves || []).join(', ') || 'None';
    const tags = (r.tags || []).join(', ') || '—';
    const lastSeen = r.lastSeen ? new Date(r.lastSeen).toLocaleDateString('en-IN') : '—';
    const firstSeen = r.firstSeen ? new Date(r.firstSeen).toLocaleDateString('en-IN') : '—';

    return `
      <tr style="background:${i % 2 === 0 ? '#ffffff' : '#f8fafc'}">
        <td style="text-align:center;padding:8px 6px;border:1px solid #cbd5e1;">${riskBadge}</td>
        <td style="padding:8px 6px;border:1px solid #cbd5e1;font-family:monospace;font-size:12px;font-weight:bold;color:#1e40af;">${esc(r.ip)}</td>
        <td style="padding:8px 6px;border:1px solid #cbd5e1;">${esc(r.country || r.countryCode || '—')}${r.city ? `<br><small style="color:#64748b">${esc(r.city)}</small>` : ''}</td>
        <td style="padding:8px 6px;border:1px solid #cbd5e1;font-size:11px;color:#334155;">${esc(r.org || '—')}</td>
        <td style="padding:8px 6px;border:1px solid #cbd5e1;font-size:11px;">${esc(services)}</td>
        <td style="padding:8px 6px;border:1px solid #cbd5e1;font-size:11px;color:${r.cves && r.cves.length ? '#dc2626' : '#64748b'};">${esc(cves)}</td>
        <td style="padding:8px 6px;border:1px solid #cbd5e1;font-size:11px;"><b>${esc(r.gnClass || 'unknown')}</b>${r.isNoise ? ' <small style="color:#64748b">(noise)</small>' : ''}</td>
        <td style="padding:8px 6px;border:1px solid #cbd5e1;font-size:11px;white-space:nowrap;">${lastSeen}</td>
      </tr>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Exposed IP & WAN Intelligence Report — ${esc(options.month || 'All')}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 10mm 15mm 10mm;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #f1f5f9;
      margin: 0;
      padding: 20px;
    }
    .container {
      max-width: 1100px;
      margin: 0 auto;
      background: #ffffff;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
    }
    .no-print {
      margin-bottom: 20px;
      display: flex;
      gap: 10px;
      align-items: center;
      justify-content: flex-end;
    }
    .btn {
      background: #1e293b;
      color: #ffffff;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .btn-print { background: #2563eb; }
    .btn-doc { background: #16a34a; }
    .header {
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 16px;
      margin-bottom: 20px;
    }
    .title {
      font-size: 24px;
      font-weight: 800;
      color: #0f172a;
      margin: 0 0 6px 0;
    }
    .subtitle {
      font-size: 13px;
      color: #64748b;
      margin: 0;
    }
    .meta-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      font-size: 12px;
      color: #475569;
      background: #f8fafc;
      padding: 10px 14px;
      border-radius: 6px;
      margin-top: 12px;
      border: 1px solid #e2e8f0;
    }
    .kpi-row {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 24px;
    }
    .kpi-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 12px;
      text-align: center;
    }
    .kpi-label { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; }
    .kpi-value { font-size: 22px; font-weight: 800; margin: 4px 0; }
    .kpi-sub { font-size: 10px; color: #94a3b8; }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
      margin-bottom: 20px;
    }
    th {
      background: #1e293b;
      color: #ffffff;
      padding: 8px 6px;
      text-align: left;
      font-weight: 600;
      border: 1px solid #334155;
    }
    tr { page-break-inside: avoid; }
    .footer {
      border-top: 1px solid #e2e8f0;
      padding-top: 14px;
      font-size: 11px;
      color: #94a3b8;
      display: flex;
      justify-content: space-between;
    }
    @media print {
      body { background: #ffffff; padding: 0; }
      .container { box-shadow: none; padding: 0; max-width: 100%; }
      .no-print { display: none !important; }
      th { background: #1e293b !important; color: #ffffff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="no-print">
      <button class="btn btn-print" onclick="window.print()">🖨️ Print / Save as PDF</button>
      <a class="btn btn-doc" href="/api/exposed-ips/export?format=doc${options.month ? '&month=' + encodeURIComponent(options.month) : ''}${options.countryCode ? '&country=' + encodeURIComponent(options.countryCode) : ''}">📄 Export as Word (.doc)</a>
      <a class="btn" href="/">⬅ Back to Dashboard</a>
    </div>

    <div class="header">
      <h1 class="title">🌐 Exposed IP &amp; WAN Perimeter Intelligence Report</h1>
      <p class="subtitle">Threat Ingestion &amp; Attack Surface Monitoring — News Feeder Bot SOC Intelligence</p>
      <div class="meta-bar">
        <span><b>Generated:</b> ${esc(generatedAt)}</span>
        <span><b>${esc(scopeLabel)}</b></span>
        <span><b>${esc(monthLabel)}</b></span>
        <span><b>${esc(sortLabel)}</b></span>
        <span><b>Records:</b> ${records.length} hosts</span>
      </div>
    </div>

    <div class="kpi-row">
      <div class="kpi-card">
        <div class="kpi-label">Total Indexed</div>
        <div class="kpi-value" style="color:#0284c7">${records.length}</div>
        <div class="kpi-sub">in current selection</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Malicious Hosts</div>
        <div class="kpi-value" style="color:#dc2626">${stats.malicious || 0}</div>
        <div class="kpi-sub">GreyNoise classification</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Mass Scanners</div>
        <div class="kpi-value" style="color:#ca8a04">${stats.noisy || 0}</div>
        <div class="kpi-sub">internet noise sources</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">High Risk (≥ 7.0)</div>
        <div class="kpi-value" style="color:#ea580c">${stats.highRisk || 0}</div>
        <div class="kpi-sub">RDP/SMB/CVE exposed</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width:75px;text-align:center;">Risk Score</th>
          <th style="width:110px;">IP Address</th>
          <th style="width:110px;">Country / City</th>
          <th style="width:140px;">Org / ASN</th>
          <th>Open Services</th>
          <th style="width:120px;">Known CVEs</th>
          <th style="width:90px;">Class</th>
          <th style="width:80px;">Last Seen</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml || '<tr><td colspan="8" style="text-align:center;padding:20px;color:#64748b">No exposed IPs found for the selected criteria.</td></tr>'}
      </tbody>
    </table>

    <div class="footer">
      <span>Intelligence Sources: Shodan InternetDB, GreyNoise Community, Shadowserver Foundation.</span>
      <span>Automated Report — News Feeder Bot</span>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Generate a Microsoft Word Document (.doc) compatible HTML document with Word XML metadata.
 * @param {object[]} records
 * @param {object} stats
 * @param {object} options
 * @returns {string} Word Document string
 */
function generateWordDoc(records = [], stats = {}, options = {}) {
  const generatedAt = new Date().toLocaleString('en-IN', {
    dateStyle: 'full',
    timeStyle: 'medium'
  });
  const monthLabel = options.month ? `Month: ${options.month}` : 'All Recorded Months';
  const scopeLabel = options.countryCode ? `Scope: ${options.countryCode} (India)` : 'Scope: Global Intelligence';

  const rowsHtml = records.map((r, i) => {
    const riskCol = getRiskColor(r.riskScore || 0);
    const services = (r.services || []).join(', ') || '—';
    const cves = (r.cves || []).join(', ') || 'None';
    const lastSeen = r.lastSeen ? new Date(r.lastSeen).toLocaleDateString('en-IN') : '—';

    return `
      <tr style="background-color:${i % 2 === 0 ? '#FFFFFF' : '#F8FAFC'};">
        <td style="padding:6pt;border:1pt solid #CBD5E1;text-align:center;">
          <b style="color:${riskCol};">${getRiskLabel(r.riskScore)} ${(r.riskScore || 0).toFixed(1)}</b>
        </td>
        <td style="padding:6pt;border:1pt solid #CBD5E1;font-family:'Courier New',monospace;font-weight:bold;color:#1E40AF;">
          ${esc(r.ip)}
        </td>
        <td style="padding:6pt;border:1pt solid #CBD5E1;">
          ${esc(r.country || r.countryCode || '—')} ${r.city ? `(${esc(r.city)})` : ''}
        </td>
        <td style="padding:6pt;border:1pt solid #CBD5E1;font-size:9pt;">
          ${esc(r.org || '—')}
        </td>
        <td style="padding:6pt;border:1pt solid #CBD5E1;font-size:9pt;">
          ${esc(services)}
        </td>
        <td style="padding:6pt;border:1pt solid #CBD5E1;font-size:9pt;color:${r.cves && r.cves.length ? '#DC2626' : '#64748B'};">
          ${esc(cves)}
        </td>
        <td style="padding:6pt;border:1pt solid #CBD5E1;font-size:9pt;">
          ${esc(r.gnClass || 'unknown')}
        </td>
        <td style="padding:6pt;border:1pt solid #CBD5E1;font-size:9pt;white-space:nowrap;">
          ${lastSeen}
        </td>
      </tr>
    `;
  }).join('');

  return `
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset='utf-8'>
  <title>Exposed IP & WAN Intelligence Report</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
      <w:DoNotOptimizeForBrowser/>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    body {
      font-family: 'Calibri', 'Segoe UI', Arial, sans-serif;
      font-size: 10.5pt;
      color: #0F172A;
      margin: 1in;
    }
    h1 {
      color: #0F172A;
      font-size: 18pt;
      margin-bottom: 2pt;
    }
    .subtitle {
      color: #64748B;
      font-size: 11pt;
      margin-top: 0;
      margin-bottom: 12pt;
    }
    .kpi-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16pt;
    }
    .kpi-table td {
      border: 1pt solid #E2E8F0;
      background-color: #F8FAFC;
      padding: 8pt;
      text-align: center;
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 14pt;
    }
    .data-table th {
      background-color: #1E293B;
      color: #FFFFFF;
      padding: 6pt;
      font-size: 9.5pt;
      border: 1pt solid #334155;
      text-align: left;
    }
    .data-table td {
      padding: 5pt;
      border: 1pt solid #CBD5E1;
      font-size: 9.5pt;
    }
  </style>
</head>
<body>
  <h1>🌐 Cyber Threat Intelligence — Exposed IP &amp; WAN Perimeter Report</h1>
  <p class="subtitle">Official Attack Surface &amp; Infrastructure Risk Assessment</p>

  <p style="font-size:10pt;color:#475569;margin-bottom:14pt;">
    <b>Report Date:</b> ${esc(generatedAt)} &nbsp;|&nbsp;
    <b>${esc(scopeLabel)}</b> &nbsp;|&nbsp;
    <b>${esc(monthLabel)}</b> &nbsp;|&nbsp;
    <b>Inventory Size:</b> ${records.length} hosts
  </p>

  <table class="kpi-table">
    <tr>
      <td><b>Total Hosts</b><br><span style="font-size:16pt;color:#0284C7;font-weight:bold;">${records.length}</span></td>
      <td><b>Malicious Hosts</b><br><span style="font-size:16pt;color:#DC2626;font-weight:bold;">${stats.malicious || 0}</span></td>
      <td><b>Mass Scanners</b><br><span style="font-size:16pt;color:#CA8A04;font-weight:bold;">${stats.noisy || 0}</span></td>
      <td><b>High Risk (&ge; 7.0)</b><br><span style="font-size:16pt;color:#EA580C;font-weight:bold;">${stats.highRisk || 0}</span></td>
    </tr>
  </table>

  <h2>Detailed Exposed Host Inventory</h2>
  <table class="data-table">
    <thead>
      <tr>
        <th style="width:10%;">Risk</th>
        <th style="width:14%;">IP Address</th>
        <th style="width:14%;">Country / City</th>
        <th style="width:16%;">Org / ASN</th>
        <th style="width:16%;">Open Services</th>
        <th style="width:12%;">Known CVEs</th>
        <th style="width:9%;">Class</th>
        <th style="width:9%;">Last Seen</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml || '<tr><td colspan="8">No records match the filter criteria.</td></tr>'}
    </tbody>
  </table>

  <br>
  <p style="font-size:9pt;color:#94A3B8;border-top:1pt solid #E2E8F0;padding-top:8pt;">
    Intelligence verified via Shodan InternetDB, GreyNoise Community, and Shadowserver Foundation feeds.<br>
    Confidential &amp; Proprietary Security Assessment.
  </p>
</body>
</html>
  `.trim();
}

module.exports = {
  generatePrintableHtml,
  generateWordDoc
};
