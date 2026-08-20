// src/discord-sender.js
// Sends news articles to a Discord channel via webhook.
//
// Uses Node.js native fetch (v18+) — ZERO npm dependencies.
// No discord.js needed — webhooks are plain HTTP POST.
//
// Setup:
//   1. In Discord: right-click channel → Edit Channel → Integrations → Webhooks → New Webhook
//   2. Copy the webhook URL
//   3. Set DISCORD_WEBHOOK_URL in .env
//
// Optional: Set DISCORD_USERNAME and DISCORD_AVATAR_URL for custom bot appearance.

const logger = require('./logger');

const DISCORD_MAX_LENGTH = 2000;   // Discord message character limit
const MAX_RETRIES        = 5;      // hard cap on 429 rate-limit retries

class DiscordSender {
  /**
   * @param {string} webhookUrl  — full Discord webhook URL
   * @param {string} [username]  — display name for the bot
   * @param {string} [avatarUrl] — avatar image URL
   */
  constructor(webhookUrl, username = '📰 News Feeder Bot', avatarUrl = null) {
    this.webhookUrl = webhookUrl;
    this.username   = username.slice(0, 80);
    this.avatarUrl  = avatarUrl;
    this.type       = 'discord';
  }

  // ── Private: POST to webhook ──────────────────────────────────────────────
  async _post(body, timeoutMs = 15000, retryCount = 0) {
    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(this.webhookUrl, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
        signal:  controller.signal
      });

      // 204 No Content = success for Discord webhooks
      if (res.status === 204 || res.ok) return;

      // Rate limited — read retry-after header (bounded retries, with backoff)
      if (res.status === 429) {
        const retryAfter = parseFloat(res.headers.get('retry-after') || '5');
        if (retryCount >= MAX_RETRIES) {
          throw new Error(`Discord rate limited — giving up after ${MAX_RETRIES} retries (HTTP 429)`);
        }
        const wait = Math.min(retryAfter, 60);
        logger.warn(`Discord rate limited — waiting ${wait}s (retry ${retryCount + 1}/${MAX_RETRIES})`);
        await sleep(wait * 1000);
        return this._post(body, timeoutMs, retryCount + 1);
      }

      const text = await res.text().catch(() => 'no body');
      throw new Error(`Discord webhook error: HTTP ${res.status} — ${text.slice(0, 200)}`);

    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error(`Discord webhook timeout after ${timeoutMs}ms`);
      }
      // Sanitize: remove webhook URL from error messages to avoid token leakage
      const safeMsg = err.message.replace(/https?:\/\/[^\s]+/g, '[URL_REDACTED]');
      throw new Error(safeMsg);
    } finally {
      clearTimeout(timer);
    }
  }

  /** Validate the webhook URL and confirm it's reachable. */
  async initialize() {
    logger.info('Initializing Discord webhook...');
    try {
      // GET the webhook info to validate the URL (no side effects)
      const controller = new AbortController();
      const timer      = setTimeout(() => controller.abort(), 10000);
      let res;
      try {
        res = await fetch(this.webhookUrl, { method: 'GET', signal: controller.signal });
      } finally {
        clearTimeout(timer);
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const info = await res.json();
      logger.success(`Discord webhook ready: #${info.channel_id || 'channel'} (${info.guild_id || 'server'})`);
    } catch (err) {
      throw new Error(`Discord initialization failed: ${err.message}\nCheck DISCORD_WEBHOOK_URL in your .env`);
    }
  }

  /**
   * Send a plain-text message to Discord.
   * Automatically truncates messages over Discord's 2000 char limit.
   * @param {string} message
   */
  async sendMessage(message) {
    // Discord uses plain text with some markdown — strip Telegram HTML tags
    const text = message
      .replace(/<[^>]{0,500}>/g, '')          // strip HTML
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .slice(0, DISCORD_MAX_LENGTH);

    const body = { content: text, username: this.username };
    if (this.avatarUrl) body.avatar_url = this.avatarUrl;

    try {
      await this._post(body);
    } catch (err) {
      throw new Error(`Discord send failed: ${err.message}`);
    }
  }

  /**
   * Send a rich embed to Discord (optional, more visually appealing).
   * @param {object} article  — { title, url, source, category, publishedAt }
   * @param {string} summary
   * @param {boolean} isCritical
   * @param {object} [threatIntel]
   */
  async sendEmbed(article, summary, isCritical = false, threatIntel = null) {
    const bulletText = summary
      .split('\n')
      .filter((l) => l.trim())
      .map((l) => l.replace(/^[•▪\-*]\s*/, ''))
      .join('\n');

    const fields = [];

    if (threatIntel) {
      if (threatIntel.cves && threatIntel.cves.length > 0) {
        const cveVal = threatIntel.cves.map((c) => {
          let str = `**${c.cveId}**`;
          if (c.cvss) str += ` (CVSS ${c.cvss}${c.severity ? ' ' + c.severity : ''})`;
          if (c.epss) str += ` [EPSS ${Math.round(c.epss * 100)}%]`;
          return str;
        }).join('\n');
        fields.push({ name: '🛡️ CVEs & Severity', value: cveVal.slice(0, 1024), inline: false });
      }

      if (threatIntel.mitre && threatIntel.mitre.length > 0) {
        const mitreVal = threatIntel.mitre.map((m) => `\`${m.id}\` ${m.name}`).join('\n');
        fields.push({ name: '🎯 MITRE ATT&CK', value: mitreVal.slice(0, 1024), inline: true });
      }

      if (threatIntel.iocs) {
        const iocLines = [];
        if (threatIntel.iocs.ips.length > 0) iocLines.push(`**IPs:** ${threatIntel.iocs.ips.join(', ')}`);
        if (threatIntel.iocs.hashes.length > 0) iocLines.push(`**Hashes:** ${threatIntel.iocs.hashes.map((h) => h.slice(0, 10) + '…').join(', ')}`);
        if (threatIntel.iocs.domains.length > 0) iocLines.push(`**Domains:** ${threatIntel.iocs.domains.join(', ')}`);
        if (iocLines.length > 0) {
          fields.push({ name: '🔍 Indicators of Compromise', value: iocLines.join('\n').slice(0, 1024), inline: false });
        }
      }
    }

    const embed = {
      title:       article.title.slice(0, 256),
      url:         article.url,
      description: bulletText.slice(0, 4096),
      color:       isCritical ? 0xFF0000 : 0x00AAFF,  // red for critical, blue otherwise
      fields:      fields.length > 0 ? fields : undefined,
      footer: {
        text: `${article.source} • ${article.category}`
      },
      timestamp:   new Date(article.publishedAt).toISOString()
    };

    const body = { embeds: [embed], username: this.username };
    if (this.avatarUrl) body.avatar_url = this.avatarUrl;
    if (isCritical)     body.content    = '🚨 **CRITICAL ALERT** 🚨';

    try {
      await this._post(body);
    } catch (err) {
      // Fallback to plain text
      logger.warn(`Discord embed failed, retrying as plain text: ${err.message}`);
      await this.sendMessage(`${isCritical ? '🚨 CRITICAL: ' : ''}${article.title}\n${summary}\n${article.url}`);
    }
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

module.exports = DiscordSender;
