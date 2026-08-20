// src/google-chat-sender.js
// Sends news articles to a Google Chat Space (formerly Google Hangouts) via Webhook.
// Uses Google Chat Cards v2 API with native fetch — ZERO npm dependencies.

const logger = require('./logger');

const MAX_RETRIES = 3;

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
    if (!this.webhookUrl || !this.webhookUrl.startsWith('https://chat.googleapis.com/')) {
      throw new Error('Invalid GOOGLE_CHAT_WEBHOOK_URL. Expected URL starting with "https://chat.googleapis.com/".');
    }
    logger.success('Google Chat Space webhook initialized');
  }

  async _post(payload, timeoutMs = 15000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        const err = new Error(`Google Chat webhook error: HTTP ${res.status} — ${errText.slice(0, 200)}`);
        err.status = res.status;
        throw err;
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error(`Google Chat webhook timeout after ${timeoutMs}ms`);
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
          logger.warn(`Google Chat rate limited — retry ${attempt}/${MAX_RETRIES} in ${wait}ms`);
          await sleep(wait);
          continue;
        }
        throw new Error(err.message.replace(/https?:\/\/[^\s]+/g, '[URL_REDACTED]'));
      }
    }
    throw lastErr;
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

    await this._postWithRetry({ text });
  }

  /**
   * Send a rich Card v2 message to the Google Chat space.
   * @param {object} article - { title, url, source, category }
   * @param {string} summary
   * @param {boolean} isCritical
   * @param {object} [threatIntel]
   */
  async sendCard(article, summary, isCritical = false, threatIntel = null) {
    const headerTitle = `${isCritical ? '🚨 CRITICAL ALERT: ' : ''}${article.title.slice(0, 150)}`;
    const subtitle = `${article.source || 'News'} • ${article.category || 'Tech'}`;

    const widgets = [
      {
        textParagraph: {
          text: summary
        }
      }
    ];

    if (threatIntel) {
      const tiLines = ['<b>🛡️ Threat Intelligence</b>'];
      if (threatIntel.cves && threatIntel.cves.length > 0) {
        tiLines.push(`• <b>CVEs:</b> ` + threatIntel.cves.map((c) => `${c.cveId}${c.cvss ? ' (CVSS ' + c.cvss + ')' : ''}`).join(', '));
      }
      if (threatIntel.mitre && threatIntel.mitre.length > 0) {
        tiLines.push(`• <b>MITRE:</b> ` + threatIntel.mitre.map((m) => `${m.id} (${m.name})`).join(', '));
      }
      if (threatIntel.iocs && (threatIntel.iocs.ips.length || threatIntel.iocs.hashes.length)) {
        const iocParts = [];
        if (threatIntel.iocs.ips.length) iocParts.push(`IPs: ${threatIntel.iocs.ips.join(', ')}`);
        if (threatIntel.iocs.hashes.length) iocParts.push(`Hashes: ${threatIntel.iocs.hashes.map((h) => h.slice(0, 10) + '…').join(', ')}`);
        tiLines.push(`• <b>IOCs:</b> ${iocParts.join(' | ')}`);
      }

      if (tiLines.length > 1) {
        widgets.push({
          textParagraph: {
            text: tiLines.join('\n')
          }
        });
      }
    }

    widgets.push({
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
    });

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
                widgets: widgets
              }
            ]
          }
        }
      ]
    };

    try {
      await this._postWithRetry(cardPayload);
    } catch (err) {
      // Fallback to plain text if card fails
      logger.warn(`Google Chat card failed, retrying as plain text: ${err.message}`);
      await this.sendMessage(`${headerTitle}\n${summary}\n${article.url}`);
    }
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

module.exports = GoogleChatSender;
