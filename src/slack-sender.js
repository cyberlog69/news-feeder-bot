// src/slack-sender.js
// Sends news articles to a Slack channel via Webhook using Block Kit.
// Zero dependencies — uses native fetch.

const logger = require('./logger');

const MAX_RETRIES = 3;

class SlackSender {
  /**
   * @param {string} webhookUrl - Slack Incoming Webhook URL
   * @param {string} [username] - Custom bot username
   */
  constructor(webhookUrl, username = '📰 News Feeder Bot') {
    this.webhookUrl = webhookUrl;
    this.username = username;
    this.type = 'slack';
  }

  async initialize() {
    logger.info('Initializing Slack webhook...');
    if (!this.webhookUrl || !this.webhookUrl.startsWith('https://hooks.slack.com/')) {
      throw new Error('Invalid SLACK_WEBHOOK_URL format.');
    }
    logger.success('Slack webhook client initialized');
  }

  async _post(payload, timeoutMs = 15000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        const err = new Error(`Slack webhook error: HTTP ${res.status} — ${errText.slice(0, 200)}`);
        err.status = res.status;
        throw err;
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error(`Slack webhook timeout after ${timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  async _postWithRetry(payload) {
    let lastErr;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        await this._post(payload);
        return;
      } catch (err) {
        lastErr = err;
        if (err.status === 429 && attempt < MAX_RETRIES) {
          const wait = attempt * 5000;
          logger.warn(`Slack rate limited — retry ${attempt}/${MAX_RETRIES} in ${wait}ms`);
          await sleep(wait);
          continue;
        }
        // Redact the webhook URL from any surfaced error (contains a token)
        throw new Error(err.message.replace(/https?:\/\/[^\s]+/g, '[URL_REDACTED]'));
      }
    }
    throw lastErr;
  }

  async sendMessage(message) {
    const payload = {
      text: message.replace(/<[^>]{0,500}>/g, ''),
      username: this.username
    };
    await this._postWithRetry(payload);
  }

  async sendBlockKit(article, summary, isCritical = false, threatIntel = null) {
    const headerText = `${isCritical ? '🚨 CRITICAL ALERT: ' : ''}${article.title.slice(0, 150)}`;
    const blocks = [
      {
        type: 'header',
        text: { type: 'plain_text', text: headerText, emoji: true }
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*Source:* ${article.source} | *Category:* ${article.category}\n\n${summary}` }
      }
    ];

    if (threatIntel) {
      const tiParts = ['*🛡️ Threat Intelligence*'];
      if (threatIntel.cves && threatIntel.cves.length > 0) {
        tiParts.push(`• *CVEs:* ` + threatIntel.cves.map((c) => `${c.cveId}${c.cvss ? ' (CVSS ' + c.cvss + ')' : ''}`).join(', '));
      }
      if (threatIntel.mitre && threatIntel.mitre.length > 0) {
        tiParts.push(`• *MITRE:* ` + threatIntel.mitre.map((m) => `${m.id} (${m.name})`).join(', '));
      }
      if (threatIntel.iocs && (threatIntel.iocs.ips.length || threatIntel.iocs.hashes.length)) {
        const iocs = [];
        if (threatIntel.iocs.ips.length) iocs.push(`IPs: ${threatIntel.iocs.ips.join(', ')}`);
        if (threatIntel.iocs.hashes.length) iocs.push(`Hashes: ${threatIntel.iocs.hashes.map((h) => h.slice(0, 10) + '…').join(', ')}`);
        tiParts.push(`• *IOCs:* ${iocs.join(' | ')}`);
      }

      if (tiParts.length > 1) {
        blocks.push({
          type: 'section',
          text: { type: 'mrkdwn', text: tiParts.join('\n') }
        });
      }
    }

    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Read Full Article 📖', emoji: true },
          url: article.url,
          action_id: 'read_article'
        }
      ]
    });

    const payload = {
      username: this.username,
      blocks
    };

    try {
      await this._postWithRetry(payload);
    } catch (err) {
      logger.warn(`Slack Block Kit failed, retrying as plain text: ${err.message}`);
      await this.sendMessage(`${headerText}\n${summary}\n${article.url}`);
    }
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

module.exports = SlackSender;
