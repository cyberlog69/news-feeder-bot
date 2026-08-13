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
  const emailTo = (process.env.EMAIL_TO || '').trim();
  const ntfyTopic = (process.env.NTFY_TOPIC_URL || '').trim();
  const pushoverUser = (process.env.PUSHOVER_USER_KEY || '').trim();
  const outboundWebhook = (process.env.OUTBOUND_WEBHOOK_URL || '').trim();

  // 1. Check delivery platforms
  const hasPlatform = Boolean(
    waTarget || tgToken || discordWebhook || slackWebhook ||
    teamsWebhook || googleChatWebhook || emailTo ||
    ntfyTopic || pushoverUser || outboundWebhook
  );

  if (!hasPlatform) {
    logger.info('[Env] No messaging channels configured — running in Web Dashboard & Public Feeds mode.');
  }

  // 2. Validate Webhook URLs if provided
  [
    { name: 'DISCORD_WEBHOOK_URL', url: discordWebhook },
    { name: 'SLACK_WEBHOOK_URL', url: slackWebhook },
    { name: 'TEAMS_WEBHOOK_URL', url: teamsWebhook },
    { name: 'GOOGLE_CHAT_WEBHOOK_URL', url: googleChatWebhook },
    { name: 'OUTBOUND_WEBHOOK_URL', url: outboundWebhook }
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

  // 4. Multi-Language configuration logging
  const defaultLang = (process.env.DEFAULT_LANGUAGE || 'en').toLowerCase().trim();
  const configuredLangs = [];
  if (process.env.WHATSAPP_LANGUAGE)    configuredLangs.push(`WhatsApp:${process.env.WHATSAPP_LANGUAGE}`);
  if (process.env.TELEGRAM_LANGUAGE)    configuredLangs.push(`Telegram:${process.env.TELEGRAM_LANGUAGE}`);
  if (process.env.DISCORD_LANGUAGE)     configuredLangs.push(`Discord:${process.env.DISCORD_LANGUAGE}`);
  if (process.env.SLACK_LANGUAGE)       configuredLangs.push(`Slack:${process.env.SLACK_LANGUAGE}`);
  if (process.env.GOOGLE_CHAT_LANGUAGE) configuredLangs.push(`GoogleChat:${process.env.GOOGLE_CHAT_LANGUAGE}`);
  if (process.env.TEAMS_LANGUAGE)       configuredLangs.push(`Teams:${process.env.TEAMS_LANGUAGE}`);

  if (configuredLangs.length > 0) {
    logger.info(`Multi-Language Routing: default=${defaultLang} | ${configuredLangs.join(', ')}`);
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
