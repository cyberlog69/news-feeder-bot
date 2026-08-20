// src/fetcher.js
// Fetches news articles from RSS feeds.
//
// Performance:
//   - ETag / Last-Modified caching: sends conditional HTTP requests.
//     If the feed hasn't changed (304), returns cached articles — no re-parse.
//   - Parallel fetch of all enabled sources via Promise.allSettled
//
// Security:
//   - All RSS/article URLs are validated (https/http only, no SSRF)
//   - Private IP ranges are blocked
//   - Content fields are capped in length

const Parser  = require('rss-parser');
const { extract } = require('@extractus/article-extractor');
const dns     = require('dns/promises');
const net     = require('net');
const logger  = require('./logger');

// ── SSRF Protection ───────────────────────────────────────────────────────────
const PRIVATE_IP_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^0\.0\.0\.0/,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
];

/**
 * Check whether an IP literal is private / reserved / link-local.
 * Handles both IPv4 and IPv6, including IPv4-mapped IPv6.
 * @param {string} ip
 * @returns {boolean}
 */
function isPrivateIp(ip) {
  if (!ip) return false;
  const addr = String(ip).toLowerCase().trim();

  // IPv4-mapped IPv6 (::ffff:10.0.0.1) → check the embedded IPv4
  const v4mapped = addr.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (v4mapped) return isPrivateIp(v4mapped[1]);

  if (net.isIPv4(addr)) {
    const [a, b, c] = addr.split('.').map(Number);
    if (a === 0)                     return true;  // 0.0.0.0/8 "this network"
    if (a === 10)                    return true;  // 10.0.0.0/8
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
    if (a === 127)                   return true;  // 127.0.0.0/8 loopback
    if (a === 169 && b === 254)      return true;  // 169.254.0.0/16 link-local
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 0 && c === 0)  return true; // 192.0.0.0/24
    if (a === 192 && b === 0 && c === 2)  return true; // 192.0.2.0/24 TEST-NET-1
    if (a === 192 && b === 168)      return true;  // 192.168.0.0/16
    if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15 benchmarking
    if (a === 198 && b === 51 && c === 100) return true;  // 198.51.100.0/24 TEST-NET-2
    if (a === 203 && b === 0 && c === 113)  return true;  // 203.0.113.0/24 TEST-NET-3
    if (a >= 224)                    return true;  // 224.0.0.0/4 multicast + reserved
    return false;
  }

  if (net.isIPv6(addr)) {
    if (addr === '::' || addr === '::1')      return true; // unspecified + loopback
    if (addr.startsWith('fc') || addr.startsWith('fd')) return true; // fc00::/7 ULA
    if (addr.startsWith('fe8') || addr.startsWith('fe9') || addr.startsWith('fea') || addr.startsWith('feb')) return true; // fe80::/10 link-local
    if (addr.startsWith('2001:db8'))          return true; // 2001:db8::/32 documentation
    if (addr.startsWith('2001:10') || addr.startsWith('2001:20')) return true; // ORCHID
    return false;
  }

  return false;
}

function isSafeUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    const hostname = parsed.hostname;
    if (PRIVATE_IP_PATTERNS.some((p) => p.test(hostname))) return false;
    // If the hostname is itself an IP literal, validate it exhaustively
    if (net.isIP(hostname)) return !isPrivateIp(hostname);
    return true;
  } catch {
    return false;
  }
}

/**
 * Async SSRF validation: resolves the hostname via DNS and blocks the request
 * if ANY resolved address is private/reserved. Mitigates DNS-rebinding attacks
 * (e.g. hostnames that resolve to 127.0.0.1 / 169.254.169.254 at fetch time).
 * @param {string} url
 * @returns {Promise<boolean>}
 */
async function resolveSafeUrl(url) {
  if (!isSafeUrl(url)) return false;

  try {
    const hostname = new URL(url).hostname;
    if (net.isIP(hostname)) return !isPrivateIp(hostname);

    const addresses = await dns.lookup(hostname, { all: true });
    if (!addresses || addresses.length === 0) return false;
    return addresses.every((entry) => !isPrivateIp(entry.address));
  } catch {
    // DNS resolution failure → treat as unsafe rather than risk SSRF
    return false;
  }
}

// ── ETag / Last-Modified cache ────────────────────────────────────────────────
// Stores { etag, lastModified, articles } per RSS URL so we can skip re-fetching
// unchanged feeds (saves bandwidth + CPU on every 5-minute tick).
const etagCache = new Map();

const USER_AGENT =
  'Mozilla/5.0 (compatible; NewsFeederBot/2.0; +https://github.com/cyberlog69/news-feeder-bot)';

// rss-parser instance — used for parseString() after we handle HTTP ourselves
const parser = new Parser({
  timeout: 15000,
  headers: { 'User-Agent': USER_AGENT },
  customFields: {
    item: [
      ['media:content', 'mediaContent'],
      ['content:encoded', 'contentEncoded']
    ]
  }
});

// Stores feed health stats: { name, url, status, lastFetch, latencyMs, errorCount, articleCount }
const feedHealthMap = new Map();

/**
 * Fetch the latest articles from a single RSS source.
 * Uses conditional requests (ETag/Last-Modified) to skip unchanged feeds.
 */
