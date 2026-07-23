// src/command-handler.js
// Interactive command handler for incoming bot messages.
// Supported commands: /status, /search <keyword>, /sources, /help

const { searchSeenArticles, getTotalSeenCount } = require('./db');

/**
 * Handle incoming command text.
 * @param {string} text - Raw command string (e.g. "/search ransomware")
 * @param {object} config - Application configuration object
 * @param {number} startTime - Bot boot timestamp
 * @returns {string} - Formatted response string
 */
function handleCommand(text, config, startTime) {
  const trimmed = String(text || '').trim();
  if (!trimmed.startsWith('/')) return null;

  const parts = trimmed.split(/\s+/);
  const command = parts[0].toLowerCase();
  const args = parts.slice(1).join(' ');

  switch (command) {
    case '/status': {
      const uptimeSec = Math.floor((Date.now() - startTime) / 1000);
      const uptimeStr = uptimeSec < 60 ? `${uptimeSec}s`
        : uptimeSec < 3600 ? `${Math.floor(uptimeSec / 60)}m ${uptimeSec % 60}s`
        : `${Math.floor(uptimeSec / 3600)}h ${Math.floor((uptimeSec % 3600) / 60)}m`;

      const totalSent = getTotalSeenCount();
      const sourcesCount = (config.sources || []).filter((s) => s.enabled).length;

      return [
        '📊 *News Feeder Bot Status*',
        '━━━━━━━━━━━━━━━━━━━━━━━━━',
        `✅ Status: Active & Operational`,
        `⏱ Uptime: ${uptimeStr}`,
        `📰 Total Sent: ${totalSent} articles`,
        `📡 Active Sources: ${sourcesCount}`,
        `🤖 AI Provider: ${process.env.SUMMARIZER_PROVIDER || 'gemini'}`,
        '━━━━━━━━━━━━━━━━━━━━━━━━━'
      ].join('\n');
    }

    case '/sources': {
      const sources = (config.sources || []).filter((s) => s.enabled);
      return [
        '📡 *Active News Sources*',
        '━━━━━━━━━━━━━━━━━━━━━━━━━',
        ...sources.map((s) => `• *${s.name}* (${s.category})`),
        '━━━━━━━━━━━━━━━━━━━━━━━━━'
      ].join('\n');
    }

    case '/search': {
      if (!args) return '⚠️ Usage: `/search <keyword>` (e.g. `/search ransomware`)';

      const results = searchSeenArticles(args, 5);
      if (results.length === 0) {
        return `🔍 No recent articles found matching: *${args}*`;
      }

      return [
        `🔍 *Search Results for "${args}"*`,
        '━━━━━━━━━━━━━━━━━━━━━━━━━',
        ...results.map((r, i) => `${i + 1}. *${r.title}*\n   _${r.source}_ • [Link](${r.url})\n`),
        '━━━━━━━━━━━━━━━━━━━━━━━━━'
      ].join('\n');
    }

    case '/help':
    default: {
      return [
        '🤖 *News Feeder Bot Commands*',
        '━━━━━━━━━━━━━━━━━━━━━━━━━',
        '• `/status` - View bot uptime and delivery statistics',
        '• `/sources` - List all active RSS news feeds',
        '• `/search <keyword>` - Search recent articles by topic',
        '• `/help` - Show this command reference',
        '━━━━━━━━━━━━━━━━━━━━━━━━━'
      ].join('\n');
    }
  }
}

module.exports = { handleCommand };
