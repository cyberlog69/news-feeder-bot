// src/webhook-sender.js
// Outbound Webhook Sender for SOAR / SIEM Integration
// Exports structured JSON security payloads to external automation endpoints (n8n, Zapier, Splunk, Shuffle).

const logger = require('./logger');

class WebhookSender {
  /**
   * @param {string} webhookUrl - Outbound HTTP Webhook URL
   * @param {string} [secret]   - Optional HMAC authorization token / secret header
   */
  constructor(webhookUrl = '', secret = '') {
    this.webhookUrl = webhookUrl || process.env.OUTBOUND_WEBHOOK_URL || '';
    this.secret     = secret || process.env.OUTBOUND_WEBHOOK_SECRET || '';
    this.type       = 'outbound-webhook';
  }

  async initialize() {
    logger.info('Initializing Outbound Webhook Sender…');
    if (!this.webhookUrl) {
      throw new Error('OUTBOUND_WEBHOOK_URL environment variable is required.');
    }
    logger.success(`Outbound Webhook Sender initialized: -> ${this.webhookUrl}`);
  }

  async sendMessage(message) {
    const payload = { event: 'news_alert', message, timestamp: new Date().toISOString() };
    await this._postPayload(payload);
  }

  /**
   * Export a structured article payload to the target HTTP endpoint.
   * @param {object} article
   * @param {string} summary
   * @param {boolean} isCritical
   * @param {object|null} threatIntel
   */
  async sendPayload(article, summary, isCritical = false, threatIntel = null) {
    const payload = {
      event: 'security_news_alert',
      timestamp: new Date().toISOString(),
      is_critical: isCritical,
      article: {
        title: article.title,
        url: article.url,
        source: article.source,
        category: article.category,
        published_at: article.publishedAt
      },
      summary_bullets: summary.split('\n').filter((l) => l.trim()),
      threat_intel: threatIntel || null
    };

    await this._postPayload(payload);
  }

  async _postPayload(payload) {
    if (!this.webhookUrl) {
      logger.info('[Webhook Demo] Payload:', JSON.stringify(payload).slice(0, 100));
      return;
    }

    const headers = { 'Content-Type': 'application/json' };
    if (this.secret) {
      headers['X-NewsBot-Secret'] = this.secret;
      headers['Authorization']   = `Bearer ${this.secret}`;
    }

    const res = await fetchWithTimeout(this.webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    }, 10000);

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Outbound webhook HTTP ${res.status}: ${errText.slice(0, 150)}`);
    }

    logger.success(`[Outbound Webhook] Exported event payload to ${this.webhookUrl}`);
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

module.exports = WebhookSender;
