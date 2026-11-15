// src/dashboard/http.js
// Small HTTP helpers shared by the dashboard routes.

const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('../paths');

const LOG_DIR = path.join(DATA_DIR, 'logs');

/** Read the last N lines of today's bot log. */
function getLatestLog(lines = 100) {
  try {
    const d = new Date();
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const logPath = path.join(LOG_DIR, `bot-${dateStr}.log`);
    if (!fs.existsSync(logPath)) return [];
    return fs.readFileSync(logPath, 'utf-8').trim().split('\n').slice(-lines).reverse();
  } catch {
    return [];
  }
}

/** Atomically persist config.json; returns false on failure. */
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

/** Build an absolute base URL without trusting arbitrary Host headers. */
function publicBaseUrl(req) {
  const configured = String(process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
  if (configured) {
    return /^https?:\/\//i.test(configured) ? configured : `https://${configured}`;
  }

  const host = String(req.headers.host || 'localhost:3000');
  if (!/^[a-z0-9.\-:\[\]]+$/i.test(host)) return 'http://localhost:3000';

  const proto = process.env.TRUST_PROXY === 'true' && req.headers['x-forwarded-proto'] === 'https'
    ? 'https'
    : 'http';
  return `${proto}://${host}`;
}

/** Read a request body with a hard size cap. */
function readBody(req, maxBytes = 512) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      if (body.length < maxBytes) body += chunk.toString().slice(0, maxBytes);
    });
    req.on('end', () => resolve(body));
    req.on('error', () => resolve(''));
  });
}

module.exports = { getLatestLog, writeConfigFile, publicBaseUrl, readBody };
