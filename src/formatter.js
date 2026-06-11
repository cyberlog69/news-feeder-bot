// src/formatter.js
// Formats news articles for WhatsApp and Telegram.
//
// WhatsApp: uses WhatsApp's own markdown (*bold*, _italic_, dividers)
// Telegram:  uses HTML (<b>, <i>, <a href>) — more reliable than MarkdownV2

// ── WhatsApp Formatter ────────────────────────────────────────────────────────

/**
 * Format an article for WhatsApp.
 * @param {object} article  - Article object from fetcher
 * @param {string} summary  - Bullet-point summary from summarizer
 * @returns {string}
 */
function formatArticle(article, summary) {
  const timeStr = formatDate(article.publishedAt);
  const divider = '━━━━━━━━━━━━━━━━━━━━━━━━━';

  return [
    `${article.category}  |  *${article.source}*`,
    divider,
    `*${article.title}*`,
    '',
    summary,
    '',
    `🔗 ${article.url}`,
    `⏰ _${timeStr}_`,
    divider
  ].join('\n');
}

/**
 * Format a startup message for WhatsApp.
 * @param {string[]} sourceNames
 * @param {number}   intervalMin
 */
function formatStartupMessage(sourceNames, intervalMin) {
  const divider = '━━━━━━━━━━━━━━━━━━━━━━━━━';
  return [
    `📰 *WhatsApp News Bot Started!*`,
    divider,
    `Monitoring *${sourceNames.length}* sources:`,
    '',
    ...sourceNames.map((n) => `   ✅ ${n}`),
    '',
    `🔄 Checking every *${intervalMin} minutes*`,
    `🤖 Gemini AI summarization: active`,
    divider,
    `_Articles will be delivered as soon as they're published._`
  ].join('\n');
}

// ── Telegram Formatter ────────────────────────────────────────────────────────

/**
 * Format an article for Telegram (HTML parse mode).
 * Escapes HTML special chars in user-provided text.
 * @param {object} article
 * @param {string} summary
 * @returns {string}
 */
function formatArticleForTelegram(article, summary) {
  const timeStr = formatDate(article.publishedAt);
  const divider = '━━━━━━━━━━━━━━━━━━━━━━━━━';

  // Convert bullet summary to plain text (remove • prefix for cleaner look)
  const telegramSummary = summary
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => `▪ ${l.replace(/^[•▪\-*]\s*/, '')}`)
    .join('\n');

  return [
    `${esc(article.category)}  |  <b>${esc(article.source)}</b>`,
    divider,
    `<b>${esc(article.title)}</b>`,
    '',
    telegramSummary,
    '',
    `🔗 <a href="${article.url}">Read full article</a>`,
    `⏰ <i>${esc(timeStr)}</i>`,
    divider
  ].join('\n');
}

/**
 * Startup message for Telegram (HTML).
 * @param {string[]} sourceNames
 * @param {number}   intervalMin
 */
function formatStartupMessageForTelegram(sourceNames, intervalMin) {
  const divider = '━━━━━━━━━━━━━━━━━━━━━━━━━';
  return [
    `📰 <b>News Bot Started!</b>`,
    divider,
    `Monitoring <b>${sourceNames.length}</b> sources:`,
    '',
    ...sourceNames.map((n) => `   ✅ ${esc(n)}`),
    '',
    `🔄 Checking every <b>${intervalMin} minutes</b>`,
    `🤖 Gemini AI summarization: active`,
    divider,
    `<i>Articles will be delivered as soon as they're published.</i>`
  ].join('\n');
}

// ── Shared Helpers ────────────────────────────────────────────────────────────

/** Escape HTML special characters for safe use in Telegram HTML mode */
function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Convert ISO / RFC date string to a human-readable local time */
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

module.exports = {
  formatArticle,
  formatStartupMessage,
  formatArticleForTelegram,
  formatStartupMessageForTelegram
};
