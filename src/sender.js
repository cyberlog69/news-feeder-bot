// src/sender.js
// WhatsApp client using whatsapp-web.js (unofficial library).
//
// Cross-platform Chrome detection: supports Windows, Linux (Docker/VPS), and macOS.
// Override with CHROME_PATH env var for full control.
//
// Supports sending to:
//   • A phone number    →  set WHATSAPP_TARGET=919876543210
//   • A group by name  →  set WHATSAPP_TARGET=My Cyber News Group
//   • A group/channel ID → set WHATSAPP_TARGET=120363XXXX@g.us
//
// First run: scan the QR code displayed in terminal.
// After that: session saved to .wwebjs_auth/ — no re-scan needed.

const fs     = require('fs');
const path   = require('path');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const logger  = require('./logger');

// ── Cross-platform Chrome detection ──────────────────────────────────────────
function findChrome() {
  // 1. Explicit override via environment variable (highest priority)
  if (process.env.CHROME_PATH) {
    try { if (fs.existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH; } catch {}
    logger.warn(`CHROME_PATH set but not found: ${process.env.CHROME_PATH}`);
  }

  const candidates = [
    // ── Linux (Docker, Ubuntu, Debian, CentOS) ──────────────────────────
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
    '/usr/local/bin/chromium',
    // ── macOS ────────────────────────────────────────────────────────────
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    // ── Windows ──────────────────────────────────────────────────────────
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    (process.env.LOCALAPPDATA || '') + '\\Google\\Chrome\\Application\\chrome.exe',
    (process.env.PROGRAMFILES || '') + '\\Google\\Chrome\\Application\\chrome.exe',
  ];

  for (const p of candidates) {
    try { if (p && fs.existsSync(p)) return p; } catch {}
  }

  // 2. Try puppeteer's own bundled Chromium as last resort
  try {
    // eslint-disable-next-line
    const puppeteer = require('puppeteer');
    const bundled = puppeteer.executablePath();
    if (bundled && fs.existsSync(bundled)) {
      logger.info('Using puppeteer bundled Chromium');
      return bundled;
    }
  } catch {}

  return null;
}

// ── WhatsApp auth directory ───────────────────────────────────────────────────
// Allow override via env var for Docker volume mounts
const AUTH_DATA_PATH = process.env.WWEBJS_AUTH_PATH || path.join(process.cwd(), '.wwebjs_auth');

class WhatsAppSender {
  /**
   * @param {string} target - Phone number, group name, or group/channel ID.
   *                          Set via WHATSAPP_TARGET in .env
   */
  constructor(target) {
    this.target         = target.trim();
    this.resolvedChatId = null;
    this.isReady        = false;
    this.client         = null;
    this._readyResolve  = null;
    this._readyPromise  = new Promise((resolve) => { this._readyResolve = resolve; });
  }

  /** Initialize the WhatsApp client and begin authentication. */
  async initialize() {
    const chromePath = findChrome();
    if (chromePath) {
      logger.info(`Using Chrome: ${chromePath}`);
    } else {
      logger.warn('Chrome not found — puppeteer will attempt auto-detection.');
    }

    this.client = new Client({
      authStrategy: new LocalAuth({
        clientId:   'news-bot',
        dataPath:   AUTH_DATA_PATH
      }),
      puppeteer: {
        headless:       true,
        executablePath: chromePath || undefined,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',       // critical for Docker (limited /dev/shm)
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-extensions',
          '--disable-background-networking',
          '--disable-default-apps',
          '--disable-sync',
          '--metrics-recording-only',
          '--mute-audio',
        ]
      }
    });

    // ── Events ──────────────────────────────────────────────────────────────

    this.client.on('qr', (qr) => {
      console.log('\n');
      console.log('╔══════════════════════════════════════════════════╗');
      console.log('║  📱  SCAN THIS QR CODE WITH WHATSAPP              ║');
      console.log('║  Open WhatsApp → Linked Devices → Link a Device  ║');
      console.log('╚══════════════════════════════════════════════════╝\n');
      qrcode.generate(qr, { small: true });
      console.log('\n⏳  Waiting for you to scan...\n');

      // On cloud deployments without a terminal, log a warning
      if (process.env.NODE_ENV === 'production') {
        logger.warn('CLOUD DEPLOYMENT: WhatsApp QR scan required!');
        logger.warn('See DEPLOYMENT.md → "WhatsApp on Cloud" for instructions.');
      }
    });

    this.client.on('loading_screen', (percent) => {
      process.stdout.write(`\r⏳  WhatsApp loading: ${percent}%   `);
    });

    this.client.on('authenticated', () => {
      console.log('');
      logger.success('WhatsApp authenticated! (session saved for future runs)');
    });

    this.client.on('ready', async () => {
      console.log('');
      logger.success('WhatsApp client READY');

      try {
        this.resolvedChatId = await this._resolveTarget(this.target);
        logger.success(`Messages will be sent to: ${this.target} (${this.resolvedChatId})`);
      } catch (err) {
        logger.error(`Could not resolve target "${this.target}": ${err.message.split('\n')[0]}`);
        logger.warn('Run  npm run list-groups  to see available groups and their IDs.');
      }

      this.isReady = true;
      this._readyResolve();
    });

    this.client.on('auth_failure', (msg) => {
      logger.error(`WhatsApp authentication FAILED: ${msg}`);
      logger.warn('Delete the .wwebjs_auth folder and restart to re-scan QR.');
    });

    this.client.on('disconnected', (reason) => {
      logger.warn(`WhatsApp disconnected: ${reason}`);
      this.isReady = false;
    });

    logger.info('Starting WhatsApp client (this may take ~30 seconds)...');
    await this.client.initialize();
  }

  /**
   * Resolves WHATSAPP_TARGET to a chat ID string.
   *
   * Resolution order:
   *   1. Already a full chat ID (contains @)  →  use as-is
   *   2. All digits                            →  phone number → X@c.us
   *   3. Anything else                         →  search group chats by name
   */
  async _resolveTarget(target) {
    if (target.includes('@')) return target;

    if (/^\d+$/.test(target)) return target + '@c.us';

    logger.info(`Searching for group named "${target}"...`);
    const chats  = await this.client.getChats();
    const groups = chats.filter((c) => c.isGroup);

    const match = groups.find(
      (g) => g.name.toLowerCase() === target.toLowerCase()
    );
    if (match) {
      logger.success(`Found group: "${match.name}" → ${match.id._serialized}`);
      return match.id._serialized;
    }

    const partial = groups.find(
      (g) => g.name.toLowerCase().includes(target.toLowerCase())
    );
    if (partial) {
      logger.warn(`Partial match: "${partial.name}" → ${partial.id._serialized}`);
      return partial.id._serialized;
    }

    throw new Error(
      `No group found matching "${target}".\n` +
      `Available groups:\n` +
      groups.map((g) => `  • "${g.name}" → ${g.id._serialized}`).join('\n')
    );
  }

  /** Wait until the client is authenticated and ready. */
  waitUntilReady() {
    return this._readyPromise;
  }

  /** Send a text message to the configured target. */
  async sendMessage(message) {
    if (!this.isReady) throw new Error('WhatsApp client not ready.');
    if (!this.resolvedChatId) {
      throw new Error(
        `Target "${this.target}" could not be resolved. ` +
        'Run npm run list-groups to find the correct group name or ID.'
      );
    }
    try {
      await this.client.sendMessage(this.resolvedChatId, message);
    } catch (err) {
      throw new Error(`sendMessage to ${this.resolvedChatId} failed: ${err.message.split('\n')[0]}`);
    }
  }

  /** Return all groups the linked account is in — used by list-groups.js */
  async getGroups() {
    if (!this.isReady) throw new Error('Client not ready');
    const chats = await this.client.getChats();
    return chats
      .filter((c) => c.isGroup)
      .map((g) => ({
        name:         g.name,
        id:           g.id._serialized,
        participants: g.participants?.length || '?'
      }));
  }

  /** Gracefully shut down the client. */
  async destroy() {
    if (this.client) await this.client.destroy().catch(() => {});
  }
}

module.exports = WhatsAppSender;
