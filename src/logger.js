// src/logger.js — Colored, timestamped console output + persistent rotating log file

const fs   = require('fs');
const path = require('path');

const colors = {
  reset:  '\x1b[0m',
  green:  '\x1b[32m',
  red:    '\x1b[31m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',
  gray:   '\x1b[90m',
  bold:   '\x1b[1m'
};

// ── Log file setup ────────────────────────────────────────────────────────────
const LOG_DIR      = path.join(process.cwd(), 'data', 'logs');
const MAX_LOG_DAYS = 7;   // keep 7 days of logs

function getLogPath() {
  // Daily log file: data/logs/bot-2026-06-15.log
  const d = new Date();
  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return path.join(LOG_DIR, `bot-${dateStr}.log`);
}

function ensureLogDir() {
  try {
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
  } catch {}
}

function pruneOldLogs() {
  try {
    const files = fs.readdirSync(LOG_DIR)
      .filter((f) => f.startsWith('bot-') && f.endsWith('.log'))
      .sort();
    // Delete files beyond the retention window
    while (files.length > MAX_LOG_DAYS) {
      const oldest = files.shift();
      try { fs.unlinkSync(path.join(LOG_DIR, oldest)); } catch {}
    }
  } catch {}
}

ensureLogDir();
pruneOldLogs();

function writeToFile(level, msg) {
  try {
    const ts   = new Date().toISOString();
    const line = `[${ts}] [${level.padEnd(7)}] ${msg}\n`;
    fs.appendFileSync(getLogPath(), line, 'utf-8');
  } catch {}
}

// ── Exports ───────────────────────────────────────────────────────────────────
function ts() {
  return new Date().toLocaleTimeString('en-IN', { hour12: true });
}

module.exports = {
  info: (msg) => {
    console.log(`${colors.cyan}[${ts()}] ℹ  ${msg}${colors.reset}`);
    writeToFile('INFO', msg);
  },
  success: (msg) => {
    console.log(`${colors.green}[${ts()}] ✔  ${msg}${colors.reset}`);
    writeToFile('SUCCESS', msg);
  },
  error: (msg) => {
    console.error(`${colors.red}[${ts()}] ✖  ${msg}${colors.reset}`);
    writeToFile('ERROR', msg);
  },
  warn: (msg) => {
    console.warn(`${colors.yellow}[${ts()}] ⚠  ${msg}${colors.reset}`);
    writeToFile('WARN', msg);
  },
  section: (msg) => {
    console.log(`\n${colors.bold}${colors.gray}─── ${msg} ───${colors.reset}`);
    writeToFile('SECTION', `─── ${msg} ───`);
  }
};
