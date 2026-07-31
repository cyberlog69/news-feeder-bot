<div align="center">

# 📰 News Feeder Bot v3.7

### Automated cybersecurity & tech news intelligence — delivered across 9 platforms
#### Threat Intel (CVE/EPSS/IOC/MITRE) · Multi-Language Translation · TTS Voice Summaries · RAG Conversational AI (`/ask`) · RSS Feed Health · 0 Vulnerabilities

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
- [Delivery Channels](#-supported-delivery-channels)
- [Quick Start](#-quick-start)
- [RAG & Conversational AI (`/ask`)](#-rag--conversational-ai-ask-your-news)
- [Threat Intelligence & Enrichment](#-deep-threat-intelligence)
- [Multi-Language Translation](#-multi-language--internationalization)
- [Audio & Multimedia Delivery](#-audio--multimedia-delivery)
- [Platform Setup Guides](#-platform-setup-guides)
- [Web Dashboard & Admin Manager](#-web-dashboard--admin-manager)
- [Automated Unit Testing](#-automated-testing)
- [Security](#-security)

---

## 🆕 What's New in v3.7

| Module | Feature Details |
|---|---|
| 🧠 **RAG & Conversational AI** | Ask natural language questions via `/ask <question>`. Searches historical news in SQLite using term-frequency vector embeddings and Cosine Similarity, generating cited AI responses. |
| 🛡️ **Threat Intelligence** | Auto-enriches security news with CVE details, FIRST.org EPSS exploit probabilities, IOC extraction (IPs, hashes, defanged domains), and MITRE ATT&CK mapping. |
| 🌍 **Multi-Language Routing** | Translate news summaries on the fly per platform (`TELEGRAM_LANGUAGE=es`, `DISCORD_LANGUAGE=de`). Supports 13+ languages with SQLite translation caching. |
| 🔊 **Audio & Multimedia** | Text-to-Speech narrative summaries, native **Telegram Voice Notes**, and dynamic SVG visual alert cards for critical zero-day news. |
| 📧 **9 Delivery Channels** | WhatsApp, Telegram, Discord, Google Chat, Slack, MS Teams, HTML Email Newsletters, Mobile Push (Pushover/Ntfy.sh), and Outbound SOAR/SIEM Webhooks. |
| 🎛️ **Feed Health & Admin UI** | RSS Feed Health Index tracking latency (ms), HTTP status, and error counts. Visual Feed Manager REST APIs (`/api/sources`) to add/toggle feeds without manual config edits. |
| 🧪 **34/34 Unit Tests** | Automated Node.js native test suite (`npm test`) with 100% pass rate. |

---

## ✨ Features

| Feature | Description |
|---|---|
| 🧠 **RAG & Conversational AI** | Query historical news database via `/ask` command across all messaging channels |
| 🛡️ **Threat Intelligence** | CVE, EPSS exploit likelihood, IOCs (IPs/Hashes), and MITRE ATT&CK technique IDs |
| 🌍 **Multi-Language Support** | Instant per-platform translation for 13+ ISO language codes |
| 🎙️ **TTS Voice Summaries** | Text-to-Speech narration delivered as native Telegram Voice Notes |
| 🖼️ **SVG Visual Alert Cards** | Dynamically rendered social alert cards for `🚨 CRITICAL ALERT` news |
| 📱 **9 Delivery Channels** | WhatsApp, Telegram, Discord, Google Chat, Slack, MS Teams, Email, Push, Webhook |
| 🤖 **Multi-Provider AI** | Groq, Gemini, OpenRouter, HuggingFace, Ollama, or Extractive fallback |
| 🗄️ **Native SQLite Storage** | `data/newsbot.sqlite` for article deduplication, threat intel cache, and vector RAG |
| 📊 **Feed Health Matrix** | Real-time monitoring of response latency, HTTP status, and error counts |
| 🎯 **Keyword Filtering** | Include or exclude articles by keywords (e.g. `ransomware`, `CVE`) |
| 🚨 **Severity Alerts** | Auto `🚨 CRITICAL ALERT` badge for zero-days, RCE, and active exploits |
| 🔒 **Security Hardened** | SSRF protection, prompt injection prevention, 0 npm audit vulnerabilities |

---

## 📲 Supported Delivery Channels

1. **WhatsApp**: Personal DMs, Groups, and Channels.
2. **Telegram**: Channels, Groups, DMs with inline buttons and native Voice Notes.
3. **Discord**: Rich Embeds via Webhooks with severity color coding.
4. **Google Chat Space**: Rich Cards v2 delivered to Google Chat Spaces.
5. **Slack**: Rich Block Kit sections with interactive buttons.
6. **Microsoft Teams**: Adaptive Cards formatted for SOC channels.
7. **HTML Email Newsletters**: Responsive dark-themed HTML emails via SendGrid/Resend/SMTP.
8. **Mobile Push Notifications**: Instant phone/smartwatch push via Pushover and Ntfy.sh.
9. **Outbound Webhooks**: Structured JSON threat payload exports for SOAR/SIEM (n8n, Zapier, Splunk, Shuffle).

---

## 🚀 Quick Start

### Prerequisites
- **Node.js 22+ (LTS)** → [nodejs.org](https://nodejs.org) *(required for `node:sqlite` database & native test runner)*
- **npm 10+** → Bundled automatically with Node.js 22+
- **Google Chrome** → [google.com/chrome](https://google.com/chrome) *(WhatsApp only)*

### 3-Step Setup
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

Ask questions about recent cybersecurity incidents and news directly in chat:
```text
/ask What ransomware attacks occurred this week?
/ask Tell me about CVE-2024-30078
/ask What supply chain vulnerabilities were patched?
```
The bot searches SQLite vector storage using term-frequency cosine similarity and synthesizes a cited response linking directly to source articles.

---

## 🛡️ Deep Threat Intelligence

Security news articles are automatically analyzed and enriched with:
- **CVE & CVSS v3 Scores**: Extracted and queried via FIRST.org / CIRCL APIs.
- **EPSS Scores**: Percentile exploit likelihood prediction score.
- **IOC Parsing**: IPv4 addresses, SHA-256/MD5 hashes, and defanged domains.
- **MITRE ATT&CK Mapping**: Maps threat actor tactics (e.g. `T1059 Command and Scripting Interpreter`, `T1486 Data Encrypted for Impact`).

---

## 🧪 Automated Testing

Run the native test suite covering all modules:
```bash
npm test
```
**34/34 passing test cases** covering threat intel, RAG vector retrieval, translation caching, formatters, and administrative APIs.

---

## 🔒 Security

- **0 npm audit vulnerabilities**
- **SSRF Protection**: Internal IP blocking (`127.0.0.1`, `169.254.169.254`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`)
- **Sanitized Input**: Control character stripping and HTML escaping across all senders

---

## 📄 License
[MIT License](LICENSE) © 2026 CyberLog
