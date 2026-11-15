<div align="center">

# 📰 News Feeder Bot v3.18.0

### Autonomous Cybersecurity & Tech Intelligence Platform — Delivered Across 9 Platforms
#### Threat Intel (CVE/EPSS/IOC/MITRE) · Sigma/YARA & Sentinel KQL · STIX/TAXII 2.1 · TTS Cyber Podcast · 3D Threat Globe · 0 Audit Vulnerabilities

[![CI](https://github.com/cyberlog69/news-feeder-bot/actions/workflows/ci.yml/badge.svg)](https://github.com/cyberlog69/news-feeder-bot/actions)
[![Security](https://img.shields.io/badge/npm%20audit-0%20vulnerabilities-brightgreen)](https://npmjs.com)
[![Node](https://img.shields.io/badge/node-%3E%3D22.13.0-blue)](https://nodejs.org)
[![Docker](https://img.shields.io/badge/docker-ready-2496ED?logo=docker&logoColor=white)](https://hub.docker.com)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

</div>

---

## 📌 Table of Contents

- [What's New in v3.18.0](#-whats-new-in-v3180)
- [Features](#-features)
- [Supported Delivery Channels](#-supported-delivery-channels)
- [Quick Start](#-quick-start)
- [SIEM & SOAR Rule Transpiler & Push API](#-siem--soar-rule-transpiler)
- [STIX 2.1 & TAXII 2.1 Threat Sharing](#-stix-21--taxii-21-threat-sharing)
- [Daily Cyber Threat Podcast & Audio Stream](#-daily-cyber-threat-podcast--rss-feed)
- [Granular Source Reputation & Adaptive Scorer](#-granular-source-reputation)
- [AI Sigma & YARA Detection Rule Generator](#-ai-sigma--yara-rule-generator)
- [Real-Time Exploit PoC Radar](#-real-time-exploit-poc-radar)
- [Organization Tech Stack Watchlist](#-organization-tech-stack-watchlist)
- [Interactive Threat Intel Commands](#-interactive-threat-intel-commands)
- [3D Interactive Cyber Threat Globe & Radar](#-3d-interactive-cyber-threat-globe--radar)
- [RAG & Conversational AI (`/ask`)](#-rag--conversational-ai-ask-your-news)
- [Deep Threat Intelligence](#-deep-threat-intelligence)
- [Bot Commands Reference](#-bot-commands)
- [Web Dashboard & Administrative APIs](#-web-dashboard--administrative-apis)
- [Automated Unit Testing](#-automated-testing)
- [Security](#-security)

---

## 🆕 What's New in v3.18.0

| Module | Details |
|---|---|
| 🔐 **Dashboard Login & RBAC** | Token login issues a short-lived HMAC-signed `HttpOnly`, `SameSite=Strict` cookie. `/` and every `/api/*` route are protected in production (public exceptions: podcast, STIX/MISP, syndication feeds, TAXII, `/health`). Admin/analyst/auditor roles are enforced. |
| 🧩 **Modular Dashboard** | Templates, auth, HTTP helpers, sessions, and six route groups were extracted. `src/web-dashboard.js` dropped from ~2,360 lines to ~416 lines. |
| 💾 **Persistent Runtime State** | The digest buffer and Telegram `getUpdates` offset are stored in SQLite, so restarts no longer lose buffered digests or replay old commands. |
| 🛡️ **SSRF Hardening** | RSS **and** full-text article fetches follow redirects manually and re-validate every hop. Article HTML is fetched safely and passed to `extractFromHtml()`, so the extractor performs no network I/O. |
| 🎙️ **Pluggable TTS** | `TTS_PROVIDER=google\|openai\|elevenlabs\|none`. Audio is generated only when real speech synthesis succeeds; otherwise the podcast/voice note is explicitly text-only. |
| 🧪 **109/109 Passing Unit Tests** | Offline-by-default test suite covering login/session, RBAC, SSRF, persistence, commands, subscriptions, SIEM/STIX, podcast handling, and dashboard routes. CI runs it before deploy. |

---

## ✨ Features

| Category | Feature | Description |
|---|---|---|
| 🛡️ **Security** | **RBAC & Rate Limiter** | Constant-time token auth, tiered roles & IP sliding-window DoS protection |
| | **SIEM Audit Logging** | Standardized ArcSight CEF and Elastic ECS audit logging (`/api/audit-log`) |
| | **DB Maintenance** | Automated timestamped backups (`data/backups/`), WAL checkpoint & VACUUM |
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
| | **SVG Alert Cards** | Opt-in visual alert graphics for `🚨 CRITICAL ALERT` articles, served at `/cards/<file>` |
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
- **Node.js 22.13+ (LTS)** → [nodejs.org](https://nodejs.org) *(built-in `node:sqlite` is only unflagged from 22.13.0 onward)*
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

## 🧪 AI Summarizer & Live Diagnostics (`npm run test-ai`)

Test all your configured LLM API keys and model availability in real time:

```bash
npm run test-ai
```

### 🏆 Top 6 Supported Free AI Providers
1. 🥇 **Groq Cloud** (`GROQ_API_KEY`) — 14,400 free requests/day (~300ms ultra-fast LPU inference).
2. 🥈 **Google Gemini** (`GEMINI_API_KEY`) — 1,500 free requests/day (Native REST, zero dependencies).
3. 🥉 **Cerebras Cloud** (`CEREBRAS_API_KEY`) — 1,000,000 free tokens/day (2,000+ tokens/sec, world's fastest AI chip).
4. 4️⃣ **Mistral AI** (`MISTRAL_API_KEY`) — Free experimentation tier (Premier European models).
5. 5️⃣ **Cohere** (`COHERE_API_KEY`) — 1,000 free calls/month (Purpose-built text summarization).
6. 6️⃣ **Cloudflare Workers AI** (`CLOUDFLARE_API_TOKEN`) — 10,000 free neurons/day on global edge network.
* Plus: **OpenRouter**, **Ollama** (100% offline & unlimited), and **Extractive** (zero-API fallback).

### What It Tests:
- 🔑 **API Key Validation**: Verifies detected keys across all configured providers.
- 🤖 **Dynamic Model Discovery**: Queries live `/models` endpoints in real time to discover active production models.
- ⚡ **Latency Benchmark**: Measures live LLM inference execution time in milliseconds.
- 📝 **Natural Executive Summary**: Validates clean, human-readable 3-bullet output with chain-of-thought `<think>` tags and planning artifacts automatically stripped.

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
- **🖼️ SVG Visual Alert Cards** (`src/card-generator.js`): Opt-in (`ENABLE_ALERT_CARDS=true` or `settings.enableAlertCards`) SVG graphics for `🚨 CRITICAL ALERT` articles, served at `/cards/<file>`. Set `PUBLIC_BASE_URL` to link them from Telegram/WhatsApp.

---

## ⚙️ Configuration Reference

### Environment Variables (`.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `SUMMARIZER_PROVIDER` | No | `groq` | Choose: `groq`, `gemini`, `cerebras`, `mistral`, `cohere`, `cloudflare`, `openrouter`, `huggingface`, `ollama`, `extractive` |
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
| `TTS_PROVIDER` | Optional | `google` | `google`, `openai`, `elevenlabs`, or `none` |
| `OPENAI_API_KEY` | Optional | — | Required for `TTS_PROVIDER=openai` |
| `ELEVENLABS_API_KEY` / `ELEVENLABS_VOICE_ID` | Optional | — | Required for `TTS_PROVIDER=elevenlabs` |
| `DEFAULT_LANGUAGE` | Optional | `en` | Default output language code (`en`, `es`, `de`, `fr`, etc.) |
| `DASHBOARD_TOKEN` | Optional | — | Legacy alias for the admin token; secures `/trigger` and admin APIs |
| `ADMIN_TOKEN` | Optional | — | Full-access token for administrative APIs |
| `ANALYST_TOKEN` | Optional | — | Analyst-level token (`/api/watchlist`, source management) |
| `AUDITOR_TOKEN` | Optional | — | Read-only token for `/api/audit-log` and `/api/subscriptions` |
| `SESSION_SECRET` | Optional | admin token | HMAC key for dashboard session cookies |
| `COMMAND_ADMIN_USERS` | Optional | — | Comma-separated chat user IDs allowed to run admin-only bot commands |
| `DEMO_MODE` | Optional | `false` | Enables sample/fixture threat data (never enable in production) |
| `EXPOSED_IP_SEEDS` | Optional | — | Comma-separated real IPv4 addresses to enrich during exposed-IP scans |
| `EXPOSED_IP_SEED_FILE` / `EXPOSED_IP_SEED_URL` | Optional | — | Local/remote CSV, JSON, or text feed of real IPv4 addresses |
| `PUBLIC_BASE_URL` | Optional | — | Public base URL used to link generated alert cards and public feeds |
| `TRUST_PROXY` | Optional | `false` | Use `X-Forwarded-For`/`X-Forwarded-Proto` when behind a reverse proxy |
| `PORT` | Optional | `3000` | HTTP port for Web Dashboard and health check |

---

## 🤖 Bot Commands

Interactive commands are long-polled/listened for on the **configured WhatsApp and Telegram target chats only** (other chats on the linked account are ignored). Set `COMMAND_ADMIN_USERS` to restrict `/ask`, `/briefing`, and watchlist mutations to specific user IDs.

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
- `GET /login` / `POST /login` / `GET /logout` — Signed HttpOnly cookie session for the console and read-only APIs.
- `GET /` — Full HTML Web Dashboard with tabbed navigation (`Overview`, `Feed Health`, `Rules & Filters`). Redirects to `/login` in production until authenticated.
- `GET /health` — JSON Health Check for cloud platforms (`{"status": "ok", "uptime": 120}`). Public.
- `GET /metrics` — System metrics and Prometheus format (`/metrics?format=prometheus`). Requires an auditor token or session.
- `GET /events` — Server-Sent Events (SSE) live log stream. Requires a token.
- `POST /trigger` — Trigger a manual pipeline cycle (admin token/session; fails closed in production).
- All other `/api/*` routes require a valid session or bearer token in production. Public exceptions: `/api/podcast/*`, `/api/stix/bundle`, `/api/misp/events`, plus the syndication feeds and TAXII endpoints.
- `GET /api/subscriptions` — List topic subscriptions (auditor token).
- `POST /api/subscriptions` / `DELETE /api/subscriptions` — Manage per-target topic filters (admin token).
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

> 📖 **Comprehensive Step-by-Step Guide**: For dedicated walkthroughs covering Oracle Cloud Always Free, GCP, Fly.io, Render, Railway, Hetzner, DigitalOcean, AWS, and Raspberry Pi, see [**`DEPLOYMENT.md`**](DEPLOYMENT.md).

### Quick Deployment Options:

* **Docker & Podman (Recommended)**:
  ```bash
  # Docker Compose
  docker compose up -d --build
  docker compose logs -f

  # Podman Compose
  podman-compose up -d --build
  podman-compose logs -f
  ```
* **Production VPS (PM2 Background Daemon)**:
  ```bash
  npm run pm2:start
  npm run pm2:logs
  ```
* **Cloud PaaS (Fly.io / Railway / Render)**:
  Auto-detects included `Dockerfile`. Set `/app/data` volume mount for SQLite persistence.

---

## 💻 npm Commands

```bash
npm start                # Launch News Feeder Bot
npm test                 # Run native unit test suite (--test-concurrency=1)
npm run test-ai          # Live AI summarizer and LLM model diagnostic suite
npm run add-source       # Interactively add RSS source feed
npm run list-groups      # Discover WhatsApp group IDs
npm run list-telegram-chats # Discover Telegram chat IDs
npm run docker:up        # Start Docker Compose container
npm run docker:down      # Stop Docker Compose container
npm run docker:logs      # View Docker container logs
npm run podman:up        # Start Podman Compose container
npm run podman:down      # Stop Podman Compose container
npm run podman:logs      # View Podman container logs
npm run audit            # Run npm vulnerability audit
```

---

## 🧪 Automated Testing

Run the Node.js native test suite:
```bash
npm test
```

### Test Suite Breakdown (109/109 Passed)
- `test/phase1-enterprise.test.js` — SIEM KQL/SPL push, STIX/TAXII 2.1 threat sharing, TTS podcast audio handling, and source reputation
- `test/enterprise-security.test.js` — RBAC token validation, sliding-window rate limiting, CEF/ECS audit logging & DB maintenance
- `test/social-broadcast.test.js` — Mastodon/Bluesky broadcasters and public RSS/Atom/JSON feed generators
- `test/ciso-briefing.test.js` — Executive CISO threat briefing generator (Markdown & print/PDF HTML)
- `test/soc-dashboard.test.js` — SOC glassmorphism dashboard REST APIs (`/api/threat-intel`, `/api/subscriptions`, `/api/system-status`)
- `test/subscriptions.test.js` — Per-user & channel topic subscriptions engine (`/subscribe`)
- `test/clustering.test.js` — Cosine similarity story clustering and Master Bulletin fusion
- `test/cisa-ransomware.test.js` — CISA KEV catalog sync & dark web ransomware leak tracker
- `test/audio-media.test.js` — TTS script formatting & SVG alert card generation
- `test/channels.test.js` — HTML email template builder, Pushover/Ntfy push, Webhooks
- `test/command.test.js` — `/status`, `/sources`, `/search`, `/ask` command handlers
- `test/dashboard.test.js` — Feed health tracking, Web Dashboard APIs, and `/api/sources` pipeline-config integration
- `test/db.test.js` — SQLite database transactions & cache operations
- `test/formatter.test.js` — Telegram HTML & WhatsApp formatters
- `test/google-chat.test.js` — Google Chat Cards v2 webhook syntax validator
- `test/rag.test.js` — TF-IDF vectorization, Cosine Similarity, and RAG answer synthesis
- `test/scorer.test.js` — Article scoring & threshold evaluation
- `test/security.test.js` — SSRF URL validator and RBAC fail-closed behaviour
- `test/session.test.js` — signed dashboard session cookies (tamper/expiry)
- `test/login.test.js` — dashboard login flow and protected read-only APIs
- `test/summarizer.test.js` — Multi-provider AI summarization cascade
- `test/threat-intel.test.js` — CVE, EPSS, IOC, and MITRE ATT&CK technique extraction
- `test/translator.test.js` — Multi-language translation engine & cache

---

## 🔒 Security

- **0 npm audit vulnerabilities**
- **Dashboard login + fail-closed auth**: admins sign in with a token; the server issues a short-lived HMAC-signed `HttpOnly`, `SameSite=Strict` cookie. All `/api/*` routes (except the public podcast/STIX/MISP endpoints) and `/` require authentication in production. If no token is configured they return `401` / redirect to the login page instead of opening up.
- **Session secret**: set `SESSION_SECRET` to keep cookies valid across token rotation; otherwise the admin token is used as the signing key.
- **Fake-data guard**: sample IPs, PoCs, detection rules, and threat-map nodes are only generated when `DEMO_MODE=true`.
- **SSRF Prevention**: Internal IP blocking (`127.0.0.1`, `169.254.169.254`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, IPv6 loopback/ULA/link-local) including DNS-resolution checks at fetch time.
- **Sanitized Input**: Control character stripping and HTML escaping across all senders
- **Outbound webhooks** are authenticated with an HMAC-SHA256 `X-NewsBot-Signature` over the raw body; the shared secret is never transmitted.

---

## ⚠️ Known Limitations

- **Exposed-IP scanner is experimental.** Public aggregate feeds (GreyNoise metadata, Shadowserver tags) do not expose individual hosts, so the scanner only enriches existing rows or addresses supplied via `EXPOSED_IP_SEEDS`, `EXPOSED_IP_SEED_FILE`, or `EXPOSED_IP_SEED_URL`. It intentionally never fabricates IPs.
- **Full-text extraction** fetches HTML through the SSRF-safe redirect handler (`src/fetcher.js`) before handing it to `@extractus/article-extractor`, so the extractor no longer performs its own network I/O.
- **Persisted state**: the digest buffer and Telegram `getUpdates` offset are stored in SQLite and survive restarts. The deduplicator reloads its recent history from SQLite.
- **Tests run offline by default** (external `fetch` is blocked; local dashboard servers still work). Set `NEWSBOT_ALLOW_EXTERNAL_TESTS=true` to hit live APIs intentionally.
- **WhatsApp Web is unofficial**: account bans and session expiry are inherent risks of `whatsapp-web.js`.
- **TTS** defaults to an unofficial Google endpoint; set `TTS_PROVIDER=openai` or `elevenlabs` for a supported API. When TTS is unavailable or `TTS_PROVIDER=none`, episodes and voice summaries are published text-only with no audio enclosure.
- **Prometheus scraping** of `/metrics` now needs a bearer token or session cookie.
- **Read-only APIs are private in production**; if you want a public status page, expose only `/health` and the syndication feeds.

---

## ❓ Troubleshooting

| Issue | Cause | Solution |
|---|---|---|
| `database is locked` | SQLite concurrent access | Tests are pre-configured with `--test-concurrency=1` in `package.json` |
| Dashboard keeps redirecting to `/login` | No valid session and tokens are configured | Sign in with `ADMIN_TOKEN`/`ANALYST_TOKEN`, or send `Authorization: Bearer <token>` for API clients |
| `401` on `/metrics` in production | Metrics now require a token | Add `Authorization: Bearer $AUDITOR_TOKEN` to the Prometheus scrape config |
| `GROQ_API_KEY not set` | Missing AI provider key | Get free key at [console.groq.com](https://console.groq.com) or set `SUMMARIZER_PROVIDER=extractive` |
| `Puppeteer Chrome Error` | Chrome path missing on VPS | Install Chromium (`apt install chromium-browser`) and set `CHROME_PATH=/usr/bin/chromium` |
| `EADDRINUSE: port 3000` | Port in use | Change `PORT` in `.env` or kill existing process |

---

## 📄 License
[MIT License](LICENSE) © 2026 CyberLog
