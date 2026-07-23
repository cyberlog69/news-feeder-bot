// src/env-validator.js
// Startup environment variable schema validator.
// Validates targets, webhook URLs, and summarizer provider configurations.

const logger = require('./logger');

const ALLOWED_PROVIDERS = ['groq', 'gemini', 'openrouter', 'huggingface', 'ollama', 'extractive'];

function validateEnv() {
  const issues = [];
  const warnings = [];

  const waTarget = (process.env.WHATSAPP_TARGET || '').trim();
  const tgToken = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
  const discordWebhook = (process.env.DISCORD_WEBHOOK_URL || '').trim();
  const slackWebhook = (process.env.SLACK_WEBHOOK_URL || '').trim();
  const teamsWebhook = (process.env.TEAMS_WEBHOOK_URL || '').trim();
  const googleChatWebhook = (process.env.GOOGLE_CHAT_WEBHOOK_URL || '').trim();

  // 1. Must have at least one delivery platform
  if (!waTarget && !tgToken && !discordWebhook && !slackWebhook && !teamsWebhook && !googleChatWebhook) {
    issues.push('No delivery platform configured! Set WHATSAPP_TARGET, TELEGRAM_BOT_TOKEN, DISCORD_WEBHOOK_URL, SLACK_WEBHOOK_URL, TEAMS_WEBHOOK_URL, or GOOGLE_CHAT_WEBHOOK_URL.');
  }

  // 2. Validate Webhook URLs if provided
  [
    { name: 'DISCORD_WEBHOOK_URL', url: discordWebhook },
    { name: 'SLACK_WEBHOOK_URL', url: slackWebhook },
    { name: 'TEAMS_WEBHOOK_URL', url: teamsWebhook },
    { name: 'GOOGLE_CHAT_WEBHOOK_URL', url: googleChatWebhook }
  ].forEach(({ name, url }) => {
    if (url) {
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          issues.push(`${name} must be a valid HTTP or HTTPS URL.`);
        }
      } catch {
        issues.push(`${name} is not a valid URL: "${url}"`);
      }
    }
  });

  // 3. Summarizer provider validation
  const provider = (process.env.SUMMARIZER_PROVIDER || 'groq').toLowerCase().trim();
  if (!ALLOWED_PROVIDERS.includes(provider)) {
    warnings.push(`Unknown SUMMARIZER_PROVIDER "${provider}". Allowed options: ${ALLOWED_PROVIDERS.join(', ')}`);
  }

  if (warnings.length > 0) {
    warnings.forEach((w) => logger.warn(`[Env] ${w}`));
  }

  if (issues.length > 0) {
    issues.forEach((i) => logger.error(`[Env] ${i}`));
    return { valid: false, issues };
  }

  logger.success('Environment configuration validated');
  return { valid: true, issues: [] };
}

module.exports = { validateEnv };
