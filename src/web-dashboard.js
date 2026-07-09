// src/web-dashboard.js
// Local web dashboard + cloud health check endpoint.
//
// Routes:
//   GET  /          — Full HTML dashboard (auto-refresh 30s)
//   GET  /health    — JSON health check (used by Railway/Render/Fly.io/Docker)
//   GET  /metrics   — JSON detailed metrics
//   POST /trigger   — Manually trigger a pipeline run (requires DASHBOARD_TOKEN)
//   GET  /api/articles — JSON list of recent articles (optional token auth)
//
// Listens on:
//   process.env.PORT (set by cloud platforms) || config.settings.dashboardPort || 3000
// Binds to:
//   0.0.0.0 in production (NODE_ENV=production) so cloud platforms can reach it
//   127.0.0.1 in development (localhost only)

const http = require('http');
const fs   = require('fs');
const path = require('path');

const LOG_DIR   = path.join(process.cwd(), 'data', 'logs');
const IS_PROD   = process.env.NODE_ENV === 'production';

// ── Auth token for /trigger (optional — open if not set) ─────────────────────
const DASHBOARD_TOKEN = (process.env.DASHBOARD_TOKEN || '').trim();

function getLatestLog(lines = 100) {
  try {
    const d       = new Date();
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const logPath = path.join(LOG_DIR, `bot-${dateStr}.log`);
    if (!fs.existsSync(logPath)) return [];
    return fs.readFileSync(logPath, 'utf-8').trim().split('\n').slice(-lines).reverse();
  } catch { return []; }
}

// Read version from package.json (falls back to '3.x')
function getVersion() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8'));
    return pkg.version || '3.x';
  } catch { return '3.x'; }
}

