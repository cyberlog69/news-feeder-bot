// src/telegram-sender.js
// Sends news articles to a Telegram chat, group, or channel.
//
// Setup:
//   1. Message @BotFather on Telegram → /newbot → copy the token
//   2. Set TELEGRAM_BOT_TOKEN in .env
//   3. Set TELEGRAM_TARGET in .env (chat ID, @channelname, or group ID)
//   4. Run: npm run list-telegram-chats  to find your chat/group ID
//
// TELEGRAM_TARGET formats accepted:
//   Personal chat:  123456789           (numeric user ID)
//   Group:         -987654321           (negative numeric group ID)
//   Channel:       @mychannel           (public channel username)
//   Channel:       -1001234567890       (private channel numeric ID)

const TelegramBot = require('node-telegram-bot-api');
const logger      = require('./logger');

class TelegramSender {
  /**
   * @param {string} token  - Bot token from @BotFather
   * @param {string} target - Chat ID, group ID, or @channelname
   */
  constructor(token, target) {
    this.token  = token;
    this.target = target.trim();
    this.type   = 'telegram';
    this.bot    = null;
  }

  /** Initialize — validates the token and resolves the target chat */
  async initialize() {
    logger.info('Initializing Telegram bot...');

    // polling: false — we only send, never receive
    this.bot = new TelegramBot(this.token, { polling: false });

    // Validate token by fetching bot info
    try {
      const me = await this.bot.getMe();
      logger.success(`Telegram bot ready: @${me.username} (${me.first_name})`);
      logger.info(`Telegram target: ${this.target}`);
    } catch (err) {
      throw new Error(
        `Telegram token invalid or network error: ${err.message}\n` +
        'Check TELEGRAM_BOT_TOKEN in your .env file.'
      );
    }
  }

  /**
   * Send an HTML-formatted message to the configured target.
   * @param {string} message - HTML formatted string
   */
  async sendMessage(message) {
    if (!this.bot) throw new Error('Telegram bot not initialized');

    try {
      await this.bot.sendMessage(this.target, message, {
        parse_mode:               'HTML',
        disable_web_page_preview: true
      });
    } catch (err) {
      // Surface helpful error messages
      if (err.message.includes('chat not found')) {
        throw new Error(
          `Telegram chat "${this.target}" not found.\n` +
          'Run: npm run list-telegram-chats to find the correct chat ID.'
        );
      }
      if (err.message.includes('bot was kicked') || err.message.includes('not a member')) {
        throw new Error(
          `Bot is not a member of chat "${this.target}".\n` +
          'Add your bot to the group/channel first, then restart.'
        );
      }
      if (err.message.includes('have no rights')) {
        throw new Error(
          `Bot doesn't have permission to post in "${this.target}".\n` +
          'For channels: make the bot an Administrator with "Post Messages" permission.'
        );
      }
      throw err;
    }
  }

  /** Return recent chats the bot has interacted with — used by list-telegram-chats.js */
  async getRecentChats() {
    if (!this.bot) throw new Error('Bot not initialized');
    const updates = await this.bot.getUpdates({ limit: 100, timeout: 5 });

    const seen  = new Map();
    for (const update of updates) {
      const msg  = update.message || update.channel_post || update.edited_message;
      if (!msg) continue;
      const chat = msg.chat;
      if (!seen.has(chat.id)) {
        seen.set(chat.id, {
          id:    chat.id,
          type:  chat.type,                                          // private/group/supergroup/channel
          name:  chat.title || `${chat.first_name || ''} ${chat.last_name || ''}`.trim(),
          username: chat.username ? `@${chat.username}` : null
        });
      }
    }
    return [...seen.values()];
  }
}

module.exports = TelegramSender;
