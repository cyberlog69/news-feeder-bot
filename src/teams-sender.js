// src/teams-sender.js
// Sends news articles to a Microsoft Teams channel via Webhook (Adaptive Cards).
// Zero dependencies — uses native fetch.

const logger = require('./logger');

const MAX_RETRIES = 3;

class TeamsSender {
  /**
   * @param {string} webhookUrl - MS Teams Webhook URL
   * @param {string} [username] - Display title
   */
  constructor(webhookUrl, username = '📰 News Feeder Bot') {
    this.webhookUrl = webhookUrl;
    this.username = username;
    this.type = 'teams';
  }

  async initialize() {
    logger.info('Initializing Microsoft Teams webhook...');
    if (!this.webhookUrl || !this.webhookUrl.startsWith('https://')) {
      throw new Error('TEAMS_WEBHOOK_URL must be a valid https URL.');
    }
    logger.success('Microsoft Teams webhook initialized');
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
        const err = new Error(`Teams webhook error: HTTP ${res.status} — ${errText.slice(0, 200)}`);
        err.status = res.status;
        throw err;
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error(`Teams webhook timeout after ${timeoutMs}ms`);
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
          logger.warn(`Teams rate limited — retry ${attempt}/${MAX_RETRIES} in ${wait}ms`);
          await sleep(wait);
          continue;
        }
        throw new Error(err.message.replace(/https?:\/\/[^\s]+/g, '[URL_REDACTED]'));
      }
    }
    throw lastErr;
  }

  async sendMessage(message) {
    const payload = {
      type: 'message',
      attachments: [
        {
          contentType: 'application/vnd.microsoft.card.adaptive',
          content: {
            $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
            type: 'AdaptiveCard',
            version: '1.2',
            body: [
              {
                type: 'TextBlock',
                text: message.replace(/<[^>]{0,500}>/g, ''),
                wrap: true
              }
            ]
          }
        }
      ]
    };

    await this._postWithRetry(payload);
  }

  async sendAdaptiveCard(article, summary, isCritical = false, threatIntel = null) {
    const cardBody = [
      {
        type: 'TextBlock',
        text: `${isCritical ? '🚨 CRITICAL: ' : ''}${article.title}`,
        weight: 'Bolder',
        size: 'Medium',
        wrap: true,
        color: isCritical ? 'Attention' : 'Default'
      },
      {
        type: 'TextBlock',
        text: `Source: ${article.source} | Category: ${article.category}`,
        isSubtle: true,
        size: 'Small',
        wrap: true
      },
      {
        type: 'TextBlock',
        text: summary,
        wrap: true
      }
    ];

    if (threatIntel) {
      const facts = [];
      if (threatIntel.cves && threatIntel.cves.length > 0) {
        facts.push({
          title: 'CVEs:',
          value: threatIntel.cves.map((c) => `${c.cveId}${c.cvss ? ' (CVSS ' + c.cvss + ')' : ''}`).join(', ')
        });
      }
      if (threatIntel.mitre && threatIntel.mitre.length > 0) {
        facts.push({
          title: 'MITRE:',
          value: threatIntel.mitre.map((m) => `${m.id} (${m.name})`).join(', ')
        });
      }
      if (threatIntel.iocs && (threatIntel.iocs.ips.length || threatIntel.iocs.hashes.length)) {
        const iocStr = [];
        if (threatIntel.iocs.ips.length) iocStr.push(`IPs: ${threatIntel.iocs.ips.join(', ')}`);
        if (threatIntel.iocs.hashes.length) iocStr.push(`Hashes: ${threatIntel.iocs.hashes.map((h) => h.slice(0, 10) + '…').join(', ')}`);
        facts.push({ title: 'IOCs:', value: iocStr.join(' | ') });
      }

      if (facts.length > 0) {
        cardBody.push({
          type: 'FactSet',
          facts
        });
      }
    }

    const payload = {
      type: 'message',
      attachments: [
        {
          contentType: 'application/vnd.microsoft.card.adaptive',
          content: {
            $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
            type: 'AdaptiveCard',
            version: '1.2',
            body: cardBody,
            actions: [
              {
                type: 'Action.OpenUrl',
                title: 'Read Full Article 📖',
                url: article.url
              }
            ]
          }
        }
      ]
    };

    try {
      await this._postWithRetry(payload);
    } catch (err) {
      logger.warn(`Teams Adaptive Card failed, retrying as plain text: ${err.message}`);
      await this.sendMessage(`${article.title}\n${summary}\n${article.url}`);
    }
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

module.exports = TeamsSender;
