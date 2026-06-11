// list-groups.js
// Helper script — lists all WhatsApp groups the linked account is in.
//
// Run this AFTER scanning the QR code at least once (so a session exists).
//
// Usage:  node list-groups.js
//
// Copy the ID of your chosen group and set it as WHATSAPP_TARGET in .env

require('dotenv').config();
const WhatsAppSender = require('./src/sender');
const logger         = require('./src/logger');

async function main() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  📋  WhatsApp News Bot — List Groups/Chats  ');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('Starting WhatsApp client...');
  console.log('(Scan QR code if prompted — or session loads automatically)\n');

  // Use a dummy target just to boot the client
  const sender = new WhatsAppSender('list-mode');

  // Override _resolveTarget to skip resolution for this utility
  sender._resolveTarget = async () => 'list-mode@c.us';

  await sender.initialize();
  await sender.waitUntilReady();

  console.log('\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  YOUR WHATSAPP GROUPS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const groups = await sender.getGroups();

  if (groups.length === 0) {
    console.log('  ⚠️  No groups found.');
    console.log('  Make sure you have added your linked WhatsApp number to at least one group.');
  } else {
    groups.forEach((g, i) => {
      console.log(`  ${String(i + 1).padStart(2, ' ')}. 👥 ${g.name}`);
      console.log(`      ID: ${g.id}`);
      console.log(`      Members: ${g.participants}`);
      console.log('');
    });

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n  ✅  HOW TO USE:\n');
    console.log('  Option A — Set the group NAME in .env (case-insensitive):');
    console.log('    WHATSAPP_TARGET=My Cyber News Group\n');
    console.log('  Option B — Set the group ID in .env (most reliable):');
    console.log('    WHATSAPP_TARGET=120363XXXXXXXXXXXXXXXXXX@g.us\n');
    console.log('  Then run: npm start\n');
  }

  await sender.destroy();
  process.exit(0);
}

main().catch((err) => {
  logger.error(`Error: ${err.message}`);
  process.exit(1);
});
