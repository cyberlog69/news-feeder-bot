// src/dashboard/html.js
// Server-rendered dashboard and login page templates.
// Kept separate from the HTTP route dispatcher to keep both readable.

const { version: APP_VERSION } = require('../../package.json');

const IS_PROD = process.env.NODE_ENV === 'production';

// Version comes from package.json at require time.
function getVersion() {
  return APP_VERSION || '3.x';
}

function buildHtml(stats, recentArticles, logLines, startTime, options = {}) {
  const uptime    = Math.floor((Date.now() - startTime) / 1000);
  const uptimeStr = uptime < 60   ? `${uptime}s`
    : uptime < 3600 ? `${Math.floor(uptime / 60)}m ${uptime % 60}s`
    : `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`;

  const version = getVersion();
  const { authRequired = false, role = null } = options;

  const articleRows = recentArticles.map((a) => `
    <tr>
      <td>${escHtml(a.sentAt ? new Date(a.sentAt).toLocaleString('en-IN') : '')}</td>
      <td><a href="${escHtml(safeHref(a.url))}" target="_blank" rel="noopener noreferrer">${escHtml(a.title)}</a></td>
      <td>${escHtml(a.source)}</td>
    </tr>`).join('');

  const logHtml = logLines.map((l) => {
    let cls = 'log-info';
    if (l.includes('[ERROR]'))   cls = 'log-error';
    else if (l.includes('[WARN]'))    cls = 'log-warn';
    else if (l.includes('[SUCCESS]')) cls = 'log-success';
    return `<div class="${cls}">${escHtml(l)}</div>`;
  }).join('');

  // Token field shown when any admin/analyst/auditor token is configured
  const tokenField = authRequired
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
    /* Podcast Subscribe Modal */
    .modal-overlay{display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(4px);z-index:9999;align-items:center;justify-content:center;padding:16px}
    .modal-overlay.active{display:flex}
    .modal-card{background:var(--surface);border:1px solid var(--border);border-radius:12px;max-width:560px;width:100%;box-shadow:0 20px 40px rgba(0,0,0,0.6);overflow:hidden;animation:modalFadeIn .2s ease-out}
    @keyframes modalFadeIn{from{opacity:0;transform:scale(.96) translateY(10px)}to{opacity:1;transform:scale(1) translateY(0)}}
    .modal-header{padding:16px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between}
    .modal-header h3{font-size:15px;color:var(--accent);display:flex;align-items:center;gap:8px}
    .modal-close{background:none;border:none;color:var(--muted);font-size:22px;cursor:pointer;line-height:1;padding:2px 8px;border-radius:4px}
    .modal-close:hover{color:var(--text);background:var(--border)}
    .modal-body{padding:18px 20px}
    .feed-url-group{display:flex;gap:8px;margin:10px 0 16px}
    .feed-url-input{flex:1;background:var(--bg);border:1px solid var(--border);color:var(--text);padding:9px 12px;border-radius:6px;font-family:'Cascadia Code','Consolas',monospace;font-size:12px}
    .btn-copy{background:var(--accent);color:#fff;border:none;padding:9px 14px;border-radius:6px;font-weight:600;cursor:pointer;font-size:12px;white-space:nowrap;transition:background .15s}
    .btn-copy:hover{background:#6d6dda}
    .btn-copy.copied{background:var(--green);color:#000}
    .app-buttons{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin-bottom:16px}
    .app-btn{display:flex;align-items:center;justify-content:center;gap:6px;padding:8px 10px;background:var(--bg);border:1px solid var(--border);border-radius:6px;color:var(--text);text-decoration:none;font-size:12px;font-weight:600;transition:border-color .15s,background .15s}
    .app-btn:hover{border-color:var(--accent);background:rgba(129,140,248,0.08);color:var(--blue)}
    .guide-box{background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:12px 14px;font-size:12px;line-height:1.6}
    .guide-box h4{color:var(--text);font-size:11px;margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em}
    .guide-box ol{margin-left:18px;color:var(--muted)}
    .guide-box li{margin-bottom:3px}
    .guide-box b{color:var(--text)}
  </style>
</head>
<body>
  <header>
    <span style="font-size:28px">📰</span>
    <h1>News Feeder Bot v${escHtml(version)}</h1>
    <span class="badge ${IS_PROD ? 'prod' : ''}">● ${IS_PROD ? 'PRODUCTION' : 'LOCAL'}</span>
    <span style="margin-left:auto;color:var(--muted);font-size:12px">
      ${role ? `Signed in as ${escHtml(role)} · <a href="/logout" style="color:var(--blue)">Sign out</a> · ` : ''}Auto-refresh: 30s
    </span>
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
        <div style="margin-bottom:12px;">
          <audio id="podcastAudio" controls preload="metadata" style="width:100%;height:36px;border-radius:6px;background:var(--bg);" src="/api/podcast/audio"></audio>
        </div>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
          <button type="button" class="btn" onclick="openSubscribeModal()" style="background:#818cf8;color:#fff;border-color:#818cf8;font-weight:600;display:inline-flex;align-items:center;gap:6px;">📡 Subscribe RSS (Apple/Spotify)</button>
          <button type="button" class="btn" onclick="playPodcastTTS()" style="display:inline-flex;align-items:center;gap:6px;">🗣️ Read with Browser TTS</button>
          <a href="/api/podcast/audio" download="cyber-threat-briefing.mp3" class="btn" style="color:var(--muted);display:inline-flex;align-items:center;gap:6px;">⬇️ Download MP3</a>
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

  <!-- Exposed IPs & WAN Intelligence Panel -->
  <section id="exposed-ip-section">
    <h2>🌐 Exposed IPs &amp; WAN Intelligence <span id="exposedIpLastUpdate" style="font-size:11px;color:var(--muted);margin-left:10px">Loading…</span></h2>
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:20px;">
      <!-- Stats cards row -->
      <div id="exposedIpStats" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:16px;">
        <div class="card" style="padding:14px;"><div class="label">Total IPs</div><div class="value" id="eiTotal">—</div><div class="sub">indexed exposed hosts</div></div>
        <div class="card" style="padding:14px;"><div class="label" style="color:var(--red)">Malicious</div><div class="value" id="eiMalicious" style="color:var(--red)">—</div><div class="sub">classified malicious</div></div>
        <div class="card" style="padding:14px;"><div class="label" style="color:var(--yellow)">Mass Scanners</div><div class="value" id="eiNoisy" style="color:var(--yellow)">—</div><div class="sub">GreyNoise noisy IPs</div></div>
        <div class="card" style="padding:14px;"><div class="label" style="color:var(--orange)">High Risk</div><div class="value" id="eiHighRisk" style="color:var(--orange)">—</div><div class="sub">risk score ≥ 7/10</div></div>
      </div>
      <!-- Tab bar & Controls -->
      <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;align-items:center;">
        <button id="eiTabGlobal" class="btn btn-run" onclick="loadExposedIps('global')" style="font-size:12px;padding:6px 14px;">🌍 Global</button>
        <button id="eiTabIndia"  class="btn" onclick="loadExposedIps('IN')" style="font-size:12px;padding:6px 14px;">🇮🇳 India (IN)</button>
        
        <select id="eiMonthSelect" class="search-input" style="padding:6px 10px;font-size:12px;min-width:130px;" onchange="onExposedIpMonthChange(this.value)">
          <option value="">📅 All Months</option>
        </select>

        <select id="eiSortSelect" class="search-input" style="padding:6px 10px;font-size:12px;min-width:140px;" onchange="onExposedIpSortChange(this.value)">
          <option value="risk_desc">⚡ Risk (High → Low)</option>
          <option value="risk_asc">⚡ Risk (Low → High)</option>
          <option value="date_desc">🕒 Date (Newest first)</option>
          <option value="date_asc">🕒 Date (Oldest first)</option>
          <option value="ip_asc">🌐 IP Address (A-Z)</option>
          <option value="country_asc">🏳️ Country (A-Z)</option>
        </select>

        <span style="flex:1"></span>
        <input id="eiSearchInput" class="search-input" style="min-width:160px;" placeholder="Filter by IP, country, service…" oninput="filterExposedIps(this.value)">
        <button class="btn" onclick="triggerIpScan()" title="Trigger a fresh scan now">⟳ Refresh Scan</button>
        <button class="btn" onclick="printExposedIpsPdf()" title="Print or save report as PDF" style="border-color:var(--blue);color:var(--blue);font-weight:600;">🖨️ Print / PDF</button>
        <button class="btn" onclick="exportExposedIpsDoc()" title="Export report as Word Document (.doc)" style="border-color:var(--green);color:var(--green);font-weight:600;">📄 Export DOC</button>
      </div>
      <!-- Country breakdown mini-chart -->
      <div id="eiCountryBar" style="margin-bottom:14px;"></div>
      <!-- Main table -->
      <div id="exposedIpBox"><div class="log-info">Loading exposed IP intelligence…</div></div>
      <p style="color:var(--muted);font-size:11px;margin-top:10px;">💡 Data sourced from <b>Shodan InternetDB</b>, <b>GreyNoise Community</b>, and <b>Shadowserver</b> public feeds. Updated daily. No active scanning is performed.</p>
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
    function authHeaders(extra) {
      var headers = Object.assign({}, extra || {});
      var el = document.getElementById('triggerToken');
      if (el && el.value.trim()) headers['Authorization'] = 'Bearer ' + el.value.trim();
      return headers;
    }
    function renderArticleTable(articles, emptyMsg) {
      if (!articles || articles.length === 0) return '<div class="log-info">' + emptyMsg + '</div>';
      return '<table><thead><tr><th>Time</th><th>Title</th><th>Source</th></tr></thead><tbody>' +
        articles.map(function(a) {
          const t = a.sentAt ? new Date(a.sentAt).toLocaleString('en-IN') : '—';
          const href = /^https?:\/\//i.test(a.url || '') ? a.url : '';
          const title = href ? '<a href="' + esc(href) + '" target="_blank" rel="noopener">' + esc(a.title || href) + '</a>' : esc(a.title || '');
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
          var audio = document.getElementById('podcastAudio');
          if (audio && data.audioUrl) {
            audio.src = data.audioUrl;
          }
        }
      } catch (e) {}
    }

    function openSubscribeModal() {
      var modal = document.getElementById('subscribeModal');
      var input = document.getElementById('feedUrlInput');
      var fullUrl = window.location.origin + '/podcast.xml';
      if (input) input.value = fullUrl;

      var apple = document.getElementById('applePodcastsLink');
      if (apple) {
        apple.href = 'podcast://' + window.location.host + '/podcast.xml';
      }

      var pocket = document.getElementById('pocketCastsLink');
      if (pocket) {
        pocket.href = 'https://pca.st/subscribe?url=' + encodeURIComponent(fullUrl);
      }

      var overcast = document.getElementById('overcastLink');
      if (overcast) {
        overcast.href = 'overcast://x-callback-url/add?url=' + encodeURIComponent(fullUrl);
      }

      if (modal) modal.classList.add('active');
    }

    function closeSubscribeModal() {
      var modal = document.getElementById('subscribeModal');
      if (modal) modal.classList.remove('active');
    }

    window.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') closeSubscribeModal();
    });

    async function copyPodcastFeedUrl() {
      var input = document.getElementById('feedUrlInput');
      var btn = document.getElementById('copyFeedBtn');
      if (!input) return;
      var url = input.value || (window.location.origin + '/podcast.xml');
      try {
        await navigator.clipboard.writeText(url);
        if (btn) {
          btn.textContent = '✅ Copied!';
          btn.classList.add('copied');
          setTimeout(function() {
            btn.textContent = '📋 Copy URL';
            btn.classList.remove('copied');
          }, 2500);
        }
      } catch (e) {
        input.select();
        document.execCommand('copy');
        if (btn) {
          btn.textContent = '✅ Copied!';
          btn.classList.add('copied');
          setTimeout(function() {
            btn.textContent = '📋 Copy URL';
            btn.classList.remove('copied');
          }, 2500);
        }
      }
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
            '<button data-tech="' + esc(item.keyword) + '" onclick="deleteTech(this.dataset.tech)" style="background:none;border:none;color:var(--red);cursor:pointer;font-weight:bold;margin-left:4px;">×</button></span>';
        }).join('') || '<div class="log-info">Watchlist empty</div>';
      } catch (e) {}
    }

    async function addTech() {
      var input = document.getElementById('newTechInput');
      var kw = input.value.trim();
      if (!kw) return;
      await fetch('/api/watchlist', { method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ keyword: kw }) });
      input.value = '';
      loadWatchlist();
    }

    async function deleteTech(kw) {
      await fetch('/api/watchlist', { method: 'DELETE', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ keyword: kw }) });
      loadWatchlist();
    }

    loadThreatMap();
    loadDetectionRules();
    loadPocRadar();
    loadPodcast();
    loadWatchlist();

    // ── Exposed IPs & WAN Intelligence ──────────────────────────────────
    var __exposedIpData = [];
    var __exposedIpFilter = '';
    var __exposedIpTab = 'global';
    var __exposedIpMonth = '';
    var __exposedIpSort = 'risk_desc';

    function riskColor(score) {
      if (score >= 8) return 'var(--red)';
      if (score >= 5) return 'var(--orange)';
      if (score >= 3) return 'var(--yellow)';
      return 'var(--green)';
    }

    function riskBadge(score) {
      var label = score >= 8 ? 'CRITICAL' : score >= 5 ? 'HIGH' : score >= 3 ? 'MEDIUM' : 'LOW';
      var color = riskColor(score);
      return '<span style="background:' + color + ';color:#000;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;">' + label + '</span>';
    }

    function renderExposedIpTable(data) {
      var q = __exposedIpFilter.toLowerCase();
      var rows = q ? data.filter(function(r) {
        return (r.ip + r.country + r.org + (r.services || []).join(' ') + (r.tags || []).join(' ')).toLowerCase().includes(q);
      }) : data;

      if (!rows || rows.length === 0) {
        document.getElementById('exposedIpBox').innerHTML =
          '<div class="log-info">No exposed IP records found' + (q ? ' matching "' + esc(q) + '"' : '') + '. Select another month or click ⟳ Refresh Scan.</div>';
        return;
      }

      var html = '<table><thead><tr>' +
        '<th>Risk</th><th>IP Address</th><th>Country</th><th>Org / ASN</th>' +
        '<th>Open Services</th><th>CVEs</th><th>Tags</th><th>Classification</th><th>Last Seen</th>' +
        '</tr></thead><tbody>';

      rows.forEach(function(r) {
        var svcs = (r.services || []).slice(0, 5).map(function(s) {
          return '<span style="background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:1px 5px;font-size:10px;margin:1px;display:inline-block">' + esc(s) + '</span>';
        }).join('');

        var cveList = (r.cves || []).slice(0, 3).map(function(c) {
          return '<span style="color:var(--red);font-size:10px;">' + esc(c) + '</span>';
        }).join(' ');

        var tagList = (r.tags || []).slice(0, 3).map(function(t) {
          return '<span style="background:rgba(251,191,36,0.15);color:var(--yellow);font-size:10px;padding:1px 5px;border-radius:4px;">' + esc(t) + '</span>';
        }).join(' ');

        var classColor = r.gnClass === 'malicious' ? 'var(--red)' : r.gnClass === 'benign' ? 'var(--green)' : 'var(--muted)';
        var classIcon  = r.gnClass === 'malicious' ? '⛔' : r.gnClass === 'benign' ? '✅' : r.isNoise ? '📡' : '❓';
        var ls = r.lastSeen ? new Date(r.lastSeen).toLocaleDateString('en-IN') : '—';

        html += '<tr>' +
          '<td>' + riskBadge(r.riskScore) + ' <b style="color:' + riskColor(r.riskScore) + ';font-size:12px;margin-left:3px">' + (r.riskScore || 0).toFixed(1) + '</b></td>' +
          '<td><code style="color:var(--blue);font-size:12px">' + esc(r.ip) + '</code></td>' +
          '<td>' + esc(r.country || r.countryCode || '—') + (r.city ? '<br><span style="color:var(--muted);font-size:10px">' + esc(r.city) + '</span>' : '') + '</td>' +
          '<td style="font-size:11px;color:var(--muted);max-width:160px;word-break:break-all">' + esc((r.org || '').slice(0, 50)) + '</td>' +
          '<td>' + (svcs || '<span style="color:var(--muted);font-size:10px">—</span>') + '</td>' +
          '<td>' + (cveList || '<span style="color:var(--muted);font-size:10px">None</span>') + '</td>' +
          '<td>' + (tagList || '<span style="color:var(--muted);font-size:10px">—</span>') + '</td>' +
          '<td><span style="color:' + classColor + ';font-weight:600;font-size:11px">' + classIcon + ' ' + esc(r.gnClass || 'unknown') + '</span>' +
            (r.isNoise ? ' <span style="font-size:10px;color:var(--muted)">(noisy)</span>' : '') + '</td>' +
          '<td style="white-space:nowrap;font-size:11px">' + ls + '</td>' +
        '</tr>';
      });

      html += '</tbody></table>';
      document.getElementById('exposedIpBox').innerHTML = html;
    }

    function filterExposedIps(q) {
      __exposedIpFilter = q;
      renderExposedIpTable(__exposedIpData);
    }

    function onExposedIpMonthChange(val) {
      __exposedIpMonth = val || '';
      loadExposedIps(__exposedIpTab);
    }

    function onExposedIpSortChange(val) {
      __exposedIpSort = val || 'risk_desc';
      loadExposedIps(__exposedIpTab);
    }

    function printExposedIpsPdf() {
      var country = __exposedIpTab !== 'global' ? __exposedIpTab : '';
      var params = [];
      params.push('autoPrint=1');
      if (country) params.push('country=' + encodeURIComponent(country));
      if (__exposedIpMonth) params.push('month=' + encodeURIComponent(__exposedIpMonth));
      if (__exposedIpSort) params.push('sort=' + encodeURIComponent(__exposedIpSort));
      window.open('/api/exposed-ips/report?' + params.join('&'), '_blank');
    }

    function exportExposedIpsDoc() {
      var country = __exposedIpTab !== 'global' ? __exposedIpTab : '';
      var params = [];
      params.push('format=doc');
      if (country) params.push('country=' + encodeURIComponent(country));
      if (__exposedIpMonth) params.push('month=' + encodeURIComponent(__exposedIpMonth));
      if (__exposedIpSort) params.push('sort=' + encodeURIComponent(__exposedIpSort));
      window.location.href = '/api/exposed-ips/export?' + params.join('&');
    }

    async function loadExposedIps(scope) {
      __exposedIpTab = scope;
      document.getElementById('eiTabGlobal').className = scope === 'global' ? 'btn btn-run' : 'btn';
      document.getElementById('eiTabIndia').className  = scope === 'IN'     ? 'btn btn-run' : 'btn';
      document.getElementById('exposedIpBox').innerHTML = '<div class="log-info">Loading…</div>';
      try {
        var queryParams = [];
        if (scope !== 'global') queryParams.push('country=' + encodeURIComponent(scope));
        if (__exposedIpMonth) queryParams.push('month=' + encodeURIComponent(__exposedIpMonth));
        if (__exposedIpSort) queryParams.push('sort=' + encodeURIComponent(__exposedIpSort));
        var url = '/api/exposed-ips' + (queryParams.length ? '?' + queryParams.join('&') : '');

        var res = await fetch(url);
        var data = await res.json();

        // Update summary stats
        var stats = data.stats || {};
        document.getElementById('eiTotal').textContent    = stats.total    ?? '—';
        document.getElementById('eiMalicious').textContent = stats.malicious ?? '—';
        document.getElementById('eiNoisy').textContent    = stats.noisy     ?? '—';
        document.getElementById('eiHighRisk').textContent = stats.highRisk  ?? '—';
        if (stats.lastUpdated) {
          document.getElementById('exposedIpLastUpdate').textContent =
            'Last updated: ' + new Date(stats.lastUpdated).toLocaleString('en-IN') +
            (__exposedIpMonth ? ' (Filter: ' + __exposedIpMonth + ')' : '');
        }

        // Dynamically populate available months if not yet loaded
        var monthSel = document.getElementById('eiMonthSelect');
        if (monthSel && stats.availableMonths && stats.availableMonths.length) {
          var curVal = monthSel.value;
          var optsHtml = '<option value="">📅 All Months</option>';
          stats.availableMonths.forEach(function(m) {
            optsHtml += '<option value="' + esc(m) + '"' + (m === curVal ? ' selected' : '') + '>📅 ' + esc(m) + '</option>';
          });
          monthSel.innerHTML = optsHtml;
          monthSel.value = curVal;
        }

        // Country breakdown bar chart
        var byCountry = stats.byCountry || [];
        var maxC = Math.max.apply(null, byCountry.map(function(c){return c.count;}).concat([1]));
        document.getElementById('eiCountryBar').innerHTML = byCountry.length ? (
          '<div style="margin-bottom:6px;color:var(--muted);font-size:11px;text-transform:uppercase;font-weight:600;letter-spacing:.05em">Top Countries</div>' +
          byCountry.slice(0, 8).map(function(c) {
            var pct = Math.round((c.count / maxC) * 100);
            return '<div class="bar-row"><div class="bar-label" style="min-width:80px">' + esc(c.country_code || c.countryCode || '??') + '</div>' +
              '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%;background:var(--blue)"></div></div>' +
              '<div class="bar-count">' + c.count + '</div></div>';
          }).join('')
        ) : '';

        __exposedIpData = data.ips || [];
        renderExposedIpTable(__exposedIpData);
      } catch (e) {
        document.getElementById('exposedIpBox').innerHTML =
          '<div class="log-info">No scan data yet. Click ⟳ Refresh Scan to run an IP scan.</div>';
      }
    }

    async function triggerIpScan() {
      var box = document.getElementById('exposedIpBox');
      box.innerHTML = '<div class="log-info">⏳ Triggering exposed-IP scan in background…</div>';
      try {
        var tokenEl = document.getElementById('triggerToken');
        var headers = {};
        if (tokenEl && tokenEl.value.trim()) headers['Authorization'] = 'Bearer ' + tokenEl.value.trim();
        var res = await fetch('/api/exposed-ips/scan', { method: 'POST', headers: headers });
        var data = await res.json();
        if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
        box.innerHTML = '<div class="log-success">✅ ' + (data.message || 'Scan triggered!') + ' Results will appear after the scan completes (30–120s).</div>';
        setTimeout(function() { loadExposedIps(__exposedIpTab); }, 3000);
      } catch (e) {
        box.innerHTML = '<div class="log-error">❌ Scan trigger failed: ' + esc(e.message) + '</div>';
      }
    }

    // Auto-load exposed IPs panel on page load
    loadExposedIps('global');

    async function triggerRun() {
      const btn    = document.getElementById('runNowBtn');
      const status = document.getElementById('triggerStatus');
      const tokenInput = document.getElementById('triggerToken');
      const token  = tokenInput ? tokenInput.value.trim() : '';

      if (btn) btn.disabled = true;
      if (status) {
        status.className = 'running';
        status.textContent = '⏳ Triggering pipeline…';
        status.style.display = 'inline-block';
      }

      try {
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = 'Bearer ' + token;

        const res = await fetch('/trigger', { method: 'POST', headers, body: JSON.stringify({}) });
        const data = await res.json().catch(() => ({}));

        if (res.ok) {
          if (status) {
            status.className = 'ok';
            status.textContent = '✅ ' + (data.message || 'Pipeline triggered successfully!');
          }
          setTimeout(function() { location.reload(); }, 2500);
        } else {
          if (status) {
            status.className = 'err';
            status.textContent = '❌ ' + (data.error || 'Failed (HTTP ' + res.status + ')');
          }
          if (btn) btn.disabled = false;
        }
      } catch (e) {
        if (status) {
          status.className = 'err';
          status.textContent = '❌ Network error: ' + e.message;
        }
        if (btn) btn.disabled = false;
      }
    }
  </script>

  <!-- Podcast Subscribe Modal -->
  <div id="subscribeModal" class="modal-overlay" onclick="if(event.target===this)closeSubscribeModal()">
    <div class="modal-card">
      <div class="modal-header">
        <h3>🎙️ Subscribe to Cyber Threat Briefing</h3>
        <button class="modal-close" onclick="closeSubscribeModal()" aria-label="Close">&times;</button>
      </div>
      <div class="modal-body">
        <p style="color:var(--muted);font-size:13px;margin-bottom:12px;line-height:1.5;">
          Subscribe to autonomous daily 2-minute cyber threat intelligence briefings in Apple Podcasts, Pocket Casts, or your favorite podcast app via standard RSS.
        </p>

        <label style="font-size:11px;color:var(--muted);text-transform:uppercase;font-weight:700;letter-spacing:.05em;">Podcast RSS Feed URL</label>
        <div class="feed-url-group">
          <input type="text" id="feedUrlInput" class="feed-url-input" readonly value="">
          <button id="copyFeedBtn" class="btn-copy" onclick="copyPodcastFeedUrl()">📋 Copy URL</button>
        </div>

        <div class="app-buttons">
          <a id="applePodcastsLink" href="#" class="app-btn">🍏 Apple Podcasts</a>
          <a id="pocketCastsLink" href="#" target="_blank" rel="noopener" class="app-btn">📱 Pocket Casts</a>
          <a id="overcastLink" href="#" target="_blank" rel="noopener" class="app-btn">🎧 Overcast</a>
          <a href="/podcast.xml" target="_blank" class="app-btn" style="color:var(--muted);">📄 Raw XML Feed</a>
        </div>

        <div class="guide-box">
          <h4>How to Add to Your App</h4>
          <ol>
            <li>Click <b>📋 Copy URL</b> above.</li>
            <li>In <b>Apple Podcasts</b>: Go to <b>Library</b> ➔ tap <b>⋯</b> ➔ choose <b>Follow a Show by URL…</b> ➔ paste and tap Follow.</li>
            <li>In <b>Pocket Casts / Overcast / AntennaPod</b>: Paste the URL directly into the search bar.</li>
          </ol>
          <div style="margin-top:10px;padding-top:8px;border-top:1px solid var(--border);color:var(--muted);font-size:11px;line-height:1.4;">
            💡 <b>Spotify notice:</b> Spotify is a closed directory where show creators register feeds once via <a href="https://podcasters.spotify.com" target="_blank" rel="noopener" style="color:var(--blue)">podcasters.spotify.com</a>. You can listen directly in the web audio player above or subscribe in Apple Podcasts / Pocket Casts.
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/** Only emit clickable links for http(s) URLs (legacy DB rows may be unsafe). */
function safeHref(url) {
  try {
    const parsed = new URL(String(url));
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') ? String(url) : '#';
  } catch {
    return '#';
  }
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Minimal login page used when dashboard tokens are configured. */
function buildLoginHtml({ error = '', next = '/', configured = true } = {}) {
  const safeNext = /^\/(?!\/)/.test(String(next || '/')) ? String(next) : '/';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Sign in — News Feeder Bot</title>
  <style>
    :root{--bg:#0f0f13;--surface:#1a1a24;--border:#2d2d40;--text:#e0e0e0;--muted:#9ca3af;--accent:#818cf8;--red:#f87171}
    *{box-sizing:border-box}
    body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--bg);color:var(--text);font-family:'Segoe UI',system-ui,sans-serif}
    form{width:min(420px,92vw);background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:28px}
    h1{font-size:20px;color:var(--accent);margin:0 0 6px}
    p{color:var(--muted);font-size:13px;line-height:1.5;margin:0 0 18px}
    label{display:block;font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-bottom:6px}
    input{width:100%;padding:10px 12px;border-radius:6px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:14px}
    button{width:100%;margin-top:16px;padding:10px;border:0;border-radius:6px;background:var(--accent);color:#fff;font-weight:700;cursor:pointer}
    .error{background:#3f1d1d;border:1px solid var(--red);color:#fecaca;padding:10px;border-radius:6px;font-size:13px;margin-bottom:14px}
    code{background:var(--bg);padding:2px 5px;border-radius:4px;color:var(--accent)}
  </style>
</head>
<body>
  <form method="post" action="/login">
    <h1>📰 News Feeder Bot</h1>
    <p>${configured
      ? 'Enter your dashboard token to access the SOC console and read-only APIs.'
      : 'No token is configured. Set <code>ADMIN_TOKEN</code> (or <code>DASHBOARD_TOKEN</code>) in the environment, then restart the bot.'}</p>
    ${error ? `<div class="error">${escHtml(error)}</div>` : ''}
    ${configured ? `
    <label for="token">Access token</label>
    <input id="token" name="token" type="password" autocomplete="current-password" autofocus required>
    <input type="hidden" name="next" value="${escHtml(safeNext)}">
    <button type="submit">Sign in</button>` : ''}
  </form>
</body>
</html>`;
}

module.exports = { buildHtml, buildLoginHtml, escHtml, safeHref, getVersion };