async function fetchSource(source) {
  const startTime = Date.now();
  const rssUrl = source.rss;

  if (!isSafeUrl(rssUrl)) {
    logger.warn(`Skipping source "${source.name}": invalid or unsafe RSS URL`);
    recordFeedHealth(source.name, rssUrl, 'Invalid URL', 0, Date.now() - startTime, 0);
    return [];
  }

  // DNS-rebinding defense: resolve hostname and block if it points anywhere private
  const safeResolved = await resolveSafeUrl(rssUrl);
  if (!safeResolved) {
    logger.warn(`Skipping source "${source.name}": RSS URL resolves to a private/reserved address (SSRF)`);
    recordFeedHealth(source.name, rssUrl, 'SSRF Blocked', 0, Date.now() - startTime, 0);
    return [];
  }

  try {
    logger.info(`Fetching: ${source.name}`);

    // Build conditional request headers
    const cached    = etagCache.get(rssUrl);
    const reqHeaders = { 'User-Agent': USER_AGENT };
    if (cached?.etag)         reqHeaders['If-None-Match']     = cached.etag;
    if (cached?.lastModified) reqHeaders['If-Modified-Since'] = cached.lastModified;

    // Use native fetch so we can read response headers ourselves
    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), 15000);
    let res;
    try {
      res = await fetch(rssUrl, { headers: reqHeaders, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }

    const latencyMs = Date.now() - startTime;

    // 304 Not Modified — feed hasn't changed, use cached articles
    if (res.status === 304 && cached?.articles?.length > 0) {
      logger.info(`  ${source.name}: not modified (served from cache)`);
      recordFeedHealth(source.name, rssUrl, 304, cached.articles.length, latencyMs, 0);
      return cached.articles;
    }

    if (!res.ok) {
      logger.error(`Failed to fetch ${source.name}: HTTP ${res.status}`);
      recordFeedHealth(source.name, rssUrl, res.status, 0, latencyMs, 1);
      return cached?.articles || [];
    }

    // Parse feed from response body text
    const text = await res.text();
    const feed = await parser.parseString(text);

    // Map to our article shape
    const articles = feed.items.slice(0, 15).map((item) => {
      const rawContent =
        item.contentSnippet ||
        item.contentEncoded ||
        item.content ||
        item.summary ||
        '';
      const url = item.link || item.guid || '';

      return {
        title:       cleanText(item.title || 'No Title').slice(0, 300),
        url:         isSafeUrl(url) ? url : '',
        description: cleanText(rawContent).slice(0, 5000),
        publishedAt: item.pubDate || item.isoDate || new Date().toISOString(),
        source:      source.name,
        category:    source.category
      };
    }).filter((a) => a.url);

    // Update ETag cache for next request
    etagCache.set(rssUrl, {
      etag:         res.headers.get('etag')          || null,
      lastModified: res.headers.get('last-modified') || null,
      articles
    });

    recordFeedHealth(source.name, rssUrl, 200, articles.length, latencyMs, 0);
    return articles;

  } catch (err) {
    const latencyMs = Date.now() - startTime;
    const cached = etagCache.get(rssUrl);
    logger.error(`Failed to fetch ${source.name}: ${err.message.split('\n')[0]}`);
    recordFeedHealth(source.name, rssUrl, 'Error', cached?.articles?.length || 0, latencyMs, 1);
    return cached?.articles || [];
  }
}

function recordFeedHealth(name, rss, status, articleCount, latencyMs, errIncrement = 0) {
  const existing = feedHealthMap.get(rss) || { errorCount: 0 };
  feedHealthMap.set(rss, {
    name,
    rss,
    status,
    articleCount,
    latencyMs,
    errorCount: existing.errorCount + errIncrement,
    lastFetch: new Date().toISOString()
  });
}

function getFeedHealth() {
  return Array.from(feedHealthMap.values());
}

/**
 * Fetch all enabled sources in parallel.
 */
async function fetchAllSources(sources) {
  const enabled = sources.filter((s) => s.enabled);
  const results = await Promise.allSettled(enabled.map(fetchSource));

  const all = [];
  results.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      all.push(...result.value);
    } else {
      logger.warn(`Source ${enabled[i].name} rejected: ${result.reason}`);
    }
  });

  return all;
}

/**
 * Attempt to extract full article text from a URL.
 * SSRF: URL is validated before fetching.
 */
async function getFullArticleText(url) {
  if (!isSafeUrl(url)) return null;
  if (!(await resolveSafeUrl(url))) return null;

  try {
    const article = await extract(url, {}, { timeout: 12000 });
    if (!article?.content) return null;

    return article.content
      .replace(/<[^>]{0,500}>/g, ' ')
      .replace(/&[a-z]{1,10};/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 5000);
  } catch {
    return null;
  }
}

/** Strip HTML and collapse whitespace */
function cleanText(str) {
  return String(str || '')
    .replace(/<[^>]{0,500}>/g, ' ')
    .replace(/&[a-z]{1,10};/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = { fetchAllSources, getFullArticleText, isSafeUrl, resolveSafeUrl, isPrivateIp, getFeedHealth };
