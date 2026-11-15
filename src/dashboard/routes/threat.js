// src/dashboard/routes/threat.js
// Threat-intel, watchlist, subscription, and SOC telemetry routes.

const { isTokenValid } = require('../auth');
const { isDemoMode } = require('../../db');
const { getVersion } = require('../html');

/**
 * @param {object} ctx - { req, res, url, pipeline, startTime, secureHeaders }
 * @returns {Promise<boolean>} true when a route was handled
 */
async function handleThreatRoutes({ req, res, url, pipeline, startTime, secureHeaders }) {
    // ── Threat Intel & SOC Radar API ─────────────────────────────────
    if (url === '/api/threat-intel') {
      try {
        const { initDb } = require('../../db');
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
      return true;
    }

    // ── Force CISA KEV / threat data sync (admin) ──────────────────────
    if (url === '/api/threat-intel/sync' && req.method === 'POST') {
      if (!isTokenValid(req, 'admin')) {
        res.writeHead(401, { 'Content-Type': 'application/json', ...secureHeaders() });
        res.end(JSON.stringify({ error: 'Unauthorized: Admin token required' }));
        return true;
      }

      try {
        const { syncThreatData } = require('../../threat-ops');
        await syncThreatData(true);
        const { initDb } = require('../../db');
        const db = initDb();
        const kevCount = db.prepare('SELECT count(*) as count FROM cisa_kev_cache').get().count;
        res.writeHead(200, { 'Content-Type': 'application/json', ...secureHeaders() });
        res.end(JSON.stringify({ success: true, cisaKevTracked: kevCount }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json', ...secureHeaders() });
        res.end(JSON.stringify({ error: err.message }));
      }
      return true;
    }

    // ── Run ransomware victim sweep immediately (admin) ────────────────
    if (url === '/api/threat-intel/ransomware' && req.method === 'POST') {
      if (!isTokenValid(req, 'admin')) {
        res.writeHead(401, { 'Content-Type': 'application/json', ...secureHeaders() });
        res.end(JSON.stringify({ error: 'Unauthorized: Admin token required' }));
        return true;
      }

      try {
        const { runRansomwareTracking } = require('../../threat-ops');
        const alerted = await runRansomwareTracking([]);
        res.writeHead(200, { 'Content-Type': 'application/json', ...secureHeaders() });
        res.end(JSON.stringify({ success: true, alerted }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json', ...secureHeaders() });
        res.end(JSON.stringify({ error: err.message }));
      }
      return true;
    }

    // ── Topic Subscriptions API ────────────────────────────────────────
    if (url === '/api/subscriptions' && req.method === 'GET') {
      if (!isTokenValid(req, 'auditor')) {
        res.writeHead(401, { 'Content-Type': 'application/json', ...secureHeaders() });
        res.end(JSON.stringify({ error: 'Unauthorized: auditor token required' }));
        return true;
      }
      try {
        const { listSubscriptions } = require('../../subscription-manager');
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
      return true;
    }

    if (url === '/api/subscriptions' && req.method === 'POST') {
      if (!isTokenValid(req, 'admin')) {
        res.writeHead(401, { 'Content-Type': 'application/json', ...secureHeaders() });
        res.end(JSON.stringify({ error: 'Unauthorized: admin token required' }));
        return true;
      }
      let bodyText = '';
      req.on('data', (c) => { if (bodyText.length < 100000) bodyText += c; });
      req.on('end', () => {
        try {
          const { targetId, platform, topics } = JSON.parse(bodyText);
          if (!targetId || !platform) {
            res.writeHead(400, { 'Content-Type': 'application/json', ...secureHeaders() });
            res.end(JSON.stringify({ error: 'targetId and platform are required' }));
            return true;
          }
          const { setSubscription, listSubscriptions } = require('../../subscription-manager');
          const updated = setSubscription(String(targetId), String(platform), topics);
          res.writeHead(200, { 'Content-Type': 'application/json', ...secureHeaders() });
          res.end(JSON.stringify({ success: true, topics: updated, subscriptions: listSubscriptions() }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json', ...secureHeaders() });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return true;
    }

    if (url === '/api/subscriptions' && req.method === 'DELETE') {
      if (!isTokenValid(req, 'admin')) {
        res.writeHead(401, { 'Content-Type': 'application/json', ...secureHeaders() });
        res.end(JSON.stringify({ error: 'Unauthorized: admin token required' }));
        return true;
      }
      let bodyText = '';
      req.on('data', (c) => { if (bodyText.length < 100000) bodyText += c; });
      req.on('end', () => {
        try {
          const { targetId, platform } = JSON.parse(bodyText);
          if (!targetId || !platform) {
            res.writeHead(400, { 'Content-Type': 'application/json', ...secureHeaders() });
            res.end(JSON.stringify({ error: 'targetId and platform are required' }));
            return true;
          }
          const { deleteUserSubscription, listSubscriptions } = require('../../subscription-manager');
          deleteUserSubscription(String(targetId), String(platform));
          res.writeHead(200, { 'Content-Type': 'application/json', ...secureHeaders() });
          res.end(JSON.stringify({ success: true, subscriptions: listSubscriptions() }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json', ...secureHeaders() });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return true;
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
      return true;
    }

    // ── Feed Health Index ──────────────────────────────────────────────
    if (url === '/api/feed-health') {
      const { getFeedHealth } = require('../../fetcher');
      const healthData = getFeedHealth();
      res.writeHead(200, { 'Content-Type': 'application/json', ...secureHeaders() });
      res.end(JSON.stringify(healthData));
      return true;
    }

    // ── Executive CISO Briefing API ────────────────────────────────────
    if (url === '/api/ciso-briefing') {
      try {
        const { generateCisoBriefing, formatBriefingHtml } = require('../../report-generator');
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
      return true;
    }

    // ── Sigma & YARA Detection Rules API ───────────────────────────────
    if (url === '/api/detection-rules') {
      try {
        const { getAllDetectionRules, setCachedDetectionRule } = require('../../db');
        let rules = getAllDetectionRules(50);
        if (rules.length === 0 && isDemoMode()) {
          const { generateSigmaRule, generateYaraRule } = require('../../sigma-generator');
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
      return true;
    }

    // ── Exploit PoC Radar API ──────────────────────────────────────────
    if (url === '/api/pocs') {
      try {
        const { getAllCvePocs, setCvePoc } = require('../../db');
        let pocs = getAllCvePocs(50);
        if (pocs.length === 0 && isDemoMode()) {
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
      return true;
    }

    // ── Technology Watchlist API ───────────────────────────────────────
    if (url === '/api/watchlist' && req.method === 'GET') {
      try {
        const { getMonitoredTechnologies } = require('../../watchlist');
        const list = getMonitoredTechnologies();
        res.writeHead(200, { 'Content-Type': 'application/json', ...secureHeaders() });
        res.end(JSON.stringify({ count: list.length, watchlist: list }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json', ...secureHeaders() });
        res.end(JSON.stringify({ error: err.message }));
      }
      return true;
    }

    if (url === '/api/watchlist' && req.method === 'POST') {
      if (!isTokenValid(req)) {
        res.writeHead(401, { 'Content-Type': 'application/json', ...secureHeaders() });
        res.end(JSON.stringify({ error: 'Unauthorized: Admin token required' }));
        return true;
      }
      let bodyText = '';
      req.on('data', (c) => { if (bodyText.length < 100000) bodyText += c; });
      req.on('end', () => {
        try {
          const { keyword, category } = JSON.parse(bodyText);
          const { addTechnology, getMonitoredTechnologies } = require('../../watchlist');
          if (!keyword) {
            res.writeHead(400, { 'Content-Type': 'application/json', ...secureHeaders() });
            res.end(JSON.stringify({ error: 'Keyword required' }));
            return true;
          }
          addTechnology(keyword, category || 'Custom', 'dashboard');
          res.writeHead(200, { 'Content-Type': 'application/json', ...secureHeaders() });
          res.end(JSON.stringify({ success: true, watchlist: getMonitoredTechnologies() }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json', ...secureHeaders() });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return true;
    }

    if (url === '/api/watchlist' && req.method === 'DELETE') {
      if (!isTokenValid(req)) {
        res.writeHead(401, { 'Content-Type': 'application/json', ...secureHeaders() });
        res.end(JSON.stringify({ error: 'Unauthorized: Admin token required' }));
        return true;
      }
      let bodyText = '';
      req.on('data', (c) => { if (bodyText.length < 100000) bodyText += c; });
      req.on('end', () => {
        try {
          const { keyword } = JSON.parse(bodyText);
          const { removeTechnology, getMonitoredTechnologies } = require('../../watchlist');
          removeTechnology(keyword);
          res.writeHead(200, { 'Content-Type': 'application/json', ...secureHeaders() });
          res.end(JSON.stringify({ success: true, watchlist: getMonitoredTechnologies() }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json', ...secureHeaders() });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return true;
    }


  return false;
}

module.exports = { handleThreatRoutes };
