// src/web-dashboard.js
// Local web dashboard + cloud health check endpoint.
//
// Routes:
//   GET  /login     — Token login form (issues a signed HttpOnly cookie)
//   GET  /          — Full HTML dashboard (auto-refresh 30s, authenticated)
//   GET  /health    — Public JSON health check (Railway/Render/Fly.io/Docker)
//   GET  /metrics   — JSON/Prometheus metrics (auditor token)
//   POST /trigger   — Manually trigger a pipeline run (admin token)
//   /api/*          — Protected (except public podcast/STIX/MISP endpoints)
//
// Listens on:
//   process.env.PORT (set by cloud platforms) || config.settings.dashboardPort || 3000
// Binds to:
//   0.0.0.0 in production (NODE_ENV=production) so cloud platforms can reach it
//   127.0.0.1 in development (localhost only)

const http = require('http');
const fs   = require('fs');
const path = require('path');

const { DATA_DIR } = require('./paths');
const CARD_DIR  = path.join(DATA_DIR, 'cards');
const IS_PROD   = process.env.NODE_ENV === 'production';

const { createRateLimiter, identifyToken, hasConfiguredTokens } = require('./security-guard');
const { recordAuditEvent } = require('./audit-logger');
const { isDemoMode } = require('./db');
const { isAuthorized, isTokenValid, requestRole } = require('./dashboard/auth');
const { getLatestLog, readBody } = require('./dashboard/http');
const { buildHtml, buildLoginHtml } = require('./dashboard/html');
const { createSession, sessionCookie, clearSessionCookie } = require('./session');
const { handleMediaRoutes } = require('./dashboard/routes/media');
const { handleExposedIpRoutes } = require('./dashboard/routes/exposed-ips');
const { handleSourceRoutes } = require('./dashboard/routes/sources');
const { handleThreatRoutes } = require('./dashboard/routes/threat');
const { handleIntelRoutes } = require('./dashboard/routes/intel');
const { handleSyndicationRoutes } = require('./dashboard/routes/syndication');

const AUTH_REQUIRED = hasConfiguredTokens();

