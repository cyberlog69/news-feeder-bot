// src/teams-sender.js
// Sends news articles to a Microsoft Teams channel via Webhook (Adaptive Cards).
// Zero dependencies — uses native fetch.

const logger = require('./logger');

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
    if (!this.webhookUrl) throw new Error('TEAMS_WEBHOOK_URL not set');
    logger.success('Microsoft Teams webhook initialized');
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

    const res = await fetch(this.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error(`Teams webhook error: HTTP ${res.status}`);
    }
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

    const res = await fetch(this.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      await this.sendMessage(`${article.title}\n${summary}\n${article.url}`);
    }
  }
}

module.exports = TeamsSender;
