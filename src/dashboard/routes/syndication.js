// src/dashboard/routes/syndication.js
// Extracted route group for the dashboard dispatcher.

const { isTokenValid } = require('../auth');
const { publicBaseUrl } = require('../http');

/**
 * @param {object} ctx - { req, res, url, pipeline, secureHeaders }
 * @returns {Promise<boolean>} true when a route was handled
 */
async function handleSyndicationRoutes({ req, res, url, pipeline, secureHeaders }) {
    // ── Public Syndication Feeds (RSS / Atom / JSON Feed) ─────────────
    if (url === '/feed.xml' || url === '/rss.xml' || url === '/rss') {
      const { generateRssXml } = require('../../feed-generator');
      const articles = pipeline.getRecentArticles(30);
      const xml = generateRssXml(articles, publicBaseUrl(req));
      res.writeHead(200, { 'Content-Type': 'application/rss+xml; charset=utf-8', ...secureHeaders() });
      res.end(xml);
      return true;
    }

    if (url === '/atom.xml' || url === '/atom') {
      const { generateAtomXml } = require('../../feed-generator');
      const articles = pipeline.getRecentArticles(30);
      const xml = generateAtomXml(articles, publicBaseUrl(req));
      res.writeHead(200, { 'Content-Type': 'application/atom+xml; charset=utf-8', ...secureHeaders() });
      res.end(xml);
      return true;
    }

    if (url === '/feed.json') {
      const { generateJsonFeed } = require('../../feed-generator');
      const articles = pipeline.getRecentArticles(30);
      const jsonFeed = generateJsonFeed(articles, publicBaseUrl(req));
      res.writeHead(200, { 'Content-Type': 'application/feed+json; charset=utf-8', ...secureHeaders() });
      res.end(JSON.stringify(jsonFeed, null, 2));
      return true;
    }

    // ── SIEM / SOC Audit Log Stream API (CEF / ECS) ───────────────────
    if (url === '/api/audit-log') {
      if (!isTokenValid(req, 'auditor')) {
        res.writeHead(401, { 'Content-Type': 'application/json', ...secureHeaders() });
        res.end(JSON.stringify({ error: 'Unauthorized: auditor token required' }));
        return true;
      }
      const { getRecentAuditLogs } = require('../../audit-logger');
      const logs = getRecentAuditLogs(50);
      res.writeHead(200, { 'Content-Type': 'application/json', ...secureHeaders() });
      res.end(JSON.stringify({ total: logs.length, logs }));
      return true;
    }

    // ── SQLite Database Backup & Optimization API ──────────────────────
    if (url === '/api/db/backup' && req.method === 'POST') {
      if (!isTokenValid(req, 'admin')) {
        res.writeHead(401, { 'Content-Type': 'application/json', ...secureHeaders() });
        res.end(JSON.stringify({ error: 'Unauthorized: Admin token required' }));
        return true;
      }

      const { createDatabaseBackup, optimizeDatabase, pruneOldRecords, cleanupGeneratedMedia } = require('../../db-maintenance');
      const maxBackups = Math.min(
        Math.max(parseInt(pipeline.config?.settings?.backupRetentionCount, 10) || 7, 1),
        90
      );
      const backupPath = createDatabaseBackup(maxBackups);
      const optimized = optimizeDatabase();
      const retentionDays = Math.min(
        Math.max(parseInt(pipeline.config?.settings?.recordRetentionDays, 10) || 90, 1),
        3650
      );
      const pruned = pruneOldRecords(retentionDays);
      const cleanedMedia = cleanupGeneratedMedia(30);

      res.writeHead(200, { 'Content-Type': 'application/json', ...secureHeaders() });
      res.end(JSON.stringify({
        success: Boolean(backupPath),
        backupPath,
        optimized,
        prunedRecords: pruned,
        cleanedMediaFiles: cleanedMedia
      }));
      return true;
    }


  return false;
}

module.exports = { handleSyndicationRoutes };
