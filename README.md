# WhatsApp & Telegram News Bot 📰🔐

> Automatically fetches the latest **cybersecurity & tech news** from 4 sources, summarizes each article with **Gemini AI**, and delivers it to **WhatsApp and/or Telegram** — the moment it's published.

---

## Features

- 🔐 **4 curated cybersecurity sources** — checked every 5 minutes
- 🤖 **Gemini AI summaries** — each article condensed into 3 bullet points
- 💬 **WhatsApp support** — send to a number, group, or channel
- 📢 **Telegram support** — send to a personal chat, group, or channel
- 🔀 **Both at once** — run WhatsApp + Telegram simultaneously
- 🔁 **Never duplicates** — each article is sent only once, across all platforms
- ➕ **Easy to extend** — add any RSS news site in seconds
- 🛡️ **Quota-safe** — built-in rate limiter, retry logic, and summary cache

---

## News Sources

| Source | Category |
|---|---|
| [Cyber Security News](https://cybersecuritynews.com/) | 🔐 Cybersecurity |
| [HackRead](https://hackread.com/) | 🕵️ Hacking & Security |
| [The Hacker News](https://thehackernews.com/) | 💻 Infosec |
| [BleepingComputer](https://www.bleepingcomputer.com/) | 🖥️ Security & Tech |

---

## Prerequisites

| Requirement | Notes |
|---|---|
| **Node.js 18+** | [nodejs.org](https://nodejs.org) — LTS version |
| **Google Chrome** | Already on most PCs — the bot uses your existing install |
| **Gemini API Key** | Free at [aistudio.google.com](https://aistudio.google.com/apikey) |
| **WhatsApp** *(optional)* | Any personal WhatsApp account |
| **Telegram Bot** *(optional)* | Create one free via [@BotFather](https://t.me/BotFather) |

> At least one platform (WhatsApp **or** Telegram) must be configured.

---

## Quick Start

```bash
git clone https://github.com/cyberlog69/whatsapp-news-bot.git
cd whatsapp-news-bot
npm install
npm approve-scripts puppeteer
Copy-Item .env.example .env   # then open .env and fill in your details
npm start
```

---

## Setup Guide

### Step 1 — Configure `.env`

Open `.env` and fill in whichever platforms you want:

```env
# ── WHATSAPP (optional) ───────────────────────────────
WHATSAPP_TARGET=919876543210          # phone number
# WHATSAPP_TARGET=My News Group       # group name
# WHATSAPP_TARGET=120363XXX@g.us      # group ID (most reliable)

# ── TELEGRAM (optional) ───────────────────────────────
TELEGRAM_BOT_TOKEN=123456789:ABCDef...
TELEGRAM_TARGET=@mychannel            # public channel
# TELEGRAM_TARGET=-1001234567890      # private channel / group ID
# TELEGRAM_TARGET=123456789           # personal chat ID

# ── AI SUMMARIZATION ──────────────────────────────────
GEMINI_API_KEY=AIzaSy...              # free at aistudio.google.com
```

You can enable **one or both** platforms — the bot handles it automatically.

---

### Step 2 — Telegram Bot Setup

> Skip this if you only want WhatsApp.

**2a. Create your bot:**
1. Open Telegram → search **@BotFather** → tap Start
2. Send `/newbot` → pick a display name → pick a `username_bot`
3. Copy the token: `123456789:ABCDefghIJKlmnoPQRstuvWXYz`
4. Paste it as `TELEGRAM_BOT_TOKEN` in `.env`

**2b. Find your chat/group/channel ID:**

```bash
npm run list-telegram-chats
```

This shows every chat your bot has seen. You'll get output like:

```
   1. 📢 Cyber News Channel
      ID:       -1001234567890
      Type:     channel
      Username: @cybernewschannel
```

Copy the ID → set it as `TELEGRAM_TARGET` in `.env`.

> **For channels:** Add your bot as an Administrator with "Post Messages" permission before running the script.
> **For groups:** Add your bot to the group and send any message there first.

---

### Step 3 — WhatsApp Group Setup

> Skip this if you only want Telegram.

```bash
npm start   # scan QR code → link your WhatsApp
npm run list-groups   # find group IDs
```

Set your group ID in `.env`:
```env
WHATSAPP_TARGET=120363XXXXXXXXXXXXXXXXXX@g.us
```

Then restart: `npm start`

---

### Step 4 — Start the Bot

```bash
npm start
```

**WhatsApp first run:** A QR code appears → open WhatsApp → **Linked Devices → Link a Device** → scan it.

**Telegram:** No scan needed — just validate the token and you're live.

You'll receive a startup notification on all configured platforms confirming the bot is live.

---

## Sample Messages

**WhatsApp:**
```
🔐 Cybersecurity  |  *Cyber Security News*
━━━━━━━━━━━━━━━━━━━━━━━━━
*Windows 0-Day Allows Privilege Escalation*

• A critical kernel flaw allows attackers to gain SYSTEM-level access.
• The vulnerability requires no user interaction to exploit.
• Microsoft released an emergency patch — update immediately.

🔗 https://cybersecuritynews.com/...
⏰ _12 Jun 2026, 01:15 AM_
━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Telegram:**
```
🔐 Cybersecurity  |  Cyber Security News
━━━━━━━━━━━━━━━━━━━━━━━━━
Windows 0-Day Allows Privilege Escalation

▪ A critical kernel flaw allows attackers to gain SYSTEM-level access.
▪ The vulnerability requires no user interaction to exploit.
▪ Microsoft released an emergency patch — update immediately.

🔗 Read full article
⏰ 12 Jun 2026, 01:15 AM
━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Adding More News Sources

### Option A — Interactive CLI
```bash
npm run add-source
```

### Option B — Edit `config.json` directly
```json
{
  "name": "Krebs on Security",
  "url": "https://krebsonsecurity.com/",
  "rss": "https://krebsonsecurity.com/feed/",
  "category": "🔎 Krebs",
  "enabled": true
}
```
Restart the bot after saving.

### Finding RSS Feeds
- Most sites: `https://example.com/feed/` or `/rss.xml`
- Use [rss.app](https://rss.app) to generate feeds for sites without one

---

## All Commands

| Command | Description |
|---|---|
| `npm start` | Start the bot (WhatsApp + Telegram) |
| `npm run list-groups` | List WhatsApp groups to find group IDs |
| `npm run list-telegram-chats` | List Telegram chats/groups/channels |
| `npm run add-source` | Add a new RSS news source interactively |

---

## Configuration Reference (`config.json`)

| Setting | Default | Description |
|---|---|---|
| `pollIntervalMinutes` | `5` | How often to check for new articles |
| `maxArticlesPerRun` | `5` | Max articles sent per check (prevents flooding) |
| `summaryBulletPoints` | `3` | Number of AI summary bullet points |
| `delayBetweenMessagesSec` | `3` | Pause between WhatsApp messages |

---

## How It Works

```
Every 5 minutes:
  1. 📡 Fetch RSS feeds from all enabled sources (in parallel)
  2. 🔍 Filter out already-sent articles (JSON deduplication)
  3. 🤖 Summarize each article with Gemini AI
       ├── Cache: skip API call if URL already summarized
       ├── Rate limiter: 4.5s gap between calls (< 15 req/min)
       └── Retry: on 429, waits the API-specified delay and retries
  4. 📱 Format for WhatsApp (bold/italic markdown)
  4. 📢 Format for Telegram (HTML — bold, links, italic)
  5. 💬 Broadcast to WhatsApp + Telegram simultaneously
  6. 💾 Mark as sent — never delivered twice
```

---

## Troubleshooting

### WhatsApp QR appears again on restart
```powershell
Remove-Item -Recurse -Force .wwebjs_auth
npm start
```

### Chrome not found
Install Chrome from [google.com/chrome](https://www.google.com/chrome) and restart.

### WhatsApp group not found
Run `npm run list-groups` — use the full `@g.us` ID instead of the group name.

### Telegram: "chat not found"
- Personal chat: send any message to your bot first
- Group: add the bot to the group and send a message
- Channel: add the bot as Admin with "Post Messages" permission

### Telegram: "have no rights to send"
In your Telegram channel: Administrators → your bot → enable "Post Messages".

### Gemini 429 quota errors
The bot retries automatically. If you're consistently hitting limits, reduce `maxArticlesPerRun` in `config.json` to `2` or `3`.

---

## Project Structure

```
whatsapp-news-bot/
├── index.js                  ← Entry point — boots platforms + scheduler
├── config.json               ← News sources (edit to add/remove sites)
├── add-source.js             ← npm run add-source
├── list-groups.js            ← npm run list-groups (WhatsApp)
├── list-telegram-chats.js    ← npm run list-telegram-chats
├── .env                      ← Your secrets (never commit!)
├── .env.example              ← Template
├── package.json
│
├── src/
│   ├── fetcher.js            ← RSS feed fetcher
│   ├── deduplicator.js       ← JSON article history (no duplicates)
│   ├── summarizer.js         ← Gemini AI (rate-limited + cached)
│   ├── formatter.js          ← WhatsApp markdown + Telegram HTML
│   ├── sender.js             ← WhatsApp client (whatsapp-web.js)
│   ├── telegram-sender.js    ← Telegram bot client
│   ├── pipeline.js           ← Orchestrates fetch → summarize → broadcast
│   └── logger.js             ← Colored console output
│
├── data/
│   └── seen_articles.json    ← Auto-created article history
│
└── .wwebjs_auth/             ← Auto-created WhatsApp session
```

---

## Security Notes

- ✅ `.env` is gitignored — API keys never pushed to GitHub
- ✅ `.wwebjs_auth/` is gitignored — WhatsApp session stays local
- ✅ `data/` is gitignored — article history stays local
- ⚠️ Never share your `.env` or `.wwebjs_auth/` folder

---

## License

MIT — free to use, modify, and share.
