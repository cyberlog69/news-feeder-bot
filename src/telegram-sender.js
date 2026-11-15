// src/telegram-sender.js
// Sends news articles to a Telegram chat, group, or channel.
//
// Uses Node.js built-in fetch (v18+) — NO third-party HTTP library.
// This avoids the entire vulnerable request/form-data/qs dependency chain.
//
// Setup:
//   1. Message @BotFather on Telegram → /newbot → copy the token
//   2. Set TELEGRAM_BOT_TOKEN in .env
//   3. Set TELEGRAM_TARGET in .env
//   4. Run: npm run list-telegram-chats  to find your chat/group ID
//
// TELEGRAM_TARGET formats:
//   Personal chat:  123456789
//   Group:         -987654321
//   Channel:       @mychannel  |  -1001234567890
//
// Inline buttons (sendMessageWithButtons):
//   Each article message includes an inline keyboard:
//     [📖 Read Full Article]  [🔗 Share]
//   Buttons use url type — no callback handler needed.

const crypto = require('crypto');
const logger = require('./logger');
const { mask } = require('./redact');
const { getRuntimeState, setRuntimeState } = require('./db');

// Telegram Bot API base URL — always HTTPS
const TG_API = 'https://api.telegram.org';

// Telegram's hard message length limit
const TG_MAX_LENGTH = 4096;

class TelegramSender {
  /**
   * @param {string} token  - Bot token from @BotFather
   * @param {string} target - Chat ID, group ID, or @channelname
   */
  constructor(token, target) {
    this.token  = token;
    this.target = String(target).trim();
    this.type   = 'telegram';
  }

