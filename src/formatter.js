// src/formatter.js
// Formats news articles for WhatsApp and Telegram.
//
// New in v3:
//   - AI vs fallback label: articles show _(AI summary)_ or _(auto-extracted)_
//   - Severity badge: articles matching critical keywords get 🚨 CRITICAL ALERT header
//   - Digest formatting: bundle multiple articles into one message
//
// Security hardening (unchanged):
//   - All external text is escaped before insertion
//   - Article URLs validated to http/https only (XSS prevention)
//   - WhatsApp markdown chars escaped to prevent format injection

// ── Shared Security Helpers ───────────────────────────────────────────────────

/** Escape HTML special chars for Telegram HTML parse mode. */
function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Escape WhatsApp markdown special characters to prevent format injection. */
function escWA(str) {
  return String(str || '').replace(/[*_~`]/g, (c) => `\\${c}`);
}

/** Return a safe URL (http/https only — blocks javascript:, file:, data:). */
function safeUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return url;
    return '#';
  } catch {
    return '#';
  }
}

// ── Severity Detection ────────────────────────────────────────────────────────

/**
 * Check if an article title matches any severity keywords.
 * Used to add the 🚨 CRITICAL ALERT badge.
 *
 * @param {string}   title
 * @param {string[]} severityKeywords  — from config.severity.keywords
 * @returns {boolean}
 */
function isCritical(title, severityKeywords = []) {
  if (!severityKeywords || severityKeywords.length === 0) return false;
  const lc = title.toLowerCase();
  return severityKeywords.some((kw) => lc.includes(kw.toLowerCase()));
}

// ── WhatsApp Formatter ────────────────────────────────────────────────────────

/**
 * Format an article for WhatsApp.
 *
 * @param {object}   article
 * @param {string}   summary
 * @param {boolean}  aiUsed            — true if Gemini was used, false if fallback
 * @param {string[]} [severityKeywords] — from config.severity.keywords
 */
function formatArticle(article, summary, aiUsed = true, severityKeywords = []) {
  const timeStr  = formatDate(article.publishedAt);
  const divider  = '━━━━━━━━━━━━━━━━━━━━━━━━━';
  const critical = isCritical(article.title, severityKeywords);

  const title    = escWA(article.title);
  const source   = escWA(article.source);
  const category = escWA(article.category);
  const url      = safeUrl(article.url);
  const aiLabel  = aiUsed ? '_🤖 AI summary_' : '_📄 auto-extracted_';

  const lines = [];

  // Critical alert banner
  if (critical) {
    lines.push(`🚨 *CRITICAL ALERT* 🚨`);
  }

  lines.push(
    `${category}  |  *${source}*`,
    divider,
    `*${title}*`,
    '',
    summary,
    '',
    `🔗 ${url}`,
    `⏰ _${timeStr}_  ${aiLabel}`,
    divider
  );

  return lines.join('\n');
}

/**
 * Format a startup message for WhatsApp.
 */
function formatStartupMessage(sourceNames, intervalMin) {
  const divider = '━━━━━━━━━━━━━━━━━━━━━━━━━';
  return [
    `📰 *News Bot Started!*`,
    divider,
    `Monitoring *${sourceNames.length}* sources:`,
    '',
    ...sourceNames.map((n) => `   ✅ ${escWA(n)}`),
    '',
    `🔄 Checking every *${intervalMin} minutes*`,
    `🤖 Gemini AI summarization: active`,
    `📝 Logs saved to: data/logs/`,
    divider,
    `_Articles will be delivered as soon as they're published._`
  ].join('\n');
}

/**
 * Format a daily health check message for WhatsApp.
 */
function formatHealthCheck(stats) {
  const divider = '━━━━━━━━━━━━━━━━━━━━━━━━━';
  return [
    `💚 *News Bot — Daily Health Check*`,
    divider,
    `✅ Bot is alive and running`,
    `📊 Total articles sent: *${stats.totalSent}*`,
    `📅 Time: _${formatDate(new Date().toISOString())}_`,
    divider
  ].join('\n');
}

/**
 * Format a daily digest (multiple articles bundled into one message) for WhatsApp.
 */
function formatDigest(articles, summaries, date) {
  const divider = '━━━━━━━━━━━━━━━━━━━━━━━━━';
  const dateStr = date || new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  const lines = [
    `📰 *Daily Cybersecurity Digest*`,
    `📅 _${dateStr}_`,
    divider,
    ''
  ];

  articles.forEach((article, i) => {
    const title = escWA(article.title);
    const url   = safeUrl(article.url);
    const sum   = summaries[i] || '';
    lines.push(`*${i + 1}. ${title}*`);
    lines.push(sum);
    lines.push(`🔗 ${url}`);
    lines.push('');
  });

  lines.push(divider);
  lines.push(`_${articles.length} articles — ${formatDate(new Date().toISOString())}_`);
  return lines.join('\n');
}

// ── Telegram Formatter (HTML mode) ───────────────────────────────────────────

/**
 * Format an article for Telegram (HTML parse mode).
 *
 * @param {object}   article
 * @param {string}   summary
 * @param {boolean}  aiUsed
 * @param {string[]} [severityKeywords]
 */
function formatArticleForTelegram(article, summary, aiUsed = true, severityKeywords = []) {
  const timeStr  = formatDate(article.publishedAt);
  const divider  = '━━━━━━━━━━━━━━━━━━━━━━━━━';
  const critical = isCritical(article.title, severityKeywords);

  const title    = esc(article.title);
  const source   = esc(article.source);
  const category = esc(article.category);
  const url      = safeUrl(article.url);
  const aiLabel  = aiUsed ? '🤖 <i>AI summary</i>' : '📄 <i>auto-extracted</i>';

  const telegramSummary = summary
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => `▪ ${esc(l.replace(/^[•▪\-*]\s*/, ''))}`)
    .join('\n');

  const lines = [];

  if (critical) {
    lines.push(`🚨 <b>CRITICAL ALERT</b> 🚨`);
  }

  lines.push(
    `${esc(category)}  |  <b>${source}</b>`,
    divider,
    `<b>${title}</b>`,
    '',
    telegramSummary,
    '',
    `🔗 <a href="${esc(url)}">Read full article</a>`,
    `⏰ <i>${esc(timeStr)}</i>  ${aiLabel}`,
    divider
  );

  return lines.join('\n');
}

