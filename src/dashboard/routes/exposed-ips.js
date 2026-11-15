// src/dashboard/routes/exposed-ips.js
// Extracted route group for the dashboard dispatcher.

const { isTokenValid } = require('../auth');
const { isDemoMode } = require('../../db');

/**
 * @param {object} ctx - { req, res, url, query, secureHeaders }
 * @returns {Promise<boolean>} true when a route was handled
 */
async function handleExposedIpRoutes({ req, res, url, query, secureHeaders }) {
    // ── Exposed IPs & WAN Intelligence API ─────────────────────────────
    if (url === '/api/exposed-ips' && req.method === 'GET') {
      try {
        const { getExposedIps, getExposedIpStats } = require('../../db');
        const countryCode = (query.country || '').toUpperCase().trim() || null;
        const month       = (query.month || '').trim() || null;
        const sortBy      = (query.sort || 'risk_desc').trim();
        const limit       = Math.min(Math.max(parseInt(query.limit, 10) || 500, 1), 1000);
        const ips         = getExposedIps(limit, { countryCode, month, sortBy });
        const stats       = getExposedIpStats(month);
        res.writeHead(200, { 'Content-Type': 'application/json', ...secureHeaders() });
        res.end(JSON.stringify({ count: ips.length, ips, stats }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json', ...secureHeaders() });
        res.end(JSON.stringify({ error: err.message }));
      }
      return true;
    }

    // ── Printable HTML / PDF Report View ──────────────────────────────
    if (url === '/api/exposed-ips/report' && req.method === 'GET') {
      try {
        const { getExposedIps, getExposedIpStats } = require('../../db');
        const { generatePrintableHtml } = require('../../exposed-ip-report');
        const countryCode = (query.country || '').toUpperCase().trim() || null;
        const month       = (query.month || '').trim() || null;
        const sortBy      = (query.sort || 'risk_desc').trim();
        const ips         = getExposedIps(1000, { countryCode, month, sortBy });
        const stats       = getExposedIpStats(month);
        const html        = generatePrintableHtml(ips, stats, { month, countryCode, sortBy });
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
          ...secureHeaders({
            'Content-Security-Policy': "default-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'"
          })
        });
        res.end(html);
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain', ...secureHeaders() });
        res.end('Report generation error: ' + err.message);
      }
      return true;
    }

    // ── Microsoft Word (.doc) Document Export ─────────────────────────
    if (url === '/api/exposed-ips/export' && req.method === 'GET') {
      try {
        const { getExposedIps, getExposedIpStats } = require('../../db');
        const { generateWordDoc } = require('../../exposed-ip-report');
        const countryCode = (query.country || '').toUpperCase().trim() || null;
        const month       = (query.month || '').trim() || null;
        const sortBy      = (query.sort || 'risk_desc').trim();
        const ips         = getExposedIps(1000, { countryCode, month, sortBy });
        const stats       = getExposedIpStats(month);
        const doc         = generateWordDoc(ips, stats, { month, countryCode, sortBy });
        const filename    = `Exposed-IPs-Report-${month || 'All'}-${countryCode || 'Global'}.doc`;
        res.writeHead(200, {
          'Content-Type': 'application/msword; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store',
          ...secureHeaders()
        });
        res.end(doc);
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain', ...secureHeaders() });
        res.end('Export error: ' + err.message);
      }
      return true;
    }

    // Trigger a background IP scan on demand
    if (url === '/api/exposed-ips/scan' && req.method === 'POST') {
      if (!isTokenValid(req, 'admin')) {
        res.writeHead(401, { 'Content-Type': 'application/json', ...secureHeaders() });
        res.end(JSON.stringify({ error: 'Unauthorized: admin token required' }));
        return true;
      }
      res.writeHead(200, { 'Content-Type': 'application/json', ...secureHeaders() });
      res.end(JSON.stringify({ message: 'Exposed-IP scan triggered in background. Refresh in ~60s.' }));
      // Fire-and-forget
      setImmediate(async () => {
        try {
          const { runDailyScan } = require('../../exposed-ip-scanner');
          const logger = require('../../logger');
          const saved = await runDailyScan();
          logger.success(`[ExposedIP] On-demand scan complete — ${saved} records`);
        } catch (err) {
          const logger = require('../../logger');
          logger.warn(`[ExposedIP] On-demand scan error: ${err.message}`);
        }
      });
      return true;
    }

    // Seed sample exposed IPs on demand (demo mode only)
    if (url === '/api/exposed-ips/seed' && req.method === 'POST') {
      if (!isTokenValid(req, 'admin')) {
        res.writeHead(401, { 'Content-Type': 'application/json', ...secureHeaders() });
        res.end(JSON.stringify({ error: 'Unauthorized: admin token required' }));
        return true;
      }
      if (!isDemoMode()) {
        res.writeHead(403, { 'Content-Type': 'application/json', ...secureHeaders() });
        res.end(JSON.stringify({ error: 'Sample data is disabled. Set DEMO_MODE=true to enable it.' }));
        return true;
      }
      try {
        const { seedSampleExposedIps, getExposedIps, getExposedIpStats } = require('../../db');
        const count = seedSampleExposedIps();
        const ips = getExposedIps(200);
        const stats = getExposedIpStats();
        res.writeHead(200, { 'Content-Type': 'application/json', ...secureHeaders() });
        res.end(JSON.stringify({ success: true, seeded: count, total: ips.length, ips, stats }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json', ...secureHeaders() });
        res.end(JSON.stringify({ error: err.message }));
      }
      return true;
    }


  return false;
}

module.exports = { handleExposedIpRoutes };
