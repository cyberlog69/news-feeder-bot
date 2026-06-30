// index.js — Main entry point  v3.0
// Boots WhatsApp, Telegram, and/or Discord based on .env configuration,
// then runs the news pipeline on a schedule.
//
// New in v3:
//   - Multi-target: WHATSAPP_TARGET and TELEGRAM_TARGET accept comma-separated values
//   - Discord: DISCORD_WEBHOOK_URL enables Discord delivery
//   - Daily digest: cron job at config.digest.sendAt bundles articles into one message
//   - Health check ping: daily "I'm alive" message at config.settings.healthCheckHour
//   - Web dashboard: local browser UI at http://localhost:PORT
//   - Graceful shutdown: flushes deduplicator to disk before exit

require('dotenv').config({ quiet: true }); // quiet:true suppresses dotenv v17 runtime log

const path            = require('path');
const fs              = require('fs');
const cron            = require('node-cron');
const WhatsAppSender  = require('./src/sender');
const TelegramSender  = require('./src/telegram-sender');
const DiscordSender   = require('./src/discord-sender');
const NewsPipeline    = require('./src/pipeline');
const { initSummarizer } = require('./src/summarizer');
const {
  formatStartupMessage,
  formatStartupMessageForTelegram,
  formatHealthCheck,
  formatHealthCheckForTelegram,
  formatDigest,
  formatDigestForTelegram
} = require('./src/formatter');
const { startDashboard } = require('./src/web-dashboard');
const logger          = require('./src/logger');

const BOT_START_TIME = Date.now();

// ── Banner ────────────────────────────────────────────────────────────────────
console.log('\n');
console.log('╔══════════════════════════════════════════════════╗');
console.log('║   📰  News Feeder Bot  v3.0                      ║');
console.log('║   Cybersecurity & Tech News — Multi-Platform     ║');
console.log('╚══════════════════════════════════════════════════╝\n');

// ── Environment ───────────────────────────────────────────────────────────────
const WA_TARGETS_RAW  = process.env.WHATSAPP_TARGET  || '';
const TG_TOKEN        = process.env.TELEGRAM_BOT_TOKEN;
const TG_TARGETS_RAW  = process.env.TELEGRAM_TARGET  || '';
const SUMMARIZER      = (process.env.SUMMARIZER_PROVIDER || 'groq').toLowerCase();
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK_URL;
const DISCORD_NAME    = process.env.DISCORD_USERNAME  || '📰 News Feeder Bot';
const DISCORD_AVATAR  = process.env.DISCORD_AVATAR_URL || null;

// Parse comma-separated multi-targets
const WA_TARGETS = WA_TARGETS_RAW.split(',').map((t) => t.trim()).filter(Boolean);
const TG_TARGETS = TG_TARGETS_RAW.split(',').map((t) => t.trim()).filter(Boolean);

// Must have at least one platform
if (WA_TARGETS.length === 0 && !TG_TOKEN && !DISCORD_WEBHOOK) {
  console.error(
    '❌  No platform configured! Set at least one in your .env:\n\n' +
    '   WhatsApp:  WHATSAPP_TARGET=919876543210\n' +
    '              WHATSAPP_TARGET=groupId@g.us,anotherGroupId@g.us  (multi)\n' +
    '   Telegram:  TELEGRAM_BOT_TOKEN=123:ABC...  +  TELEGRAM_TARGET=@mychannel\n' +
    '   Discord:   DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...\n\n' +
    '   Copy .env.example → .env to get started.\n'
  );
  process.exit(1);
}

// ── Config ────────────────────────────────────────────────────────────────────
const configPath = path.join(__dirname, 'config.json');
if (!fs.existsSync(configPath)) {
  console.error('❌  config.json not found!');
  process.exit(1);
}
let config, enabledSources;
try {
  config         = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  enabledSources = config.sources.filter((s) => s.enabled);
} catch (err) {
  console.error(`❌  Failed to parse config.json: ${err.message}`);
  process.exit(1);
}

logger.info(`Loaded ${enabledSources.length} enabled news sources`);
enabledSources.forEach((s) => logger.info(`  • ${s.name}  (${s.rss})`));

