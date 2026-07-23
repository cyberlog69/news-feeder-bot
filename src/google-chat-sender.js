// src/google-chat-sender.js
// Sends news articles to a Google Chat Space (formerly Google Hangouts) via Webhook.
// Uses Google Chat Cards v2 API with native fetch — ZERO npm dependencies.

const logger = require('./logger');

class GoogleChatSender {
  /**
   * @param {string} webhookUrl - Google Chat Space Webhook URL
   *                              (https://chat.googleapis.com/v1/spaces/.../messages?key=...&token=...)
   * @param {string} [username] - Display name
   */
  constructor(webhookUrl, username = '📰 News Feeder Bot') {
    this.webhookUrl = webhookUrl;
    this.username = username;
    this.type = 'google-chat';
  }

  async initialize() {
    logger.info('Initializing Google Chat Space webhook...');
    if (!this.webhookUrl || !this.webhookUrl.includes('chat.googleapis.com')) {
      throw new Error('Invalid GOOGLE_CHAT_WEBHOOK_URL. Expected URL containing "chat.googleapis.com".');
    }
    logger.success('Google Chat Space webhook initialized');
  }

  /**
   * Send a plain text message to the Google Chat space.
   * @param {string} message
   */
  async sendMessage(message) {
    const text = message
      .replace(/<[^>]{0,500}>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"');

    const res = await fetch(this.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({ text })
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Google Chat webhook error: HTTP ${res.status} — ${errText.slice(0, 200)}`);
    }
  }

  /**
   * Send a rich Card v2 message to the Google Chat space.
   * @param {object} article - { title, url, source, category }
   * @param {string} summary
   * @param {boolean} isCritical
   */
  async sendCard(article, summary, isCritical = false) {
    const headerTitle = `${isCritical ? '🚨 CRITICAL ALERT: ' : ''}${article.title.slice(0, 150)}`;
    const subtitle = `${article.source || 'News'} • ${article.category || 'Tech'}`;

    const cardPayload = {
      cardsV2: [
        {
          cardId: `news_${Date.now()}`,
          card: {
            header: {
              title: headerTitle,
              subtitle: subtitle,
              imageUrl: 'https://fonts.gstatic.com/s/i/short-term/release/googlesymbols/newspaper/default/48px.svg',
              imageType: 'CIRCLE'
            },
            sections: [
              {
                widgets: [
                  {
                    textParagraph: {
                      text: summary
                    }
                  },
                  {
                    buttonList: {
                      buttons: [
                        {
                          text: 'Read Full Article 📖',
                          onClick: {
                            openLink: {
                              url: article.url
                            }
                          }
                        }
                      ]
                    }
                  }
                ]
              }
            ]
          }
        }
      ]
    };

    const res = await fetch(this.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify(cardPayload)
    });

    if (!res.ok) {
      // Fallback to plain text if card fails
      await this.sendMessage(`${headerTitle}\n${summary}\n${article.url}`);
    }
  }
}

module.exports = GoogleChatSender;
