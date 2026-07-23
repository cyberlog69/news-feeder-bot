<div align="center">

# 📰 News Feeder Bot

### Automated cybersecurity & tech news — delivered to WhatsApp, Telegram, and Discord
#### Multi-provider AI summaries · keyword filtering · severity alerts · live dashboard · production-ready

[![CI](https://github.com/cyberlog69/news-feeder-bot/actions/workflows/ci.yml/badge.svg)](https://github.com/cyberlog69/news-feeder-bot/actions)
[![Security](https://img.shields.io/badge/npm%20audit-0%20vulnerabilities-brightgreen)](https://npmjs.com)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-blue)](https://nodejs.org)
[![Docker](https://img.shields.io/badge/docker-ready-2496ED?logo=docker&logoColor=white)](https://hub.docker.com)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

</div>

---

## 📌 Table of Contents

- [What's New](#-whats-new)
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

## 🆕 What's New

### v3.2 — Enterprise Webhooks, Native SQLite & Automated Testing
| Change | Details |
|---|---|
| 💬 **Google Chat (Hangouts)** | Deliver news directly into Google Chat Spaces via Webhooks using rich Cards v2 |
| 💼 **Slack & MS Teams** | Enterprise workplace delivery via Slack Block Kit and MS Teams Adaptive Cards |
| 🗄️ **Native SQLite (`node:sqlite`)** | Crash-proof SQLite storage (`data/newsbot.sqlite`) with automatic JSON migration |
| ⚡ **AI Fallback Cascade** | Auto-cascade through AI providers (`Groq` → `Gemini` → `OpenRouter` → `HuggingFace` → `Ollama`) |
| 📡 **Real-Time Live UI (SSE)** | Dashboard streams live log updates instantly via Server-Sent Events (`/events`) |
| 📊 **Prometheus Metrics** | Ingest metrics into Grafana/Datadog using standard Prometheus format (`/metrics?format=prometheus`) |
| 🧪 **Automated Test Suite** | Native Node.js unit tests (`npm test`) covering security, scoring, formatters, and DB |
| 🤖 **Bot Commands** | Interactive user commands (`/status`, `/search <keyword>`, `/sources`, `/help`) |

---

## ✨ Features

| Feature | Description |
|---|---|
| 📱 **WhatsApp Delivery** | Send to personal chats, groups, or channels — multi-target supported |
| ✈️ **Telegram Delivery** | Send to channels, groups, or DMs — native Bot API, no extra libs |
| 🎮 **Discord Delivery** | Rich embeds via webhooks — severity color-coded, zero dependencies |
| 🟢 **Google Chat Space** | Rich Cards v2 delivered directly into Google Chat (Hangouts) spaces |
| 💼 **Slack & MS Teams** | Rich Block Kit and Adaptive Cards webhooks for workplace SOC rooms |
| 🤖 **Multi-Provider AI** | Groq, Gemini, OpenRouter, HuggingFace, Ollama, or Extractive fallback |
| 🗄️ **Native SQLite Storage** | Atomic transactions, zero JSON corruption, auto-migrated from legacy files |
| 🎯 **Keyword Filtering** | Include or exclude articles by keywords (e.g. `ransomware`, `CVE`) |
| 🚨 **Severity Alerts** | Auto `🚨 CRITICAL ALERT` badge for zero-days, RCE, active exploits |
| 📋 **Daily Digest** | Bundle all articles into one daily message at a scheduled time |
| ⚡ **ETag Caching** | RSS feeds only re-fetched when actually updated — 3× faster |
| 💾 **Persistent Cache** | AI summaries survive bot restarts — no wasted API calls |
| ⚖️ **Article Scoring** | Skip low-value articles by importance score (0.0–1.0) |
| 🔀 **Source Routing** | Send specific sources to specific platforms independently |
| 🔁 **Multi-Target** | Comma-separated lists for WhatsApp groups and Telegram channels |
| 📊 **Web Dashboard & SSE** | Dark-mode local UI with stats, recent articles, and SSE live log streaming |
| 🩺 **Health & Prometheus** | `/health` and Prometheus-compatible `/metrics` for monitoring |
| 🧪 **Automated Testing** | `npm test` runs 16+ unit tests covering all core modules |
| 🔒 **Security Hardened** | SSRF protection, prompt injection prevention, 0 audit vulnerabilities |

---

## 🚀 Quick Start

### Prerequisites
- **Node.js 18+** → [nodejs.org](https://nodejs.org)
- **Google Chrome** → [google.com/chrome](https://google.com/chrome) *(WhatsApp only)*
- **AI API Key** *(optional)* → Get a free [Groq key](https://console.groq.com) (default) — or use `SUMMARIZER_PROVIDER=extractive` for no AI at all

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

> **No AI key?** Set `SUMMARIZER_PROVIDER=extractive` in `.env` — the bot extracts article sentences directly, no API required.

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
Articles appear as **rich embeds**: blue for normal, red for critical alerts.

### Google Chat (Hangouts Space)

| Step | Action |
|---|---|
| 1 | Open your Google Chat Space → click Space Name at top → **Apps & integrations** → **Webhooks** |
| 2 | Click **Add Webhook** → Name it `📰 News Feeder Bot` → copy the URL |
| 3 | Paste into `.env` → `GOOGLE_CHAT_WEBHOOK_URL=https://chat.googleapis.com/v1/spaces/...` |

Articles appear as **Google Chat Cards v2** with action buttons to read full articles.

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
fly secrets set GROQ_API_KEY=xxx TELEGRAM_BOT_TOKEN=xxx TELEGRAM_TARGET=@channel
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
│   ├── summarizer.js           # Multi-provider AI (Groq/Ollama/HF/OpenRouter/Gemini/Extractive)
│   ├── scorer.js               # Article importance scoring (0.0–1.0)
│   ├── formatter.js            # Message formatting for WhatsApp, Telegram, Discord
│   ├── sender.js               # WhatsApp client (cross-platform Chrome detection)
│   ├── telegram-sender.js      # Telegram Bot API (native fetch, zero deps)
│   ├── discord-sender.js       # Discord webhooks (rich embeds, native fetch)
│   ├── deduplicator.js         # Seen-article tracking with debounced disk writes
│   ├── web-dashboard.js        # Dashboard + /health + /metrics endpoints
│   └── logger.js               # Colored console + daily rotating log files
│
├── scripts/
│   └── scan.js                 # Static security scanner (pattern-based code audit)
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
├── DEPLOYMENT.md               # Complete deployment guide for all platforms
└── .env.example                # All environment variables documented
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

Choose your provider by setting `SUMMARIZER_PROVIDER` in `.env`. The bot auto-falls back to extractive summarization if the API fails — articles always get delivered.

### Provider Comparison

| Provider | Cost | Free Limit | Quality | Setup |
|---|---|---|---|---|
| **Groq** *(default)* | 🆓 Free | 14,400 req/day | ⭐⭐⭐⭐ | API key — no CC needed |
| **Ollama** | 🆓 Forever free | Unlimited | ⭐⭐⭐⭐ | Install app locally |
| **HuggingFace** | 🆓 Free tier | Rate-limited | ⭐⭐⭐⭐⭐ | API key — free account |
| **OpenRouter** | 🆓 Free tier | Varies by model | ⭐⭐⭐⭐ | API key — free account |
| **Gemini** | 🆓 Free tier | 1,500 req/day | ⭐⭐⭐⭐ | API key — free account |
| **Extractive** | 🆓 Zero cost | Unlimited | ⭐⭐⭐ | Nothing needed |

### Setup by Provider

#### 🟢 Groq (Recommended — 14,400 free req/day, no credit card)
```env
SUMMARIZER_PROVIDER=groq
GROQ_API_KEY=gsk_xxxx
GROQ_MODEL=llama-3.1-8b-instant   # or: llama-3.3-70b-versatile, mixtral-8x7b-32768
```
Get free key: [console.groq.com](https://console.groq.com)

#### 🏠 Ollama (Local — private, unlimited, no API key)
```bash
# Install from https://ollama.com, then:
ollama pull llama3.2
```
```env
SUMMARIZER_PROVIDER=ollama
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2   # or: mistral, phi3, gemma2
```

#### 🤗 HuggingFace (Best model quality for summarization)
```env
SUMMARIZER_PROVIDER=huggingface
HF_API_KEY=hf_xxxx
HF_MODEL=facebook/bart-large-cnn   # purpose-built summarization model
```
Get free token: [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)

#### 🔀 OpenRouter (100+ free models via one API)
```env
SUMMARIZER_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-xxxx
OPENROUTER_MODEL=meta-llama/llama-3.1-8b-instruct:free
```
Get free key: [openrouter.ai](https://openrouter.ai)

#### 💎 Gemini (Original provider)
```env
SUMMARIZER_PROVIDER=gemini
GEMINI_API_KEY=AIza_xxxx
```
Get free key: [aistudio.google.com](https://aistudio.google.com)

#### 📄 Extractive (No AI — always works)
```env
SUMMARIZER_PROVIDER=extractive
# No key needed — extracts top sentences from the article directly
```

> **Cache:** All providers share `data/summary_cache.json` — summaries survive restarts and never repeat API calls for the same article.
> **Auto-fallback:** If your provider is unavailable, the bot silently falls back to extractive so articles always get sent. Each message shows `🤖 AI summary` or `📄 auto-extracted`.

---

## 🔒 Security

| Area | Implementation |
|---|---|
| SSRF | All RSS/article URLs validated — private IPs and non-HTTP schemes blocked |
| Prompt injection | RSS content isolated with XML delimiters in all AI provider prompts |
| HTML injection | All external text HTML-escaped before Telegram messages |
| XSS | Article URLs validated to `http`/`https` only before embedding |
| WhatsApp injection | Markdown special chars (`*`, `_`, `~`, `` ` ``) escaped in all text |
| Error sanitization | Stack traces, API tokens, and file paths never logged |
| File permissions | Sensitive data files written with `mode 0o600` |
| Docker | Runs as non-root user (`botuser`) inside container |
| Supply chain | `package-lock.json` committed; `npm audit` = **0 vulnerabilities** (232 packages) |
| CI | GitHub Actions runs `npm audit --audit-level=high` on every push |
| Static scan | `scripts/scan.js` checks all source files for eval, prototype pollution, hardcoded keys |

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
| `npm run audit` | Run `npm audit` to check for vulnerabilities |

### PM2 (VPS / always-on)
| Command | Description |
|---|---|
| `npm run pm2:start` | Start with PM2 in production mode |
| `npm run pm2:stop` | Stop |
| `npm run pm2:restart` | Restart without downtime |
| `npm run pm2:reload` | Zero-downtime reload |
| `npm run pm2:logs` | Follow live logs |
| `npm run pm2:monit` | CPU and memory monitor |
| `npm run pm2:delete` | Remove from PM2 |

### Docker
| Command | Description |
|---|---|
| `npm run docker:build` | Build the Docker image |
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
| AI provider 429 / quota errors | Bot retries automatically. Switch provider: `SUMMARIZER_PROVIDER=groq` or `=extractive` |
| Ollama not responding | Make sure Ollama is running: `ollama serve` — then retry |
| HuggingFace model loading slow | Free tier cold-starts can take 20–30s — bot waits and retries automatically |
| Telegram "chat not found" | Run `npm run list-telegram-chats` to find the correct ID |
| Discord articles not sending | Verify `DISCORD_WEBHOOK_URL` in `.env`; regenerate webhook if needed |
| "No platform configured" | Set at least one: `WHATSAPP_TARGET`, `TELEGRAM_BOT_TOKEN`, or `DISCORD_WEBHOOK_URL` |
| Dashboard port in use | Change `dashboardPort` in `config.json` or set `PORT` env var |
| Docker out of memory | Increase `memory: 600M` → `900M` in `docker-compose.yml` |
| WhatsApp on cloud (QR scan) | See [DEPLOYMENT.md — WhatsApp on Cloud](DEPLOYMENT.md#-whatsapp-on-cloud-deployments) |
| dotenv log at startup | Normal in v17 — suppressed automatically with `{ quiet: true }` |

---

## 📄 License

MIT — free to use, modify, and distribute.

---

<div align="center">

**[⭐ Star this repo](https://github.com/cyberlog69/news-feeder-bot)** if it's useful · **[🐛 Report a bug](https://github.com/cyberlog69/news-feeder-bot/issues)** · **[💡 Request a feature](https://github.com/cyberlog69/news-feeder-bot/issues)**

</div>
