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

  async sendBlockKit(article, summary, isCritical = false) {
    const headerText = `${isCritical ? '🚨 CRITICAL ALERT: ' : ''}${article.title.slice(0, 150)}`;
    const payload = {
      username: this.username,
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: headerText, emoji: true }
        },
        {
          type: 'section',
          text: { type: 'mrkdwn', text: `*Source:* ${article.source} | *Category:* ${article.category}\n\n${summary}` }
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: { type: 'plain_text', text: 'Read Full Article 📖', emoji: true },
              url: article.url,
              action_id: 'read_article'
            }
          ]
        }
      ]
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