function buildHtml(stats, recentArticles, logLines, startTime) {
  const uptime    = Math.floor((Date.now() - startTime) / 1000);
  const uptimeStr = uptime < 60   ? `${uptime}s`
    : uptime < 3600 ? `${Math.floor(uptime / 60)}m ${uptime % 60}s`
    : `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`;

  const version = getVersion();

  const articleRows = recentArticles.map((a) => `
    <tr>
      <td>${escHtml(a.sentAt ? new Date(a.sentAt).toLocaleString('en-IN') : '')}</td>
      <td><a href="${escHtml(a.url)}" target="_blank" rel="noopener noreferrer">${escHtml(a.title)}</a></td>
      <td>${escHtml(a.source)}</td>
    </tr>`).join('');

  const logHtml = logLines.map((l) => {
    let cls = 'log-info';
    if (l.includes('[ERROR]'))   cls = 'log-error';
    else if (l.includes('[WARN]'))    cls = 'log-warn';
    else if (l.includes('[SUCCESS]')) cls = 'log-success';
    return `<div class="${cls}">${escHtml(l)}</div>`;
  }).join('');

  // Token field shown only if DASHBOARD_TOKEN is configured
  const tokenField = DASHBOARD_TOKEN
    ? `<input type="password" id="triggerToken" placeholder="Dashboard token" style="padding:8px 12px;border-radius:6px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:13px;width:180px;">`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="refresh" content="30">
  <title>📰 News Feeder Bot — Dashboard</title>
  <style>
    :root{--bg:#0f0f13;--surface:#1a1a24;--border:#2d2d40;--text:#e0e0e0;--muted:#888;
      --green:#4ade80;--red:#f87171;--yellow:#fbbf24;--blue:#60a5fa;--accent:#818cf8;--orange:#fb923c}
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:var(--bg);color:var(--text);font-family:'Segoe UI',system-ui,sans-serif;font-size:14px}
    header{background:var(--surface);border-bottom:1px solid var(--border);padding:16px 24px;display:flex;align-items:center;gap:12px;flex-wrap:wrap}
    header h1{font-size:20px;color:var(--accent)}
    .badge{background:var(--green);color:#000;font-size:11px;font-weight:700;padding:3px 8px;border-radius:99px}
    .badge.prod{background:var(--blue)}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;padding:24px}
    .card{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:20px}
    .card .label{color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px}
    .card .value{font-size:28px;font-weight:700;color:var(--accent)}
    .card .sub{font-size:12px;color:var(--muted);margin-top:4px}
    section{padding:0 24px 24px}
    section h2{font-size:14px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px}
    table{width:100%;border-collapse:collapse;background:var(--surface);border-radius:10px;overflow:hidden}
    th,td{padding:10px 14px;text-align:left;border-bottom:1px solid var(--border)}
    th{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em}
    td a{color:var(--blue);text-decoration:none}
    td a:hover{text-decoration:underline}
    .log-box{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:16px;max-height:320px;overflow-y:auto;font-family:'Cascadia Code','Consolas',monospace;font-size:12px;line-height:1.6}
    .log-error{color:var(--red)}.log-warn{color:var(--yellow)}.log-success{color:var(--green)}.log-info{color:var(--muted)}
    .toolbar{padding:0 24px 16px;display:flex;gap:12px;flex-wrap:wrap;align-items:center}
    .toolbar a,.btn{color:var(--blue);font-size:12px;text-decoration:none;background:var(--surface);border:1px solid var(--border);padding:7px 14px;border-radius:6px;cursor:pointer;font-family:inherit}
    .toolbar a:hover,.btn:hover{border-color:var(--accent)}
    .btn-run{background:var(--accent);color:#fff;border-color:var(--accent);font-weight:600}
    .btn-run:hover{background:#6d6dda;border-color:#6d6dda}
    .btn-run:disabled{opacity:.5;cursor:not-allowed}
    #triggerStatus{font-size:12px;padding:7px 12px;border-radius:6px;display:none;font-weight:600}
    #triggerStatus.ok{background:#14532d;color:var(--green);border:1px solid var(--green)}
    #triggerStatus.err{background:#450a0a;color:var(--red);border:1px solid var(--red)}
    #triggerStatus.running{background:#1e1b4b;color:var(--accent);border:1px solid var(--accent)}
    .refresh-note{text-align:center;color:var(--muted);font-size:12px;padding:16px}
  </style>
</head>
<body>
  <header>
    <span style="font-size:28px">📰</span>
    <h1>News Feeder Bot v${escHtml(version)}</h1>
    <span class="badge ${IS_PROD ? 'prod' : ''}">● ${IS_PROD ? 'PRODUCTION' : 'LOCAL'}</span>
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
      <div class="label">Environment</div>
      <div class="value" style="font-size:16px">${IS_PROD ? '☁️ Cloud' : '🖥️ Local'}</div>
      <div class="sub">NODE_ENV: ${process.env.NODE_ENV || 'development'}</div>
    </div>
    <div class="card">
      <div class="label">Last Check</div>
      <div class="value" style="font-size:14px">${new Date().toLocaleTimeString('en-IN')}</div>
      <div class="sub">dashboard rendered</div>
    </div>
  </div>

  <div class="toolbar">
    <a href="/health">🟢 /health (JSON)</a>
    <a href="/metrics">📊 /metrics (JSON)</a>
    <a href="/api/articles">📋 /api/articles (JSON)</a>
    <a href="/" onclick="location.reload();return false;">🔄 Refresh</a>
    <span style="flex:1"></span>
    ${tokenField}
    <button class="btn btn-run" id="runNowBtn" onclick="triggerRun()">▶ Run Now</button>
    <span id="triggerStatus"></span>
  </div>

  <section>
    <h2>Recent Articles Sent</h2>
    <table>
      <thead><tr><th>Time</th><th>Title</th><th>Source</th></tr></thead>
      <tbody>${articleRows || '<tr><td colspan="3" style="color:var(--muted);text-align:center;padding:20px">No articles yet</td></tr>'}</tbody>
    </table>
  </section>

  <section>
    <h2>Live Log (today)</h2>
    <div class="log-box">${logHtml || '<div class="log-info">No logs yet today</div>'}</div>
  </section>

  <p class="refresh-note">Page auto-refreshes every 30s · <a href="/" style="color:var(--blue)">Refresh now</a></p>

  <script>
    async function triggerRun() {
      const btn    = document.getElementById('runNowBtn');
      const status = document.getElementById('triggerStatus');
      const token  = document.getElementById('triggerToken')?.value || '';

      btn.disabled = true;
      status.className = 'running';
      status.textContent = '⏳ Running pipeline…';
      status.style.display = 'inline-block';

      try {
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = 'Bearer ' + token;

        const res = await fetch('/trigger', { method: 'POST', headers, body: '{}' });
        const data = await res.json().catch(() => ({}));

        if (res.ok) {
          status.className = 'ok';
          status.textContent = '✅ ' + (data.message || 'Pipeline triggered!');
          setTimeout(() => location.reload(), 3000);
        } else {
          status.className = 'err';
          status.textContent = '❌ ' + (data.error || 'Failed (HTTP ' + res.status + ')');
        }
      } catch (e) {
        status.className = 'err';
        status.textContent = '❌ Network error: ' + e.message;
      }

      btn.disabled = false;
    }
  </script>
</body>
</html>`;
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Parse request body (for POST /trigger) ────────────────────────────────────
function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk.toString().slice(0, 512); }); // cap at 512 bytes
    req.on('end', () => resolve(body));
    req.on('error', () => resolve(''));
  });
}

/**
 * Start the web dashboard + health check server.
 *
 * @param {object}   pipeline      — NewsPipeline instance
 * @param {number}   port          — fallback port if PORT env not set
 * @param {number}   startTime     — Bot start timestamp (Date.now())
 * @param {Function} [onTrigger]   — async callback to manually trigger pipeline run
 */
function startDashboard(pipeline, port = 3000, startTime = Date.now(), onTrigger = null) {
  // Cloud platforms (Railway, Render, Fly.io) inject PORT env var
  const listenPort = parseInt(process.env.PORT, 10) || port;

  // In production, bind to 0.0.0.0 so the cloud platform can reach us.
  // In development, bind to 127.0.0.1 (localhost only — more secure).
  const host = IS_PROD ? '0.0.0.0' : '127.0.0.1';

  const server = http.createServer(async (req, res) => {
    const url = req.url.split('?')[0];

    // ── Health check endpoint (used by cloud platforms) ──────────────────
    if (url === '/health') {
      const stats  = pipeline.getStats();
      const uptime = Math.floor((Date.now() - startTime) / 1000);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status:      'ok',
        uptime_sec:  uptime,
        total_sent:  stats.totalSent,
        environment: process.env.NODE_ENV || 'development',
        timestamp:   new Date().toISOString()
      }));
      return;
    }

    // ── Metrics endpoint ─────────────────────────────────────────────────
    if (url === '/metrics') {
      const stats        = pipeline.getStats();
      const recent       = pipeline.getRecentArticles(10);
      const uptime       = Math.floor((Date.now() - startTime) / 1000);
      const memUsage     = process.memoryUsage();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status:          'ok',
        uptime_sec:      uptime,
        total_sent:      stats.totalSent,
        recent_articles: recent,
        memory: {
          rss_mb:       Math.round(memUsage.rss / 1024 / 1024),
          heap_used_mb: Math.round(memUsage.heapUsed / 1024 / 1024),
          heap_total_mb:Math.round(memUsage.heapTotal / 1024 / 1024)
        },
        node_version: process.version,
        environment:  process.env.NODE_ENV || 'development',
        timestamp:    new Date().toISOString()
      }, null, 2));
      return;
    }

    // ── /api/articles — machine-readable article history ─────────────────
    if (url === '/api/articles') {
      const recent = pipeline.getRecentArticles(50);
      res.writeHead(200, {
        'Content-Type':                'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify({ count: recent.length, articles: recent }, null, 2));
      return;
    }

    // ── POST /trigger — manually run the pipeline ─────────────────────────
    if (url === '/trigger' && req.method === 'POST') {
      // Auth check (only if DASHBOARD_TOKEN is configured)
      if (DASHBOARD_TOKEN) {
        const authHeader = req.headers['authorization'] || '';
        const provided   = authHeader.replace(/^Bearer\s+/i, '').trim();
        if (provided !== DASHBOARD_TOKEN) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Unauthorized — invalid or missing token' }));
          return;
        }
      }

      // Consume body (required even if not used, to drain the socket)
      await readBody(req);

      if (!onTrigger) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Pipeline trigger not available' }));
        return;
      }

      if (pipeline.isRunning) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Pipeline is already running — try again in a moment' }));
        return;
      }

      // Respond immediately, then fire the pipeline in background
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Pipeline triggered successfully — check the log for results' }));

      // Fire and forget (errors caught internally by pipeline)
      setImmediate(() => {
        const logger = require('./logger');
        logger.info('[Dashboard] Manual pipeline run triggered via /trigger');
        onTrigger().catch((err) => logger.error(`[Dashboard] Trigger error: ${err.message}`));
      });
      return;
    }

    // ── Main dashboard ───────────────────────────────────────────────────
    if (url === '/' || url === '/dashboard') {
      try {
        const stats          = pipeline.getStats();
        const recentArticles = pipeline.getRecentArticles(20);
        const logLines       = getLatestLog(80);
        const html           = buildHtml(stats, recentArticles, logLines, startTime);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(html);
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Dashboard error: ' + err.message);
      }
      return;
    }

    // ── 404 → redirect to dashboard ──────────────────────────────────────
    res.writeHead(301, { Location: '/' });
    res.end();
  });

  server.listen(listenPort, host, () => {
    const logger = require('./logger');
    if (IS_PROD) {
      logger.success(`Health check available at http://0.0.0.0:${listenPort}/health`);
    } else {
      logger.success(`Web dashboard running at http://localhost:${listenPort}`);
      logger.info(`  Health check:   http://localhost:${listenPort}/health`);
      logger.info(`  Metrics:        http://localhost:${listenPort}/metrics`);
      logger.info(`  API articles:   http://localhost:${listenPort}/api/articles`);
      logger.info(`  Manual trigger: POST http://localhost:${listenPort}/trigger`);
    }
  });

  server.on('error', (err) => {
    const logger = require('./logger');
    if (err.code === 'EADDRINUSE') {
      logger.warn(`Dashboard: port ${listenPort} already in use — skipped.`);
    } else {
      logger.warn(`Dashboard error: ${err.message}`);
    }
  });

  return server;
}

module.exports = { startDashboard };
