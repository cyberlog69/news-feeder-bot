# WhatsApp News Bot 📰🔐

> Automatically fetches the latest **cybersecurity & tech news** from 4 sources, summarizes each article with **Gemini AI**, and delivers it to your **WhatsApp number, group, or channel** — the moment it's published.

---

## Features

- 🔐 **4 curated cybersecurity sources** — updated in real time (every 5 min)
- 🤖 **AI summaries** — Gemini 2.0 Flash condenses each article into 3 bullet points
- 💬 **Flexible delivery** — send to your own number, a WhatsApp group, or a channel
- 🔁 **Never duplicates** — JSON-based tracker ensures each article is sent only once
- ➕ **Easy to extend** — add any RSS-enabled news site in seconds
- 🛡️ **Quota-safe** — built-in rate limiter, retry logic, and summary cache for Gemini

---

## News Sources

| Source | Category | RSS |
|---|---|---|
| [Cyber Security News](https://cybersecuritynews.com/) | 🔐 Cybersecurity | ✅ |
| [HackRead](https://hackread.com/) | 🕵️ Hacking & Security | ✅ |
| [The Hacker News](https://thehackernews.com/) | 💻 Infosec | ✅ |
| [BleepingComputer](https://www.bleepingcomputer.com/) | 🖥️ Security & Tech | ✅ |

---

## Prerequisites

| Requirement | Notes |
|---|---|
| **Node.js 18+** | Download from [nodejs.org](https://nodejs.org) (LTS version) |
| **Google Chrome** | Already installed on most PCs — bot uses your existing Chrome |
| **Gemini API Key** | Free at [aistudio.google.com](https://aistudio.google.com/apikey) |
| **WhatsApp** | Any personal WhatsApp account (no Business account needed) |

---

## Setup

### Step 1 — Clone & Install

```bash
git clone https://github.com/cyberlog69/whatsapp-news-bot.git
cd whatsapp-news-bot
npm install
npm approve-scripts puppeteer
```

> ⚠️ `npm install` downloads dependencies (~300MB including a headless browser). Wait for it to complete fully.

---

### Step 2 — Configure `.env`

```bash
# Windows (PowerShell)
Copy-Item .env.example .env
```

Open `.env` in any text editor and fill in:

```env
# WHERE TO SEND NEWS — pick ONE of the 3 options below:

# Option 1: Your personal WhatsApp number (country code + number, no + or spaces)
WHATSAPP_TARGET=919876543210

# Option 2: WhatsApp Group name (must match exactly, case-insensitive)
# WHATSAPP_TARGET=My Cyber News Group

# Option 3: Group ID — most reliable (see "Sending to a Group" below)
# WHATSAPP_TARGET=120363XXXXXXXXXXXXXXXXXX@g.us

# Free Gemini API key from https://aistudio.google.com/apikey
GEMINI_API_KEY=AIzaXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

---

### Step 3 — Start the Bot

```bash
npm start
```

**First run only:**
1. A QR code appears in your terminal
2. Open WhatsApp on your phone → **Linked Devices** → **Link a Device**
3. Scan the QR code
4. You'll see `✔ WhatsApp client READY`
5. A startup notification is sent to your configured target

> ✅ After the first scan, your session is saved to `.wwebjs_auth/`. Future restarts don't need a QR scan.

---

## Sending to a WhatsApp Group

To deliver news to a group instead of a personal number:

**Step 1** — Start the bot once to link your WhatsApp (scan the QR code)

**Step 2** — Add the linked WhatsApp account to your group

**Step 3** — Run the group finder:
```bash
npm run list-groups
```

You'll see output like:
```
   1. 👥 Cyber Security Alerts
      ID: 120363XXXXXXXXXXXXXXXXXX@g.us
      Members: 12
```

**Step 4** — Copy the ID into your `.env`:
```env
WHATSAPP_TARGET=120363XXXXXXXXXXXXXXXXXX@g.us
```

**Step 5** — Restart the bot:
```bash
npm start
```

> 💡 You can also use the group **name** directly (e.g. `WHATSAPP_TARGET=Cyber Security Alerts`) and the bot will auto-resolve it to the ID.

---

## Adding More News Sources

### Option A — Interactive CLI (easiest)
```bash
npm run add-source
```
Follow the prompts — name, website URL, RSS feed URL, and category emoji.

### Option B — Edit `config.json` directly
Open `config.json` and add a new entry to the `sources` array:

```json
{
  "name": "Krebs on Security",
  "url": "https://krebsonsecurity.com/",
  "rss": "https://krebsonsecurity.com/feed/",
  "category": "🔎 Krebs",
  "enabled": true
}
```

Then restart: `npm start`

### Finding RSS Feed URLs
Most news sites publish RSS at `/feed/` or `/rss.xml`:
- WordPress sites → `https://example.com/feed/`
- Try appending `/feed`, `/rss`, or `/rss.xml` to the homepage URL
- Or use [rss.app](https://rss.app) to generate a feed for sites without one

### Disabling a Source Temporarily
Set `"enabled": false` for any source in `config.json` and restart.

---

## Configuration Reference (`config.json`)

```json
{
  "sources": [ ... ],
  "settings": {
    "pollIntervalMinutes": 5,
    "maxArticlesPerRun": 5,
    "summaryBulletPoints": 3,
    "delayBetweenMessagesSec": 3
  }
}
```

| Setting | Default | Description |
|---|---|---|
| `pollIntervalMinutes` | `5` | How often to check for new articles |
| `maxArticlesPerRun` | `5` | Max articles to send per check (prevents flooding) |
| `summaryBulletPoints` | `3` | Number of AI summary bullet points per article |
| `delayBetweenMessagesSec` | `3` | Pause between WhatsApp messages |

---

## How It Works

```
Every 5 minutes:
  1. 📡 Fetch RSS feeds from all enabled sources
  2. 🔍 Filter out already-sent articles (JSON deduplication)
  3. 🤖 Summarize each new article with Gemini AI
       ├── Cache check: skip API call if already summarized
       ├── Rate limiter: enforce 4.5s gap (stay under 15 req/min)
       └── Retry logic: on 429, wait the API-specified delay and retry
  4. 📱 Format for WhatsApp (bold, bullet points, emojis, dividers)
  5. 💬 Send to your number / group / channel
  6. 💾 Mark article as sent (never sent again)
```

---

## Sample WhatsApp Message

```
🔐 Cybersecurity  |  *Cyber Security News*
━━━━━━━━━━━━━━━━━━━━━━━━━
*Windows 0-Day Vulnerability Allows Privilege Escalation*

• A critical zero-day flaw in the Windows kernel has been discovered by researchers.
• Attackers can exploit the vulnerability to gain SYSTEM-level privileges without user interaction.
• Microsoft has released an emergency patch — users should update immediately.

🔗 https://cybersecuritynews.com/windows-0day/
⏰ _11 Jun 2026, 10:05 PM_
━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Available Commands

| Command | Description |
|---|---|
| `npm start` | Start the news bot |
| `npm run list-groups` | List all WhatsApp groups to find group IDs |
| `npm run add-source` | Add a new RSS news source interactively |

---

## Troubleshooting

### QR code appears again on restart
Your session expired. Delete the auth folder and re-scan:
```powershell
Remove-Item -Recurse -Force .wwebjs_auth
npm start
```

### `WHATSAPP_TARGET is not set`
Make sure `.env` exists (not just `.env.example`) and contains `WHATSAPP_TARGET=...`

### Group not found
1. Confirm the bot's linked WhatsApp number is a member of the group
2. Run `npm run list-groups` to see exact group names and IDs
3. Use the group ID (`@g.us`) in `.env` instead of the name — it's more reliable

### Gemini 429 quota errors
The bot handles this automatically with retry + rate limiter. If you're consistently hitting the daily limit (1,500 req/day free), reduce `maxArticlesPerRun` in `config.json`:
```json
"maxArticlesPerRun": 2
```
Or upgrade to a paid Gemini plan at [aistudio.google.com](https://aistudio.google.com).

### Chrome not found
The bot automatically uses your installed Google Chrome. If Chrome isn't installed:
1. Download Chrome from [google.com/chrome](https://www.google.com/chrome)
2. Restart the bot

---

## Project Structure

```
whatsapp-news-bot/
├── index.js              ← Entry point — boots WhatsApp + runs scheduler
├── config.json           ← News sources (add/remove sites here)
├── add-source.js         ← CLI: npm run add-source
├── list-groups.js        ← CLI: npm run list-groups
├── .env                  ← Your secrets (never commit this!)
├── .env.example          ← Template — copy to .env
├── package.json
│
├── src/
│   ├── fetcher.js        ← RSS feed fetcher (all sources in parallel)
│   ├── deduplicator.js   ← JSON-based article history tracker
│   ├── summarizer.js     ← Gemini AI (rate-limited, cached, retry-safe)
│   ├── formatter.js      ← WhatsApp message formatter
│   ├── sender.js         ← WhatsApp client (supports number / group / channel)
│   ├── pipeline.js       ← Orchestrates the full fetch → send pipeline
│   └── logger.js         ← Colored, timestamped console output
│
├── data/
│   └── seen_articles.json  ← Auto-created — tracks sent articles
│
└── .wwebjs_auth/           ← Auto-created — WhatsApp session (don't delete)
```

---

## Security Notes

- ✅ `.env` is in `.gitignore` — your API keys are never pushed to GitHub
- ✅ `.wwebjs_auth/` is in `.gitignore` — your WhatsApp session stays local
- ✅ `data/` is in `.gitignore` — article history stays local
- ⚠️ Never share your `.env` file or `.wwebjs_auth/` folder with anyone

---

## License

MIT — free to use, modify, and share.
