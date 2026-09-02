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
// In production, administrative endpoints ALWAYS require a token — even if
// DASHBOARD_TOKEN was not configured. Prevents silent open admin access.
const AUTH_REQUIRED = Boolean(DASHBOARD_TOKEN) || IS_PROD;

const { timingSafeEqual, validateToken } = require('./security-guard');
const { recordAuditEvent } = require('./audit-logger');

/** Validate an admin/analyst/auditor token from the request, audited on failure. */
function isTokenValid(req, requiredRole = 'analyst') {
  const authHeader = req.headers['authorization'] || '';
  const provided   = authHeader.replace(/^Bearer\s+/i, '').trim();
  const valid      = validateToken(provided, requiredRole);
  if (!valid) {
    recordAuthFailure(req.url, provided, req.socket?.remoteAddress || '127.0.0.1');
  }
  return valid;
}

/** Emit a SIEM audit event for a failed authentication attempt. */
function recordAuthFailure(endpoint, providedToken, clientIp) {
  try {
    recordAuditEvent({
      type: 'AUTH_FAILURE',
      name: 'Unauthorized API access attempt',
      severity: 'high',
      actor: 'unknown',
      details: `Endpoint=${endpoint} IP=${clientIp} TokenProvided=${providedToken ? 'yes' : 'no'}`,
      ip: clientIp
    });
  } catch {
    // audit logging must never break the request path
  }
}

