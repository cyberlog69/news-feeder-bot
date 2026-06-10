// src/formatter.js
// Formats a news article and its AI summary into a WhatsApp-ready message.
//
// WhatsApp formatting cheat-sheet:
//   *text*   → bold
//   _text_   → italic
//   ~text~   → strikethrough
//   ```text``` → monospace

/**
 * Format an article + AI summary into a clean WhatsApp message string.
 *
 * @param {object} article  - Article object from fetcher
 * @param {string} summary  - Bullet-point summary from summarizer
 * @returns {string}        - Ready-to-send WhatsApp message
 */
function formatArticle(article, summary) {
  const timeStr = formatDate(article.publishedAt);
  const divider = '━━━━━━━━━━━━━━━━━━━━━━━━━';

  const lines = [
    `${article.category}  |  *${article.source}*`,
    divider,
    `*${article.title}*`,
    '',
    summary,
    '',
    `🔗 ${article.url}`,
    `⏰ _${timeStr}_`,
    divider
  ];

  return lines.join('\n');
}

/**
 * Format a startup / status message.
 * @param {string[]} sourceNames - List of monitored source names
 * @param {number}   intervalMin - Poll interval in minutes
 */
function formatStartupMessage(sourceNames, intervalMin) {
  const divider = '━━━━━━━━━━━━━━━━━━━━━━━━━';
  const lines = [
    `📰 *WhatsApp News Bot Started!*`,
    divider,
    `I'm now monitoring *${sourceNames.length}* news sources for you:`,
    '',
    ...sourceNames.map((n) => `   ✅ ${n}`),
    '',
    `🔄 Checking for new articles every *${intervalMin} minutes*`,
    `🤖 AI summarization: active`,
    divider,
    `_You'll receive new articles as soon as they're published._`
  ];
  return lines.join('\n');
}

/** Convert an ISO / RFC date string to a human-readable local time */
function formatDate(dateStr) {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString('en-IN', {
      day:    '2-digit',
      month:  'short',
      year:   'numeric',
      hour:   '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch {
    return dateStr;
  }
}

module.exports = { formatArticle, formatStartupMessage };
