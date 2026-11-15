// src/dashboard/routes/sources.js
// Extracted route group for the dashboard dispatcher.

const fs = require('fs');
const path = require('path');
const { isTokenValid } = require('../auth');
const { writeConfigFile } = require('../http');
const { recordAuditEvent } = require('../../audit-logger');

/**
 * @param {object} ctx - { req, res, url, pipeline, clientIp, secureHeaders }
 * @returns {Promise<boolean>} true when a route was handled
 */
async function handleSourceRoutes({ req, res, url, pipeline, clientIp, secureHeaders }) {
    // ── Sources API ────────────────────────────────────────────────────

    if (url === '/api/sources' && req.method === 'GET') {
      const config = pipeline.config || {};
      const { getFeedHealth } = require('../../fetcher');
      const healthMap = new Map(getFeedHealth().map((h) => [h.rss, h]));

      const sources = (config.sources || []).map((s) => ({
        ...s,
        health: healthMap.get(s.rss) || null
      }));

      res.writeHead(200, { 'Content-Type': 'application/json', ...secureHeaders() });
      res.end(JSON.stringify(sources));
      return true;
    }

    // ── Toggle Source ──────────────────────────────────────────────────
    if (url === '/api/sources/toggle' && req.method === 'POST') {
      if (!isTokenValid(req)) {
        res.writeHead(401, { 'Content-Type': 'application/json', ...secureHeaders() });
        res.end(JSON.stringify({ error: 'Unauthorized: invalid or missing Dashboard Token' }));
        return true;
      }

      let bodyText = '';
      req.on('data', (chunk) => { if (bodyText.length < 100000) bodyText += chunk; });
      req.on('end', () => {
        try {
          const { name, enabled } = JSON.parse(bodyText);
          const configPath = path.join(process.cwd(), 'config.json');
          const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

          const target = (config.sources || []).find((s) => s.name === name);
          if (!target) {
            res.writeHead(404, { 'Content-Type': 'application/json', ...secureHeaders() });
            res.end(JSON.stringify({ error: 'Source not found' }));
            return true;
          }

          target.enabled = Boolean(enabled);
          if (!writeConfigFile(configPath, config)) {
            res.writeHead(500, { 'Content-Type': 'application/json', ...secureHeaders() });
            res.end(JSON.stringify({ error: 'Failed to write config.json — check filesystem permissions (read-only volume?).' }));
            return true;
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
      return true;
    }

    // ── Add Source ─────────────────────────────────────────────────────
    if (url === '/api/sources/add' && req.method === 'POST') {
      if (!isTokenValid(req)) {
        res.writeHead(401, { 'Content-Type': 'application/json', ...secureHeaders() });
        res.end(JSON.stringify({ error: 'Unauthorized: invalid or missing Dashboard Token' }));
        return true;
      }

      let bodyText = '';
      req.on('data', (chunk) => { if (bodyText.length < 100000) bodyText += chunk; });
      req.on('end', () => {
        try {
          const { name, rss, category } = JSON.parse(bodyText);
          const { isSafeUrl } = require('../../fetcher');
          if (!name || !rss || !isSafeUrl(rss)) {
            res.writeHead(400, { 'Content-Type': 'application/json', ...secureHeaders() });
            res.end(JSON.stringify({ error: 'Valid feed name and safe HTTP/HTTPS RSS URL are required.' }));
            return true;
          }

          const configPath = path.join(process.cwd(), 'config.json');
          const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

          const safeName = String(name).trim().slice(0, 100);
          const safeCategory = String(category || 'Tech').trim().slice(0, 80);
          const safeRss = String(rss).trim();
          if (!safeName) {
            res.writeHead(400, { 'Content-Type': 'application/json', ...secureHeaders() });
            res.end(JSON.stringify({ error: 'Source name cannot be empty.' }));
            return true;
          }

          config.sources = config.sources || [];
          if (config.sources.some((s) => String(s.name).toLowerCase() === safeName.toLowerCase())) {
            res.writeHead(409, { 'Content-Type': 'application/json', ...secureHeaders() });
            res.end(JSON.stringify({ error: `Source "${safeName}" already exists.` }));
            return true;
          }

          config.sources.push({
            name: safeName,
            category: safeCategory,
            rss: safeRss,
            enabled: true
          });

          if (!writeConfigFile(configPath, config)) {
            res.writeHead(500, { 'Content-Type': 'application/json', ...secureHeaders() });
            res.end(JSON.stringify({ error: 'Failed to write config.json — check filesystem permissions (read-only volume?).' }));
            return true;
          }
          if (pipeline.config) pipeline.config.sources = config.sources;

          recordAuditEvent({
            type: 'SOURCE_MANAGEMENT',
            name: 'News source added',
            severity: 'medium',
            actor: 'dashboard',
            details: `Source=${safeName} RSS=${safeRss}`,
            ip: clientIp
          });

          res.writeHead(200, { 'Content-Type': 'application/json', ...secureHeaders() });
          res.end(JSON.stringify({ message: `Source "${safeName}" added successfully` }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json', ...secureHeaders() });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return true;
    }

    // ── Delete Source ──────────────────────────────────────────────────
    if (url === '/api/sources/delete' && req.method === 'POST') {
      if (!isTokenValid(req)) {
        res.writeHead(401, { 'Content-Type': 'application/json', ...secureHeaders() });
        res.end(JSON.stringify({ error: 'Unauthorized: invalid or missing Dashboard Token' }));
        return true;
      }

      let bodyText = '';
      req.on('data', (chunk) => { if (bodyText.length < 100000) bodyText += chunk; });
      req.on('end', () => {
        try {
          const { name } = JSON.parse(bodyText);
          const configPath = path.join(process.cwd(), 'config.json');
          const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

          config.sources = (config.sources || []).filter((s) => s.name !== name);
          if (!writeConfigFile(configPath, config)) {
            res.writeHead(500, { 'Content-Type': 'application/json', ...secureHeaders() });
            res.end(JSON.stringify({ error: 'Failed to write config.json — check filesystem permissions (read-only volume?).' }));
            return true;
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
      return true;
    }


  return false;
}

module.exports = { handleSourceRoutes };
