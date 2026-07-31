// src/slack-sender.js
// Sends news articles to a Slack channel via Webhook using Block Kit.
// Zero dependencies — uses native fetch.

const logger = require('./logger');

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

  async sendMessage(message) {
    const payload = {
      text: message.replace(/<[^>]{0,500}>/g, ''),
      username: this.username
    };

    const res = await fetch(this.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error(`Slack webhook error: HTTP ${res.status}`);
    }
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

    const res = await fetch(this.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      await this.sendMessage(`${headerText}\n${summary}\n${article.url}`);
    }
  }
}

module.exports = SlackSender;
