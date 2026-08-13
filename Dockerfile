# ─────────────────────────────────────────────────────────
#  Dockerfile — News Feeder Bot v3.14.0
#
#  Multi-stage build:
#    Stage 1 (deps)  — install production npm deps without heavy chrome binaries
#    Stage 2 (final) — lean production runtime with pre-configured Debian Chromium
#
#  Usage:
#    docker build -t news-feeder-bot .
#    docker compose up -d
# ─────────────────────────────────────────────────────────

# ── Stage 1: Install dependencies ────────────────────────
FROM node:22-bookworm-slim AS deps

WORKDIR /app

# Skip downloading bundled Chromium inside minimal build stage
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

COPY package*.json ./

# Install production deps only
RUN npm ci --omit=dev


# ── Stage 2: Production runtime ──────────────────────────
FROM node:22-bookworm-slim AS final

ENV DEBIAN_FRONTEND=noninteractive
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV CHROME_PATH=/usr/bin/chromium

# Install official Debian Chromium browser, fonts, and CA certificates
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    fonts-noto-color-emoji \
    ca-certificates \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN groupadd -r botuser && useradd -r -g botuser -d /app -s /sbin/nologin botuser

WORKDIR /app

# Copy installed node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY --chown=botuser:botuser . .

# Create persistent data directories and set ownership
RUN mkdir -p data/logs .wwebjs_auth .wwebjs_cache \
    && chown -R botuser:botuser data .wwebjs_auth .wwebjs_cache

# Switch to non-root user
USER botuser

# Production environment
ENV NODE_ENV=production

# Port for web dashboard + health check
EXPOSE 3000

# Health check — used by Docker and cloud platforms
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD wget -qO- http://localhost:${PORT:-3000}/health || exit 1

CMD ["node", "index.js"]
