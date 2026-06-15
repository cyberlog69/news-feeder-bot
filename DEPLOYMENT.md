# 🚀 Deployment Guide — News Feeder Bot v3.0

Complete guide for running the bot locally and on every major cloud platform.

---

## 📋 Platform Comparison

| Platform | WhatsApp | Telegram | Discord | Free? | Cost | Best For |
|---|---|---|---|---|---|---|
| **Local (PM2)** | ✅ | ✅ | ✅ | ✅ Free | Your electricity | Always-on PC/server |
| **Docker (local)** | ✅ | ✅ | ✅ | ✅ Free | Your electricity | Isolated local env |
| **Railway.app** | ✅ (volume) | ✅ | ✅ | Limited | ~$5/mo | Easiest cloud |
| **Render.com** | ✅ (disk) | ✅ | ✅ | ✅ Free tier | Free/$7+ | Simple deployment |
| **Fly.io** | ✅ (volume) | ✅ | ✅ | ✅ Free tier | Free/$1.94+/mo | Best free cloud |
| **Oracle Cloud** | ✅ | ✅ | ✅ | ✅ Always Free | $0 forever | Free VPS |
| **DigitalOcean** | ✅ | ✅ | ✅ | ❌ | $4/mo | Reliable VPS |
| **AWS EC2** | ✅ | ✅ | ✅ | ✅ 1 yr free | Free/pay-as-go | Enterprise |

