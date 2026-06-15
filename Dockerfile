# ─────────────────────────────────────────────────────────
#  Dockerfile — News Feeder Bot v3.0
#
#  Multi-stage build:
#    Stage 1 (deps)  — install only production npm deps
#    Stage 2 (final) — lean runtime image with Chrome
#
#  WhatsApp Note:
#    The first run requires a QR code scan. Mount .wwebjs_auth/
#    as a Docker volume so the session persists across restarts.
#
#  Usage:
#    docker build -t news-feeder-bot .
#    docker-compose up -d
# ─────────────────────────────────────────────────────────

# ── Stage 1: Install dependencies ────────────────────────
FROM node:20-bookworm-slim AS deps

WORKDIR /app

COPY package*.json ./

# Install production deps only (puppeteer will download Chromium here)
RUN npm ci --omit=dev


# ── Stage 2: Production runtime ──────────────────────────
FROM node:20-bookworm-slim AS final

# Install Chrome/Chromium runtime dependencies
# These are needed by puppeteer's bundled Chromium to run
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    fonts-liberation \
    fonts-noto-color-emoji \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for security (don't run as root)
RUN groupadd -r botuser && useradd -r -g botuser -d /app -s /sbin/nologin botuser

WORKDIR /app

# Copy installed node_modules from deps stage (includes puppeteer + Chromium)
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY --chown=botuser:botuser . .

# Create persistent data directories and set correct ownership
RUN mkdir -p data/logs .wwebjs_auth .wwebjs_cache \
    && chown -R botuser:botuser data .wwebjs_auth .wwebjs_cache

# Switch to non-root user
USER botuser

# Production environment
ENV NODE_ENV=production

# Port for web dashboard + health check
# Cloud platforms (Railway, Render, Fly.io) override this with their own PORT
EXPOSE 3000

# Health check — used by Docker and cloud platforms
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD wget -qO- http://localhost:${PORT:-3000}/health || exit 1

CMD ["node", "index.js"]
