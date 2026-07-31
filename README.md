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
- [Platform Setup Guides](#-platform-setup-guides)
- [Web Dashboard & Admin Manager](#-web-dashboard--admin-manager)
- [Automated Unit Testing](#-automated-testing)
- [Security](#-security)

---

## 🆕 What's New in v3.7

| Module | Details |
|---|---|
| 🧠 **RAG & Conversational AI (`/ask`)** | Ask natural language questions via `/ask <question>`. Searches historical news in SQLite using term-frequency vector embeddings and Cosine Similarity, generating cited AI responses. |
| 🛡️ **Deep Threat Intelligence** | Auto-enriches security news with CVE details, FIRST.org EPSS exploit probabilities, IOC extraction (IPs, hashes, defanged domains), and MITRE ATT&CK mapping. |
| 🌍 **Multi-Language Translation** | Translate news summaries on the fly per platform (`TELEGRAM_LANGUAGE=es`, `DISCORD_LANGUAGE=de`). Supports 13+ languages with SQLite translation caching. |
| 🔊 **Audio & Multimedia** | Text-to-Speech narrative summaries, native **Telegram Voice Notes**, and dynamic SVG visual alert cards for critical zero-day news. |
| 📧 **9 Delivery Channels** | WhatsApp, Telegram, Discord, Google Chat, Slack, MS Teams, HTML Email Newsletters, Mobile Push (Pushover/Ntfy.sh), and Outbound SOAR/SIEM Webhooks. |
| 🎛️ **Feed Health & Admin UI** | RSS Feed Health Index tracking latency (ms), HTTP status, and error counts. Visual Feed Manager REST APIs (`/api/sources`) to add/toggle feeds without manual config edits. |
| 🧪 **34/34 Unit Tests** | Automated Node.js native test suite (`npm test`) covering security, RAG, formatters, and administrative APIs with 100% pass rate. |

---

## ✨ Features

| Category | Feature | Description |
|---|---|---|
| 🤖 **AI & RAG** | **Conversational RAG** | Ask questions (`/ask`) over historical news using vector retrieval & AI synthesis |
| | **Multi-Provider AI** | Auto-cascading AI support (`Groq` → `Gemini` → `OpenRouter` → `HuggingFace` → `Ollama`) |
| 🛡️ **Security** | **Threat Intel Engine** | CVE, EPSS exploit probability, IOC parsing (IPs/hashes), MITRE ATT&CK mapping |
| 🔊 **Media** | **TTS Voice Summaries** | Formats spoken narrative scripts and generates `.mp3` audio files |
| | **Telegram Voice Notes** | Dispatches playable voice summaries directly to Telegram chats |
| | **SVG Alert Cards** | Generates visual social alert graphics for `🚨 CRITICAL ALERT` articles |
| 🌍 **Localization**| **Multi-Language Routing**| Translate news summaries per platform (`en`, `es`, `de`, `fr`, `hi`, `ja`, etc.) |
| 📱 **Delivery** | **9 Platforms** | WhatsApp, Telegram, Discord, Google Chat, Slack, MS Teams, Email, Push, Webhook |
| 🗄️ **Storage** | **Native SQLite** | Crash-proof SQLite storage (`data/newsbot.sqlite`) for cache and vector storage |
| 📊 **Admin** | **Feed Health Matrix** | Live monitoring of response latency, HTTP status, and error counts per RSS feed |
| | **Visual Feed Manager**| REST APIs (`/api/sources`) to add, toggle, or delete feeds with hot reloading |

---

## 📲 Supported Delivery Channels

1. **WhatsApp**: Personal DMs, Groups, and Channels via WhatsApp Web.
2. **Telegram**: Channels, Groups, DMs with inline reading buttons and native Voice Notes.
3. **Discord**: Rich Embeds via Webhooks with severity color coding.
4. **Google Chat Space**: Rich Cards v2 delivered directly to Google Chat Spaces.
5. **Slack**: Rich Block Kit sections with interactive buttons.
6. **Microsoft Teams**: Adaptive Cards formatted for SOC channels.
7. **HTML Email Newsletters**: Responsive dark-themed HTML emails via SendGrid/Resend/SMTP.
8. **Mobile Push Notifications**: Instant phone/smartwatch push via Pushover and Ntfy.sh.
9. **Outbound Webhooks**: Structured JSON threat payload exports for SOAR/SIEM (n8n, Zapier, Splunk, Shuffle).

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
- **CVE & CVSS v3 Scores**: Extracted and queried via FIRST.org / CIRCL APIs.
- **EPSS Scores**: Percentile exploit likelihood prediction score.
- **IOC Parsing**: IPv4 addresses, SHA-256/MD5 hashes, and defanged domains.
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

### Key Capabilities
- Supports **13+ ISO language codes** (`en`, `es`, `de`, `fr`, `hi`, `ja`, `pt`, `zh`, `ru`, `it`, `nl`, `tr`, `pl`).
- SQLite translation caching (`translation_cache` table) prevents redundant API calls.
- AI translation engine uses active AI provider or free REST fallback.

---

## 🔊 Audio & Multimedia Delivery

- **🎙️ TTS Voice Summary Engine** (`src/audio-generator.js`): Formats spoken narrative scripts and generates `.mp3` audio files in `data/audio/`.
- **📲 Telegram Native Voice Notes** (`src/telegram-sender.js`): Delivers audio summaries as native playable Telegram Voice Notes directly in chats.
- **🖼️ SVG Visual Alert Cards** (`src/card-generator.js`): Dynamically renders SVG social alert graphics in `data/cards/` for `🚨 CRITICAL ALERT` articles.

---

## 📋 Platform Setup Guides

### 1. WhatsApp
1. Set `WHATSAPP_TARGET` in `.env` (phone number or group name/ID).
2. Run `npm start` and scan the QR code in the terminal.

### 2. Telegram
1. Message `@BotFather` on Telegram → `/newbot` → Copy API Token into `TELEGRAM_BOT_TOKEN`.
2. Add bot to group/channel and set `TELEGRAM_TARGET` (e.g. `@mychannel` or chat ID).

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

## 🎛️ Web Dashboard & Admin Manager

The built-in Web Dashboard listens on `process.env.PORT` or `3000` (`http://localhost:3000`):

- **📊 Live Stats & Log Stream (SSE)**: View delivery statistics, recent articles, and real-time log output via Server-Sent Events (`/events`).
- **📡 Feed Health Index**: Monitor RSS feed latency (ms), HTTP status codes, and error counts via `GET /api/feed-health`.
- **🎛️ Visual Feed Manager**: Add, toggle, or delete RSS sources directly via REST APIs (`GET /api/sources`, `POST /api/sources/add`, `POST /api/sources/toggle`, `POST /api/sources/delete`).
- **📈 Prometheus Metrics**: Ingest metrics into Grafana/Datadog via `GET /metrics?format=prometheus`.
- **🔒 Dashboard Security**: Protect manual triggers and administrative APIs by setting `DASHBOARD_TOKEN`.

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

## 📄 License
[MIT License](LICENSE) © 2026 CyberLog
