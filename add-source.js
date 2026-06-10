// add-source.js
// Interactive CLI to add a new news source to config.json
// Run with: node add-source.js  OR  npm run add-source

const fs       = require('fs');
const path     = require('path');
const readline = require('readline');

const configPath = path.join(__dirname, 'config.json');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

// Common emoji suggestions
const EMOJI_SUGGESTIONS = [
  '🔐 Cybersecurity', '🕵️ Hacking', '💻 Tech', '📡 Infosec',
  '🌐 World News', '📊 Finance', '🤖 AI & ML', '🛡️ Security'
];

async function main() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  📰  Add a New News Source to WhatsApp Bot  ');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

  console.log('Current sources:');
  config.sources.forEach((s, i) => {
    console.log(`  ${i + 1}. ${s.enabled ? '✅' : '❌'} ${s.name}`);
  });
  console.log('');

  const name     = (await ask('Source Name       (e.g. The Hacker News): ')).trim();
  const url      = (await ask('Website URL       (e.g. https://thehackernews.com): ')).trim();
  const rss      = (await ask('RSS Feed URL      (e.g. https://feeds.feedburner.com/TheHackersNews): ')).trim();

  console.log('\nCategory suggestions:');
  EMOJI_SUGGESTIONS.forEach((e, i) => console.log(`  ${i + 1}. ${e}`));
  const category = (await ask('\nCategory          (pick from above or type your own): ')).trim();

  const enabledStr = (await ask('Enable now?       (Y/n): ')).trim().toLowerCase();
  const enabled    = enabledStr !== 'n';

  const newSource = { name, url, rss, category, enabled };

  // Validate required fields
  if (!name || !rss) {
    console.error('\n❌ Name and RSS Feed URL are required. Aborting.\n');
    rl.close();
    process.exit(1);
  }

  // Check for duplicate
  const exists = config.sources.some(
    (s) => s.rss === rss || s.name.toLowerCase() === name.toLowerCase()
  );
  if (exists) {
    console.warn('\n⚠️  A source with this name or RSS URL already exists!');
    const overwrite = (await ask('Add anyway? (y/N): ')).trim().toLowerCase();
    if (overwrite !== 'y') {
      console.log('Aborted.\n');
      rl.close();
      return;
    }
  }

  config.sources.push(newSource);
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');

  console.log(`\n✅  Added "${name}" to config.json!`);
  if (enabled) {
    console.log('🔄  Restart the bot (Ctrl+C → npm start) to begin receiving news from this source.');
  } else {
    console.log('ℹ️  Source is disabled. Set "enabled": true in config.json to activate it.');
  }
  console.log('');

  rl.close();
}

main().catch((err) => {
  console.error('Error:', err.message);
  rl.close();
  process.exit(1);
});
