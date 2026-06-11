// src/sender.js
// WhatsApp client using whatsapp-web.js (unofficial library).
//
// Supports sending to:
//   • A phone number    →  set WHATSAPP_TARGET=919876543210
//   • A group by name  →  set WHATSAPP_TARGET=My Cyber News Group
//   • A group/channel ID → set WHATSAPP_TARGET=120363XXXX@g.us
//
// First run: scan the QR code displayed in terminal.
// After that: session saved to .wwebjs_auth/ — no re-scan needed.

const fs     = require('fs');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const logger  = require('./logger');

// ── Detect system Chrome ───────────────────────────────────────────────────────
function findChrome() {
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    (process.env.LOCALAPPDATA || '') + '\\Google\\Chrome\\Application\\chrome.exe'
  ];
  for (const p of candidates) {
    try { if (fs.existsSync(p)) return p; } catch {}
  }
  return null;
}

class WhatsAppSender {
  /**
   * @param {string} target - Phone number, group name, or group/channel ID.
   *                          Set via WHATSAPP_TARGET in .env
   */
  constructor(target) {
    this.target        = target.trim();
    this.resolvedChatId = null;   // filled in after client is ready
    this.isReady       = false;
    this.client        = null;
    this._readyResolve = null;
    this._readyPromise = new Promise((resolve) => { this._readyResolve = resolve; });
  }

  /** Initialize the WhatsApp client and begin authentication. */
  async initialize() {
    const chromePath = findChrome();
    if (chromePath) {
      logger.info(`Using system Chrome: ${chromePath}`);
    } else {
      logger.warn('System Chrome not found — puppeteer will try to auto-detect.');
    }

    this.client = new Client({
      authStrategy: new LocalAuth({ clientId: 'news-bot' }),
      puppeteer: {
        headless: true,
        executablePath: chromePath || undefined,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
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

      // Resolve the target chat ID now that client is ready
      try {
        this.resolvedChatId = await this._resolveTarget(this.target);
        logger.success(`Messages will be sent to: ${this.target} (${this.resolvedChatId})`);
      } catch (err) {
        logger.error(`Could not resolve target "${this.target}": ${err.message}`);
        logger.warn('Run  node list-groups.js  to see available groups and their IDs.');
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
   *   2. All digits                            →  treat as phone number → X@c.us
   *   3. Anything else                         →  search group chats by name
   */
  async _resolveTarget(target) {
    // 1. Already a chat ID (e.g. 120363XXX@g.us or 91XXXX@c.us)
    if (target.includes('@')) {
      return target;
    }

    // 2. All digits → phone number
    if (/^\d+$/.test(target)) {
      return target + '@c.us';
    }

    // 3. Group name search
    logger.info(`Searching for group named "${target}"...`);
    const chats = await this.client.getChats();
    const groups = chats.filter((c) => c.isGroup);

    const match = groups.find(
      (g) => g.name.toLowerCase() === target.toLowerCase()
    );

    if (match) {
      logger.success(`Found group: "${match.name}" → ${match.id._serialized}`);
      return match.id._serialized;
    }

    // Partial match fallback
    const partial = groups.find(
      (g) => g.name.toLowerCase().includes(target.toLowerCase())
    );
    if (partial) {
      logger.warn(`Exact match not found. Using partial match: "${partial.name}" → ${partial.id._serialized}`);
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

  /**
   * Send a text message to the configured target (number, group, or channel).
   * @param {string} message
   */
  async sendMessage(message) {
    if (!this.isReady) {
      throw new Error('WhatsApp client not ready — cannot send message.');
    }
    if (!this.resolvedChatId) {
      throw new Error(
        `Target "${this.target}" could not be resolved. ` +
        'Run node list-groups.js to find the correct group name or ID.'
      );
    }

    try {
      await this.client.sendMessage(this.resolvedChatId, message);
    } catch (err) {
      throw new Error(`sendMessage to ${this.resolvedChatId} failed: ${err.message}`);
    }
  }

  /** Return all groups the linked account is in — used by list-groups.js */
  async getGroups() {
    if (!this.isReady) throw new Error('Client not ready');
    const chats = await this.client.getChats();
    return chats
      .filter((c) => c.isGroup)
      .map((g) => ({
        name: g.name,
        id:   g.id._serialized,
        participants: g.participants?.length || '?'
      }));
  }

  /** Gracefully shut down the client. */
  async destroy() {
    if (this.client) {
      await this.client.destroy().catch(() => {});
    }
  }
}

module.exports = WhatsAppSender;
