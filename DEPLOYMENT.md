# 🚀 Multi-Cloud Deployment Guide — News Feeder Bot v3.14.0

This guide provides step-by-step instructions for deploying **News Feeder Bot** across all major free, low-cost, and enterprise cloud hosting platforms.

---

## 📋 Table of Contents

1. [Architecture & System Requirements](#-architecture--system-requirements)
2. [🆓 Oracle Cloud (OCI) Always Free VM (Recommended 100% Free Forever)](#1--oracle-cloud-oci-always-free-vm)
3. [🆓 Google Cloud Platform (GCP) e2-micro & Cloud Run](#2--google-cloud-platform-gcp)
4. [🚀 Fly.io (Container with Persistent Volume)](#3--flyio)
5. [⚡ Render.com (Web Service)](#4--rendercom)
6. [🚂 Railway.app (1-Click Container Deployment)](#5--railwayapp)
7. [💎 Hetzner Cloud & DigitalOcean (Production VPS)](#6--hetzner-cloud--digitalocean)
8. [☁️ Amazon Web Services (AWS Lightsail & EC2)](#7--amazon-web-services-aws)
9. [🏠 Self-Hosted / Raspberry Pi / Home Lab](#8--self-hosted--raspberry-pi--home-lab)
10. [🔒 Production Security & Hardening Checklist](#-production-security--hardening-checklist)

---

## 🏗 Architecture & System Requirements

```text
                                  ┌───────────────────────────┐
                                  │   RSS Feeds / Threat APIs │
                                  └─────────────┬─────────────┘
                                                │ (Cron Polling)
┌───────────────────────────────────────────────▼───────────────────────────────────────────────┐
│                                 News Feeder Bot v3.14.0                                       │
│                                                                                               │
│  ┌───────────────────────┐   ┌───────────────────────┐   ┌────────────────────────────────┐   │
│  │ Threat Intel & CISA   │   │ Story Clustering &    │   │ Multi-Provider AI Summarizer   │   │
│  │ KEV / Ransomware Gangs│   │ Master Bulletin Fusion│   │ (Groq/Gemini/OpenRouter/Ollama)│   │
│  └───────────────────────┘   └───────────────────────┘   └────────────────────────────────┘   │
│                                               │                                               │
│                         ┌─────────────────────┴─────────────────────┐                         │
│                         ▼                                           ▼                         │
│              ┌─────────────────────┐                     ┌─────────────────────┐              │
│              │ SQLite Vector Store │                     │ SOC Web Dashboard   │              │
│              │ & Subscriptions DB  │                     │ & Syndication Feeds │              │
│              └─────────────────────┘                     └─────────────────────┘              │
└───────────────────────────────────────┬───────────────────────────────────────────────────────┘
                                        │
     ┌──────────────────────────────────┴──────────────────────────────────┐
     ▼                                  ▼                                  ▼
┌──────────────────────┐   ┌──────────────────────┐   ┌────────────────────────────────┐
│ Messaging Channels   │   │ SOC / SIEM Ingestion │   │ Social Broadcasting            │
│ WhatsApp • Telegram  │   │ Email • Webhooks     │   │ Mastodon • Bluesky             │
│ Discord • Slack • Teams  │ Pushover • Ntfy.sh   │   │ RSS 2.0 • Atom • JSON Feed     │
└──────────────────────┘   └──────────────────────┘   └────────────────────────────────┘
```

### Memory & Compute Sizing

| Workload Configuration | Minimum RAM | Recommended RAM | CPU |
|---|---|---|---|
| **Standard** (Telegram, Discord, Slack, Teams, Email, Push, Webhooks) | 256 MB | 512 MB | 1 vCPU |
| **With WhatsApp Web** (Headless Chromium / Puppeteer engine) | 600 MB | 1 GB – 2 GB | 1 – 2 vCPU |

---

## 1. 🆓 Oracle Cloud (OCI) Always Free VM

Oracle Cloud offers the most generous free-tier compute in the world with **zero cost forever**:
* **Specs**: 4 ARM OCPUs, **24 GB RAM**, and 200 GB NVMe storage (Ampere A1) or 2 AMD Micro VMs (1 GB RAM each).

### Step-by-Step Setup:

1. **Create an OCI Instance**:
   * Navigate to **Compute → Instances → Create Instance**.
   * Choose **Ubuntu 24.04 / 22.04 LTS (aarch64 or x86_64)**.
   * Shape: Choose **Ampere (ARM)** with 2 to 4 OCPUs and 12 to 24 GB RAM.
   * Add your SSH public key and click **Create**.

2. **Open Firewall Ports in OCI Security List**:
   * Go to **Virtual Cloud Networks → Security Lists → Default Security List**.
   * Add Ingress Rules:
     * `Port 22` (SSH)
     * `Port 80 / 443` (HTTP/HTTPS)
     * `Port 3000` (News Feeder Bot Web Dashboard)

3. **Connect and Install Node.js & Docker**:
   ```bash
   ssh ubuntu@<YOUR_OCI_PUBLIC_IP>

   # Update packages
   sudo apt update && sudo apt upgrade -y

   # Install Docker and Docker Compose
   sudo apt install -y docker.io docker-compose git
   sudo usermod -aG docker ubuntu
   newgrp docker
   ```

4. **Clone & Configure**:
   ```bash
   git clone https://github.com/cyberlog69/news-feeder-bot.git
   cd news-feeder-bot
   cp .env.example .env
   nano .env  # Configure bot tokens and API keys
   ```

5. **Launch with Docker Compose**:
   ```bash
   docker-compose up -d
   docker-compose logs -f
   ```

6. *(Optional)* **WhatsApp Authentication**:
   If WhatsApp is enabled, view the QR code terminal stream using:
   ```bash
   docker logs -f news-feeder-bot
   ```

---

## 2. 🆓 Google Cloud Platform (GCP)

### Option A: GCP Compute Engine `e2-micro` (100% Free Forever)
* Available in `us-central1`, `us-east1`, or `us-west1` with 1 GB RAM & 30 GB disk.

```bash
# 1. Create VM via gcloud CLI
gcloud compute instances create newsbot-vm \
    --zone=us-central1-a \
    --machine-type=e2-micro \
    --image-family=ubuntu-2404-lts-amd64 \
    --image-project=ubuntu-os-cloud \
    --boot-disk-size=30GB

# 2. Add 2GB Swap Memory (Recommended for Chromium stability)
ssh <YOUR_VM_IP>
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# 3. Clone and Run
git clone https://github.com/cyberlog69/news-feeder-bot.git
cd news-feeder-bot
cp .env.example .env
npm install --production
npm run pm2:start
```

### Option B: Google Cloud Run (Serverless Container)
```bash
# Build and deploy container image to Google Cloud Run
gcloud run deploy news-feeder-bot \
    --source . \
    --region us-central1 \
    --allow-unauthenticated \
    --port 3000 \
    --memory 1Gi \
    --cpu 1 \
    --min-instances 1 \
    --set-env-vars NODE_ENV=production,PORT=3000
```

---

## 3. 🚀 Fly.io

Fly.io runs Docker containers near your users with persistent NVMe volumes.

1. **Install flyctl & Login**:
   ```bash
   powershell -Command "iwr https://fly.io/install.ps1 -useb | iex" # Windows
   # or on Linux/macOS: curl -L https://fly.io/install.sh | sh
   fly auth login
   ```

2. **Initialize App**:
   ```bash
   fly launch --no-deploy
   ```

3. **Create Persistent Volume for SQLite & WhatsApp**:
   ```bash
   fly volumes create newsbot_data --size 1 --region iad
   ```

4. **Update `fly.toml`**:
   Ensure volume mount is defined:
   ```toml
   [mounts]
     source = "newsbot_data"
     destination = "/app/data"

   [[vm]]
     size = "shared-cpu-1x"
     memory = "512mb"
   ```

5. **Set Secrets and Deploy**:
   ```bash
   fly secrets set TELEGRAM_BOT_TOKEN="your-token" TELEGRAM_CHAT_ID="your-chat-id" GROQ_API_KEY="your-groq-key"
   fly deploy
   ```

---

## 4. ⚡ Render.com

1. **Push your repository** to GitHub.
2. Log in to [Render.com](https://render.com) → **New +** → **Web Service**.
3. Select your `news-feeder-bot` GitHub repository.
4. Set:
   * **Runtime**: `Docker`
   * **Plan**: `Free` (or `Starter` $7/mo for persistent storage)
   * **Environment Variables**: Add all `.env` keys (`GROQ_API_KEY`, `TELEGRAM_BOT_TOKEN`, `DISCORD_WEBHOOK_URL`, etc.).
5. **Keep-Alive Tip for Free Tier**:
   Free instances sleep after 15 minutes of inactivity. Set up a free 5-minute health check ping to your Render URL (e.g. `https://your-bot.onrender.com/health`) on [UptimeRobot](https://uptimerobot.com) or [Cron-Job.org](https://cron-job.org).

---

## 5. 🚂 Railway.app

1. Go to [Railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**.
2. Railway will automatically detect the `Dockerfile`.
3. In **Settings → Volumes**, click **Add Volume** and mount it to `/app/data`.
4. Under **Variables**, paste your environment variables.
5. Generate a domain under **Networking** to access your SOC dashboard.

---

## 6. 💎 Hetzner Cloud & DigitalOcean (Production VPS)

Hetzner Cloud (`~€3.79/mo`) and DigitalOcean (`$4-$6/mo`) offer unmatched performance and reliability.

### Complete Production Setup:

```bash
# 1. SSH into VPS
ssh root@<SERVER_IP>

# 2. Setup UFW Firewall
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable

# 3. Install Docker & Compose
curl -fsSL https://get.docker.com | sh
apt install -y docker-compose-plugin

# 4. Clone and Launch
git clone https://github.com/cyberlog69/news-feeder-bot.git /opt/news-feeder-bot
cd /opt/news-feeder-bot
cp .env.example .env
nano .env

# 5. Start in Background
docker compose up -d

# 6. Enable Automatic Restart on System Reboot
docker update --restart=always news-feeder-bot
```

### SSL Reverse Proxy with Caddy (Optional for HTTPS Dashboard):
Create `/opt/Caddyfile`:
```caddy
newsbot.yourdomain.com {
    reverse_proxy localhost:3000
}
```
Run Caddy:
```bash
docker run -d --name caddy --restart always \
  -p 80:80 -p 443:443 \
  -v /opt/Caddyfile:/etc/caddy/Caddyfile \
  -v caddy_data:/data \
  caddy:alpine
```

---

## 7. ☁️ Amazon Web Services (AWS)

### AWS Lightsail ($3.50/month)
1. Open **AWS Lightsail Console** → **Create Instance**.
2. Select **Linux/Unix** → **OS Only** → **Ubuntu 24.04 LTS**.
3. Choose the **$3.50/mo plan** (1 vCPU, 512 MB – 1 GB RAM, 20 GB SSD).
4. Connect via browser SSH and run standard Docker Compose setup.

### AWS EC2 (t2.micro / t4g.small Free Tier)
1. Launch an `e2-micro` or `t4g.small` instance.
2. In Security Groups, allow inbound ports `22` and `3000`.
3. Use PM2 or Docker Compose to manage the background daemon.

---

## 8. 🏠 Self-Hosted / Raspberry Pi / Home Lab

Deploying on a home server (Raspberry Pi 4/5, Synology NAS, Unraid, Proxmox, or Mini PC) provides **100% privacy and zero monthly cloud costs**.

### Raspberry Pi 4 / 5 (ARM64)
```bash
# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Clone and run
git clone https://github.com/cyberlog69/news-feeder-bot.git
cd news-feeder-bot
cp .env.example .env
docker compose up -d
```

### Synology NAS / Container Manager
1. Open **Container Manager** (or Docker) in DSM.
2. Create a new Project pointing to the `news-feeder-bot` folder with `docker-compose.yml`.
3. Map `/app/data` to a persistent shared folder (e.g. `/volume1/docker/newsbot/data`).
4. Set Environment Variables and click **Build & Start**.

---

## 🔒 Production Security & Hardening Checklist

| Security Measure | How to Implement |
|---|---|
| **Dashboard Token Auth** | Set `DASHBOARD_TOKEN="your-secure-random-token"` in `.env` |
| **RBAC Roles** | Configure `ADMIN_TOKEN`, `ANALYST_TOKEN`, and `AUDITOR_TOKEN` |
| **SSRF Prevention** | Built-in IP filtering blocks private RFC1918 subnets from custom RSS URLs |
| **Automated Backups** | Trigger snapshots via `POST /api/db/backup` or check `data/backups/` |
| **Database Vacuuming** | WAL checkpoints and SQLite vacuum run automatically |
| **Firewall (UFW)** | Only expose port `3000` (or `443` through reverse proxy); block raw internal ports |

---

## 📊 Quick Deployment Summary Matrix

| Provider | Type | Monthly Cost | Storage Persistence | WhatsApp Ready |
|---|---|---|---|---|
| **Oracle Cloud (OCI)** | VPS | **$0.00 (Free Forever)** | ✅ 200 GB NVMe | ✅ Yes (24 GB RAM) |
| **Google Cloud e2-micro** | VPS | **$0.00 (Free Forever)** | ✅ 30 GB Disk | ✅ Yes (with swap) |
| **Fly.io** | PaaS | **Free Allowance** | ✅ Fly Volumes | ⚠️ Scale to 512MB |
| **Railway.app** | PaaS | ~$5.00 / mo | ✅ Volume Mounts | ✅ Yes |
| **Render.com** | PaaS | Free / $7.00 / mo | ⚠️ Paid Disks | ⚠️ Needs Keep-Alive |
| **Hetzner Cloud** | VPS | ~€3.79 / mo (~$4) | ✅ 40 GB NVMe | 🚀 Outstanding |
| **DigitalOcean** | VPS | $4.00 – $6.00 / mo | ✅ SSD Storage | ✅ Yes |
| **Home Lab / Raspberry Pi** | Self-Hosted | **$0.00 (Hardware)** | ✅ Native Local Disk | ✅ Yes |
