// index.js — Main entry point v3.14.0
// Boots multi-platform news delivery (WhatsApp, Telegram, Discord, Slack, Teams, Google Chat, Email, Push, Webhooks)
// and starts the SOC Web Dashboard + REST APIs on port 3000 immediately.

require('dotenv').config({ quiet: true });

const path            = require('path');
const fs              = require('fs');
const cron            = require('node-cron');
const WhatsAppSender   = require('./src/sender');
const TelegramSender   = require('./src/telegram-sender');
const DiscordSender    = require('./src/discord-sender');
const SlackSender      = require('./src/slack-sender');
const TeamsSender      = require('./src/teams-sender');
const GoogleChatSender = require('./src/google-chat-sender');
const EmailSender      = require('./src/email-sender');
const PushSender       = require('./src/push-sender');
const WebhookSender    = require('./src/webhook-sender');
const NewsPipeline     = require('./src/pipeline');
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
const { validateEnv }    = require('./src/env-validator');
const { syncThreatData, runRansomwareTracking } = require('./src/threat-ops');
const logger             = require('./src/logger');

const BOT_START_TIME = Date.now();

// ── Banner ────────────────────────────────────────────────────────────────────
console.log('\n');
console.log('╔══════════════════════════════════════════════════╗');
console.log('║   📰  News Feeder Bot  v3.14.0                   ║');
console.log('║   Autonomous Threat Intelligence Platform        ║');
console.log('╚══════════════════════════════════════════════════╝\n');

// ── Environment ───────────────────────────────────────────────────────────────
validateEnv();