/** Sanitize a post-login redirect target. */
function safeNext(value) {
  return /^\/(?!\/)/.test(String(value || '/')) ? String(value) : '/';
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
  const rateLimiter = createRateLimiter({ windowMs: 60000, maxRequests: 200 });

  const server = http.createServer(async (req, res) => {
    const url = req.url.split('?')[0];
    const query = Object.fromEntries(new URL(req.url, 'http://localhost').searchParams);
    const forwardedFor = process.env.TRUST_PROXY === 'true'
      ? String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
      : '';
    const clientIp = forwardedFor || req.socket.remoteAddress || '127.0.0.1';

    // ── Rate Limiting Check ──────────────────────────────────────────────
    const rateCheck = rateLimiter.checkLimit(clientIp);
    if (!rateCheck.allowed && url !== '/health') {
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
        'Permissions-Policy': 'geolocation=(), camera=(), microphone=(), payment=()',
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Resource-Policy': 'same-origin',
        ...(IS_PROD ? { 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains' } : {}),
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

    // ── Login / logout ───────────────────────────────────────────────────
    if (url === '/login' && req.method === 'GET') {
      if (isAuthorized(req, 'auditor')) {
        res.writeHead(302, { Location: '/', ...secureHeaders() });
        res.end();
        return;
      }
      const html = buildLoginHtml({
        error: query.error || '',
        next: safeNext(query.next),
        configured: AUTH_REQUIRED
      });
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        ...secureHeaders({
          'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'"
        })
      });
      res.end(html);
      return;
    }

    if (url === '/login' && req.method === 'POST') {
      const body = await readBody(req, 4096);
      const params = new URLSearchParams(body);
      const token = params.get('token') || '';
      const next = safeNext(params.get('next'));
      const role = identifyToken(token);

      if (!role) {
        recordAuditEvent({
          type: 'AUTH_FAILURE',
          name: 'Dashboard login failed',
          severity: 'high',
          actor: 'unknown',
          details: `IP=${clientIp}`,
          ip: clientIp
        });
        const html = buildLoginHtml({
          error: AUTH_REQUIRED ? 'Invalid token.' : 'Authentication is not configured. Set ADMIN_TOKEN and restart.',
          next,
          configured: AUTH_REQUIRED
        });
        res.writeHead(401, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
          ...secureHeaders({
            'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'"
          })
        });
        res.end(html);
        return;
      }

      const session = createSession(role);
      if (!session) {
        res.writeHead(500, { 'Content-Type': 'application/json', ...secureHeaders() });
        res.end(JSON.stringify({ error: 'Session signing is not configured.' }));
        return;
      }

      recordAuditEvent({
        type: 'AUTH_SUCCESS',
        name: 'Dashboard login succeeded',
        severity: 'low',
        actor: role,
        details: `IP=${clientIp}`,
        ip: clientIp
      });

      res.writeHead(302, {
        Location: next,
        'Set-Cookie': sessionCookie(session, { secure: IS_PROD }),
        'Cache-Control': 'no-store',
        ...secureHeaders()
      });
      res.end();
      return;
    }

    if (url === '/logout') {
      res.writeHead(302, {
        Location: '/login',
        'Set-Cookie': clearSessionCookie({ secure: IS_PROD }),
        'Cache-Control': 'no-store',
        ...secureHeaders()
      });
      res.end();
      return;
    }

    // ── Authenticate all non-public API routes ───────────────────────────
    // Public by design: health, metrics (protected below), public syndication
    // feeds, TAXII/STIX sharing, and the podcast.
    const isPublicApi =
      url === '/api/podcast/latest' ||
      url.startsWith('/api/podcast/audio') ||
      url === '/api/stix/bundle' ||
      url === '/api/misp/events';

    if (url.startsWith('/api/') && !isPublicApi && !isAuthorized(req, 'auditor')) {
      res.writeHead(401, { 'Content-Type': 'application/json', ...secureHeaders() });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }

    // ── Extracted route groups ──────────────────────────────────────────
    const routeContext = { req, res, url, query, pipeline, startTime, secureHeaders, clientIp };
    if (await handleIntelRoutes(routeContext)) return;
    if (await handleSyndicationRoutes(routeContext)) return;
    if (await handleThreatRoutes(routeContext)) return;
    if (await handleMediaRoutes(routeContext)) return;
    if (await handleExposedIpRoutes(routeContext)) return;
    if (await handleSourceRoutes(routeContext)) return;

    // ── Metrics endpoint (JSON or Prometheus format) ─────────────────────
    if (url === '/metrics') {
      if (!isAuthorized(req, 'auditor')) {
        res.writeHead(401, { 'Content-Type': 'application/json', ...secureHeaders() });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }

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

        res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4', ...secureHeaders() });
        res.end(prometheusOutput);
        return;
      }

      const recent = pipeline.getRecentArticles(10);
      res.writeHead(200, { 'Content-Type': 'application/json', ...secureHeaders() });
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
      // Require a token (admin/analyst/auditor). Fails closed in production.
      if (!isTokenValid(req, 'auditor')) {
        res.writeHead(401, { 'Content-Type': 'application/json', ...secureHeaders() });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
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
      // Always enforce. In dev with no tokens validateToken() returns true;
      // in production it fails closed, regardless of which token variable is set.
      if (!isTokenValid(req, 'admin')) {
        res.writeHead(401, { 'Content-Type': 'application/json', ...secureHeaders() });
        res.end(JSON.stringify({ error: 'Unauthorized — valid admin token required' }));
        return;
      }

      // Consume body (required even if not used, to drain the socket)
      await readBody(req);

      if (!onTrigger) {
        res.writeHead(503, { 'Content-Type': 'application/json', ...secureHeaders() });
        res.end(JSON.stringify({ error: 'Pipeline trigger not available' }));
        return;
      }

      if (pipeline && pipeline.isRunning) {
        res.writeHead(409, { 'Content-Type': 'application/json', ...secureHeaders() });
        res.end(JSON.stringify({ error: 'Pipeline is currently running — please wait a moment' }));
        return;
      }

      // Respond immediately, then fire the pipeline in background
      res.writeHead(200, { 'Content-Type': 'application/json', ...secureHeaders() });
      res.end(JSON.stringify({ message: 'Pipeline triggered successfully! Fetching feeds & threat intel in background…' }));

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
      if (!isAuthorized(req, 'auditor')) {
        res.writeHead(302, {
          Location: `/login?next=${encodeURIComponent(url)}`,
          'Cache-Control': 'no-store',
          ...secureHeaders()
        });
        res.end();
        return;
      }

      try {
        const stats          = pipeline.getStats();
        const recentArticles = pipeline.getRecentArticles(20);
        const logLines       = getLatestLog(80);
        const html           = buildHtml(stats, recentArticles, logLines, startTime, {
          authRequired: AUTH_REQUIRED,
          role: requestRole(req)
        });
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
