// src/push-sender.js
// Mobile Push Notification Sender (Pushover & Ntfy.sh)
// Zero external dependencies — uses native fetch.

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
   * Send push notification.
   * @param {string} message
   */
  async sendMessage(message) {
    const title = '📰 News Feeder Alert';
    await this.sendPush(title, message, '#');
  }

  /**
   * Send notification for an article.
   * @param {object} article
   * @param {string} summary
   * @param {boolean} isCritical
   */
  async sendPush(title, summary, url = '#', isCritical = false) {
    const cleanText = String(summary || '').replace(/<[^>]{0,500}>/g, '').slice(0, 1000);

    if (this.provider === 'ntfy' && this.topicUrl) {
      // Ntfy.sh REST API
      const res = await fetchWithTimeout(this.topicUrl, {
        method: 'POST',
        headers: {
          'Title': title.slice(0, 100),
          'Priority': isCritical ? 'high' : 'default',
          'Tags': isCritical ? 'warning,rotating_light' : 'newspaper',
          'Click': url
        },
        body: cleanText
      }, 8000);

      if (!res.ok) {
        throw new Error(`Ntfy push failed: HTTP ${res.status}`);
      }
      logger.success(`[Push:Ntfy] Notification sent: "${title.slice(0, 40)}…"`);
    } else if (this.provider === 'pushover' && this.userKey && this.apiToken) {
      // Pushover REST API
      const body = new URLSearchParams({
        token: this.apiToken,
        user: this.userKey,
        title: title.slice(0, 100),
        message: cleanText,
        url: url,
        priority: isCritical ? '1' : '0'
      });

      const res = await fetchWithTimeout('https://api.pushover.net/1/messages.json', {
        method: 'POST',
        body
      }, 8000);

      if (!res.ok) {
        throw new Error(`Pushover push failed: HTTP ${res.status}`);
      }
      logger.success(`[Push:Pushover] Notification sent: "${title.slice(0, 40)}…"`);
    } else {
      logger.info(`[Push Demo] Notification: "${title}" -> ${cleanText.slice(0, 60)}…`);
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
