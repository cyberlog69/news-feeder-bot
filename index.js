// index.js — Main entry point (version comes from package.json)
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
const { runDailyScan: runExposedIpScan } = require('./src/exposed-ip-scanner');
const { handleCommand }  = require('./src/command-handler');
const logger             = require('./src/logger');
const { mask }           = require('./src/redact');
const pkg                = require('./package.json');

const BOT_START_TIME = Date.now();

// ── Banner ────────────────────────────────────────────────────────────────────
console.log('\n');
console.log('╔══════════════════════════════════════════════════╗');
console.log(`║   📰  News Feeder Bot  v${pkg.version.padEnd(24)}║`);
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

// ── Scheduler helpers ─────────────────────────────────────────────────────────
const clampInt = (value, min, max, fallback) => {
  const n = parseInt(value, 10);
  if (isNaN(n)) return fallback;
  return Math.min(Math.max(n, min), max);
};

/** Re-read config.json for hot-reloadable schedule settings. */
function readLiveConfig(configPath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch {
    return fallback;
  }
}

/** Return { dateKey, hour, minute } in the requested IANA timezone. */
function getTimeParts(date, timeZone) {
  try {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    });
    const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
    return {
      dateKey: `${parts.year}-${parts.month}-${parts.day}`,
      hour: parseInt(parts.hour, 10),
      minute: parseInt(parts.minute, 10)
    };
  } catch {
    // Invalid timezone — fall back to the server clock.
    return {
      dateKey: date.toISOString().slice(0, 10),
      hour: date.getHours(),
      minute: date.getMinutes()
    };
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const senders = [];
  const telegramPollersStarted = new Set();

  // ── Interactive command dispatcher ────────────────────────────────────────
  // Only the configured target chat(s) are allowed to issue commands. When
  // COMMAND_ADMIN_USERS is set, cost/mutation-heavy commands require a match.
  const commandAdminIds = (process.env.COMMAND_ADMIN_USERS || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

  function isAdminUser(id) {
    if (commandAdminIds.length === 0) return true; // trusted target chat
    return commandAdminIds.includes(String(id || ''));
  }

  const dispatchCommand = async ({ text, targetId, userId, platform }) => {
    return handleCommand(text, pipeline.config || config, BOT_START_TIME, {
      targetId,
      userId,
      platform,
      isAdmin: isAdminUser(userId || targetId)
    });
  };

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
      logger.info(`Initializing Telegram → ${mask(target)}`);
      try {
        const tgSender = new TelegramSender(TG_TOKEN, target);
        await tgSender.initialize();
        try {
          await tgSender.sendMessage(
            formatStartupMessageForTelegram(enabledSources.map((s) => s.name), config.settings.pollIntervalMinutes)
          );
          logger.success(`Telegram startup notification sent → ${mask(target)}`);
        } catch (err) {
          logger.warn(`Telegram startup notification failed: ${err.message}`);
        }
        senders.push({ name: `Telegram(${mask(target)})`, sender: tgSender, type: 'telegram' });

        // One long-poll loop per bot token; it accepts commands from any of
        // the configured TELEGRAM_TARGET chats.
        if (!telegramPollersStarted.has(TG_TOKEN)) {
          telegramPollersStarted.add(TG_TOKEN);
          tgSender.startCommandPolling(dispatchCommand, { allowedChats: TG_TARGETS }).catch((err) => {
            logger.warn(`Telegram command polling failed: ${err.message.split('\n')[0]}`);
          });
        }
      } catch (err) {
        logger.error(`Telegram init failed for "${mask(target)}": ${err.message.split('\n')[0]}`);
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
      senders.push({ name: 'Outbound Webhook', sender: webhookSender, type: 'outbound-webhook' });
    } catch (err) {
      logger.error(`Webhook init failed: ${err.message.split('\n')[0]}`);
    }
  }

  // ── 10. WhatsApp (multi-target) ───────────────────────────────────────────
  const WA_TARGETS_RAW = process.env.WHATSAPP_TARGET || '';
  const WA_TARGETS = WA_TARGETS_RAW.split(',').map((t) => t.trim()).filter(Boolean);

  if (WA_TARGETS.length > 0) {
    for (const target of WA_TARGETS) {
      logger.info(`Initializing WhatsApp → ${mask(target)}`);
      try {
        const waSender = new WhatsAppSender(target);
        waSender.onCommand(dispatchCommand);
        await waSender.initialize();
        
        // Wait for ready asynchronously so other features and dashboard run immediately
        waSender.waitUntilReady().then(async () => {
          try {
            await waSender.sendMessage(
              formatStartupMessage(enabledSources.map((s) => s.name), config.settings.pollIntervalMinutes)
            );
            logger.success(`WhatsApp startup notification sent → ${mask(target)}`);
          } catch (err) {
            logger.warn(`WhatsApp startup notification failed: ${err.message}`);
          }
          senders.push({ name: `WhatsApp(${mask(target, 3)})`, sender: waSender, type: 'whatsapp' });
        }).catch((err) => {
          logger.warn(`WhatsApp auth error: ${err.message}`);
        });
      } catch (err) {
        logger.error(`WhatsApp init failed for "${mask(target)}": ${err.message.split('\n')[0]}`);
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

  // ── Heartbeat: pipeline polling + daily digest (both hot-reloadable) ─────
  // A one-minute tick is used instead of `*/N` crons so changing
  // pollIntervalMinutes / digest settings in config.json takes effect without
  // a restart, and so intervals above 59 minutes remain expressible.
  let lastPipelineRun = Date.now();
  let lastDigestDateKey = null;

  cron.schedule('* * * * *', async () => {
    const live = readLiveConfig(configPath, config);

    const interval = clampInt(live.settings?.pollIntervalMinutes, 1, 1440, 5);
    if (Date.now() - lastPipelineRun >= interval * 60 * 1000) {
      lastPipelineRun = Date.now();
      await pipeline.run().catch((err) => {
        logger.error(`Unhandled pipeline error: ${err.message.split('\n')[0]}`);
      });
    }

    const digest = live.digest || {};
    if (!digest.enabled || !digest.sendAt) return;

    const [hourStr, minStr] = String(digest.sendAt).split(':');
    const hour = parseInt(hourStr, 10);
    const min  = parseInt(minStr,  10);
    if (isNaN(hour) || isNaN(min) || hour < 0 || hour > 23 || min < 0 || min > 59) return;

    const timeZone = digest.timezone || 'UTC';
    const now = getTimeParts(new Date(), timeZone);
    const nowMinutes = now.hour * 60 + now.minute;
    const targetMinutes = hour * 60 + min;
    // 10-minute grace window: survives a restart or a skipped heartbeat.
    if (nowMinutes >= targetMinutes && nowMinutes < targetMinutes + 10 && lastDigestDateKey !== now.dateKey) {
      lastDigestDateKey = now.dateKey;
      logger.info(`Sending daily digest for ${now.dateKey} (${timeZone})...`);
      await pipeline.sendDigest(formatDigest, formatDigestForTelegram).catch((err) => {
        logger.error(`Digest error: ${err.message.split('\n')[0]}`);
      });
    }
  });

  logger.info(
    `Scheduler heartbeat started — pipeline every ${clampInt(config.settings?.pollIntervalMinutes, 1, 1440, 5)} min, ` +
    `digest ${config.digest?.enabled ? `daily at ${config.digest.sendAt} (${config.digest.timezone || 'UTC'})` : 'disabled'}`
  );

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
      pruneOldRecords(config.settings?.recordRetentionDays || config.settings?.backupRetentionDays || 90);
      cleanupGeneratedMedia(30);
      const backupPath = createDatabaseBackup(clampInt(config.settings?.backupRetentionCount, 1, 90, 7));
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

  // ── Exposed IP Scanner: daily WAN / publicly exposed IP collection ────────────────
  const exposedIpEnabled = config.settings?.enableExposedIpScan !== false;
  if (exposedIpEnabled) {
    // Fire an initial scan 2 minutes after boot (non-blocking)
    setTimeout(() => {
      runExposedIpScan().catch((err) =>
        logger.warn(`[ExposedIP] Startup scan failed: ${err.message.split('\n')[0]}`)
      );
    }, 2 * 60 * 1000);

    // Daily cron — configurable via config.settings.exposedIpScanHour (default 3 AM)
    const exposedIpHour = parseInt(config.settings?.exposedIpScanHour, 10);
    const scanHour = (!isNaN(exposedIpHour) && exposedIpHour >= 0 && exposedIpHour <= 23)
      ? exposedIpHour : 3;
    cron.schedule(`0 ${scanHour} * * *`, async () => {
      logger.info('[ExposedIP] Running daily exposed-IP scan…');
      await runExposedIpScan().catch((err) =>
        logger.warn(`[ExposedIP] Daily scan failed: ${err.message.split('\n')[0]}`)
      );
    });
    logger.info(`[ExposedIP] Daily scan scheduled at ${scanHour}:00 — startup warm-up in 2 min`);
  }
}

// ── Graceful shutdown ─────────────────────────────────────────────────────────
function shutdown() {
  logger.warn('Shutting down gracefully...');
  setTimeout(() => process.exit(0), 1000);
}

process.on('SIGINT',  shutdown);
process.on('SIGTERM', shutdown);

// An unknown exception leaves the process in an undefined state. Log it and
// exit so the supervisor (Docker/PM2/systemd) can restart cleanly.
process.on('uncaughtException', (err) => {
  logger.error(`Uncaught exception: ${err?.message || String(err)}`);
  if (err?.stack) logger.error(err.stack.split('\n').slice(0, 5).join(' | '));
  process.exit(1);
});

process.on('unhandledRejection', (r) => {
  logger.error(`Unhandled rejection: ${r?.message || String(r).split('\n')[0]}`);
});

// ── Start ─────────────────────────────────────────────────────────────────────
main().catch((err) => {
  logger.error(`Fatal startup error: ${err.message}`);
  console.error(err);
  process.exit(1);
});
