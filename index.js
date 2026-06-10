// index.js — Main entry point
// Boots WhatsApp, then runs the news pipeline on a schedule.

require('dotenv').config();

const path         = require('path');
const fs           = require('fs');
const cron         = require('node-cron');
const WhatsAppSender = require('./src/sender');
const NewsPipeline   = require('./src/pipeline');
const { initGemini } = require('./src/summarizer');
const { formatStartupMessage } = require('./src/formatter');
const logger         = require('./src/logger');

// ── Banner ────────────────────────────────────────────────────────────────────
console.log('\n');
console.log('╔══════════════════════════════════════════════╗');
console.log('║   📰  WhatsApp News Bot  v1.0                ║');
console.log('║   Cybersecurity & Tech News, delivered live  ║');
console.log('╚══════════════════════════════════════════════╝\n');

// ── Validate environment ──────────────────────────────────────────────────────
const TARGET_NUMBER = process.env.WHATSAPP_TARGET_NUMBER;
const GEMINI_KEY    = process.env.GEMINI_API_KEY;

if (!TARGET_NUMBER) {
  console.error(
    '❌  WHATSAPP_TARGET_NUMBER is not set!\n' +
    '    1. Copy .env.example → .env\n' +
    '    2. Fill in your WhatsApp number (with country code, no + or spaces)\n' +
    '    3. Restart the bot.\n'
  );
  process.exit(1);
}

// ── Load config ───────────────────────────────────────────────────────────────
const configPath = path.join(__dirname, 'config.json');
if (!fs.existsSync(configPath)) {
  console.error('❌  config.json not found! Make sure it exists in the project root.');
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
const enabledSources = config.sources.filter((s) => s.enabled);

logger.info(`Loaded ${enabledSources.length} enabled news sources`);
enabledSources.forEach((s) => logger.info(`  • ${s.name}  (${s.rss})`));

// ── Initialize Gemini AI (optional) ──────────────────────────────────────────
initGemini(GEMINI_KEY || '');

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  // 1. Start WhatsApp
  const sender = new WhatsAppSender(TARGET_NUMBER);
  await sender.initialize();
  await sender.waitUntilReady();

  // 2. Send startup notification to the user's own number
  try {
    const startMsg = formatStartupMessage(
      enabledSources.map((s) => s.name),
      config.settings.pollIntervalMinutes
    );
    await sender.sendMessage(startMsg);
    logger.success('Startup notification sent to WhatsApp');
  } catch (err) {
    logger.warn(`Could not send startup notification: ${err.message}`);
  }

  // 3. Create pipeline
  const pipeline = new NewsPipeline(config, sender);

  // 4. Run immediately on startup (catch-up on missed articles)
  logger.info('Running initial pipeline pass...');
  await pipeline.run();

  // 5. Schedule subsequent runs using cron
  const interval = config.settings.pollIntervalMinutes || 5;
  logger.info(`Scheduling pipeline every ${interval} minutes`);

  cron.schedule(`*/${interval} * * * *`, async () => {
    await pipeline.run().catch((err) => {
      logger.error(`Unhandled pipeline error: ${err.message}`);
    });
  });

  logger.success('Bot is running! Press Ctrl+C to stop.\n');
}

// ── Graceful shutdown ─────────────────────────────────────────────────────────
process.on('SIGINT', () => {
  logger.warn('Shutting down gracefully...');
  process.exit(0);
});

process.on('uncaughtException', (err) => {
  logger.error(`Uncaught exception: ${err.message}`);
  // Don't crash — log and continue
});

process.on('unhandledRejection', (reason) => {
  logger.error(`Unhandled rejection: ${reason}`);
});

// ── Start ─────────────────────────────────────────────────────────────────────
main().catch((err) => {
  logger.error(`Fatal startup error: ${err.message}`);
  console.error(err);
  process.exit(1);
});