// ── Config ────────────────────────────────────────────────────────────────────
const configPath = path.join(__dirname, 'config.json');
if (!fs.existsSync(configPath)) {
  console.error('❌  config.json not found!');
  process.exit(1);
}
let config, enabledSources;
try {
  config         = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  enabledSources = (config.sources || []).filter((s) => s.enabled);
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

  // ── 1. Pipeline & Early Dashboard Startup ──────────────────────────────────
  // Starts web dashboard & health check on port 3000 immediately so container/cloud healthchecks succeed instantly
  const pipeline = new NewsPipeline(config, senders, configPath);
  const dashPort = parseInt(process.env.PORT || config.settings?.dashboardPort, 10) || 3000;
  startDashboard(pipeline, dashPort, BOT_START_TIME, () => pipeline.run());

  // ── 2. Telegram (multi-target) ────────────────────────────────────────────
  const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const TG_TARGETS_RAW = process.env.TELEGRAM_TARGET || '';
  const TG_TARGETS = TG_TARGETS_RAW.split(',').map((t) => t.trim()).filter(Boolean);

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
  }

  // ── 3. Discord ────────────────────────────────────────────────────────────
  const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK_URL;
  if (DISCORD_WEBHOOK) {
    try {
      const discordSender = new DiscordSender({
        webhookUrl: DISCORD_WEBHOOK,
        username: process.env.DISCORD_USERNAME || '📰 News Feeder Bot',
        avatarUrl: process.env.DISCORD_AVATAR_URL || null
      });
      await discordSender.initialize();
      senders.push({ name: 'Discord', sender: discordSender, type: 'discord' });
    } catch (err) {
      logger.error(`Discord init failed: ${err.message.split('\n')[0]}`);
    }
  }

  // ── 4. Slack ──────────────────────────────────────────────────────────────
  const SLACK_WEBHOOK = process.env.SLACK_WEBHOOK_URL;
  if (SLACK_WEBHOOK) {
    try {
      const slackSender = new SlackSender(SLACK_WEBHOOK);
      await slackSender.initialize();
      senders.push({ name: 'Slack', sender: slackSender, type: 'slack' });
    } catch (err) {
      logger.error(`Slack init failed: ${err.message.split('\n')[0]}`);
    }
  }

  // ── 5. Microsoft Teams ────────────────────────────────────────────────────
  const TEAMS_WEBHOOK = process.env.TEAMS_WEBHOOK_URL;
  if (TEAMS_WEBHOOK) {
    try {
      const teamsSender = new TeamsSender(TEAMS_WEBHOOK);
      await teamsSender.initialize();
      senders.push({ name: 'MS Teams', sender: teamsSender, type: 'teams' });
    } catch (err) {
      logger.error(`Teams init failed: ${err.message.split('\n')[0]}`);
    }
  }

  // ── 6. Google Chat Space ──────────────────────────────────────────────────
  const GOOGLE_CHAT_WEBHOOK = process.env.GOOGLE_CHAT_WEBHOOK_URL;
  if (GOOGLE_CHAT_WEBHOOK) {
    try {
      const googleChatSender = new GoogleChatSender(GOOGLE_CHAT_WEBHOOK);
      await googleChatSender.initialize();
      senders.push({ name: 'Google Chat', sender: googleChatSender, type: 'google-chat' });
    } catch (err) {
      logger.error(`Google Chat init failed: ${err.message.split('\n')[0]}`);
    }
  }

  // ── 7. Email Newsletter ───────────────────────────────────────────────────
  if (process.env.EMAIL_TO) {
    try {
      const emailSender = new EmailSender();
      await emailSender.initialize();
      senders.push({ name: 'Email', sender: emailSender, type: 'email' });
    } catch (err) {
      logger.error(`Email init failed: ${err.message.split('\n')[0]}`);
    }
  }

  // ── 8. Mobile Push (Ntfy / Pushover) ──────────────────────────────────────
  if (process.env.NTFY_TOPIC_URL || process.env.PUSHOVER_USER_KEY) {
    try {
      const pushSender = new PushSender();
      await pushSender.initialize();
      senders.push({ name: `Push(${pushSender.provider})`, sender: pushSender, type: 'push' });
    } catch (err) {
      logger.error(`Push init failed: ${err.message.split('\n')[0]}`);
    }
  }

  // ── 9. Outbound SOAR / SIEM Webhooks ──────────────────────────────────────
  if (process.env.OUTBOUND_WEBHOOK_URL) {
    try {
      const webhookSender = new WebhookSender();
      await webhookSender.initialize();
      senders.push({ name: 'Outbound Webhook', sender: webhookSender, type: 'webhook' });
    } catch (err) {
      logger.error(`Webhook init failed: ${err.message.split('\n')[0]}`);
    }
  }

  // ── 10. WhatsApp (multi-target) ───────────────────────────────────────────
  const WA_TARGETS_RAW = process.env.WHATSAPP_TARGET || '';
  const WA_TARGETS = WA_TARGETS_RAW.split(',').map((t) => t.trim()).filter(Boolean);

  if (WA_TARGETS.length > 0) {
    for (const target of WA_TARGETS) {
      logger.info(`Initializing WhatsApp → ${target}`);
      try {
        const waSender = new WhatsAppSender(target);
        await waSender.initialize();
        
        // Wait for ready asynchronously so other features and dashboard run immediately
        waSender.waitUntilReady().then(async () => {
          try {
            await waSender.sendMessage(
              formatStartupMessage(enabledSources.map((s) => s.name), config.settings.pollIntervalMinutes)
            );
            logger.success(`WhatsApp startup notification sent → ${target}`);
          } catch (err) {
            logger.warn(`WhatsApp startup notification failed: ${err.message}`);
          }
          senders.push({ name: `WhatsApp(${target.slice(0, 20)})`, sender: waSender, type: 'whatsapp' });
        }).catch((err) => {
          logger.warn(`WhatsApp auth error: ${err.message}`);
        });
      } catch (err) {
        logger.error(`WhatsApp init failed for "${target}": ${err.message.split('\n')[0]}`);
      }
    }
  }

  logger.success(
    `Bot is live! Active senders: ${senders.length > 0 ? senders.map((s) => s.name).join(' + ') : 'Web Dashboard & Public Feeds Only'}` +
    `  |  Dashboard: http://localhost:${dashPort}\n`
  );

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

  // ── Database maintenance cron (daily): backup + optimize + prune ─────────
  const maintenanceHour = parseInt(config.settings?.maintenanceHour, 10);
  if (!isNaN(maintenanceHour) && maintenanceHour >= 0 && maintenanceHour <= 23) {
    const { createDatabaseBackup, optimizeDatabase, pruneOldRecords, cleanupGeneratedMedia } = require('./src/db-maintenance');
    cron.schedule(`0 ${maintenanceHour} * * *`, async () => {
      logger.info('Running daily database maintenance...');
      pruneOldRecords(config.settings?.backupRetentionDays || 90);
      cleanupGeneratedMedia(30);
      const backupPath = createDatabaseBackup();
      const optimized = optimizeDatabase();
      logger.info(`Maintenance complete — backup: ${backupPath || 'none'}, optimization: ${JSON.stringify(optimized)}`);
    });
    logger.info(`Daily database maintenance scheduled at ${maintenanceHour}:00`);
  }

  // ── Threat Ops: CISA KEV sync + ransomware tracker (daily) ────────────────
  const threatOpsHour = parseInt(config.settings?.threatOpsHour, 10);
  const threatOpsEnabled = config.settings?.enableThreatOps !== false;
  if (threatOpsEnabled) {
    // Startup sync (fire-and-forget — never blocks boot)
    syncThreatData(false).catch((err) =>
      logger.warn(`Threat data startup sync failed: ${err.message.split('\n')[0]}`)
    );

    // First ransomware sweep shortly after boot (gives senders time to init)
    setTimeout(async () => {
      await runRansomwareTracking(senders).catch((err) =>
        logger.warn(`Startup ransomware sweep failed: ${err.message.split('\n')[0]}`)
      );
    }, 90 * 1000);

    if (!isNaN(threatOpsHour) && threatOpsHour >= 0 && threatOpsHour <= 23) {
      cron.schedule(`0 ${threatOpsHour} * * *`, async () => {
        logger.info('Running daily threat operations (KEV + ransomware)...');
        await syncThreatData(false).catch((err) =>
          logger.warn(`Threat data sync failed: ${err.message.split('\n')[0]}`)
        );
        await runRansomwareTracking(senders).catch((err) =>
          logger.warn(`Ransomware tracking failed: ${err.message.split('\n')[0]}`)
        );
      });
      logger.info(`Daily threat ops scheduled at ${threatOpsHour}:00`);
    }
  }
}

// ── Graceful shutdown ─────────────────────────────────────────────────────────
function shutdown() {
  logger.warn('Shutting down gracefully...');
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