// ── AI Summarizer ─────────────────────────────────────────────────────────────
initSummarizer();

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const senders = [];

  // ── WhatsApp (multi-target) ───────────────────────────────────────────────
  if (WA_TARGETS.length > 0) {
    for (const target of WA_TARGETS) {
      logger.info(`Initializing WhatsApp → ${target}`);
      try {
        const waSender = new WhatsAppSender(target);
        await waSender.initialize();
        await waSender.waitUntilReady();

        try {
          await waSender.sendMessage(
            formatStartupMessage(enabledSources.map((s) => s.name), config.settings.pollIntervalMinutes)
          );
          logger.success(`WhatsApp startup notification sent → ${target}`);
        } catch (err) {
          logger.warn(`WhatsApp startup notification failed: ${err.message}`);
        }

        senders.push({ name: `WhatsApp(${target.slice(0, 20)})`, sender: waSender, type: 'whatsapp' });
      } catch (err) {
        logger.error(`WhatsApp init failed for "${target}": ${err.message.split('\n')[0]}`);
      }
    }
  } else {
    logger.info('WhatsApp: not configured — skipping');
  }

  // ── Telegram (multi-target) ───────────────────────────────────────────────
  if (TG_TOKEN && TG_TARGETS.length > 0) {
    for (const target of TG_TARGETS) {
      logger.info(`Initializing Telegram → ${target}`);
      try {
        const tgSender = new TelegramSender(TG_TOKEN, target);
        await tgSender.initialize();

        try {
          await tgSender.sendMessage(
            formatStartupMessageForTelegram(enabledSources.map((s) => s.name), config.settings.pollIntervalMinutes)
          );
          logger.success(`Telegram startup notification sent → ${target}`);
        } catch (err) {
          logger.warn(`Telegram startup notification failed: ${err.message}`);
        }

        senders.push({ name: `Telegram(${target})`, sender: tgSender, type: 'telegram' });
      } catch (err) {
        logger.error(`Telegram init failed for "${target}": ${err.message.split('\n')[0]}`);
      }
    }
  } else if (TG_TOKEN && TG_TARGETS.length === 0) {
    logger.warn('TELEGRAM_BOT_TOKEN is set but TELEGRAM_TARGET is missing — Telegram skipped');
    logger.warn('Run: npm run list-telegram-chats to find your chat ID');
  } else {
    logger.info('Telegram: not configured — skipping');
  }

  // ── Discord (optional) ────────────────────────────────────────────────────
  if (DISCORD_WEBHOOK) {
    logger.info('Initializing Discord webhook...');
    try {
      const discordSender = new DiscordSender(DISCORD_WEBHOOK, DISCORD_NAME, DISCORD_AVATAR);
      await discordSender.initialize();
      senders.push({ name: 'Discord', sender: discordSender, type: 'discord' });
    } catch (err) {
      logger.error(`Discord init failed: ${err.message.split('\n')[0]}`);
    }
  } else {
    logger.info('Discord: not configured (DISCORD_WEBHOOK_URL not set) — skipping');
  }

  if (senders.length === 0) {
    logger.error('No platforms initialized — exiting.');
    process.exit(1);
  }

  // ── Pipeline ──────────────────────────────────────────────────────────────
  const pipeline = new NewsPipeline(config, senders, configPath);

  // ── Web Dashboard ─────────────────────────────────────────────────────────
  const dashPort = parseInt(config.settings?.dashboardPort, 10) || 3000;
  startDashboard(pipeline, dashPort, BOT_START_TIME);

  // ── Initial run ───────────────────────────────────────────────────────────
  logger.info('Running initial pipeline pass...');
  await pipeline.run();

  // ── Recurring pipeline cron ───────────────────────────────────────────────
  const interval = config.settings.pollIntervalMinutes || 5;
  cron.schedule(`*/${interval} * * * *`, async () => {
    await pipeline.run().catch((err) => {
      logger.error(`Unhandled pipeline error: ${err.message}`);
    });
  });

  // ── Daily digest cron ─────────────────────────────────────────────────────
  const digest = config.digest || {};
  if (digest.enabled && digest.sendAt) {
    const [hourStr, minStr] = String(digest.sendAt).split(':');
    const hour = parseInt(hourStr, 10);
    const min  = parseInt(minStr,  10);
    if (!isNaN(hour) && !isNaN(min)) {
      cron.schedule(`${min} ${hour} * * *`, async () => {
        logger.info('Sending daily digest...');
        await pipeline.sendDigest(formatDigest, formatDigestForTelegram).catch((err) => {
          logger.error(`Digest error: ${err.message}`);
        });
      });
      logger.info(`Daily digest scheduled at ${digest.sendAt}`);
    }
  }

  // ── Health check cron (daily at configured hour) ──────────────────────────
  const healthHour = parseInt(config.settings?.healthCheckHour, 10);
  if (!isNaN(healthHour) && healthHour >= 0 && healthHour <= 23) {
    cron.schedule(`0 ${healthHour} * * *`, async () => {
      logger.info('Sending daily health check...');
      const stats = pipeline.getStats();
      for (const { name, sender, type } of senders) {
        try {
          const msg = type === 'telegram'
            ? formatHealthCheckForTelegram(stats)
            : formatHealthCheck(stats);
          await sender.sendMessage(msg);
          logger.success(`[${name}] Health check sent`);
        } catch (err) {
          logger.warn(`[${name}] Health check failed: ${err.message.split('\n')[0]}`);
        }
      }
    });
    logger.info(`Daily health check scheduled at ${healthHour}:00`);
  }

  logger.success(
    `Bot is live! Broadcasting to: ${senders.map((s) => s.name).join(' + ')}` +
    `  |  Dashboard: http://localhost:${dashPort}  |  Press Ctrl+C to stop.\n`
  );
}

// ── Graceful shutdown ─────────────────────────────────────────────────────────
function shutdown() {
  logger.warn('Shutting down gracefully...');
  // pipeline is not accessible here; deduplicator debounce will flush naturally.
  // For immediate safety, we set a small timeout before exit.
  setTimeout(() => process.exit(0), 1000);
}

process.on('SIGINT',  shutdown);
process.on('SIGTERM', shutdown);
process.on('uncaughtException',  (err) => logger.error(`Uncaught: ${err.message.split('\n')[0]}`));
process.on('unhandledRejection', (r)   => logger.error(`Unhandled rejection: ${r?.message || String(r).split('\n')[0]}`));

// ── Start ─────────────────────────────────────────────────────────────────────
main().catch((err) => {
  logger.error(`Fatal startup error: ${err.message}`);
  console.error(err);
  process.exit(1);
});
