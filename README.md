# WhatsApp News Bot 📰

Automatically fetches the latest cybersecurity & tech news and delivers them to your WhatsApp — the moment they're published.

## Sources Monitored
| Source | Category |
|---|---|
| [Cyber Security News](https://cybersecuritynews.com/) | 🔐 Cybersecurity |
| [HackRead](https://hackread.com/) | 🕵️ Hacking & Security |
| [Reuters Technology](https://www.reuters.com/technology/) | 💻 Tech News |
| [BleepingComputer](https://www.bleepingcomputer.com/) | 🖥️ Security & Tech |

---

## Prerequisites

Before you start, make sure you have:

1. **Node.js 18+** — Download from [nodejs.org](https://nodejs.org) (choose the LTS version)
2. **A Gemini API Key** (free) — Get one at [aistudio.google.com](https://aistudio.google.com/apikey)
3. A WhatsApp account on your phone

---

## Setup (Step-by-Step)

### Step 1 — Install dependencies

Open a terminal in this folder and run:

```bash
npm install
```

> ⚠️ This will download ~300MB (includes a headless Chrome browser for WhatsApp). Wait for it to complete.

---

### Step 2 — Create your `.env` file

Copy the example file:

```bash
# Windows (Command Prompt)
copy .env.example .env

# Windows (PowerShell)
Copy-Item .env.example .env
```

Open `.env` in Notepad and fill in:

```env
# Your WhatsApp number with country code, NO + or spaces
# Example: India +91 98765 43210  →  919876543210
WHATSAPP_TARGET_NUMBER=919XXXXXXXXX

# Free Gemini API key from https://aistudio.google.com/apikey
GEMINI_API_KEY=AIzaXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

---

### Step 3 — Start the bot

```bash
npm start
```

The first time you run it:

1. A **QR code** will appear in the terminal
2. Open WhatsApp on your phone → **Linked Devices** → **Link a Device**
3. Scan the QR code
4. The bot will say `✔ WhatsApp client READY`
5. You'll receive a startup message on WhatsApp confirming it's live!

> ✅ After the first scan, your session is saved. Future restarts **don't need a QR scan**.

---

## Adding More News Sources

### Option A — Interactive CLI (easiest):
```bash
npm run add-source
```
Follow the prompts to enter the site name, URL, and RSS feed URL.

### Option B — Edit config.json manually:
Open `config.json` and add an entry to the `sources` array:

```json
{
  "name": "The Hacker News",
  "url": "https://thehackernews.com",
  "rss": "https://feeds.feedburner.com/TheHackersNews",
  "category": "🔐 Cybersecurity",
  "enabled": true
}
```

Then restart the bot: `npm start`

### Finding RSS Feed URLs:
Most news sites have RSS at `/feed/` or `/rss/`. Examples:
- WordPress sites: `https://example.com/feed/`
- Try appending `/feed` or `/rss.xml` to any news site URL

---

## Disabling a Source Temporarily

In `config.json`, set `"enabled": false` for any source you want to pause:

```json
{
  "name": "Reuters Technology",
  "enabled": false
}
```

Restart the bot to apply changes.

---

## Configuration Options (`config.json`)

| Setting | Default | Description |
|---|---|---|
| `pollIntervalMinutes` | `5` | How often to check for new articles |
| `maxArticlesPerRun` | `5` | Max articles to send per poll cycle |
| `summaryBulletPoints` | `3` | Number of bullet points per article |
| `delayBetweenMessagesSec` | `3` | Pause between WhatsApp messages |

---

## How It Works

```
Every 5 minutes:
  1. 📡 Fetch RSS feeds from all enabled sources
  2. 🔍 Check which articles are NEW (SQLite deduplication)
  3. 🤖 Summarize each new article with Gemini AI
  4. 📱 Format for WhatsApp (bold, bullets, emojis)
  5. 💬 Send to your WhatsApp number
  6. 💾 Mark article as sent (never sent twice)
```

---

## Troubleshooting

### "Session expired / QR code appears again"
Delete the `.wwebjs_auth` folder and re-scan:
```bash
rmdir /s /q .wwebjs_auth   # Windows CMD
```

### "WHATSAPP_TARGET_NUMBER is not set"
Make sure your `.env` file exists and contains the number.

### Articles aren't being sent
1. Check the terminal for error messages
2. Verify your number format: country code + number, no `+` or spaces
3. Make sure WhatsApp is connected on your phone

### Reuters RSS not working
Reuters occasionally changes their feed URLs. Try:
- `https://feeds.reuters.com/reuters/technologyNews`
- `https://www.reuters.com/arc/outboundfeeds/rss/?outputType=xml`

---

## Project Structure

```
WhatsappAutomation/
├── index.js              ← Entry point
├── config.json           ← News sources (edit this to add/remove sites)
├── add-source.js         ← CLI to add new sources
├── .env                  ← Your secrets (never share this!)
├── .env.example          ← Template
├── package.json
│
├── src/
│   ├── fetcher.js        ← RSS news fetcher
│   ├── deduplicator.js   ← Tracks sent articles (SQLite)
│   ├── summarizer.js     ← Gemini AI summarization
│   ├── formatter.js      ← WhatsApp message formatting
│   ├── sender.js         ← WhatsApp client (whatsapp-web.js)
│   ├── pipeline.js       ← Orchestrates everything
│   └── logger.js         ← Colored console output
│
├── data/
│   └── seen_articles.db  ← Auto-created SQLite database
│
└── .wwebjs_auth/         ← Auto-created WhatsApp session
```
