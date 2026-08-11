<div align="center">

# 📰 News Feeder Bot v3.7

### Autonomous Cybersecurity & Tech Intelligence Platform — Delivered Across 9 Platforms
#### Threat Intel (CVE/EPSS/IOC/MITRE) · Multi-Language Translation · TTS Voice Summaries · RAG Conversational AI (`/ask`) · RSS Feed Health · 0 Audit Vulnerabilities

[![CI](https://github.com/cyberlog69/news-feeder-bot/actions/workflows/ci.yml/badge.svg)](https://github.com/cyberlog69/news-feeder-bot/actions)
[![Security](https://img.shields.io/badge/npm%20audit-0%20vulnerabilities-brightgreen)](https://npmjs.com)
[![Node](https://img.shields.io/badge/node-%3E%3D22.0.0-blue)](https://nodejs.org)
[![Docker](https://img.shields.io/badge/docker-ready-2496ED?logo=docker&logoColor=white)](https://hub.docker.com)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

</div>

---

## 📌 Table of Contents

- [What's New in v3.7](#-whats-new-in-v37)
- [Features](#-features)
- [Supported Delivery Channels](#-supported-delivery-channels)
- [Quick Start](#-quick-start)
- [RAG & Conversational AI (`/ask`)](#-rag--conversational-ai-ask-your-news)
- [Deep Threat Intelligence](#-deep-threat-intelligence)
- [Multi-Language & Internationalization](#-multi-language--internationalization)
- [Audio & Multimedia Delivery](#-audio--multimedia-delivery)
- [Configuration Reference](#️-configuration-reference)
- [Bot Commands](#-bot-commands)
- [Web Dashboard & Administrative APIs](#-web-dashboard--administrative-apis)
- [Platform Setup Guides](#-platform-setup-guides)
- [Deployment Guides](#-deployment-guides)
- [npm Commands](#-npm-commands)
- [Automated Unit Testing](#-automated-testing)
- [Security](#-security)
- [Troubleshooting](#-troubleshooting)

---

## 🆕 What's New in v3.13

| Module | Details |
|---|---|
| 🌐 **Social & Public Syndication** | Broadcasts critical security alerts to Mastodon/Fediverse and Bluesky (AT Protocol). Exposes public syndication endpoints: RSS 2.0 (`/feed.xml`), Atom 1.0 (`/atom.xml`), and JSON Feed 1.1 (`/feed.json`). |
| 📑 **Executive CISO Briefings** | Generates strategic CISO executive intelligence reports in Markdown and print/PDF-ready HTML summarizing active CISA KEV zero-days, dark web ransomware disclosures, and tactical recommendations via `/briefing` or `GET /api/ciso-briefing`. |
| 📊 **Next-Gen SOC Dashboard & Radar** | Military-grade dark glassmorphism SOC console (`http://localhost:3000`) with Threat Telemetry HUD, live CISA KEV & Ransomware victim stream, and REST APIs (`/api/threat-intel`, `/api/subscriptions`, `/api/system-status`). |
| 👥 **Subscription Topics (`/subscribe`)** | Interactive bot commands (`/subscribe ransomware, cve`, `/unsubscribe`, `/subscriptions`) allowing users, channels, and groups to filter news by specific keywords or categories with SQLite persistence. |
| 📰 **AI Story Clustering & Master Bulletins** | Automatically identifies overlapping breaking news coverage across multiple feeds using Cosine Similarity on term-frequency vectors and shared CVEs. Merges facts into a single consolidated **Master Bulletin** citing all sources. |
| 🏴‍☠️ **Live Ransomware & CISA KEV Tracker** | Ingests real-time victim disclosures from dark web ransomware leak portals (LockBit, RansomHub, BlackCat, Akira, Play). Syncs CISA's official *Known Exploited Vulnerabilities* (KEV) catalog with SQLite persistence and warning badges. |
| 🧠 **RAG & Conversational AI (`/ask`)** | Ask natural language questions via `/ask <question>`. Searches historical news in SQLite using term-frequency vector embeddings and Cosine Similarity, generating cited AI responses. |
| 🛡️ **Deep Threat Intelligence** | Auto-enriches security news with CVE details, FIRST.org EPSS exploit probabilities, IOC extraction (IPs, hashes, defanged domains), and MITRE ATT&CK mapping. |
| 🌍 **Multi-Language Translation** | Translate news summaries on the fly per platform (`TELEGRAM_LANGUAGE=es`, `DISCORD_LANGUAGE=de`). Supports 13+ languages with SQLite translation caching. |
| 🔊 **Audio & Multimedia** | Text-to-Speech narrative summaries, native **Telegram Voice Notes**, and dynamic SVG visual alert cards for critical zero-day news. |
| 📧 **9 Delivery Channels** | WhatsApp, Telegram, Discord, Google Chat, Slack, MS Teams, HTML Email Newsletters, Mobile Push (Pushover/Ntfy.sh), and Outbound SOAR/SIEM Webhooks. |
| 🎛️ **Feed Health & Admin UI** | RSS Feed Health Index tracking latency (ms), HTTP status, and error counts. Visual Feed Manager REST APIs (`/api/sources`) to add/toggle feeds without manual config edits. |
| 🧪 **49/49 Unit Tests** | Automated Node.js native test suite (`npm test`) covering Social Media, Syndication Feeds, CISO Briefings, SOC Dashboard APIs, Subscriptions, Story Clustering, CISA KEV, Ransomware tracking, RAG, and formatters with 100% pass rate. |

---

## ✨ Features

| Category | Feature | Description |
|---|---|---|
| 🌐 **Public Feeds** | **Feed Syndication** | Auto-generates public RSS 2.0 (`/feed.xml`), Atom (`/atom.xml`), and JSON Feed (`/feed.json`) |
| | **Social Broadcasting** | Broadcasts alerts to Mastodon/Fediverse and Bluesky (AT Protocol) |
| 📑 **Reporting** | **CISO Executive Briefings**| Auto-compiles strategic threat reports in Markdown/PDF-ready HTML via `/briefing` |
| 📊 **SOC Console**| **SOC Threat Telemetry** | Midnight glassmorphism dashboard with live KEV radar, ransomware stream & metrics HUD |
| 👥 **Personalization**| **Topic Subscriptions** | Filter alerts per user or channel via `/subscribe` (e.g. `ransomware`, `cve`, `ai`) |
| 📰 **Fusion** | **Story Clustering** | Groups overlapping news coverage using Cosine Similarity & shared CVE IDs |
| | **Master Bulletins** | Consolidates multi-source breaking news into 1 all-in-one bulletin with multi-citations |
| 🏴‍☠️ **Threat Intel** | **CISA KEV Sync** | Real-time lookup against CISA Known Exploited Vulnerabilities catalog with ransomware flags |
| | **Ransomware Leak Tracker** | Real-time dark web leak portal tracking across major ransomware gangs with victim alerts |
| 🤖 **AI & RAG** | **Conversational RAG** | Ask questions (`/ask`) over historical news using vector retrieval & AI synthesis |
| | **Multi-Provider AI** | Auto-cascading AI support (`Groq` → `Gemini` → `OpenRouter` → `HuggingFace` → `Ollama`) |
| 🛡️ **Enrichment** | **Threat Intel Engine** | CVE, EPSS exploit probability, IOC parsing (IPs/hashes), MITRE ATT&CK technique IDs |
| 🔊 **Media** | **TTS Voice Summaries** | Formats spoken narrative scripts and generates `.mp3` audio files |
| | **Telegram Voice Notes** | Dispatches playable voice summaries directly to Telegram chats |
| | **SVG Alert Cards** | Generates visual social alert graphics for `🚨 CRITICAL ALERT` articles |
| 🌍 **Localization**| **Multi-Language Routing**| Translate news summaries per platform (`en`, `es`, `de`, `fr`, `hi`, `ja`, etc.) |
| 📱 **Delivery** | **9 Platforms** | WhatsApp, Telegram, Discord, Google Chat, Slack, MS Teams, Email, Push, Webhook |
| 🗄️ **Storage** | **Native SQLite** | Crash-proof SQLite storage (`data/newsbot.sqlite`) for cache, KEV catalog, and vector storage |
| 📊 **Admin** | **Feed Health Matrix** | Live monitoring of response latency, HTTP status, and error counts per RSS feed |
| | **Visual Feed Manager**| REST APIs (`/api/sources`) to add, toggle, or delete feeds with hot reloading |

---

## 📲 Supported Delivery Channels

1. **WhatsApp**: Personal DMs, Groups, and Channels via WhatsApp Web (`whatsapp-web.js`).
2. **Telegram**: Channels, Groups, DMs with inline reading buttons and native Voice Notes (`telegram-sender.js`).
3. **Discord**: Rich Embeds via Webhooks with severity color coding (`discord-sender.js`).
4. **Google Chat Space**: Rich Cards v2 delivered directly to Google Chat Spaces (`google-chat-sender.js`).
5. **Slack**: Rich Block Kit sections with interactive buttons (`slack-sender.js`).
6. **Microsoft Teams**: Adaptive Cards formatted for SOC channels (`teams-sender.js`).
7. **HTML Email Newsletters**: Responsive dark-themed HTML emails via SendGrid/Resend/SMTP (`email-sender.js`).
8. **Mobile Push Notifications**: Instant phone/smartwatch push via Pushover and Ntfy.sh (`push-sender.js`).
9. **Outbound Webhooks**: Structured JSON threat payload exports for SOAR/SIEM (n8n, Zapier, Splunk, Shuffle) (`webhook-sender.js`).

---

## 🚀 Quick Start

### Prerequisites
- **Node.js 22+ (LTS)** → [nodejs.org](https://nodejs.org) *(required for built-in `node:sqlite` database & native test runner)*
- **npm 10+** → Bundled automatically with Node.js 22+
- **Google Chrome** → [google.com/chrome](https://google.com/chrome) *(WhatsApp only)*

### 3-Step Installation
```bash
# 1. Clone repository
git clone https://github.com/cyberlog69/news-feeder-bot.git
cd news-feeder-bot

# 2. Install dependencies
npm install

# 3. Configure & Run
cp .env.example .env
npm start
```

---

## 🧠 RAG & Conversational AI (`Ask Your News`)

Ask natural language questions about recent cybersecurity incidents and news directly via chat:
```text
/ask What ransomware attacks occurred this week?
/ask Tell me about CVE-2024-30078
/ask What supply chain vulnerabilities were patched?
```

### How RAG Works
1. **Vector Indexing**: Every delivered news article is tokenized and stored as a term-frequency vector in SQLite (`article_vectors` table in `data/newsbot.sqlite`).
2. **Cosine Similarity Search**: Natural language questions are converted into vectors and matched against stored article vectors.
3. **AI Synthesis**: Top matching context articles are retrieved and synthesized into an answer with citations using your active AI provider (Groq, Gemini, OpenRouter, Ollama).
4. **Extractive Fallback**: If AI API keys are not set, an extractive answer citing matching articles is generated automatically.

---

## 🛡️ Deep Threat Intelligence

Security news articles are automatically analyzed by `src/threat-intel.js` and enriched with:
- **CVE & CVSS v3 Scores**: Extracted and queried via FIRST.org / CIRCL APIs with SQLite caching.
- **EPSS Scores**: Percentile exploit likelihood prediction score.
- **IOC Parsing**: IPv4 addresses, SHA-256/MD5 hashes, and defanged domains (`1.1.1[.]1`, `example[.]com`).
- **MITRE ATT&CK Mapping**: Maps threat actor tactics (e.g. `T1059 Command and Scripting Interpreter`, `T1486 Data Encrypted for Impact`).

---

## 🌍 Multi-Language & Internationalization

Translate news summaries on the fly per delivery channel:
```env
TELEGRAM_LANGUAGE=es
DISCORD_LANGUAGE=de
SLACK_LANGUAGE=fr
WHATSAPP_LANGUAGE=hi
DEFAULT_LANGUAGE=en
```

- Supports **13+ ISO language codes** (`en`, `es`, `de`, `fr`, `hi`, `ja`, `pt`, `zh`, `ru`, `it`, `nl`, `tr`, `pl`).
- SQLite translation caching (`translation_cache` table) prevents redundant API calls.

---

## 🔊 Audio & Multimedia Delivery

- **🎙️ TTS Voice Summary Engine** (`src/audio-generator.js`): Formats spoken narrative scripts and generates `.mp3` audio files in `data/audio/`.
- **📲 Telegram Native Voice Notes** (`src/telegram-sender.js`): Delivers audio summaries as native playable Telegram Voice Notes directly in chats.
- **🖼️ SVG Visual Alert Cards** (`src/card-generator.js`): Dynamically renders SVG social alert graphics in `data/cards/` for `🚨 CRITICAL ALERT` articles.

---

## ⚙️ Configuration Reference

### Environment Variables (`.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `SUMMARIZER_PROVIDER` | No | `groq` | Choose: `groq`, `gemini`, `openrouter`, `huggingface`, `ollama`, `extractive` |
| `GROQ_API_KEY` | Optional | — | Free API key from [console.groq.com](https://console.groq.com) |
| `GEMINI_API_KEY` | Optional | — | Free API key from [aistudio.google.com](https://aistudio.google.com) |
| `OPENROUTER_API_KEY` | Optional | — | API key from [openrouter.ai](https://openrouter.ai) |
| `WHATSAPP_TARGET` | Optional | — | Phone number, group ID, or group name |
| `TELEGRAM_BOT_TOKEN` | Optional | — | Telegram Bot API token from `@BotFather` |
| `TELEGRAM_TARGET` | Optional | — | Channel handle (`@mychannel`) or Chat ID |
| `DISCORD_WEBHOOK_URL` | Optional | — | Discord channel webhook URL |
| `GOOGLE_CHAT_WEBHOOK_URL` | Optional | — | Google Chat Space Webhook Cards v2 URL |
| `SLACK_WEBHOOK_URL` | Optional | — | Slack incoming webhook URL |
| `TEAMS_WEBHOOK_URL` | Optional | — | Microsoft Teams incoming webhook URL |
| `EMAIL_TO` | Optional | — | Recipient email address for HTML newsletters |
| `EMAIL_FROM` | Optional | — | Sender email address (`newsbot@example.com`) |
| `EMAIL_API_KEY` | Optional | — | SendGrid or Resend API key |
| `NTFY_TOPIC_URL` | Optional | — | Ntfy.sh topic URL (`https://ntfy.sh/my_topic`) |
| `PUSHOVER_USER_KEY` | Optional | — | Pushover user key |
| `PUSHOVER_API_TOKEN` | Optional | — | Pushover application token |
| `OUTBOUND_WEBHOOK_URL` | Optional | — | Outbound HTTP webhook endpoint for SOAR/SIEM |
| `ENABLE_AUDIO_SUMMARY` | Optional | `false` | Set to `true` to enable TTS voice summaries for all news |
| `DEFAULT_LANGUAGE` | Optional | `en` | Default output language code (`en`, `es`, `de`, `fr`, etc.) |
| `DASHBOARD_TOKEN` | Optional | — | Secret token to secure `/trigger` and administrative APIs |
| `PORT` | Optional | `3000` | HTTP port for Web Dashboard and health check |

---

## 🤖 Bot Commands

Interactive commands supported across WhatsApp, Telegram, Discord, and Web Dashboard:

| Command | Usage | Description |
|---|---|---|
| `/status` | `/status` | View bot uptime, total delivered articles, active sources, and AI provider status |
| `/sources` | `/sources` | List all active RSS news feeds and their categories |
| `/search` | `/search <keyword>` | Search recent indexed articles by keyword (e.g. `/search ransomware`) |
| `/ask` | `/ask <question>` | Ask AI conversational questions about your news database (RAG) |
| `/help` | `/help` | Display command reference guide |

---

## 🎛️ Web Dashboard & Administrative APIs

The Web Dashboard listens on `http://localhost:3000`:

### Endpoints
- `GET /` — Full HTML Web Dashboard with tabbed navigation (`Overview`, `Feed Health`, `Rules & Filters`).
- `GET /health` — JSON Health Check for cloud platforms (`{"status": "ok", "uptime": 120}`).
- `GET /metrics` — System metrics and Prometheus format (`/metrics?format=prometheus`).
- `GET /events` — Server-Sent Events (SSE) live log stream.
- `POST /trigger` — Trigger manual pipeline cycle.
- `GET /api/feed-health` — Real-time RSS Feed Health Index matrix.
- `GET /api/sources` — Active sources list enriched with latency and error metrics.
- `POST /api/sources/toggle` — Toggle source on/off in `config.json` with hot reloading.
- `POST /api/sources/add` — Add a new RSS feed URL.
- `POST /api/sources/delete` — Delete an existing RSS feed.

---

## 📋 Platform Setup Guides

### 1. WhatsApp
1. Set `WHATSAPP_TARGET` in `.env` (phone number or group name/ID).
2. Run `npm start` and scan the QR code in the terminal.
3. Run `npm run list-groups` to find WhatsApp group IDs.

### 2. Telegram
1. Message `@BotFather` on Telegram → `/newbot` → Copy API Token into `TELEGRAM_BOT_TOKEN`.
2. Add bot to group/channel and set `TELEGRAM_TARGET` (e.g. `@mychannel` or chat ID).
3. Run `npm run list-telegram-chats` to find group/channel IDs.

### 3. Discord
1. Channel Settings → Integrations → Webhooks → New Webhook → Copy URL into `DISCORD_WEBHOOK_URL`.

### 4. Google Chat Space
1. Space Menu → Apps & Integrations → Webhooks → Add Webhook → Copy URL into `GOOGLE_CHAT_WEBHOOK_URL`.

### 5. Slack
1. Slack App → Incoming Webhooks → Activate → Add New Webhook → Copy URL into `SLACK_WEBHOOK_URL`.

### 6. Microsoft Teams
1. Teams Channel → Connectors / Workflows → Incoming Webhook → Copy URL into `TEAMS_WEBHOOK_URL`.

### 7. HTML Email Newsletters
1. Set `EMAIL_TO`, `EMAIL_FROM`, `EMAIL_API_KEY`, and `EMAIL_PROVIDER=sendgrid` in `.env`.

### 8. Mobile Push Notifications
1. **Ntfy.sh**: Set `NTFY_TOPIC_URL=https://ntfy.sh/your_topic_name`.
2. **Pushover**: Set `PUSHOVER_USER_KEY` and `PUSHOVER_API_TOKEN`.

### 9. Outbound Webhooks (SOAR/SIEM)
1. Set `OUTBOUND_WEBHOOK_URL` to your n8n, Zapier, Splunk, or Shuffle endpoint.

---

## 🌐 Deployment Guides

### Option 1: Docker & Docker Compose (Recommended)
```bash
# Build & launch in detached mode
docker-compose up -d --build

# View live logs & QR code
docker-compose logs -f
```

### Option 2: Cloud Deployment (Railway / Render / Fly.io)
1. Push repository to GitHub.
2. Create service on Railway/Render/Fly.io.
3. Set environment variables (`NODE_ENV=production`, `PORT`, `GROQ_API_KEY`, `DASHBOARD_TOKEN`).
4. Health check endpoint `/health` is monitored automatically.

### Option 3: Linux VPS (Ubuntu/Debian Systemd Service)
```bash
# 1. Install Node.js 22 LTS & Chromium
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs chromium-browser

# 2. Systemd service setup
sudo nano /etc/systemd/system/news-feeder-bot.service
```

```ini
[Unit]
Description=News Feeder Bot Service
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/news-feeder-bot
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable news-feeder-bot
sudo systemctl start news-feeder-bot
```

---

## 💻 npm Commands

```bash
npm start                # Launch News Feeder Bot
npm test                 # Run native unit test suite (--test-concurrency=1)
npm run add-source       # Interactively add RSS source feed
npm run list-groups      # Discover WhatsApp group IDs
npm run list-telegram-chats # Discover Telegram chat IDs
npm run docker:up        # Start Docker Compose container
npm run docker:down      # Stop Docker Compose container
npm run docker:logs      # View Docker container logs
npm run audit            # Run npm vulnerability audit
```

---

## 🧪 Automated Testing

Run the Node.js native test suite:
```bash
npm test
```

### Test Suite Breakdown (34/34 Passed)
- `test/audio-media.test.js` — TTS script formatting & SVG alert card generation
- `test/channels.test.js` — HTML email template builder, Pushover/Ntfy push, Webhooks
- `test/command.test.js` — `/status`, `/sources`, `/search`, `/ask` command handlers
- `test/dashboard.test.js` — Feed health tracking & Web Dashboard administrative APIs
- `test/db.test.js` — SQLite database transactions & cache operations
- `test/formatter.test.js` — Telegram HTML & WhatsApp formatters
- `test/google-chat.test.js` — Google Chat Cards v2 webhook syntax validator
- `test/rag.test.js` — TF-IDF vectorization, Cosine Similarity, and RAG answer synthesis
- `test/scorer.test.js` — Article scoring & threshold evaluation
- `test/security.test.js` — SSRF URL validator (`isSafeUrl`)
- `test/summarizer.test.js` — Multi-provider AI summarization cascade
- `test/threat-intel.test.js` — CVE, EPSS, IOC, and MITRE ATT&CK technique extraction
- `test/translator.test.js` — Multi-language translation engine & cache

---

## 🔒 Security

- **0 npm audit vulnerabilities**
- **SSRF Prevention**: Internal IP blocking (`127.0.0.1`, `169.254.169.254`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`)
- **Sanitized Input**: Control character stripping and HTML escaping across all senders

---

## ❓ Troubleshooting

| Issue | Cause | Solution |
|---|---|---|
| `database is locked` | SQLite concurrent access | Tests are pre-configured with `--test-concurrency=1` in `package.json` |
| `GROQ_API_KEY not set` | Missing AI provider key | Get free key at [console.groq.com](https://console.groq.com) or set `SUMMARIZER_PROVIDER=extractive` |
| `Puppeteer Chrome Error` | Chrome path missing on VPS | Install Chromium (`apt install chromium-browser`) and set `CHROME_PATH=/usr/bin/chromium` |
| `EADDRINUSE: port 3000` | Port in use | Change `PORT` in `.env` or kill existing process |

---

## 📄 License
[MIT License](LICENSE) © 2026 CyberLog
