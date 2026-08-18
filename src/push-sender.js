// src/push-sender.js
// Mobile Push Notification Sender (Pushover & Ntfy.sh)
// Zero external dependencies — uses native fetch with UTF-8 JSON payloads.

const logger = require('./logger');

class PushSender {
  /**
   * @param {object} config - { provider, userKey, apiToken, topicUrl }
   */
  constructor(config = {}) {
    this.provider = (config.provider || process.env.PUSH_PROVIDER || 'ntfy').toLowerCase().trim();
    this.userKey  = config.userKey || process.env.PUSHOVER_USER_KEY || '';
    this.apiToken = config.apiToken || process.env.PUSHOVER_API_TOKEN || '';
    this.topicUrl = config.topicUrl || process.env.NTFY_TOPIC_URL || '';
    this.type     = 'push';
  }

  async initialize() {
    logger.info(`Initializing Mobile Push Sender (${this.provider})…`);
    if (this.provider === 'pushover' && (!this.userKey || !this.apiToken)) {
      throw new Error('PUSHOVER_USER_KEY and PUSHOVER_API_TOKEN are required for Pushover push notifications.');
    }
    if (this.provider === 'ntfy' && !this.topicUrl) {
      throw new Error('NTFY_TOPIC_URL is required for Ntfy.sh push notifications.');
    }
    logger.success(`Mobile Push Sender initialized (${this.provider})`);
  }

  /**
   * Send generic message.
   * @param {string} message
   */
  async sendMessage(message) {
    const title = '📰 News Feeder Alert';
    await this.sendPush(title, message, '#');
  }

  /**
   * Send notification for an article.
   * @param {string} title
   * @param {string} summary
   * @param {string} [url='#']
   * @param {boolean} [isCritical=false]
   */
  async sendPush(title, summary, url = '#', isCritical = false) {
    const cleanText = String(summary || '').replace(/<[^>]{0,500}>/g, '').slice(0, 1000);
    const cleanTitle = String(title || 'News Alert').slice(0, 200);

    if (this.provider === 'ntfy' && this.topicUrl) {
      // Ntfy.sh JSON API: Prevents ByteString header conversion errors on Unicode/curly quotes (8217)
      const payload = {
        title: cleanTitle,
        message: cleanText,
        priority: isCritical ? 4 : 3,
        tags: isCritical ? ['warning', 'rotating_light'] : ['newspaper'],
        click: url
      };

      const res = await fetchWithTimeout(this.topicUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      }, 8000);

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Ntfy push failed: HTTP ${res.status} ${errText.slice(0, 100)}`);
      }
      logger.success(`[Push:Ntfy] Notification sent: "${cleanTitle.slice(0, 40)}…"`);
    } else if (this.provider === 'pushover' && this.userKey && this.apiToken) {
      // Pushover REST API (form-urlencoded with UTF-8 encoding)
      const body = new URLSearchParams({
        token: this.apiToken,
        user: this.userKey,
        title: cleanTitle,
        message: cleanText,
        url: url,
        priority: isCritical ? '1' : '0'
      });

      const res = await fetchWithTimeout('https://api.pushover.net/1/messages.json', {
        method: 'POST',
        body
      }, 8000);

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Pushover push failed: HTTP ${res.status} ${errText.slice(0, 100)}`);
      }
      logger.success(`[Push:Pushover] Notification sent: "${cleanTitle.slice(0, 40)}…"`);
    } else {
      logger.info(`[Push Demo] Notification: "${cleanTitle}" -> ${cleanText.slice(0, 60)}…`);
    }
  }
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

module.exports = PushSender;
