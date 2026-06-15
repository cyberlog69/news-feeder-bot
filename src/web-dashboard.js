// src/web-dashboard.js
// A simple local web dashboard served on http://localhost:3000 (default).
//
// Shows:
//   - Bot status (running / stopped)
//   - Recent articles sent
//   - Source health
//   - Live log tail
//
// Uses Node.js built-in 'http' module — no Express dependency needed.
// Serves a single self-contained HTML page with auto-refresh every 30 seconds.

const http = require('http');
const fs   = require('fs');
const path = require('path');

const LOG_DIR = path.join(process.cwd(), 'data', 'logs');

function getLatestLog(lines = 100) {
  try {
    const d = new Date();
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const logPath = path.join(LOG_DIR, `bot-${dateStr}.log`);
    if (!fs.existsSync(logPath)) return [];
    const content = fs.readFileSync(logPath, 'utf-8');
    return content.trim().split('\n').slice(-lines).reverse();
  } catch {
    return [];
  }
}

function buildHtml(stats, recentArticles, logLines, startTime) {
  const uptime = Math.floor((Date.now() - startTime) / 1000);
  const uptimeStr = uptime < 60 ? `${uptime}s`
    : uptime < 3600 ? `${Math.floor(uptime / 60)}m ${uptime % 60}s`
    : `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`;

  const articleRows = recentArticles.map((a) => `
    <tr>
      <td>${escHtml(a.sentAt ? new Date(a.sentAt).toLocaleString('en-IN') : '')}</td>
      <td><a href="${escHtml(a.url)}" target="_blank" rel="noopener">${escHtml(a.title)}</a></td>
      <td>${escHtml(a.source)}</td>
    </tr>
  `).join('');

  const logHtml = logLines.map((l) => {
    let cls = 'log-info';
    if (l.includes('[ERROR]'))   cls = 'log-error';
    else if (l.includes('[WARN]')) cls = 'log-warn';
    else if (l.includes('[SUCCESS]')) cls = 'log-success';
    return `<div class="${cls}">${escHtml(l)}</div>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="30">
  <title>📰 News Feeder Bot — Dashboard</title>
  <style>
    :root {
      --bg: #0f0f13; --surface: #1a1a24; --border: #2d2d40;
      --text: #e0e0e0; --muted: #888; --green: #4ade80;
      --red: #f87171; --yellow: #fbbf24; --blue: #60a5fa;
      --accent: #818cf8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: var(--bg); color: var(--text); font-family: 'Segoe UI', system-ui, sans-serif; font-size: 14px; }
    header { background: var(--surface); border-bottom: 1px solid var(--border); padding: 16px 24px; display: flex; align-items: center; gap: 12px; }
    header h1 { font-size: 20px; color: var(--accent); }
    header .badge { background: var(--green); color: #000; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 99px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; padding: 24px; }
    .card { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 20px; }
    .card .label { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; }
    .card .value { font-size: 28px; font-weight: 700; color: var(--accent); }
    .card .sub   { font-size: 12px; color: var(--muted); margin-top: 4px; }
    section { padding: 0 24px 24px; }
    section h2 { font-size: 14px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; background: var(--surface); border-radius: 10px; overflow: hidden; }
    th, td { padding: 10px 14px; text-align: left; border-bottom: 1px solid var(--border); }
    th { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }
    td a { color: var(--blue); text-decoration: none; }
    td a:hover { text-decoration: underline; }
    .log-box { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 16px; max-height: 320px; overflow-y: auto; font-family: 'Cascadia Code', 'Consolas', monospace; font-size: 12px; line-height: 1.6; }
    .log-error   { color: var(--red); }
    .log-warn    { color: var(--yellow); }
    .log-success { color: var(--green); }
    .log-info    { color: var(--muted); }
    .refresh-note { text-align: center; color: var(--muted); font-size: 12px; padding: 16px; }
  </style>
</head>
<body>
  <header>
    <span style="font-size:28px">📰</span>
    <h1>News Feeder Bot</h1>
    <span class="badge">● LIVE</span>
    <span style="margin-left:auto;color:var(--muted);font-size:12px">Auto-refresh: 30s</span>
  </header>

  <div class="grid">
    <div class="card">
      <div class="label">Total Sent</div>
      <div class="value">${stats.totalSent}</div>
      <div class="sub">all-time articles delivered</div>
    </div>
    <div class="card">
      <div class="label">Uptime</div>
      <div class="value" style="font-size:20px">${uptimeStr}</div>
      <div class="sub">since last restart</div>
    </div>
    <div class="card">
      <div class="label">Last Check</div>
      <div class="value" style="font-size:16px">${new Date().toLocaleTimeString('en-IN')}</div>
      <div class="sub">dashboard rendered</div>
    </div>
  </div>

  <section>
    <h2>Recent Articles Sent</h2>
    <table>
      <thead><tr><th>Time</th><th>Title</th><th>Source</th></tr></thead>
      <tbody>${articleRows || '<tr><td colspan="3" style="color:var(--muted);text-align:center">No articles yet</td></tr>'}</tbody>
    </table>
  </section>

  <section>
    <h2>Live Log (today)</h2>
    <div class="log-box">${logHtml || '<div class="log-info">No logs yet</div>'}</div>
  </section>

  <p class="refresh-note">Page auto-refreshes every 30 seconds · <a href="/" style="color:var(--blue)">Refresh now</a></p>
</body>
</html>`;
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Start the web dashboard server.
 *
 * @param {object}   pipeline  — NewsPipeline instance (for stats + recent articles)
 * @param {number}   port      — Port to listen on (default 3000)
 * @param {number}   startTime — Bot start timestamp (Date.now())
 */
function startDashboard(pipeline, port = 3000, startTime = Date.now()) {
  const server = http.createServer((req, res) => {
    if (req.url !== '/' && req.url !== '/dashboard') {
      res.writeHead(301, { Location: '/' });
      res.end();
      return;
    }

    try {
      const stats          = pipeline.getStats();
      const recentArticles = pipeline.getRecentArticles(20);
      const logLines       = getLatestLog(80);
      const html           = buildHtml(stats, recentArticles, logLines, startTime);

      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store'
      });
      res.end(html);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Dashboard error: ' + err.message);
    }
  });

  server.listen(port, '127.0.0.1', () => {
    const logger = require('./logger');
    logger.success(`Web dashboard running at http://localhost:${port}`);
  });

  server.on('error', (err) => {
    const logger = require('./logger');
    if (err.code === 'EADDRINUSE') {
      logger.warn(`Dashboard port ${port} is already in use — dashboard skipped.`);
    } else {
      logger.warn(`Dashboard error: ${err.message}`);
    }
  });

  return server;
}

module.exports = { startDashboard };
