<div align="center">

# 📰 News Feeder Bot

### Automated cybersecurity & tech news — delivered to WhatsApp, Telegram, and Discord
#### AI-powered summaries · keyword filtering · severity alerts · live dashboard · production-ready

[![CI](https://github.com/cyberlog69/news-feeder-bot/actions/workflows/ci.yml/badge.svg)](https://github.com/cyberlog69/news-feeder-bot/actions)
[![Security](https://img.shields.io/badge/npm%20audit-0%20vulnerabilities-brightgreen)](https://npmjs.com)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-blue)](https://nodejs.org)
[![Docker](https://img.shields.io/badge/docker-ready-2496ED?logo=docker&logoColor=white)](https://hub.docker.com)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

</div>

---

## 📌 Table of Contents

- [Features](#-features)
- [Quick Start](#-quick-start)
- [Platform Setup](#-platform-setup)
- [Configuration](#️-configuration)
- [Deployment](#-deployment)
- [Project Structure](#️-project-structure)
- [News Sources](#-default-news-sources)
- [Web Dashboard](#-web-dashboard)
- [AI Summarization](#-ai-summarization)
- [Security](#-security)
- [npm Commands](#-npm-commands)
- [Troubleshooting](#-troubleshooting)

---

## ✨ Features

| Feature | Description |
|---|---|
| 📱 **WhatsApp Delivery** | Send to personal chats, groups, or channels — multi-target supported |
| ✈️ **Telegram Delivery** | Send to channels, groups, or DMs — native Bot API, no extra libs |
| 🎮 **Discord Delivery** | Rich embeds via webhooks — severity color-coded, zero dependencies |
| 🤖 **Gemini AI Summaries** | `gemini-2.0-flash-lite` bullet summaries with persistent caching |
| 🎯 **Keyword Filtering** | Include or exclude articles by keywords (e.g. `ransomware`, `CVE`) |
| 🚨 **Severity Alerts** | Auto `🚨 CRITICAL ALERT` badge for zero-days, RCE, active exploits |
| 📋 **Daily Digest** | Bundle all articles into one daily message at a scheduled time |
| ⚡ **ETag Caching** | RSS feeds only re-fetched when actually updated — 3× faster |
| 💾 **Persistent Cache** | AI summaries survive bot restarts — no wasted API calls |
| ⚖️ **Article Scoring** | Skip low-value articles by importance score (0.0–1.0) |
| 🔀 **Source Routing** | Send specific sources to specific platforms independently |
| 🔁 **Multi-Target** | Comma-separated lists for WhatsApp groups and Telegram channels |
| 📊 **Web Dashboard** | Dark-mode local UI with stats, recent articles, and live log tail |
| 🩺 **Health Endpoints** | `/health` and `/metrics` JSON endpoints for uptime monitoring |
| 📝 **Log Files** | Daily rotating logs in `data/logs/` with 7-day auto-retention |
| 💚 **Health Pings** | Daily "I'm alive" message to all platforms at configured time |
| 🐳 **Docker Ready** | Multi-stage Dockerfile + docker-compose with named volumes |
| 🚀 **Cloud Ready** | One-click deploy to Railway, Render, Fly.io, Oracle Cloud, or any VPS |
| 🔒 **Security Hardened** | SSRF protection, prompt injection prevention, 0 audit vulnerabilities |

---

## 🚀 Quick Start

### Prerequisites
- **Node.js 18+** → [nodejs.org](https://nodejs.org)
- **Google Chrome** → [google.com/chrome](https://google.com/chrome) *(WhatsApp only)*
- **Gemini API Key** → [aistudio.google.com](https://aistudio.google.com) *(free)*

### 3-Step Setup
```bash
# 1. Clone
git clone https://github.com/cyberlog69/news-feeder-bot.git
cd news-feeder-bot

# 2. Install
npm install

# 3. Configure and run
cp .env.example .env
# Edit .env with your keys and targets, then:
npm start
```

**WhatsApp first run:** scan the QR code shown in terminal with WhatsApp → Linked Devices → Link a Device. Session is saved automatically for all future runs.

> **Telegram or Discord only?** No QR code needed — just set your bot token and run.

---

## 📱 Platform Setup

### WhatsApp

| Step | Action |
|---|---|
| 1 | Run `npm start` — a QR code appears in terminal |
| 2 | Open WhatsApp → Linked Devices → Link a Device → scan QR |
| 3 | Session saved to `.wwebjs_auth/` — no re-scan on future starts |
| 4 | Find your group ID: `npm run list-groups` |

```env
# Single target (phone number, group ID, or group name)
WHATSAPP_TARGET=919876543210
WHATSAPP_TARGET=120363409960337815@g.us
WHATSAPP_TARGET=My Cyber News Group

# Multiple targets (comma-separated)
WHATSAPP_TARGET=120363409960337815@g.us,120363409960337816@g.us
```

### Telegram

| Step | Action |
|---|---|
| 1 | Message `@BotFather` on Telegram → `/newbot` → copy the token |
| 2 | Add your bot to the group/channel and make it **Admin** |
| 3 | Find chat ID: `npm run list-telegram-chats` |

```env
TELEGRAM_BOT_TOKEN=123456789:ABCDefgh...
TELEGRAM_TARGET=@mycybernewschannel        # public channel
TELEGRAM_TARGET=-1001234567890             # private group ID
TELEGRAM_TARGET=@channel1,-1001234567890  # multi-target
```

### Discord

| Step | Action |
|---|---|
| 1 | In Discord: right-click channel → Edit Channel → Integrations → Webhooks |
| 2 | Click **New Webhook** → copy the URL |
| 3 | Paste into `.env` → done. No bot needed, no invite process. |

```env
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/123456/xxxxx
DISCORD_USERNAME=📰 News Feeder Bot     # optional: custom display name
DISCORD_AVATAR_URL=https://...          # optional: custom avatar
```

Articles appear as **rich embeds**: blue for normal, red for critical alerts.

---

## ⚙️ Configuration

All features are controlled from `config.json`. Changes take effect on the next pipeline run — **no restart needed**.

### `config.json` — Full Reference

#### 📡 News Sources
```json
"sources": [
  {
    "name":     "The Hacker News",
    "url":      "https://thehackernews.com/",
    "rss":      "https://feeds.feedburner.com/TheHackersNews",
    "category": "💻 The Hacker News",
    "enabled":  true
  }
]
```
Add more sources interactively: `npm run add-source`

#### ⚙️ General Settings
```json
"settings": {
  "pollIntervalMinutes":    5,   // how often to check for new articles
  "maxArticlesPerRun":      5,   // max articles per polling cycle
  "summaryBulletPoints":    3,   // AI bullet points per article
  "delayBetweenMessagesSec":3,   // pause between sends (avoid spam limits)
  "healthCheckHour":        8,   // send "I'm alive" ping at 8:00 AM
  "dashboardPort":       3000    // web dashboard port
}
```

#### 🎯 Keyword Filtering
```json
"filters": {
  "enabled":  true,
  "keywords": ["ransomware", "zero-day", "CVE", "data breach", "RCE"],
  "mode":     "include"
}
```
- `"include"` — only deliver articles that match at least one keyword
- `"exclude"` — skip articles that match any keyword

#### 🚨 Severity Alerts
```json
"severity": {
  "enabled":  true,
  "keywords": ["zero-day", "critical", "RCE", "ransomware", "actively exploited",
               "authentication bypass", "supply chain attack", "backdoor"]
}
```
Matching articles get a `🚨 CRITICAL ALERT` banner at the top of the message.

#### 📋 Daily Digest Mode
```json
"digest": {
  "enabled": true,
  "sendAt":  "08:00"
}
```
Instead of per-article messages, all articles are buffered and sent as one digest at `sendAt`. Keeps groups clean.

#### 🔀 Source Routing
```json
"routing": {
  "BleepingComputer":  ["whatsapp"],
  "The Hacker News":   ["telegram", "discord"],
  "HackRead":          ["whatsapp", "telegram", "discord"]
}
```
Route sources to specific platforms. Sources not listed broadcast to all.

#### ⚖️ Article Scoring
```json
"scoring": {
  "enabled":  true,
  "minScore": 0.3
}
```
Each article is scored 0.0–1.0 based on keyword relevance, recency, and content richness. Articles below `minScore` are silently skipped.

---

## 🚀 Deployment

### Option 1 — Local (Direct Node.js)
```bash
npm start              # run once
npm run dev            # auto-restart on file changes (development)
```

### Option 2 — Local 24/7 with PM2 *(recommended for always-on PC/VPS)*
```bash
npm install -g pm2
npm run pm2:start      # start in background
pm2 save               # persist across reboots
pm2 startup            # configure system auto-start
```

### Option 3 — Docker *(isolated container)*
```bash
cp .env.example .env   # fill in your credentials
npm run docker:up      # build + start in background
npm run docker:logs    # follow logs
```
WhatsApp session and article data are stored in named Docker volumes — survive container rebuilds.

### Option 4 — Railway.app *(easiest cloud)*
1. Push this repo to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Add environment variables in the **Variables** tab
4. Railway auto-detects `railway.json` and deploys via Dockerfile

### Option 5 — Render.com *(free tier)*
1. Go to [render.com](https://render.com) → New → Blueprint
2. Connect your GitHub repo (`render.yaml` is auto-detected)
3. Add secrets in the **Environment** tab
4. Free tier: Telegram + Discord work perfectly (no persistent disk needed)

### Option 6 — Fly.io *(best free cloud — 3 always-on VMs)*
```bash
npm install -g flyctl
fly auth login
fly launch --no-deploy
fly volumes create newsbot_data --size 1 --region sin
fly secrets set GEMINI_API_KEY=xxx TELEGRAM_BOT_TOKEN=xxx TELEGRAM_TARGET=@channel
fly deploy
```

### Option 7 — Oracle Cloud Always Free *(4 ARM VMs, forever free)*
Full guide: [DEPLOYMENT.md](DEPLOYMENT.md#7-️-oracle-cloud-free-tier-always-free-vps)

> 📖 **Complete step-by-step instructions for all 8 deployment options** → see [DEPLOYMENT.md](DEPLOYMENT.md)

---

## 🗂️ Project Structure

```
news-feeder-bot/
│
├── index.js                    # Entry point — boots platforms, runs cron jobs
├── config.json                 # All feature configuration (hot-reloaded)
├── .env                        # Your secrets — never commit this!
├── .env.example                # Template with all available variables
│
├── src/
│   ├── pipeline.js             # Orchestrates: fetch → filter → score → summarize → send
│   ├── fetcher.js              # RSS fetcher with ETag/Last-Modified caching
│   ├── summarizer.js           # Gemini AI with persistent cache + retry logic
│   ├── scorer.js               # Article importance scoring (0.0–1.0)
│   ├── formatter.js            # Message formatting for WhatsApp, Telegram, Discord
│   ├── sender.js               # WhatsApp client (cross-platform Chrome detection)
│   ├── telegram-sender.js      # Telegram Bot API (native fetch, zero deps)
│   ├── discord-sender.js       # Discord webhooks (rich embeds, native fetch)
│   ├── deduplicator.js         # Seen-article tracking with debounced disk writes
│   ├── web-dashboard.js        # Dashboard + /health + /metrics endpoints
│   └── logger.js               # Colored console + daily rotating log files
│
├── add-source.js               # Interactive CLI to add RSS sources
├── list-groups.js              # WhatsApp group ID finder
├── list-telegram-chats.js      # Telegram chat ID finder
│
├── Dockerfile                  # Multi-stage production Docker image
├── docker-compose.yml          # Local Docker with volumes + resource limits
├── ecosystem.config.js         # PM2 process manager configuration
├── railway.json                # Railway.app deployment config
├── render.yaml                 # Render.com blueprint
├── fly.toml                    # Fly.io deployment config
├── .github/workflows/ci.yml    # GitHub Actions CI (audit + module checks)
└── DEPLOYMENT.md               # Complete deployment guide for all platforms
```

---

## 📰 Default News Sources

| Source | Category | Feed |
|---|---|---|
| Cyber Security News | 🔐 Cybersecurity | `cybersecuritynews.com/feed` |
| HackRead | 🕵️ HackRead | `hackread.com/feed` |
| The Hacker News | 💻 The Hacker News | `feeds.feedburner.com/TheHackersNews` |
| BleepingComputer | 🖥️ BleepingComputer | `bleepingcomputer.com/feed` |

Add your own: `npm run add-source`

---

## 📊 Web Dashboard

Automatically starts at **http://localhost:3000** when the bot runs.

| Page | URL | Description |
|---|---|---|
| Dashboard | `/` | Dark-mode UI with stats, recent articles, live log tail |
| Health Check | `/health` | JSON status — used by cloud platform health checks |
| Metrics | `/metrics` | JSON with memory, uptime, recent articles |

```json
// GET /health
{ "status": "ok", "uptime_sec": 3600, "total_sent": 142, "environment": "production" }
```

- Auto-refreshes every 30 seconds
- Binds to `127.0.0.1` locally (not public), `0.0.0.0` in production
- Port controlled by `PORT` env var (cloud) or `config.settings.dashboardPort` (local)

---

## 🤖 AI Summarization

| Setting | Value |
|---|---|
| Model | `gemini-2.0-flash-lite` (higher free-tier quota than flash) |
| Rate limit | 8s minimum gap between API calls |
| Retry | Auto-retry on 429 with API-specified wait time (up to 3 attempts) |
| Cache | Summaries saved to `data/summary_cache.json` — survive restarts |
| Fallback | Extracts top sentences from article text if Gemini unavailable |
| Labels | Each article shows `🤖 AI summary` or `📄 auto-extracted` |

Get a free API key at [aistudio.google.com](https://aistudio.google.com) → **Get API Key**.

---

## 🔒 Security

| Area | Implementation |
|---|---|
| SSRF | All RSS/article URLs validated — private IPs and non-HTTP schemes blocked |
| Prompt injection | RSS content isolated with XML delimiters in Gemini prompts |
| HTML injection | All external text HTML-escaped before Telegram messages |
| XSS | Article URLs validated to `http`/`https` only before embedding |
| WhatsApp injection | Markdown special chars (`*`, `_`, `~`, `` ` ``) escaped in all text |
| Error sanitization | Stack traces, API tokens, and file paths never logged |
| File permissions | Sensitive data files written with `mode 0o600` |
| Docker | Runs as non-root user (`botuser`) inside container |
| Supply chain | `package-lock.json` committed; `npm audit` = **0 vulnerabilities** |
| CI | GitHub Actions runs `npm audit --audit-level=high` on every push |

---

## 📦 npm Commands

### Core
| Command | Description |
|---|---|
| `npm start` | Start the bot |
| `npm run dev` | Start with auto-restart on file changes |
| `npm run add-source` | Add a new RSS source interactively |
| `npm run list-groups` | List WhatsApp groups and their IDs |
| `npm run list-telegram-chats` | List Telegram chats the bot has access to |

### PM2 (VPS / always-on)
| Command | Description |
|---|---|
| `npm run pm2:start` | Start with PM2 in production mode |
| `npm run pm2:stop` | Stop |
| `npm run pm2:restart` | Restart without downtime |
| `npm run pm2:logs` | Follow live logs |
| `npm run pm2:monit` | CPU and memory monitor |

### Docker
| Command | Description |
|---|---|
| `npm run docker:up` | Build and start in background |
| `npm run docker:down` | Stop and remove containers |
| `npm run docker:logs` | Follow container logs |
| `npm run docker:restart` | Restart containers |

---

## 📝 Log Files

| Property | Value |
|---|---|
| Location | `data/logs/bot-YYYY-MM-DD.log` |
| Rotation | New file daily, 7 days retained automatically |
| Format | `[ISO timestamp] [LEVEL  ] message` |
| Dashboard | Last 80 lines shown with colour coding |

---

## ❓ Troubleshooting

| Problem | Solution |
|---|---|
| WhatsApp QR keeps reappearing | Delete `.wwebjs_auth/` and restart to get a fresh QR |
| Chrome not found | Install Google Chrome, or set `CHROME_PATH=/path/to/chrome` in `.env` |
| Gemini 429 quota errors | Normal — bot retries automatically. Or increase `pollIntervalMinutes` |
| Telegram "chat not found" | Run `npm run list-telegram-chats` to find the correct ID |
| Discord articles not sending | Verify `DISCORD_WEBHOOK_URL` in `.env`; regenerate webhook if needed |
| "No platform configured" | Set at least one: `WHATSAPP_TARGET`, `TELEGRAM_BOT_TOKEN`, or `DISCORD_WEBHOOK_URL` |
| Dashboard port in use | Change `dashboardPort` in `config.json` or set `PORT` env var |
| Docker out of memory | Increase `memory: 600M` → `900M` in `docker-compose.yml` |
| WhatsApp on cloud (QR scan) | See [DEPLOYMENT.md — WhatsApp on Cloud](DEPLOYMENT.md#-whatsapp-on-cloud-deployments) |

---

## 📄 License

MIT — free to use, modify, and distribute.

---

<div align="center">

**[⭐ Star this repo](https://github.com/cyberlog69/news-feeder-bot)** if it's useful · **[🐛 Report a bug](https://github.com/cyberlog69/news-feeder-bot/issues)** · **[💡 Request a feature](https://github.com/cyberlog69/news-feeder-bot/issues)**

</div>