  // ── Private: make an authenticated call to the Bot API ───────────────────
  async _call(method, body = {}, timeoutMs = 15000) {
    const url = `${TG_API}/bot${this.token}/${method}`;

    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
        signal:  controller.signal
      });

      const json = await res.json();

      if (!json.ok) {
        // Never include the token in the error message
        throw new Error(`Telegram API error [${method}]: ${json.description || 'Unknown error'} (code ${json.error_code})`);
      }
      return json.result;
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error(`Telegram API timeout [${method}] after ${timeoutMs}ms`);
      }
      // Sanitize error: remove any accidental token leakage
      const safeMsg = err.message.replace(this.token, '[REDACTED]');
      throw new Error(safeMsg);
    } finally {
      clearTimeout(timer);
    }
  }

  /** Validate token and confirm bot identity. */
  async initialize() {
    logger.info('Initializing Telegram bot...');
    try {
      const me = await this._call('getMe');
      logger.success(`Telegram bot ready: @${me.username} (${me.first_name})`);
      logger.info(`Telegram target: ${mask(this.target)}`);
    } catch (err) {
      throw new Error(
        `Telegram initialization failed: ${err.message}\n` +
        'Check TELEGRAM_BOT_TOKEN in your .env file.'
      );
    }
  }

  /**
   * Send an HTML-formatted message to the configured target.
   * Automatically truncates messages that exceed Telegram's 4096 char limit.
   * @param {string} message - HTML-safe string from formatter.js
   * @param {string} [chatId] - Override target chat (used for command replies)
   * @param {object} [options] - { parseMode: 'HTML' | null }
   */
  async sendMessage(message, chatId = this.target, options = {}) {
    // Enforce Telegram's character limit
    const text = message.length > TG_MAX_LENGTH
      ? message.slice(0, TG_MAX_LENGTH - 20) + '\n…<i>(truncated)</i>'
      : message;

    try {
      await this._call('sendMessage', {
        chat_id:                  chatId,
        text,
        ...(options.parseMode === null ? {} : { parse_mode: 'HTML' }),
        disable_web_page_preview: true
      });
    } catch (err) {
      // Translate common Telegram errors to actionable messages
      const msg = err.message;
      if (msg.includes('chat not found') || msg.includes('400')) {
        throw new Error(
          'Telegram: target chat not found. Run: npm run list-telegram-chats to find the correct ID.'
        );
      }
      if (msg.includes('kicked') || msg.includes('not a member')) {
        throw new Error('Telegram: bot is not a member of the target chat. Add it to the group/channel first.');
      }
      if (msg.includes('have no rights') || msg.includes('not enough rights')) {
        throw new Error('Telegram: bot lacks permission to post. Make it an Admin with "Post Messages" enabled.');
      }
      throw err;
    }
  }

  /**
   * Send an HTML-formatted message with an inline keyboard (URL buttons).
   *
   * @param {string}   message  — HTML-safe string from formatter.js
   * @param {Array}    buttons  — Array of rows, each row = array of button objects:
   *                              { text: string, url: string }
   *
   * Example:
   *   await sender.sendMessageWithButtons(msg, [
   *     [{ text: '📖 Read Full Article', url: 'https://example.com' }]
   *   ]);
   */
  async sendMessageWithButtons(message, buttons = []) {
    // Enforce Telegram's character limit
    const text = message.length > TG_MAX_LENGTH
      ? message.slice(0, TG_MAX_LENGTH - 20) + '\n…<i>(truncated)</i>'
      : message;

    // Sanitize buttons: only allow https/http URLs, cap label length
    const safeInlineKeyboard = buttons
      .filter((row) => Array.isArray(row) && row.length > 0)
      .map((row) =>
        row
          .filter((btn) => btn && typeof btn.text === 'string' && typeof btn.url === 'string')
          .filter((btn) => /^https?:\/\//i.test(btn.url.trim()))   // SSRF: https/http only
          .map((btn) => ({
            text: String(btn.text).slice(0, 64),
            url:  btn.url.trim().slice(0, 2048)
          }))
      )
      .filter((row) => row.length > 0);

    const body = {
      chat_id:                  this.target,
      text,
      parse_mode:               'HTML',
      disable_web_page_preview: true
    };

    if (safeInlineKeyboard.length > 0) {
      body.reply_markup = { inline_keyboard: safeInlineKeyboard };
    }

    try {
      await this._call('sendMessage', body);
    } catch (err) {
      // Graceful degradation: if buttons fail (e.g. old Bot API), retry without them
      const msg = err.message;
      if (msg.includes('reply_markup') || msg.includes('400')) {
        logger.warn(`Telegram: inline buttons failed — retrying without buttons`);
        await this.sendMessage(message);
        return;
      }
      // Re-use the same friendly error translations as sendMessage
      if (msg.includes('chat not found')) {
        throw new Error(
          'Telegram: target chat not found. Run: npm run list-telegram-chats to find the correct ID.'
        );
      }
      throw err;
    }
  }

  /**
   * Send an audio file as a native playable Telegram Voice Note.
   * @param {string} audioPath - Path to local .mp3 or .ogg file
   * @param {string} [caption] - Optional caption text
   */
  async sendVoiceNote(audioPath, caption = '') {
    const fs = require('fs');
    if (!fs.existsSync(audioPath)) {
      throw new Error(`Audio file not found: ${audioPath}`);
    }

    const url = `${TG_API}/bot${this.token}/sendVoice`;
    const fileBuffer = fs.readFileSync(audioPath);
    const blob = new Blob([fileBuffer], { type: 'audio/ogg' });

    const formData = new FormData();
    formData.append('chat_id', this.target);
    formData.append('voice', blob, 'summary.mp3');
    if (caption) formData.append('caption', caption.slice(0, 1024));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);

    try {
      const res = await fetch(url, {
        method: 'POST',
        body: formData,
        signal: controller.signal
      });

      const json = await res.json();
      if (!json.ok) {
        throw new Error(`Telegram sendVoice error: ${json.description || 'Unknown error'}`);
      }
      logger.success(`[Telegram] Voice note sent (${Math.round(fileBuffer.length / 1024)} KB)`);
    } catch (err) {
      logger.warn(`Telegram sendVoiceNote failed: ${err.message}`);
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Start long-polling getUpdates for slash commands.
   * Only chats listed in `allowedChats` (default: this.target) are accepted.
   *
   * @param {Function} handler - async ({ text, targetId, userId, platform }) => reply
   * @param {object}   [options]
   * @param {string[]} [options.allowedChats]
   * @param {number}   [options.pollTimeoutSec=25]
   */
  startCommandPolling(handler, { allowedChats = null, pollTimeoutSec = 25 } = {}) {
    if (typeof handler !== 'function') {
      return Promise.reject(new Error('startCommandPolling requires a handler function'));
    }
    if (this._polling) return this._pollingPromise;

    this._polling = true;
    this._updateOffset = this._updateOffset || 0;
    this._pollFailures = 0;
    this._offsetKey = `telegram_offset:${crypto.createHash('sha256').update(this.token).digest('hex').slice(0, 16)}`;

    // Restore the last processed update so a restart does not replay commands.
    try {
      const savedOffset = Number(getRuntimeState(this._offsetKey));
      if (Number.isFinite(savedOffset) && savedOffset > 0) {
        this._updateOffset = savedOffset;
      }
    } catch {
      // Non-fatal; the backlog skip below still prevents replay.
    }
    this._allowedChats = (Array.isArray(allowedChats) && allowedChats.length > 0 ? allowedChats : [this.target])
      .map((v) => String(v).trim().toLowerCase())
      .filter(Boolean);

    this._pollingPromise = (async () => {
      // Skip commands that arrived while the bot was offline so a restart does
      // not replay stale instructions.
      try {
        if (!this._updateOffset) {
          const backlog = await this._call('getUpdates', { offset: -1, limit: 1, timeout: 0 }, 5000);
          const last = Array.isArray(backlog) ? backlog[backlog.length - 1] : null;
          if (last?.update_id) this._updateOffset = last.update_id + 1;
        }
      } catch {
        // Not fatal — start from the persisted/zero offset.
      }

      logger.info('Telegram command polling started');
      while (this._polling) {
        try {
          const updates = await this._call('getUpdates', {
            offset: this._updateOffset || undefined,
            timeout: pollTimeoutSec,
            allowed_updates: ['message']
          }, (pollTimeoutSec + 10) * 1000);

          this._pollFailures = 0;

          for (const update of updates || []) {
            this._updateOffset = Math.max(this._updateOffset, (update.update_id || 0) + 1);
            try { setRuntimeState(this._offsetKey, String(this._updateOffset)); } catch {}
            const msg = update.message;
            if (!msg?.text || !msg.text.trim().startsWith('/')) continue;
            if (msg.from?.is_bot) continue;
            if (!this._isAllowedChat(msg.chat)) continue;

            try {
              const reply = await handler({
                text: msg.text.trim(),
                targetId: String(msg.chat.id),
                userId: String(msg.from?.id || ''),
                platform: 'telegram'
              });
              if (reply) await this.sendMessage(reply, msg.chat.id, { parseMode: null });
            } catch (err) {
              logger.warn(`Telegram command failed: ${err.message.split('\n')[0]}`);
            }
          }
        } catch (err) {
          if (!this._polling) break;
          this._pollFailures += 1;
          logger.warn(`Telegram command polling error (${this._pollFailures}/5): ${err.message.split('\n')[0]}`);
          if (this._pollFailures >= 5) {
            logger.warn('Telegram command polling disabled after repeated errors (check for a configured webhook)');
            this._polling = false;
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 3000));
        }
      }
    })();

    return this._pollingPromise;
  }

  /** Stop the command polling loop. */
  stopCommandPolling() {
    this._polling = false;
  }

  _isAllowedChat(chat) {
    if (!chat) return false;
    const id = String(chat.id);
    const username = chat.username ? String(chat.username).toLowerCase() : '';
    return this._allowedChats.some(
      (target) => target === id || (target.startsWith('@') && target.slice(1) === username)
    );
  }

  /**
   * Fetch recent chats the bot has seen via getUpdates.
   * Used by list-telegram-chats.js.
   */
  async getRecentChats() {
    const updates = await this._call('getUpdates', { limit: 100, timeout: 5 });

    const seen = new Map();
    for (const update of updates) {
      const msg  = update.message || update.channel_post || update.edited_message;
      if (!msg?.chat) continue;
      const chat = msg.chat;
      if (!seen.has(chat.id)) {
        seen.set(chat.id, {
          id:       chat.id,
          type:     chat.type,
          name:     chat.title || `${chat.first_name || ''} ${chat.last_name || ''}`.trim(),
          username: chat.username ? `@${chat.username}` : null
        });
      }
    }
    return [...seen.values()];
  }
}

module.exports = TelegramSender;