/**
 * Startup message for Telegram (HTML).
 */
function formatStartupMessageForTelegram(sourceNames, intervalMin) {
  const divider = '━━━━━━━━━━━━━━━━━━━━━━━━━';
  return [
    `📰 <b>News Bot Started!</b>`,
    divider,
    `Monitoring <b>${esc(String(sourceNames.length))}</b> sources:`,
    '',
    ...sourceNames.map((n) => `   ✅ ${esc(n)}`),
    '',
    `🔄 Checking every <b>${esc(String(intervalMin))}</b> minutes`,
    `🤖 Gemini AI summarization: active`,
    `📝 Logs saved to: data/logs/`,
    divider,
    `<i>Articles will be delivered as soon as they're published.</i>`
  ].join('\n');
}

/**
 * Daily health check message for Telegram.
 */
function formatHealthCheckForTelegram(stats) {
  const divider = '━━━━━━━━━━━━━━━━━━━━━━━━━';
  return [
    `💚 <b>News Bot — Daily Health Check</b>`,
    divider,
    `✅ Bot is alive and running`,
    `📊 Total articles sent: <b>${stats.totalSent}</b>`,
    `📅 Time: <i>${esc(formatDate(new Date().toISOString()))}</i>`,
    divider
  ].join('\n');
}

/**
 * Daily digest for Telegram (HTML).
 */
function formatDigestForTelegram(articles, summaries, date) {
  const divider = '━━━━━━━━━━━━━━━━━━━━━━━━━';
  const dateStr = date || new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  const lines = [
    `📰 <b>Daily Cybersecurity Digest</b>`,
    `📅 <i>${esc(dateStr)}</i>`,
    divider,
    ''
  ];

  articles.forEach((article, i) => {
    const title = esc(article.title);
    const url   = safeUrl(article.url);
    const sum   = summaries[i] || '';
    const telegramSummary = sum
      .split('\n')
      .filter((l) => l.trim())
      .map((l) => `▪ ${esc(l.replace(/^[•▪\-*]\s*/, ''))}`)
      .join('\n');

    lines.push(`<b>${i + 1}. ${title}</b>`);
    lines.push(telegramSummary);
    lines.push(`🔗 <a href="${esc(url)}">Read more</a>`);
    lines.push('');
  });

  lines.push(divider);
  lines.push(`<i>${articles.length} articles — ${esc(formatDate(new Date().toISOString()))}</i>`);
  return lines.join('\n');
}

// ── Shared Helpers ────────────────────────────────────────────────────────────

function formatDate(dateStr) {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Unknown date';
    return d.toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    });
  } catch {
    return 'Unknown date';
  }
}

module.exports = {
  formatArticle,
  formatStartupMessage,
  formatHealthCheck,
  formatDigest,
  formatArticleForTelegram,
  formatStartupMessageForTelegram,
  formatHealthCheckForTelegram,
  formatDigestForTelegram,
  isCritical
};
