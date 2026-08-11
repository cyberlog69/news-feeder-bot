// src/command-handler.js
// Interactive command handler for incoming bot messages.
// Supported commands: /status, /search <keyword>, /sources, /help

const { searchSeenArticles, getTotalSeenCount } = require('./db');
const { answerQuestion } = require('./rag-engine');
const { setSubscription, getUserSubscription, deleteUserSubscription } = require('./subscription-manager');

/**
 * Handle incoming command text.
 * @param {string} text - Raw command string (e.g. "/search ransomware" or "/subscribe cve, ransomware")
 * @param {object} config - Application configuration object
 * @param {number} startTime - Bot boot timestamp
 * @param {object} [senderInfo] - { targetId, platform }
 * @returns {Promise<string>} - Formatted response string
 */
async function handleCommand(text, config, startTime, senderInfo = {}) {
  const trimmed = String(text || '').trim();
  if (!trimmed.startsWith('/')) return null;

  const targetId = senderInfo.targetId || 'default';
  const platform = senderInfo.platform || 'general';

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

      // Security: cap keyword length and strip control/non-printable characters
      const keyword = args.replace(/[\x00-\x1F\x7F]/g, '').slice(0, 100).trim();
      if (!keyword) return '⚠️ Invalid search keyword.';

      const results = searchSeenArticles(keyword, 5);
      if (results.length === 0) {
        return `🔍 No recent articles found matching: *${keyword}*`;
      }

      return [
        `🔍 *Search Results for "${keyword}"*`,
        '━━━━━━━━━━━━━━━━━━━━━━━━━',
        ...results.map((r, i) => `${i + 1}. *${r.title}*\n   _${r.source}_ • [Link](${r.url})\n`),
        '━━━━━━━━━━━━━━━━━━━━━━━━━'
      ].join('\n');
    }

    case '/ask': {
      if (!args) return '⚠️ Usage: `/ask <question>` (e.g. `/ask What supply chain attacks occurred this week?`)';
      const question = args.replace(/[\x00-\x1F\x7F]/g, '').slice(0, 200).trim();
      return await answerQuestion(question);
    }

    case '/subscribe': {
      if (!args) {
        const current = getUserSubscription(targetId, platform);
        return `⚠️ Usage: \`/subscribe <topics>\` (e.g. \`/subscribe ransomware, cve, critical\` or \`/subscribe all\`)\n\nCurrent active topics: *${current.join(', ')}*`;
      }
      const cleanTopics = args.replace(/[\x00-\x1F\x7F]/g, '').slice(0, 200).trim();
      const updated = setSubscription(targetId, platform, cleanTopics);
      return [
        `✅ *Subscription Updated!*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `🎯 *Active Topics:* ${updated.join(', ')}`,
        `📡 You will only receive news matching these topics (or critical alerts).`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━`
      ].join('\n');
    }

    case '/unsubscribe': {
      deleteUserSubscription(targetId, platform);
      return `✅ *Unsubscribed successfully.* You will now receive all news updates by default.`;
    }

    case '/subscriptions':
    case '/mysubscriptions': {
      const current = getUserSubscription(targetId, platform);
      return [
        `📋 *Your Active Subscriptions*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `🎯 *Configured Topics:* ${current.join(', ')}`,
        `💡 Use \`/subscribe <topics>\` to update your preferences or \`/unsubscribe\` to reset.`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━`
      ].join('\n');
    }

    case '/briefing':
    case '/ciso-report': {
      const { generateCisoBriefing, formatBriefingMarkdown } = require('./report-generator');
      const briefing = generateCisoBriefing(10);
      return formatBriefingMarkdown(briefing);
    }

    case '/help':
    default: {
      return [
        '🤖 *News Feeder Bot Commands*',
        '━━━━━━━━━━━━━━━━━━━━━━━━━',
        '• `/status` - View bot uptime and delivery statistics',
        '• `/sources` - List all active RSS news feeds',
        '• `/search <keyword>` - Search recent articles by topic',
        '• `/ask <question>` - Ask AI conversational questions about your news',
        '• `/briefing` - Generate an Executive CISO Threat Intelligence Briefing',
        '• `/subscribe <topics>` - Subscribe to specific topics (e.g. ransomware, cve, critical)',
        '• `/unsubscribe` - Reset topic filters to receive all news',
        '• `/subscriptions` - View your active subscription topics',
        '• `/help` - Show this command reference',
        '━━━━━━━━━━━━━━━━━━━━━━━━━'
      ].join('\n');
    }
  }
}

module.exports = { handleCommand };