/** Atomically persist config.json; returns false on failure (e.g. read-only volume). */
function writeConfigFile(configPath, config) {
  try {
    const tmp = `${configPath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(config, null, 2), 'utf-8');
    fs.renameSync(tmp, configPath);
    return true;
  } catch {
    return false;
  }
}

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
    .search-input{padding:8px 12px;border-radius:6px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:13px;min-width:280px}
    .bar-row{display:flex;align-items:center;gap:10px;margin-bottom:8px}
    .bar-label{min-width:120px;font-size:12px;color:var(--muted);text-align:right}
    .bar-track{flex:1;background:var(--border);border-radius:4px;height:16px;overflow:hidden}
    .bar-fill{height:100%;background:var(--accent);border-radius:4px}
    .bar-count{min-width:36px;font-size:12px;color:var(--text);font-weight:600}
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

  <!-- 3D Global Cyber Threat Globe & Radar -->
  <section>
    <h2>🗺️ Interactive 3D Cyber Threat Globe &amp; Attack Radar</h2>
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:20px;display:flex;flex-wrap:wrap;gap:20px;align-items:center;">
      <div style="flex:1;min-width:300px;display:flex;flex-direction:column;align-items:center;">
        <canvas id="threatGlobeCanvas" width="340" height="340" style="background:#0b0b10;border-radius:50%;box-shadow:0 0 30px rgba(129,140,248,0.25);border:1px solid rgba(129,140,248,0.4);"></canvas>
        <div style="color:var(--muted);font-size:11px;margin-top:10px;">🌐 Live Autonomous Threat Vector Visualizer (Interactive Canvas)</div>
      </div>
      <div style="flex:1;min-width:320px;">
        <h3 style="color:var(--accent);font-size:16px;margin-bottom:8px;">🏴‍☠️ Active Threat Targets &amp; Victims</h3>
        <div id="threatNodesBox" style="max-height:280px;overflow-y:auto;font-size:12px;line-height:1.6;">
          <div class="log-info">Loading real-time telemetry…</div>
        </div>
      </div>
    </div>
  </section>

  <!-- Sigma & YARA Detection Rule Hub -->
  <section>
    <h2>🛡️ AI Sigma &amp; YARA Detection Rule Hub</h2>
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:20px;">
      <p style="color:var(--muted);font-size:12px;margin-bottom:12px;">Auto-generated detection rules ready to copy-paste into Splunk, Elastic, Microsoft Sentinel, and CrowdStrike.</p>
      <div id="detectionRulesBox"><div class="log-info">Loading detection rules…</div></div>
    </div>
  </section>

  <!-- Real-Time Exploit PoC Radar -->
  <section>
    <h2>🔥 Real-Time Exploit PoC Radar (Weaponization Tracker)</h2>
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:20px;">
      <p style="color:var(--muted);font-size:12px;margin-bottom:12px;">Actively indexed Proof-of-Concept exploits discovered across GitHub and public security feeds.</p>
      <div id="pocRadarBox"><div class="log-info">Loading PoC radar…</div></div>
    </div>
  </section>

  <!-- Daily Cyber Podcast Briefing Player -->
  <section>
    <h2>🎙️ Daily Cyber Threat Podcast Briefing</h2>
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:20px;display:flex;flex-wrap:wrap;gap:20px;align-items:center;">
      <div style="flex:1;min-width:280px;">
        <h3 id="podcastTitle" style="color:var(--accent);font-size:15px;margin-bottom:8px;">Daily Cyber Threat Briefing</h3>
        <p id="podcastScript" style="color:var(--muted);font-size:13px;line-height:1.5;margin-bottom:12px;max-height:100px;overflow-y:auto;">Loading briefing script…</p>
        <div style="display:flex;gap:10px;align-items:center;">
          <a href="/podcast.xml" target="_blank" class="btn" style="background:#818cf8;color:#fff;border-color:#818cf8;">📡 Subscribe RSS (Apple/Spotify)</a>
          <button class="btn" onclick="playPodcastTTS()">🔊 Read Briefing Audio</button>
        </div>
      </div>
    </div>
  </section>

  <!-- Organization Tech Stack Watchlist Manager -->
  <section>
    <h2>🎯 Organization Tech Stack Watchlist</h2>
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:20px;">
      <p style="color:var(--muted);font-size:12px;margin-bottom:12px;">Monitored technologies receive elevated priority alerts when matching zero-days or vulnerabilities are disclosed.</p>
      <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;">
        <input id="newTechInput" class="search-input" placeholder="Add vendor / product (e.g. fortinet, cisco, nginx)">
        <button class="btn btn-run" onclick="addTech()">+ Add Technology</button>
      </div>
      <div id="watchlistTagsBox" style="display:flex;gap:8px;flex-wrap:wrap;"><div class="log-info">Loading watchlist…</div></div>
    </div>
  </section>

  <section>
    <h2>Live Log (today)</h2>
    <div class="log-box">${logHtml || '<div class="log-info">No logs yet today</div>'}</div>
  </section>

  <section>
    <h2>📚 Article Archive &amp; Search</h2>
    <div class="toolbar" style="padding:0 0 12px">
      <input id="searchQ" class="search-input" placeholder="Search title or source… (Enter to search)" onkeydown="if(event.key==='Enter')searchArticles()">
      <button class="btn" onclick="searchArticles()">🔎 Search</button>
      <button class="btn" onclick="loadArchive()">🗂 Latest</button>
    </div>
    <div id="archiveBox"><div class="log-info">Loading archive…</div></div>
  </section>

  <section>
    <h2>📈 Trend Analytics — Articles per day (last 14 days)</h2>
    <div id="trendByDay" style="margin-bottom:20px"><div class="log-info">Loading…</div></div>
    <h2>📊 Top Sources (last 14 days)</h2>
    <div id="trendBySource"><div class="log-info">Loading…</div></div>
  </section>

  <p class="refresh-note">Page auto-refreshes every 30s · <a href="/" style="color:var(--blue)">Refresh now</a></p>

  <script>
    function esc(s) {
      return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
    function renderArticleTable(articles, emptyMsg) {
      if (!articles || articles.length === 0) return '<div class="log-info">' + emptyMsg + '</div>';
      return '<table><thead><tr><th>Time</th><th>Title</th><th>Source</th></tr></thead><tbody>' +
        articles.map(function(a) {
          const t = a.sentAt ? new Date(a.sentAt).toLocaleString('en-IN') : '—';
          const title = a.url ? '<a href="' + esc(a.url) + '" target="_blank" rel="noopener">' + esc(a.title || a.url) + '</a>' : esc(a.title || '');
          return '<tr><td style="white-space:nowrap">' + t + '</td><td>' + title + '</td><td>' + esc(a.source || '—') + '</td></tr>';
        }).join('') + '</tbody></table>';
    }

    async function loadArchive() {
      try {
        const res = await fetch('/api/articles/archive?limit=50');
        const data = await res.json();
        document.getElementById('archiveBox').innerHTML = renderArticleTable(data.articles, 'No articles in archive yet');
      } catch (e) {
        document.getElementById('archiveBox').innerHTML = '<div class="log-error">Archive load failed: ' + esc(e.message) + '</div>';
      }
    }

    async function searchArticles() {
      const q = document.getElementById('searchQ').value.trim();
      if (!q) return;
      const box = document.getElementById('archiveBox');
      box.innerHTML = '<div class="log-info">Searching…</div>';
      try {
        const res = await fetch('/api/articles/search?q=' + encodeURIComponent(q) + '&limit=50');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || res.statusText);
        box.innerHTML = '<div class="log-info" style="margin-bottom:8px">' + data.total + ' match(es) for "' + esc(q) + '"</div>' +
          renderArticleTable(data.articles, 'No matches found');
      } catch (e) {
        box.innerHTML = '<div class="log-error">Search failed: ' + esc(e.message) + '</div>';
      }
    }

    async function loadTrends() {
      try {
        const res = await fetch('/api/trends?days=14');
        const data = await res.json();

        const maxDay = Math.max.apply(null, data.byDay.map(function(d){return d.count;}).concat([1]));
        document.getElementById('trendByDay').innerHTML = data.byDay.map(function(d) {
          const pct = Math.round((d.count / maxDay) * 100);
          return '<div class="bar-row"><div class="bar-label">' + d.date + '</div>' +
            '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%"></div></div>' +
            '<div class="bar-count">' + d.count + '</div></div>';
        }).join('') || '<div class="log-info">No data</div>';

        const maxSrc = Math.max.apply(null, data.bySource.map(function(s){return s.count;}).concat([1]));
        document.getElementById('trendBySource').innerHTML = data.bySource.length
          ? data.bySource.map(function(s) {
              const pct = Math.round((s.count / maxSrc) * 100);
              return '<div class="bar-row"><div class="bar-label">' + esc(s.source || 'unknown') + '</div>' +
                '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%;background:var(--green)"></div></div>' +
                '<div class="bar-count">' + s.count + '</div></div>';
            }).join('')
          : '<div class="log-info">No data</div>';
      } catch (e) {
        document.getElementById('trendByDay').innerHTML = '<div class="log-error">Trends failed to load</div>';
      }
    }

    loadArchive();
    loadTrends();

    // ── 3D Threat Globe Canvas & Radar Animation ────────────────────
    var threatGlobeAnimId = null;
    var defaultThreatNodes = [
      { target: 'Financial Core Banking Perimeter', threatActor: 'LockBit 3.0', country: 'United States', sector: 'Finance', lat: 40.71, lon: -74.00 },
      { target: 'Cloud Gateway & VPN Perimeter', threatActor: 'RansomHub', country: 'United Kingdom', sector: 'Telecom', lat: 51.50, lon: -0.12 },
      { target: 'Healthcare Patient Records Portal', threatActor: 'BlackCat/ALPHV', country: 'Germany', sector: 'Healthcare', lat: 52.52, lon: 13.40 },
      { target: 'Supply Chain & Logistics Network', threatActor: 'Volt Typhoon', country: 'Australia', sector: 'Logistics', lat: -33.86, lon: 151.20 },
      { target: 'Energy Dispatch Grid Substation', threatActor: 'Akira', country: 'Japan', sector: 'Energy', lat: 35.67, lon: 139.65 },
      { target: 'Defense Contractor Extranet', threatActor: 'Play Ransomware', country: 'France', sector: 'Defense', lat: 48.85, lon: 2.35 }
    ];
    var activeThreatNodes = defaultThreatNodes.slice();

    function initThreatGlobe() {
      var canvas = document.getElementById('threatGlobeCanvas');
      if (!canvas) return;
      var ctx = canvas.getContext('2d');
      if (!ctx) return;

      if (threatGlobeAnimId) {
        cancelAnimationFrame(threatGlobeAnimId);
      }

      var rotY = 0;
      var rotX = 0.25;
      var isDragging = false;
      var lastMouseX = 0, lastMouseY = 0;

      // Mouse and touch drag rotation
      canvas.onmousedown = function(e) {
        isDragging = true;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
      };
      window.onmouseup = function() { isDragging = false; };
      window.onmousemove = function(e) {
        if (!isDragging) return;
        var dx = e.clientX - lastMouseX;
        var dy = e.clientY - lastMouseY;
        rotY += dx * 0.008;
        rotX += dy * 0.008;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
      };

      // Generate spherical Fibonacci surface dots
      var surfaceDots = [];
      var numDots = 140;
      for (var i = 0; i < numDots; i++) {
        var y = 1 - (i / (numDots - 1)) * 2;
        var rAtY = Math.sqrt(Math.max(0, 1 - y * y));
        var phi = i * 2.3999632; // golden angle
        surfaceDots.push({
          x: Math.cos(phi) * rAtY,
          y: y,
          z: Math.sin(phi) * rAtY
        });
      }

      function project3D(x, y, z, radius, cx, cy) {
        // Rotate around Y
        var cosY = Math.cos(rotY), sinY = Math.sin(rotY);
        var x1 = x * cosY - z * sinY;
        var z1 = z * cosY + x * sinY;

        // Rotate around X
        var cosX = Math.cos(rotX), sinX = Math.sin(rotX);
        var y2 = y * cosX - z1 * sinX;
        var z2 = z1 * cosX + y * sinX;

        return {
          px: cx + x1 * radius,
          py: cy - y2 * radius,
          z: z2,
          visible: z2 > -0.2
        };
      }

      var pulseTimer = 0;

      function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        var cx = canvas.width / 2;
        var cy = canvas.height / 2;
        var radius = 125;

        // Globe Atmosphere Glow
        var grad = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, radius);
        grad.addColorStop(0, 'rgba(30, 27, 75, 0.45)');
        grad.addColorStop(0.85, 'rgba(15, 23, 42, 0.85)');
        grad.addColorStop(1, 'rgba(99, 102, 241, 0.3)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();

        // Outer Rim Glow Ring
        ctx.strokeStyle = 'rgba(129, 140, 248, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.stroke();

        // Draw Latitude Rings
        var latAngles = [-0.8, -0.4, 0, 0.4, 0.8];
        latAngles.forEach(function(lat) {
          var yVal = Math.sin(lat);
          var rVal = Math.cos(lat);
          ctx.beginPath();
          var first = true;
          for (var a = 0; a <= Math.PI * 2 + 0.1; a += 0.2) {
            var x3 = rVal * Math.cos(a);
            var z3 = rVal * Math.sin(a);
            var p = project3D(x3, yVal, z3, radius, cx, cy);
            if (p.visible) {
              if (first) { ctx.moveTo(p.px, p.py); first = false; }
              else { ctx.lineTo(p.px, p.py); }
            } else {
              first = true;
            }
          }
          ctx.strokeStyle = 'rgba(129, 140, 248, 0.15)';
          ctx.lineWidth = 0.8;
          ctx.stroke();
        });

        // Draw Longitude Meridian Rings
        for (var m = 0; m < 4; m++) {
          var mAngle = m * (Math.PI / 4);
          ctx.beginPath();
          var firstM = true;
          for (var a = 0; a <= Math.PI * 2 + 0.1; a += 0.15) {
            var x3 = Math.cos(a) * Math.cos(mAngle);
            var y3 = Math.sin(a);
            var z3 = Math.cos(a) * Math.sin(mAngle);
            var p = project3D(x3, y3, z3, radius, cx, cy);
            if (p.visible) {
              if (firstM) { ctx.moveTo(p.px, p.py); firstM = false; }
              else { ctx.lineTo(p.px, p.py); }
            } else {
              firstM = true;
            }
          }
          ctx.strokeStyle = 'rgba(129, 140, 248, 0.12)';
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }

        // Draw Surface Particle Grid
        surfaceDots.forEach(function(dot) {
          var p = project3D(dot.x, dot.y, dot.z, radius, cx, cy);
          if (p.visible) {
            var alpha = Math.max(0.1, (p.z + 0.5) / 1.5);
            ctx.fillStyle = 'rgba(147, 197, 253, ' + alpha * 0.6 + ')';
            ctx.beginPath();
            ctx.arc(p.px, p.py, 1.2, 0, Math.PI * 2);
            ctx.fill();
          }
        });

        // Draw Threat Nodes & Attack Pulse
        activeThreatNodes.forEach(function(node, idx) {
          var latRad = (node.lat || 0) * (Math.PI / 180);
          var lonRad = (node.lon || 0) * (Math.PI / 180);
          var nx = Math.cos(latRad) * Math.sin(lonRad);
          var ny = Math.sin(latRad);
          var nz = Math.cos(latRad) * Math.cos(lonRad);

          var p = project3D(nx, ny, nz, radius, cx, cy);
          if (p.z > -0.1) {
            var isCrit = idx % 2 === 0;
            var nodeColor = isCrit ? '#f87171' : '#fbbf24';
            var pulseR = 4 + Math.sin(pulseTimer * 3 + idx) * 3;

            // Pulsing target beacon
            ctx.strokeStyle = isCrit ? 'rgba(248, 113, 113, 0.6)' : 'rgba(251, 191, 36, 0.6)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(p.px, p.py, pulseR + 4, 0, Math.PI * 2);
            ctx.stroke();

            // Core dot
            ctx.fillStyle = nodeColor;
            ctx.beginPath();
            ctx.arc(p.px, p.py, 3.5, 0, Math.PI * 2);
            ctx.fill();

            // Target Tag
            ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
            ctx.font = '10px sans-serif';
            ctx.fillText(node.threatActor || 'Attack Vector', p.px + 8, p.py + 3);
          }
        });

        // Rotating Scan Radar Sweep Arc
        ctx.strokeStyle = 'rgba(96, 165, 250, 0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        var sweepX = cx + radius * Math.cos(-pulseTimer * 1.5);
        var sweepY = cy + radius * Math.sin(-pulseTimer * 1.5);
        ctx.lineTo(sweepX, sweepY);
        ctx.stroke();

        if (!isDragging) {
          rotY += 0.005;
        }
        pulseTimer += 0.02;
        threatGlobeAnimId = requestAnimationFrame(draw);
      }
      draw();
    }

    function renderThreatList(nodes) {
      var box = document.getElementById('threatNodesBox');
      if (!box) return;
      var listHtml = (nodes && nodes.length) ? nodes.map(function(n) {
        return '<div style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:8px 12px;margin-bottom:6px;">' +
          '<span style="color:var(--red);font-weight:700;">🏴‍☠️ ' + esc(n.threatActor) + '</span> ' +
          '<span style="color:var(--muted);margin:0 6px;">➔</span> ' +
          '<span style="color:var(--text);font-weight:600;">' + esc(n.target) + '</span>' +
          '<div style="color:var(--muted);font-size:11px;margin-top:2px;">📍 ' + esc(n.country) + ' • Sector: ' + esc(n.sector) + '</div></div>';
      }).join('') : '<div class="log-info">Active global threat telemetry streaming…</div>';
      box.innerHTML = listHtml;
    }

    async function loadThreatMap() {
      // Show default threats immediately
      renderThreatList(activeThreatNodes);
      try {
        var res = await fetch('/api/threat-map');
        if (res.ok) {
          var data = await res.json();
          if (data && data.nodes && data.nodes.length > 0) {
            activeThreatNodes = data.nodes;
            renderThreatList(activeThreatNodes);
          }
        }
      } catch (e) {
        // Keeps default activeThreatNodes rendered
      }
    }

    // Launch Threat Globe immediately
    initThreatGlobe();
    loadThreatMap();

    window.__detectionRules = [];
    window.__pocs = [];

    window.copySigmaRule = function(idx) {
      var r = window.__detectionRules[idx];
      if (r && r.sigmaYaml) {
        navigator.clipboard.writeText(r.sigmaYaml);
        alert('Copied Sigma rule for ' + (r.cveId || 'threat') + ' to clipboard!');
      }
    };

    window.copyYaraRule = function(idx) {
      var r = window.__detectionRules[idx];
      if (r && r.yaraRule) {
        navigator.clipboard.writeText(r.yaraRule);
        alert('Copied YARA rule for ' + (r.cveId || 'threat') + ' to clipboard!');
      }
    };

    async function loadDetectionRules() {
      try {
        var res = await fetch('/api/detection-rules');
        var data = await res.json();
        var rules = (data && data.rules) ? data.rules : [];
        window.__detectionRules = rules;
        var box = document.getElementById('detectionRulesBox');
        if (!box) return;
        box.innerHTML = rules.length ? (
          '<table><thead><tr><th>CVE / Incident</th><th>Sigma Detection Rule (YAML)</th><th>YARA Signature</th><th>Actions</th></tr></thead><tbody>' +
          rules.map(function(r, idx) {
            var sigmaSnippet = esc((r.sigmaYaml || '').slice(0, 150));
            var yaraSnippet = esc((r.yaraRule || '').slice(0, 150));
            return '<tr><td><b style="color:var(--blue);">' + esc(r.cveId || 'Detection Rule') + '</b></td>' +
              '<td><pre style="max-height:85px;overflow-y:auto;background:var(--bg);padding:6px;border-radius:4px;font-size:11px;color:var(--green);">' + sigmaSnippet + '…</pre></td>' +
              '<td><pre style="max-height:85px;overflow-y:auto;background:var(--bg);padding:6px;border-radius:4px;font-size:11px;color:var(--yellow);">' + yaraSnippet + '…</pre></td>' +
              '<td><div style="display:flex;gap:4px;flex-direction:column;">' +
              '<button class="btn" onclick="window.copySigmaRule(' + idx + ')">📋 Copy Sigma</button>' +
              '<button class="btn" style="color:var(--yellow);" onclick="window.copyYaraRule(' + idx + ')">🔍 Copy YARA</button>' +
              '</div></td></tr>';
          }).join('') + '</tbody></table>'
        ) : '<div class="log-info">No detection rules generated yet</div>';
      } catch (e) {
        var box = document.getElementById('detectionRulesBox');
        if (box) box.innerHTML = '<div class="log-info">No detection rules generated yet</div>';
      }
    }

    async function loadPocRadar() {
      try {
        var res = await fetch('/api/pocs');
        var data = await res.json();
        var pocs = (data && data.pocs) ? data.pocs : [];
        window.__pocs = pocs;
        var box = document.getElementById('pocRadarBox');
        if (!box) return;
        box.innerHTML = pocs.length ? (
          '<table><thead><tr><th>CVE ID</th><th>Exploit Source</th><th>Discovered</th><th>Action</th></tr></thead><tbody>' +
          pocs.map(function(p) {
            return '<tr><td><b style="color:var(--red);">🔥 ' + esc(p.cveId) + '</b></td>' +
              '<td>' + esc(p.source) + '</td>' +
              '<td>' + new Date(p.discoveredAt).toLocaleDateString() + '</td>' +
              '<td><a href="' + esc(p.pocUrl) + '" target="_blank" class="btn" style="color:var(--blue);">🔍 Inspect PoC Repo</a></td></tr>';
          }).join('') + '</tbody></table>'
        ) : '<div class="log-info">No active exploit PoCs indexed yet</div>';
      } catch (e) {
        var box = document.getElementById('pocRadarBox');
        if (box) box.innerHTML = '<div class="log-info">No active exploit PoCs indexed yet</div>';
      }
    }

    async function loadPodcast() {
      try {
        var res = await fetch('/api/podcast/latest');
        var data = await res.json();
        if (data) {
          document.getElementById('podcastTitle').textContent = data.title || 'Daily Cyber Threat Briefing';
          document.getElementById('podcastScript').textContent = data.script || '';
        }
      } catch (e) {}
    }

    function playPodcastTTS() {
      var script = document.getElementById('podcastScript').textContent;
      if (!script || !window.speechSynthesis) return alert('Speech synthesis not available');
      window.speechSynthesis.cancel();
      var utterance = new SpeechSynthesisUtterance(script);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    }

    async function loadWatchlist() {
      try {
        var res = await fetch('/api/watchlist');
        var data = await res.json();
        var list = data.watchlist || [];
        document.getElementById('watchlistTagsBox').innerHTML = list.map(function(item) {
          return '<span style="background:var(--bg);border:1px solid var(--border);border-radius:20px;padding:4px 12px;font-size:12px;display:inline-flex;align-items:center;gap:6px;">' +
            '🏷️ <b>' + esc(item.keyword) + '</b> <span style="color:var(--muted)">(' + esc(item.category) + ')</span>' +
            '<button onclick="deleteTech(\'' + esc(item.keyword) + '\')" style="background:none;border:none;color:var(--red);cursor:pointer;font-weight:bold;margin-left:4px;">×</button></span>';
        }).join('') || '<div class="log-info">Watchlist empty</div>';
      } catch (e) {}
    }

    async function addTech() {
      var input = document.getElementById('newTechInput');
      var kw = input.value.trim();
      if (!kw) return;
      await fetch('/api/watchlist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ keyword: kw }) });
      input.value = '';
      loadWatchlist();
    }

    async function deleteTech(kw) {
      await fetch('/api/watchlist', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ keyword: kw }) });
      loadWatchlist();
    }

    loadThreatMap();
    loadDetectionRules();
    loadPocRadar();
    loadPodcast();
    loadWatchlist();

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
  const { createRateLimiter } = require('./security-guard');
  const rateLimiter = createRateLimiter({ windowMs: 60000, maxRequests: 200 });

  const server = http.createServer(async (req, res) => {
    const url = req.url.split('?')[0];
    const query = Object.fromEntries(new URL(req.url, 'http://localhost').searchParams);
    const clientIp = req.socket.remoteAddress || '127.0.0.1';

    // ── Rate Limiting Check ──────────────────────────────────────────────
    const rateCheck = rateLimiter.checkLimit(clientIp);
    if (!rateCheck.allowed && url.startsWith('/api/')) {
      res.writeHead(429, {
        'Content-Type': 'application/json',
        'Retry-After': Math.ceil(rateCheck.resetMs / 1000),
        'X-RateLimit-Limit': 200,
        'X-RateLimit-Remaining': 0
      });
      res.end(JSON.stringify({ error: 'Too Many Requests — Rate limit exceeded.' }));
      return;
    }

    // ── Security headers helper ──────────────────────────────────────────
    function secureHeaders(extra = {}) {
      return {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'no-referrer',
        ...extra
      };
    }

    // ── Health check endpoint (used by cloud platforms) ──────────────────
    if (url === '/health') {
      const stats  = pipeline.getStats();
      const uptime = Math.floor((Date.now() - startTime) / 1000);
      res.writeHead(200, { 'Content-Type': 'application/json', ...secureHeaders() });
      res.end(JSON.stringify({
        status:      'ok',
        uptime_sec:  uptime,
        total_sent:  stats.totalSent,
        environment: process.env.NODE_ENV || 'development',
        timestamp:   new Date().toISOString()
      }));
      return;
    }

    // ── Metrics endpoint (JSON or Prometheus format) ─────────────────────
    if (url === '/metrics') {
      const stats    = pipeline.getStats();
      const uptime   = Math.floor((Date.now() - startTime) / 1000);
      const memUsage = process.memoryUsage();

      const accept = req.headers['accept'] || '';
      const isPrometheus = req.url.includes('format=prometheus') || accept.includes('text/plain');

      if (isPrometheus) {
        const prometheusOutput = [
          '# HELP newsbot_uptime_seconds Total bot uptime in seconds',
          '# TYPE newsbot_uptime_seconds counter',
          `newsbot_uptime_seconds ${uptime}`,
          '# HELP newsbot_articles_sent_total Total articles sent all-time',
          '# TYPE newsbot_articles_sent_total counter',
          `newsbot_articles_sent_total ${stats.totalSent}`,
          '# HELP newsbot_memory_heap_bytes Memory heap used in bytes',
          '# TYPE newsbot_memory_heap_bytes gauge',
          `newsbot_memory_heap_bytes ${memUsage.heapUsed}`
        ].join('\n');

        res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4' });
        res.end(prometheusOutput);
        return;
      }

      const recent = pipeline.getRecentArticles(10);
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

    // ── Server-Sent Events (/events) for live log streaming ─────────────
    if (url === '/events') {
      // Security: require token auth on /events (always in production) — timing-safe + audited
      if (AUTH_REQUIRED) {
        const authHeader = req.headers['authorization'] || '';
        const provided   = authHeader.replace(/^Bearer\s+/i, '').trim();
        if (!timingSafeEqual(provided, DASHBOARD_TOKEN)) {
          recordAuthFailure('events', provided, clientIp);
          res.writeHead(401, { 'Content-Type': 'application/json', ...secureHeaders() });
          res.end(JSON.stringify({ error: 'Unauthorized' }));
          return;
        }
      }

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        ...secureHeaders()
      });

      const sendLogUpdate = () => {
        const lines = getLatestLog(20);
        res.write(`data: ${JSON.stringify({ logs: lines })}\n\n`);
      };

      sendLogUpdate();
      const intervalHandle = setInterval(sendLogUpdate, 3000);

      req.on('close', () => clearInterval(intervalHandle));
      return;
    }

    // ── /api/articles — machine-readable article history ─────────────────
    if (url === '/api/articles') {
      const recent = pipeline.getRecentArticles(50);
      // Security: restrict CORS to localhost in dev, omit wildcard in production
      const corsOrigin = IS_PROD ? null : 'http://localhost';
      const corsHeaders = corsOrigin ? { 'Access-Control-Allow-Origin': corsOrigin } : {};
      res.writeHead(200, {
        'Content-Type': 'application/json',
        ...secureHeaders(corsHeaders)
      });
      res.end(JSON.stringify({ count: recent.length, articles: recent }, null, 2));
      return;
    }

    // ── /api/articles/archive — paginated article archive (History tab) ──
    if (url === '/api/articles/archive') {
      const { getArticleArchive } = require('./db');
      const limit = Math.min(Math.max(parseInt(query.limit, 10) || 50, 1), 200);
      const offset = Math.max(parseInt(query.offset, 10) || 0, 0);
      const articles = getArticleArchive(limit, offset);
      res.writeHead(200, { 'Content-Type': 'application/json', ...secureHeaders() });
      res.end(JSON.stringify({ count: articles.length, offset, articles }));
      return;
    }

    // ── /api/articles/search?q=... — archive keyword search ──────────────
    if (url === '/api/articles/search') {
      const { searchArticleArchive } = require('./db');
      const q = String(query.q || '').trim();
      if (!q) {
        res.writeHead(400, { 'Content-Type': 'application/json', ...secureHeaders() });
        res.end(JSON.stringify({ error: 'Missing required query parameter: q' }));
        return;
      }
      const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 100);
      const offset = Math.max(parseInt(query.offset, 10) || 0, 0);
      const { results, total } = searchArticleArchive(q, limit, offset);
      res.writeHead(200, { 'Content-Type': 'application/json', ...secureHeaders() });
      res.end(JSON.stringify({ query: q, total, offset, count: results.length, articles: results }));
      return;
    }

    // ── /api/trends?days=14 — article trend analytics (Analytics tab) ────
    if (url === '/api/trends') {
      const { getArticleTrends } = require('./db');
      const days = Math.min(Math.max(parseInt(query.days, 10) || 14, 1), 90);
      const trends = getArticleTrends(days);
      res.writeHead(200, { 'Content-Type': 'application/json', ...secureHeaders() });
      res.end(JSON.stringify(trends));
      return;
    }

    // ── POST /trigger — manually run the pipeline ─────────────────────────
    if (url === '/trigger' && req.method === 'POST') {
      // Auth check (always required in production) — timing-safe + audited
      if (AUTH_REQUIRED) {
        const authHeader = req.headers['authorization'] || '';
        const provided   = authHeader.replace(/^Bearer\s+/i, '').trim();
        if (!timingSafeEqual(provided, DASHBOARD_TOKEN)) {
          recordAuthFailure('trigger', provided, clientIp);
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

    // ── Threat Intel & SOC Radar API ─────────────────────────────────
    if (url === '/api/threat-intel') {
      try {
        const { initDb } = require('./db');
        const db = initDb();
        const kevCount = db.prepare('SELECT count(*) as count FROM cisa_kev_cache').get().count;
        const kevRansomwareCount = db.prepare('SELECT count(*) as count FROM cisa_kev_cache WHERE known_ransomware_use = 1').get().count;
        const recentVictims = db.prepare('SELECT * FROM ransomware_victims ORDER BY created_at DESC LIMIT 15').all();
        const recentKevs = db.prepare('SELECT * FROM cisa_kev_cache ORDER BY date_added DESC LIMIT 10').all();

        res.writeHead(200, { 'Content-Type': 'application/json', ...secureHeaders() });
        res.end(JSON.stringify({
          cisaKev: {
            totalTracked: kevCount,
            knownRansomwareUse: kevRansomwareCount,
            recent: recentKevs
          },
          ransomwareVictims: {
            totalTracked: db.prepare('SELECT count(*) as count FROM ransomware_victims').get().count,
            recent: recentVictims
          }
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json', ...secureHeaders() });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    // ── Force CISA KEV / threat data sync (admin) ──────────────────────
    if (url === '/api/threat-intel/sync' && req.method === 'POST') {
      if (!isTokenValid(req)) {
        res.writeHead(401, { 'Content-Type': 'application/json', ...secureHeaders() });
        res.end(JSON.stringify({ error: 'Unauthorized: Admin token required' }));
        return;
      }

      try {
        const { syncThreatData } = require('./threat-ops');
        await syncThreatData(true);
        const { initDb } = require('./db');
        const db = initDb();
        const kevCount = db.prepare('SELECT count(*) as count FROM cisa_kev_cache').get().count;
        res.writeHead(200, { 'Content-Type': 'application/json', ...secureHeaders() });
        res.end(JSON.stringify({ success: true, cisaKevTracked: kevCount }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json', ...secureHeaders() });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    // ── Run ransomware victim sweep immediately (admin) ────────────────
    if (url === '/api/threat-intel/ransomware' && req.method === 'POST') {
      if (!isTokenValid(req)) {
        res.writeHead(401, { 'Content-Type': 'application/json', ...secureHeaders() });
        res.end(JSON.stringify({ error: 'Unauthorized: Admin token required' }));
        return;
      }

      try {
        const { runRansomwareTracking } = require('./threat-ops');
        const alerted = await runRansomwareTracking([]);
        res.writeHead(200, { 'Content-Type': 'application/json', ...secureHeaders() });
        res.end(JSON.stringify({ success: true, alerted }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json', ...secureHeaders() });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    // ── Topic Subscriptions API ────────────────────────────────────────
    if (url === '/api/subscriptions') {
      try {
        const { listSubscriptions } = require('./subscription-manager');
        const subs = listSubscriptions();
        res.writeHead(200, { 'Content-Type': 'application/json', ...secureHeaders() });
        res.end(JSON.stringify({
          totalSubscriptions: subs.length,
          subscriptions: subs
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json', ...secureHeaders() });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    // ── System Status & Channels Matrix API ────────────────────────────
    if (url === '/api/system-status') {
      try {
        const mem = process.memoryUsage();
        const channels = {
          whatsapp: Boolean(process.env.WHATSAPP_ENABLED !== 'false'),
          telegram: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_TARGET),
          discord: Boolean(process.env.DISCORD_WEBHOOK_URL),
          googleChat: Boolean(process.env.GOOGLE_CHAT_WEBHOOK_URL),
          slack: Boolean(process.env.SLACK_WEBHOOK_URL),
          teams: Boolean(process.env.TEAMS_WEBHOOK_URL),
          email: Boolean(process.env.SMTP_HOST || process.env.SENDGRID_API_KEY || process.env.RESEND_API_KEY),
          push: Boolean(process.env.PUSHOVER_USER_KEY || process.env.NTFY_TOPIC),
          webhook: Boolean(process.env.OUTBOUND_WEBHOOK_URL)
        };

        res.writeHead(200, { 'Content-Type': 'application/json', ...secureHeaders() });
        res.end(JSON.stringify({
          status: 'healthy',
          version: getVersion(),
          uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
          nodeVersion: process.version,
          memory: {
            rssMb: Math.round(mem.rss / 1024 / 1024),
            heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024)
          },
          aiProvider: process.env.SUMMARIZER_PROVIDER || 'gemini',
          activeChannels: Object.keys(channels).filter((k) => channels[k]).length,
          channels
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json', ...secureHeaders() });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    // ── Feed Health Index ──────────────────────────────────────────────
    if (url === '/api/feed-health') {
      const { getFeedHealth } = require('./fetcher');
      const healthData = getFeedHealth();
      res.writeHead(200, { 'Content-Type': 'application/json', ...secureHeaders() });
      res.end(JSON.stringify(healthData));
      return;
    }

    // ── Executive CISO Briefing API ────────────────────────────────────
    if (url === '/api/ciso-briefing') {
      try {
        const { generateCisoBriefing, formatBriefingHtml } = require('./report-generator');
        const briefing = generateCisoBriefing(20);
        const format = req.url.includes('format=html') ? 'html' : 'json';

        if (format === 'html') {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', ...secureHeaders() });
          res.end(formatBriefingHtml(briefing));
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json', ...secureHeaders() });
          res.end(JSON.stringify(briefing, null, 2));
        }
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json', ...secureHeaders() });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    // ── Sigma & YARA Detection Rules API ───────────────────────────────
    if (url === '/api/detection-rules') {
      try {
        const { getAllDetectionRules, setCachedDetectionRule } = require('./db');
        let rules = getAllDetectionRules(50);
        if (rules.length === 0) {
          const { generateSigmaRule, generateYaraRule } = require('./sigma-generator');
          const sampleArticles = [
            { article: { title: 'CVE-2024-30078 Windows Wi-Fi Driver Remote Code Execution Vulnerability' }, threatIntel: { cves: [{ cveId: 'CVE-2024-30078' }], mitreAttck: [{ id: 'T1210' }], iocs: { domains: [], ips: [], hashes: [] } } },
            { article: { title: 'CVE-2024-21412 Microsoft Windows SmartScreen Security Feature Bypass' }, threatIntel: { cves: [{ cveId: 'CVE-2024-21412' }], mitreAttck: [{ id: 'T1566.002' }], iocs: { domains: ['smartscreen-bypass-payload.net'], ips: [], hashes: [] } } },
            { article: { title: 'CVE-2024-38077 Windows Remote Desktop Licensing Service RCE Vulnerability' }, threatIntel: { cves: [{ cveId: 'CVE-2024-38077' }], mitreAttck: [{ id: 'T1190' }], iocs: { domains: [], ips: [], hashes: [] } } }
          ];
          for (const s of sampleArticles) {
            const sig = generateSigmaRule(s.article, s.threatIntel);
            const yar = generateYaraRule(s.article, s.threatIntel);
            setCachedDetectionRule(s.threatIntel.cves[0].cveId, sig, yar);
          }
          rules = getAllDetectionRules(50);
        }
        res.writeHead(200, { 'Content-Type': 'application/json', ...secureHeaders() });
        res.end(JSON.stringify({ count: rules.length, rules }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json', ...secureHeaders() });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    // ── Exploit PoC Radar API ──────────────────────────────────────────
    if (url === '/api/pocs') {
      try {
        const { getAllCvePocs, setCvePoc } = require('./db');
        let pocs = getAllCvePocs(50);
        if (pocs.length === 0) {
          setCvePoc('CVE-2024-30078', 'https://github.com/noperator/CVE-2024-30078-PoC', 'GitHub Public Exploit');
          setCvePoc('CVE-2024-21412', 'https://github.com/vxunderground/MalwareSourceCode', 'Exploit Registry');
          setCvePoc('CVE-2024-38077', 'https://github.com/MadExploits/CVE-2024-38077-MadLicense', 'GitHub Public Exploit');
          pocs = getAllCvePocs(50);
        }
        res.writeHead(200, { 'Content-Type': 'application/json', ...secureHeaders() });
        res.end(JSON.stringify({ count: pocs.length, pocs }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json', ...secureHeaders() });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    // ── Technology Watchlist API ───────────────────────────────────────
    if (url === '/api/watchlist' && req.method === 'GET') {
      try {
        const { getMonitoredTechnologies } = require('./watchlist');
        const list = getMonitoredTechnologies();
        res.writeHead(200, { 'Content-Type': 'application/json', ...secureHeaders() });
        res.end(JSON.stringify({ count: list.length, watchlist: list }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json', ...secureHeaders() });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    if (url === '/api/watchlist' && req.method === 'POST') {
      if (!isTokenValid(req)) {
        res.writeHead(401, { 'Content-Type': 'application/json', ...secureHeaders() });
        res.end(JSON.stringify({ error: 'Unauthorized: Admin token required' }));
        return;
      }
      let bodyText = '';
      req.on('data', (c) => { bodyText += c; });
      req.on('end', () => {
        try {
          const { keyword, category } = JSON.parse(bodyText);
          const { addTechnology, getMonitoredTechnologies } = require('./watchlist');
          if (!keyword) {
            res.writeHead(400, { 'Content-Type': 'application/json', ...secureHeaders() });
            res.end(JSON.stringify({ error: 'Keyword required' }));
            return;
          }
          addTechnology(keyword, category || 'Custom', 'dashboard');
          res.writeHead(200, { 'Content-Type': 'application/json', ...secureHeaders() });
          res.end(JSON.stringify({ success: true, watchlist: getMonitoredTechnologies() }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json', ...secureHeaders() });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    if (url === '/api/watchlist' && req.method === 'DELETE') {
      if (!isTokenValid(req)) {
        res.writeHead(401, { 'Content-Type': 'application/json', ...secureHeaders() });
        res.end(JSON.stringify({ error: 'Unauthorized: Admin token required' }));
        return;
      }
      let bodyText = '';
      req.on('data', (c) => { bodyText += c; });
      req.on('end', () => {
        try {
          const { keyword } = JSON.parse(bodyText);
          const { removeTechnology, getMonitoredTechnologies } = require('./watchlist');
          removeTechnology(keyword);
          res.writeHead(200, { 'Content-Type': 'application/json', ...secureHeaders() });
          res.end(JSON.stringify({ success: true, watchlist: getMonitoredTechnologies() }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json', ...secureHeaders() });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    // ── Daily Cyber Podcast APIs & RSS Syndication ─────────────────────
    if (url === '/api/podcast/latest') {
      try {
        const { getLatestPodcastEpisode } = require('./db');
        const { compileDailyPodcast } = require('./podcast-generator');
        let latest = getLatestPodcastEpisode();
        if (!latest) {
          latest = compileDailyPodcast();
        }
        res.writeHead(200, { 'Content-Type': 'application/json', ...secureHeaders() });
        res.end(JSON.stringify(latest));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json', ...secureHeaders() });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    if (url === '/podcast.xml' || url === '/podcast' || url === '/feed/podcast.xml') {
      try {
        const { generatePodcastRssXml } = require('./podcast-generator');
        const xml = generatePodcastRssXml(`http://${req.headers.host || 'localhost:3000'}`);
        res.writeHead(200, { 'Content-Type': 'application/rss+xml; charset=utf-8', ...secureHeaders() });
        res.end(xml);
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain', ...secureHeaders() });
        res.end('Error generating podcast RSS feed');
      }
      return;
    }

    // ── Global 3D Threat Globe Coordinate Telemetry API ────────────────
    if (url === '/api/threat-map') {
      try {
        const { initDb } = require('./db');
        const database = initDb();
        const victims = database.prepare('SELECT victim_name, group_name, country, sector, discovered_at FROM ransomware_victims ORDER BY discovered_at DESC LIMIT 30').all();

        // Standard country lat/long centroid mapping
        const countryCoords = {
          'US': { lat: 37.09, lon: -95.71, name: 'United States' },
          'GB': { lat: 55.37, lon: -3.43, name: 'United Kingdom' },
          'DE': { lat: 51.16, lon: 10.45, name: 'Germany' },
          'FR': { lat: 46.22, lon: 2.21, name: 'France' },
          'IN': { lat: 20.59, lon: 78.96, name: 'India' },
          'CA': { lat: 56.13, lon: -106.34, name: 'Canada' },
          'AU': { lat: -25.27, lon: 133.77, name: 'Australia' },
          'JP': { lat: 36.20, lon: 138.25, name: 'Japan' },
          'BR': { lat: -14.23, lon: -51.92, name: 'Brazil' },
          'IT': { lat: 41.87, lon: 12.56, name: 'Italy' },
          'ES': { lat: 40.46, lon: -3.74, name: 'Spain' },
          'NL': { lat: 52.13, lon: 5.29, name: 'Netherlands' }
        };

        const mapNodes = victims.map((v) => {
          const code = (v.country || 'US').toUpperCase();
          const coords = countryCoords[code] || countryCoords['US'];
          return {
            target: v.victim_name || 'Enterprise Target',
            threatActor: v.group_name || 'Ransomware Group',
            sector: v.sector || 'Commercial',
            country: coords.name,
            lat: coords.lat + (Math.random() * 2 - 1),
            lon: coords.lon + (Math.random() * 2 - 1),
            timestamp: v.discovered_at
          };
        });

        if (mapNodes.length === 0) {
          const sampleThreats = [
            { target: 'Financial Core Banking Perimeter', threatActor: 'LockBit 3.0', sector: 'Finance', country: 'United States', lat: 38.89, lon: -77.03, timestamp: new Date().toISOString() },
            { target: 'Global Logistics Gateway Node', threatActor: 'RansomHub', sector: 'Logistics', country: 'United Kingdom', lat: 51.50, lon: -0.12, timestamp: new Date().toISOString() },
            { target: 'Automotive Manufacturing Plant', threatActor: 'BlackCat', sector: 'Manufacturing', country: 'Germany', lat: 52.52, lon: 13.40, timestamp: new Date().toISOString() },
            { target: 'Telecommunications Carrier', threatActor: 'Volt Typhoon', sector: 'Telecom', country: 'Australia', lat: -33.86, lon: 151.20, timestamp: new Date().toISOString() },
            { target: 'Energy Dispatch Grid Systems', threatActor: 'Akira', sector: 'Energy', country: 'France', lat: 48.85, lon: 2.35, timestamp: new Date().toISOString() },
            { target: 'Cloud Infrastructure Provider', threatActor: 'Play Ransomware', sector: 'Technology', country: 'Japan', lat: 35.67, lon: 139.65, timestamp: new Date().toISOString() }
          ];
          mapNodes.push(...sampleThreats);
        }

        res.writeHead(200, { 'Content-Type': 'application/json', ...secureHeaders() });
        res.end(JSON.stringify({ count: mapNodes.length, nodes: mapNodes }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json', ...secureHeaders() });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    // ── Public Syndication Feeds (RSS / Atom / JSON Feed) ─────────────
    if (url === '/feed.xml' || url === '/rss.xml' || url === '/rss') {
      const { generateRssXml } = require('./feed-generator');
      const articles = pipeline.getRecentArticles(30);
      const xml = generateRssXml(articles, `http://${req.headers.host || 'localhost:3000'}`);
      res.writeHead(200, { 'Content-Type': 'application/rss+xml; charset=utf-8', ...secureHeaders() });
      res.end(xml);
      return;
    }

    if (url === '/atom.xml' || url === '/atom') {
      const { generateAtomXml } = require('./feed-generator');
      const articles = pipeline.getRecentArticles(30);
      const xml = generateAtomXml(articles, `http://${req.headers.host || 'localhost:3000'}`);
      res.writeHead(200, { 'Content-Type': 'application/atom+xml; charset=utf-8', ...secureHeaders() });
      res.end(xml);
      return;
    }

    if (url === '/feed.json') {
      const { generateJsonFeed } = require('./feed-generator');
      const articles = pipeline.getRecentArticles(30);
      const jsonFeed = generateJsonFeed(articles, `http://${req.headers.host || 'localhost:3000'}`);
      res.writeHead(200, { 'Content-Type': 'application/feed+json; charset=utf-8', ...secureHeaders() });
      res.end(JSON.stringify(jsonFeed, null, 2));
      return;
    }

    // ── SIEM / SOC Audit Log Stream API (CEF / ECS) ───────────────────
    if (url === '/api/audit-log') {
      const { getRecentAuditLogs } = require('./audit-logger');
      const logs = getRecentAuditLogs(50);
      res.writeHead(200, { 'Content-Type': 'application/json', ...secureHeaders() });
      res.end(JSON.stringify({ total: logs.length, logs }));
      return;
    }

    // ── SQLite Database Backup & Optimization API ──────────────────────
    if (url === '/api/db/backup' && req.method === 'POST') {
      if (!isTokenValid(req)) {
        res.writeHead(401, { 'Content-Type': 'application/json', ...secureHeaders() });
        res.end(JSON.stringify({ error: 'Unauthorized: Admin token required' }));
        return;
      }

      const { createDatabaseBackup, optimizeDatabase, pruneOldRecords, cleanupGeneratedMedia } = require('./db-maintenance');
      const backupPath = createDatabaseBackup();
      const optimized = optimizeDatabase();
      const pruned = pruneOldRecords(90);
      const cleanedMedia = cleanupGeneratedMedia(30);

      res.writeHead(200, { 'Content-Type': 'application/json', ...secureHeaders() });
      res.end(JSON.stringify({
        success: Boolean(backupPath),
        backupPath,
        optimized,
        prunedRecords: pruned,
        cleanedMediaFiles: cleanedMedia
      }));
      return;
    }

    // ── Sources API ────────────────────────────────────────────────────
    if (url === '/api/sources' && req.method === 'GET') {
      const config = pipeline.config || {};
      const { getFeedHealth } = require('./fetcher');
      const healthMap = new Map(getFeedHealth().map((h) => [h.rss, h]));

      const sources = (config.sources || []).map((s) => ({
        ...s,
        health: healthMap.get(s.rss) || null
      }));

      res.writeHead(200, { 'Content-Type': 'application/json', ...secureHeaders() });
      res.end(JSON.stringify(sources));
      return;
    }

    // ── Toggle Source ──────────────────────────────────────────────────
    if (url === '/api/sources/toggle' && req.method === 'POST') {
      if (!isTokenValid(req)) {
        res.writeHead(401, { 'Content-Type': 'application/json', ...secureHeaders() });
        res.end(JSON.stringify({ error: 'Unauthorized: invalid or missing Dashboard Token' }));
        return;
      }

      let bodyText = '';
      req.on('data', (chunk) => { bodyText += chunk; });
      req.on('end', () => {
        try {
          const { name, enabled } = JSON.parse(bodyText);
          const configPath = path.join(process.cwd(), 'config.json');
          const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

          const target = (config.sources || []).find((s) => s.name === name);
          if (!target) {
            res.writeHead(444, { 'Content-Type': 'application/json', ...secureHeaders() });
            res.end(JSON.stringify({ error: 'Source not found' }));
            return;
          }

          target.enabled = Boolean(enabled);
          if (!writeConfigFile(configPath, config)) {
            res.writeHead(500, { 'Content-Type': 'application/json', ...secureHeaders() });
            res.end(JSON.stringify({ error: 'Failed to write config.json — check filesystem permissions (read-only volume?).' }));
            return;
          }
          if (pipeline.config) pipeline.config.sources = config.sources;

          recordAuditEvent({
            type: 'SOURCE_MANAGEMENT',
            name: 'News source toggled',
            severity: 'medium',
            actor: 'dashboard',
            details: `Source=${name} Enabled=${Boolean(enabled)}`,
            ip: clientIp
          });

          res.writeHead(200, { 'Content-Type': 'application/json', ...secureHeaders() });
          res.end(JSON.stringify({ message: `Source "${name}" updated`, enabled: target.enabled }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json', ...secureHeaders() });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    // ── Add Source ─────────────────────────────────────────────────────
    if (url === '/api/sources/add' && req.method === 'POST') {
      if (!isTokenValid(req)) {
        res.writeHead(401, { 'Content-Type': 'application/json', ...secureHeaders() });
        res.end(JSON.stringify({ error: 'Unauthorized: invalid or missing Dashboard Token' }));
        return;
      }

      let bodyText = '';
      req.on('data', (chunk) => { bodyText += chunk; });
      req.on('end', () => {
        try {
          const { name, rss, category } = JSON.parse(bodyText);
          const { isSafeUrl } = require('./fetcher');
          if (!name || !rss || !isSafeUrl(rss)) {
            res.writeHead(400, { 'Content-Type': 'application/json', ...secureHeaders() });
            res.end(JSON.stringify({ error: 'Valid feed name and safe HTTP/HTTPS RSS URL are required.' }));
            return;
          }

          const configPath = path.join(process.cwd(), 'config.json');
          const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

          config.sources = config.sources || [];
          config.sources.push({
            name: name.trim(),
            category: (category || 'Tech').trim(),
            rss: rss.trim(),
            enabled: true
          });

          if (!writeConfigFile(configPath, config)) {
            res.writeHead(500, { 'Content-Type': 'application/json', ...secureHeaders() });
            res.end(JSON.stringify({ error: 'Failed to write config.json — check filesystem permissions (read-only volume?).' }));
            return;
          }
          if (pipeline.config) pipeline.config.sources = config.sources;

          recordAuditEvent({
            type: 'SOURCE_MANAGEMENT',
            name: 'News source added',
            severity: 'medium',
            actor: 'dashboard',
            details: `Source=${name.trim()} RSS=${rss.trim()}`,
            ip: clientIp
          });

          res.writeHead(200, { 'Content-Type': 'application/json', ...secureHeaders() });
          res.end(JSON.stringify({ message: `Source "${name}" added successfully` }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json', ...secureHeaders() });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    // ── Delete Source ──────────────────────────────────────────────────
    if (url === '/api/sources/delete' && req.method === 'POST') {
      if (!isTokenValid(req)) {
        res.writeHead(401, { 'Content-Type': 'application/json', ...secureHeaders() });
        res.end(JSON.stringify({ error: 'Unauthorized: invalid or missing Dashboard Token' }));
        return;
      }

      let bodyText = '';
      req.on('data', (chunk) => { bodyText += chunk; });
      req.on('end', () => {
        try {
          const { name } = JSON.parse(bodyText);
          const configPath = path.join(process.cwd(), 'config.json');
          const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

          config.sources = (config.sources || []).filter((s) => s.name !== name);
          if (!writeConfigFile(configPath, config)) {
            res.writeHead(500, { 'Content-Type': 'application/json', ...secureHeaders() });
            res.end(JSON.stringify({ error: 'Failed to write config.json — check filesystem permissions (read-only volume?).' }));
            return;
          }
          if (pipeline.config) pipeline.config.sources = config.sources;

          recordAuditEvent({
            type: 'SOURCE_MANAGEMENT',
            name: 'News source deleted',
            severity: 'medium',
            actor: 'dashboard',
            details: `Source=${name}`,
            ip: clientIp
          });

          res.writeHead(200, { 'Content-Type': 'application/json', ...secureHeaders() });
          res.end(JSON.stringify({ message: `Source "${name}" deleted` }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json', ...secureHeaders() });
          res.end(JSON.stringify({ error: err.message }));
        }
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
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
          ...secureHeaders({
            'Content-Security-Policy': "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'"
          })
        });
        res.end(html);
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain', ...secureHeaders() });
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
