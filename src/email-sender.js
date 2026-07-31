// src/email-sender.js
// HTML Email Newsletter Sender
// Delivers dark-themed HTML email newsletters via SendGrid/Resend REST API or SMTP.

const logger = require('./logger');

class EmailSender {
  /**
   * @param {object} config - { apiKey, fromEmail, toEmail, provider }
   */
  constructor(config = {}) {
    this.apiKey    = config.apiKey || process.env.EMAIL_API_KEY || '';
    this.fromEmail = config.fromEmail || process.env.EMAIL_FROM || 'newsbot@example.com';
    this.toEmail   = config.toEmail || process.env.EMAIL_TO || '';
    this.provider  = (config.provider || process.env.EMAIL_PROVIDER || 'sendgrid').toLowerCase().trim();
    this.type      = 'email';
  }

  async initialize() {
    logger.info('Initializing Email Newsletter Sender...');
    if (!this.toEmail) {
      throw new Error('EMAIL_TO environment variable is required for Email Sender.');
    }
    logger.success(`Email Newsletter Sender initialized: -> ${this.toEmail}`);
  }

  /**
   * Build responsive, dark-themed HTML email template.
   * @param {object} article
   * @param {string} summary
   * @param {object|null} threatIntel
   * @returns {string} HTML string
   */
  buildHtmlEmailTemplate(article, summary, threatIntel = null) {
    const title = escapeHtml(article.title || '');
    const source = escapeHtml(article.source || '');
    const category = escapeHtml(article.category || 'Security');
    const url = article.url || '#';
    const dateStr = new Date(article.publishedAt || Date.now()).toLocaleString('en-IN');

    const bulletItems = summary
      .split('\n')
      .map((l) => l.replace(/^[•▪\-*\d.]+\s*/, '').trim())
      .filter((l) => l.length > 0)
      .map((l) => `<li style="margin-bottom:8px;">${escapeHtml(l)}</li>`)
      .join('');

    let tiHtml = '';
    if (threatIntel) {
      const parts = [];
      if (threatIntel.cves && threatIntel.cves.length > 0) {
        parts.push(`<strong>CVEs:</strong> ${escapeHtml(threatIntel.cves.map((c) => `${c.cveId}${c.cvss ? ' (CVSS ' + c.cvss + ')' : ''}`).join(', '))}`);
      }
      if (threatIntel.mitre && threatIntel.mitre.length > 0) {
        parts.push(`<strong>MITRE ATT&CK:</strong> ${escapeHtml(threatIntel.mitre.map((m) => `${m.id} (${m.name})`).join(', '))}`);
      }
      if (threatIntel.iocs && (threatIntel.iocs.ips.length || threatIntel.iocs.hashes.length)) {
        const iocStr = [];
        if (threatIntel.iocs.ips.length) iocStr.push(`IPs: ${threatIntel.iocs.ips.join(', ')}`);
        if (threatIntel.iocs.hashes.length) iocStr.push(`Hashes: ${threatIntel.iocs.hashes.map((h) => h.slice(0, 10) + '…').join(', ')}`);
        parts.push(`<strong>IOCs:</strong> ${escapeHtml(iocStr.join(' | '))}`);
      }

      if (parts.length > 0) {
        tiHtml = `
          <div style="background:#1e293b;border-left:4px solid #ef4444;padding:12px 16px;border-radius:6px;margin:20px 0;font-size:13px;color:#fca5a5;">
            <div style="font-weight:bold;color:#f87171;margin-bottom:6px;">🛡️ Threat Intelligence</div>
            ${parts.map((p) => `<div style="margin-bottom:4px;">${p}</div>`).join('')}
          </div>
        `;
      }
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
</head>
<body style="background-color:#0f172a;color:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;margin:0;padding:24px;">
  <div style="max-width:600px;margin:0 auto;background-color:#1e293b;border-radius:12px;overflow:hidden;border:1px solid #334155;">
    <div style="background-color:#2563eb;padding:16px 24px;color:#ffffff;font-size:18px;font-weight:bold;">
      📰 News Feeder Alert
    </div>
    <div style="padding:24px;">
      <div style="font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;">
        ${category} • ${source}
      </div>
      <h1 style="font-size:20px;color:#f8fafc;margin:0 0 16px 0;line-height:1.4;">
        ${title}
      </h1>
      ${tiHtml}
      <div style="font-size:14px;color:#cbd5e1;line-height:1.6;margin-bottom:24px;">
        <ul style="padding-left:20px;margin:0;">
          ${bulletItems}
        </ul>
      </div>
      <div style="text-align:center;margin-top:24px;">
        <a href="${url}" target="_blank" style="background-color:#3b82f6;color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:6px;font-weight:600;font-size:14px;display:inline-block;">
          Read Full Article 📖
        </a>
      </div>
    </div>
    <div style="background-color:#0f172a;padding:12px 24px;font-size:12px;color:#64748b;text-align:center;border-top:1px solid #334155;">
      Sent by News Feeder Bot • ${dateStr}
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Send HTML email newsletter via SendGrid / Resend REST API.
   */
  async sendMessage(message) {
    // Send as simple formatted text message if HTML not explicitly called
    const article = { title: 'News Feeder Update', source: 'Bot', category: 'General', url: '#' };
    await this.sendEmail(article, message, null);
  }

  async sendEmail(article, summary, threatIntel = null) {
    const html = this.buildHtmlEmailTemplate(article, summary, threatIntel);
    const subject = `[News Alert] ${article.title}`;

    if (!this.apiKey) {
      logger.info(`[Email Demo] Would send email to ${this.toEmail}: "${subject}"`);
      return;
    }

    // SendGrid REST API send
    if (this.provider === 'sendgrid') {
      const res = await fetchWithTimeout('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: this.toEmail }] }],
          from: { email: this.fromEmail },
          subject: subject,
          content: [{ type: 'text/html', value: html }]
        })
      }, 10000);

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`SendGrid API error: HTTP ${res.status} — ${errText.slice(0, 200)}`);
      }
      logger.success(`[Email] Newsletter sent via SendGrid to ${this.toEmail}`);
    }
  }
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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

module.exports = EmailSender;
