// list-telegram-chats.js
// Helper script — shows recent chats/groups/channels your Telegram bot has seen.
//
// HOW TO USE:
//   1. Create a bot via @BotFather and set TELEGRAM_BOT_TOKEN in .env
//   2. Send any message to your bot (or add it to a group/channel)
//   3. Run: npm run list-telegram-chats
//   4. Copy the chat ID and set it as TELEGRAM_TARGET in .env
//
// For channels: forward any channel message to @userinfobot to get the ID,
// OR make the bot an admin and send a message — it will appear here.

require('dotenv').config();
const TelegramSender = require('./src/telegram-sender');
const logger         = require('./src/logger');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function main() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  📋  Telegram Bot — List Recent Chats & Groups  ');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (!TOKEN) {
    console.error(
      '❌  TELEGRAM_BOT_TOKEN is not set!\n\n' +
      '   Steps to get a bot token:\n' +
      '   1. Open Telegram and search for @BotFather\n' +
      '   2. Send /newbot and follow the instructions\n' +
      '   3. Copy the token (looks like: 123456789:ABCDefgh...)\n' +
      '   4. Add it to your .env file:\n' +
      '      TELEGRAM_BOT_TOKEN=123456789:ABCDefgh...\n' +
      '   5. Run this script again.\n'
    );
    process.exit(1);
  }

  // Use a dummy target — we only need getRecentChats()
  const bot = new TelegramSender(TOKEN, '0');
  await bot.initialize();

  console.log('Fetching recent chats...\n');
  console.log('(If no chats appear, send any message to your bot first,');
  console.log(' or add it to a group/channel and send a message there.)\n');

  const chats = await bot.getRecentChats();

  if (chats.length === 0) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⚠️  No recent chats found.\n');
    console.log('To make chats appear here:');
    console.log('  Personal chat:  Open Telegram → search for your bot → send any message');
    console.log('  Group:          Add your bot to the group → send any message in the group');
    console.log('  Channel:        Add bot as Admin with "Post Messages" → send a channel message');
    console.log('\nThen run this script again.\n');
    process.exit(0);
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  CHATS YOUR BOT CAN SEE\n');

  const typeIcon = { private: '👤', group: '👥', supergroup: '👥', channel: '📢' };

  chats.forEach((chat, i) => {
    const icon = typeIcon[chat.type] || '💬';
    console.log(`  ${String(i + 1).padStart(2)}. ${icon} ${chat.name || '(unnamed)'}`);
    console.log(`      ID:       ${chat.id}`);
    console.log(`      Type:     ${chat.type}`);
    if (chat.username) console.log(`      Username: ${chat.username}`);
    console.log('');
  });

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n  ✅  HOW TO USE THE ID:\n');
  console.log('  Add to your .env file:');
  console.log('    TELEGRAM_TARGET=-1001234567890   ← use the numeric ID');
  console.log('    TELEGRAM_TARGET=@channelname     ← OR use @username for public channels\n');
  console.log('  Then run: npm start\n');

  process.exit(0);
}

main().catch((err) => {
  logger.error(`Error: ${err.message}`);
  process.exit(1);
});