> **⚠️ WhatsApp on Cloud**: Requires initial QR scan. See [WhatsApp Cloud Setup](#-whatsapp-on-cloud-deployments) section.

---

## 1. 🖥️ Local Deployment — Direct Node.js

The simplest option. Runs on your Windows/Mac/Linux PC.

### Prerequisites
- Node.js 18+ ([nodejs.org](https://nodejs.org))
- Google Chrome installed

### Steps
```bash
git clone https://github.com/cyberlog69/news-feeder-bot.git
cd news-feeder-bot
npm install
cp .env.example .env
# Edit .env with your API keys
npm start
```

Dashboard: http://localhost:3000

---

## 2. 🔁 Local Deployment — PM2 (Recommended for 24/7)

PM2 keeps the bot running after terminal closes and auto-starts on reboot.

### Setup
```bash
# Install PM2 globally
npm install -g pm2

# Start the bot
npm run pm2:start

# Save the process list (so it survives reboots)
pm2 save

# Configure auto-start on system reboot
pm2 startup
# Follow the command it prints (copy-paste with sudo)
```

### Useful PM2 Commands
```bash
npm run pm2:logs      # view live logs
npm run pm2:monit     # CPU/memory dashboard
npm run pm2:restart   # restart without downtime
npm run pm2:stop      # stop
npm run pm2:delete    # remove from PM2
```

### Windows — PM2 with Auto-Start
```powershell
# Install PM2 Windows startup
npm install -g pm2-windows-startup
pm2-startup install

# Start bot
pm2 start ecosystem.config.js --env production
pm2 save
```

---

## 3. 🐳 Docker — Local Container

Runs in an isolated container. WhatsApp session persists via Docker volumes.

### Prerequisites
- [Docker Desktop](https://docker.com/products/docker-desktop) installed

### First Run (with WhatsApp)
```bash
# Build image
docker build -t news-feeder-bot .

# Create .env file with your credentials
cp .env.example .env
# Edit .env

# Start container — first run will show QR code in logs
docker-compose up -d

# Watch for QR code, then scan it
docker-compose logs -f
```

After scanning, the session is saved in the `newsbot_whatsapp_auth` volume.

### Useful Docker Commands
```bash
npm run docker:up       # start in background
npm run docker:logs     # follow logs
npm run docker:restart  # restart
npm run docker:down     # stop and remove containers
```

### Dashboard
http://localhost:3000

---

## 4. ☁️ Railway.app (Easiest Cloud)

Railway auto-deploys from GitHub. Supports persistent volumes for WhatsApp.

### Steps
1. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
2. Select `news-feeder-bot` repository
3. Railway detects `railway.json` and uses the Dockerfile automatically
4. Go to **Variables** tab → Add all variables from `.env.example`:
   ```
   GEMINI_API_KEY     = your_key
   TELEGRAM_BOT_TOKEN = your_token
   TELEGRAM_TARGET    = @yourchannel
   DISCORD_WEBHOOK_URL= your_webhook (optional)
   NODE_ENV           = production
   ```
5. For WhatsApp: Add a **Volume** mount at `/app/data` and `/app/.wwebjs_auth`
6. Click **Deploy**

### For WhatsApp on Railway
See [WhatsApp Cloud Setup](#-whatsapp-on-cloud-deployments) below.

### Estimated Cost
- Starter plan: ~$5 credit/month (usually enough for this bot)
- Add volume storage: $0.25/GB/month

---

## 5. 🎨 Render.com (Free Tier Available)

### Steps
1. Go to [render.com](https://render.com) → New → Blueprint
2. Connect your GitHub repository
3. Render detects `render.yaml` automatically
4. Go to **Environment** tab → Add secrets:
   ```
   GEMINI_API_KEY
   TELEGRAM_BOT_TOKEN
   TELEGRAM_TARGET
   DISCORD_WEBHOOK_URL  (optional)
   ```
5. Click **Apply**

### Free Tier Notes
- 750 compute hours/month (one service runs ~31 days = 744 hrs ✅)
- Services spin down after 15 min of inactivity on free tier
  → **Set `WHATSAPP_TARGET` to empty** on free tier (use Telegram/Discord)
  → Or upgrade to Starter ($7/mo) for always-on

### Persistent Disk (for WhatsApp)
The `render.yaml` includes a disk definition (paid: $0.25/GB/month).
Comment it out for Telegram/Discord only (free tier compatible).

---

## 6. 🪂 Fly.io (Best Free Cloud Option)

Fly.io offers 3 always-on free VMs — perfect for this bot.

### Prerequisites
```bash
# Install Fly CLI
# Windows (PowerShell)
iwr https://fly.io/install.ps1 -useb | iex

# Linux/Mac
curl -L https://fly.io/install.sh | sh
```

### Deployment Steps
```bash
# Login
fly auth login

# Edit fly.toml — change app name to something unique
# app = "news-feeder-bot-yourname"

# Create the app (first time only)
fly launch --no-deploy

# Create persistent volume for data
fly volumes create newsbot_data --size 1 --region sin

# Set secrets (never put in fly.toml)
fly secrets set GEMINI_API_KEY=your_key
fly secrets set TELEGRAM_BOT_TOKEN=your_token
fly secrets set TELEGRAM_TARGET=@yourchannel
fly secrets set DISCORD_WEBHOOK_URL=your_webhook
fly secrets set NODE_ENV=production

# Deploy
fly deploy

# Watch logs
fly logs
```

### For WhatsApp on Fly.io
```bash
# Set WhatsApp target
fly secrets set WHATSAPP_TARGET=your_group_id@g.us

# SSH into the machine for initial QR scan
fly ssh console
# Inside: node index.js
# Scan QR, then Ctrl+C and restart normally: fly deploy
```

### Free Tier Limits
- 3 shared VMs (256MB RAM each)
- Recommend: 1 VM with 512MB (`fly scale memory 512`)
- 160GB outbound data/month
- 3GB volume storage total

---

## 7. 🟠 Oracle Cloud Free Tier (Always Free VPS)

Oracle offers **4 ARM VMs free forever** — no credit card required after signup.

### VM Specifications (Always Free)
- 4 OCPUs (ARM), 24GB RAM shared across VMs
- 200GB block volume storage
- **Perfect for this bot** — runs WhatsApp, Telegram, Discord with no limits

### Setup After Creating VM
```bash
# SSH into your Oracle VM
ssh ubuntu@YOUR_VM_IP

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install Google Chrome
wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
sudo apt install -y ./google-chrome-stable_current_amd64.deb

# Install PM2
sudo npm install -g pm2

# Clone and setup
git clone https://github.com/cyberlog69/news-feeder-bot.git
cd news-feeder-bot
npm install
cp .env.example .env
nano .env  # fill in credentials

# Start with PM2
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup  # follow the printed command
```

### Access Dashboard from Outside
```bash
# Open port 3000 in Oracle Cloud security list
# Then access: http://YOUR_VM_IP:3000
```

---

## 8. 💧 DigitalOcean Droplet ($4/month)

### Setup
```bash
# Create a $4/mo Ubuntu Droplet at digitalocean.com
# SSH in, then:

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt install -y nodejs

# Install Chrome
wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
sudo apt install -y ./google-chrome-stable_current_amd64.deb

# Install PM2
sudo npm install -g pm2

# Clone and run
git clone https://github.com/cyberlog69/news-feeder-bot.git
cd news-feeder-bot
npm install
cp .env.example .env && nano .env
pm2 start ecosystem.config.js --env production
pm2 save && pm2 startup
```

---

## 📱 WhatsApp on Cloud Deployments

WhatsApp requires a QR scan on first run. Here's how to handle this on cloud:

### Method 1: SSH + Terminal QR (Recommended)
```bash
# On Railway/Fly.io/DigitalOcean:
# SSH into your instance
fly ssh console          # Fly.io
# OR connect via cloud dashboard terminal

# Run bot temporarily to get QR
NODE_ENV=development node index.js

# Scan QR with WhatsApp on your phone
# Once authenticated (✔ WhatsApp client READY), press Ctrl+C

# Restart normally — session is now saved to volume
```

### Method 2: Run Locally First, Upload Session
```bash
# 1. Run locally and scan QR
npm start

# 2. After "✔ WhatsApp client READY", stop the bot (Ctrl+C)

# 3. Upload .wwebjs_auth/ to your cloud volume
# For Railway: use railway volume commands
# For Docker: copy into named volume
# For VPS: scp -r .wwebjs_auth/ user@server:~/news-feeder-bot/
```

### Method 3: Telegram/Discord Only (Zero QR hassle)
Simply don't set `WHATSAPP_TARGET` in your cloud `.env`.
The bot will skip WhatsApp and work 100% with Telegram and Discord.

---

## 🔐 Secrets Management

### ❌ Never Do This
```bash
# NEVER put secrets in code, fly.toml, render.yaml, or railway.json
GEMINI_API_KEY=my-real-key   # BAD — goes into git!
```

### ✅ Always Use
| Platform | How to Set Secrets |
|---|---|
| Railway | Dashboard → Variables tab |
| Render | Dashboard → Environment tab |
| Fly.io | `fly secrets set KEY=value` |
| Docker | `.env` file + `env_file:` in compose |
| PM2 / VPS | `.env` file (never committed) |

---

## 🌐 Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | Recommended | Gemini AI API key (free at aistudio.google.com) |
| `WHATSAPP_TARGET` | Optional | Phone/group ID for WhatsApp delivery |
| `TELEGRAM_BOT_TOKEN` | Optional | Bot token from @BotFather |
| `TELEGRAM_TARGET` | Optional | Channel/group ID for Telegram |
| `DISCORD_WEBHOOK_URL` | Optional | Discord webhook for Discord delivery |
| `NODE_ENV` | Production | Set to `production` on cloud |
| `PORT` | Cloud | Auto-set by Railway/Render/Fly.io |
| `CHROME_PATH` | Optional | Override Chrome binary path |
| `WWEBJS_AUTH_PATH` | Optional | Override WhatsApp auth directory |
| `DISCORD_USERNAME` | Optional | Custom Discord bot display name |
| `DISCORD_AVATAR_URL` | Optional | Custom Discord bot avatar URL |

---

## 🏥 Health Check

All cloud deployments expose: `GET /health`

```json
{
  "status": "ok",
  "uptime_sec": 3600,
  "total_sent": 142,
  "environment": "production",
  "timestamp": "2026-06-16T00:00:00.000Z"
}
```

Extended metrics at: `GET /metrics`

---

## 🔧 Troubleshooting

| Problem | Solution |
|---|---|
| WhatsApp QR not showing | Run with `NODE_ENV=development node index.js` locally |
| Chrome not found in Docker | Puppeteer downloads its own — check container logs |
| Out of memory in Docker | Increase `memory:` in `docker-compose.yml` to `800M` |
| Fly.io 256MB OOM | `fly scale memory 512` |
| Railway build timeout | Puppeteer Chromium download can take 3-5 mins — normal |
| Session expired on cloud | Re-run with terminal access and re-scan QR |
| PORT already in use | Change `dashboardPort` in `config.json` |
| Gemini 429 on cloud | Already handled with retry. Add `GEMINI_API_KEY` with paid plan |
| `EADDRINUSE` dashboard | Another instance running — `pm2 delete all` then restart |

---

## 📊 Resource Usage (typical)

| Resource | Idle | Active (fetching) |
|---|---|---|
| RAM | ~180MB | ~400MB (with Chrome) |
| CPU | <1% | 5–15% during pipeline |
| Disk | ~50MB | ~100MB (with logs, cache) |
| Network | ~1MB/5min | ~5MB/5min |

Minimum recommended: **512MB RAM, 1 vCPU, 1GB storage**
