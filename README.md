# 📰 News Feeder Bot v3.0

> Automated cybersecurity & tech news delivered to **WhatsApp**, **Telegram**, and **Discord** — with AI-powered summaries, keyword filtering, severity alerts, and a live web dashboard.

[![Security](https://img.shields.io/badge/npm%20audit-0%20vulnerabilities-brightgreen)](https://npmjs.com)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-blue)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

---

## ✨ What's New in v3.0

| Feature | Description |
|---|---|
| 🎯 Keyword Filtering | Only receive articles matching your keywords (e.g. `ransomware`, `CVE`) |
| 🚨 Severity Alerts | Critical articles get a `🚨 CRITICAL ALERT` badge automatically |
| 📋 Daily Digest | Bundle all daily articles into one message at a configured time |
| 🌐 Discord Support | Send to Discord channels via webhooks (rich embeds!) |
| 📊 Web Dashboard | Live local dashboard at `http://localhost:3000` |
| 🔁 Multi-Target | Send to multiple WhatsApp groups and Telegram channels at once |
| ⚡ ETag Caching | RSS feeds only re-fetched when actually updated (3× faster) |
| 💾 Persistent Cache | AI summaries survive bot restarts (no repeated API calls) |
| 📝 Log Files | Daily rotating log files in `data/logs/bot-YYYY-MM-DD.log` |
| 💚 Health Check | Daily "I'm alive" ping to all configured platforms |
| 🏷️ AI Labels | Articles show whether summary is AI-generated or auto-extracted |
| ⚖️ Article Scoring | Filter out low-importance articles by importance score |

---

## 🚀 Quick Start

### 1. Clone and install
```bash
git clone https://github.com/cyberlog69/news-feeder-bot.git
cd news-feeder-bot
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env with your API keys and targets
```

### 3. Run
```bash
npm start
```

On first WhatsApp run: scan the QR code with WhatsApp → Linked Devices → Link a Device.

---

## ⚙️ Configuration

### `.env` — Platform credentials
```env
GEMINI_API_KEY=your_key_here

# WhatsApp (comma-separated for multiple targets)
WHATSAPP_TARGET=120363409960337815@g.us

# Telegram
TELEGRAM_BOT_TOKEN=123456:ABC...
TELEGRAM_TARGET=@mychannel

# Discord (optional)
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

### `config.json` — Feature configuration

#### Keyword Filtering
```json
"filters": {
  "enabled": true,
  "keywords": ["ransomware", "zero-day", "CVE", "data breach"],
  "mode": "include"
}
```
- `mode: "include"` → only send articles matching keywords
- `mode: "exclude"` → skip articles matching keywords

#### Daily Digest Mode
```json
"digest": {
  "enabled": true,
  "sendAt": "08:00",
  "timezone": "Asia/Kolkata"
}
```
Bundles all articles into one daily summary instead of per-article messages.

#### Severity Alerts
```json
"severity": {
  "enabled": true,
  "keywords": ["zero-day", "critical", "RCE", "ransomware", "actively exploited"]
}
```
Adds a `🚨 CRITICAL ALERT` banner to matching articles.

#### Source Routing
```json
"routing": {
  "BleepingComputer": ["whatsapp"],
  "The Hacker News": ["telegram", "discord"],
  "HackRead": ["whatsapp", "telegram", "discord"]
}
```
Send specific sources to specific platforms. Omit a source to broadcast to all.

#### Article Scoring
```json
"scoring": {
  "enabled": true,
  "minScore": 0.3
}
```
Scores articles 0.0–1.0 based on keyword relevance, recency, and content richness. Articles below `minScore` are not sent.

#### Health Check
```json
"settings": {
  "healthCheckHour": 8
}
```
Sends a daily health ping at 8:00 AM to confirm the bot is running.

#### Web Dashboard
```json
"settings": {
  "dashboardPort": 3000
}
```
Access the dashboard at `http://localhost:3000`.

---

## 📱 Platform Setup

### WhatsApp
1. Run `npm start` → scan the QR code once → session saved automatically
2. To find group IDs: `npm run list-groups`
3. Supports phone numbers (`919876543210`), group IDs (`120363...@g.us`), or group names
4. Multi-target: `WHATSAPP_TARGET=groupId1@g.us,groupId2@g.us`

### Telegram
1. Message `@BotFather` → `/newbot` → copy the token
2. Add the bot to your group/channel and make it admin
3. Find your chat ID: `npm run list-telegram-chats`
4. Multi-target: `TELEGRAM_TARGET=@channel1,-1001234567890`

### Discord
1. Discord → right-click channel → Edit Channel → Integrations → Webhooks → New Webhook
2. Copy the URL → paste into `DISCORD_WEBHOOK_URL` in `.env`
3. Articles are sent as rich embeds with color-coded severity

---

## 📦 npm Commands

| Command | Description |
|---|---|
| `npm start` | Start the bot |
| `npm run dev` | Start with auto-restart on file changes |
| `npm run add-source` | Add a new RSS news source interactively |
| `npm run list-groups` | List WhatsApp groups and their IDs |
| `npm run list-telegram-chats` | List Telegram chats the bot has seen |

---

## 🗂️ Project Structure

```
news-feeder-bot/
├── index.js                  # Entry point: boots platforms, schedules runs
├── config.json               # Sources, settings, filters, digest, routing
├── .env                      # Your secrets (never commit this!)
├── .env.example              # Template
│
├── src/
│   ├── sender.js             # WhatsApp client (whatsapp-web.js)
│   ├── telegram-sender.js    # Telegram Bot API (native fetch)
│   ├── discord-sender.js     # Discord webhooks (native fetch, rich embeds)
│   ├── pipeline.js           # Orchestrates the full processing pipeline
│   ├── fetcher.js            # RSS fetcher with ETag caching
│   ├── summarizer.js         # Gemini AI summarizer with persistent cache
│   ├── formatter.js          # Message formatting for each platform
│   ├── scorer.js             # Article importance scoring
│   ├── deduplicator.js       # Seen-article tracking (JSON, debounced writes)
│   ├── web-dashboard.js      # Local web dashboard (built-in http module)
│   └── logger.js             # Colored console + daily rotating log files
│
├── add-source.js             # CLI to add new news sources
├── list-groups.js            # WhatsApp group finder
└── list-telegram-chats.js    # Telegram chat finder
```

---

## 📰 Default News Sources

| Source | Category | RSS |
|---|---|---|
| Cyber Security News | 🔐 Cybersecurity | cybersecuritynews.com/feed |
| HackRead | 🕵️ HackRead | hackread.com/feed |
| The Hacker News | 💻 The Hacker News | feeds.feedburner.com/TheHackersNews |
| BleepingComputer | 🖥️ BleepingComputer | bleepingcomputer.com/feed |

Add more: `npm run add-source`

---

## 🔒 Security

- **SSRF protection**: All URLs validated before fetching (blocks internal IPs, file:// etc.)
- **Prompt injection**: RSS content wrapped in XML delimiters in Gemini prompts
- **HTML injection**: All user-supplied text escaped before sending to Telegram
- **XSS prevention**: Article URLs validated to http/https only
- **WhatsApp injection**: Markdown special chars escaped in all article text
- **Error sanitization**: Stack traces and API tokens never logged
- **File permissions**: Sensitive data files written with mode `0o600`
- **Supply chain**: `package-lock.json` committed; `npm audit` shows 0 vulnerabilities

---

## 🌐 Web Dashboard

Access at `http://localhost:3000` while the bot is running.

Shows:
- Bot uptime and total articles sent
- Recent articles (title, source, timestamp, link)
- Live log tail (color-coded by level)
- Auto-refreshes every 30 seconds

The dashboard only listens on `127.0.0.1` (localhost) — not exposed to the network.

---

## 📝 Log Files

Logs are saved to `data/logs/bot-YYYY-MM-DD.log`.
- 7 days of logs are retained automatically
- Each line includes: ISO timestamp, level, message
- Dashboard shows the last 80 lines of today's log

---

## 🤖 AI Summarization

- **Model**: `gemini-2.0-flash-lite` (generous free tier)
- **Rate limit**: 8s minimum gap between API calls
- **Retry**: automatic retry on 429 with API-specified wait time
- **Cache**: summaries persisted to `data/summary_cache.json` (survives restarts)
- **Fallback**: if Gemini is unavailable, sentences are extracted directly from article text
- **Label**: each article shows `🤖 AI summary` or `📄 auto-extracted`

---

## ❓ Troubleshooting

| Problem | Solution |
|---|---|
| WhatsApp session expired | Delete `.wwebjs_auth/` and re-scan QR |
| Chrome not found | Install Google Chrome from google.com/chrome |
| Gemini 429 quota | Normal — bot retries automatically. Increase `pollIntervalMinutes` in config.json |
| Telegram "chat not found" | Run `npm run list-telegram-chats` |
| Discord webhook fails | Verify the URL in `.env`; check channel permissions |
| "No platform configured" | Set at least one of `WHATSAPP_TARGET`, `TELEGRAM_BOT_TOKEN`, or `DISCORD_WEBHOOK_URL` |
| Dashboard not loading | Check port isn't in use; default is 3000 |

---

## 📄 License

MIT — free to use, modify, and distribute.
