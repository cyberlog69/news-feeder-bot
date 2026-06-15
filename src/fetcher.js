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

function isSafeUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    const hostname = parsed.hostname;
    if (PRIVATE_IP_PATTERNS.some((p) => p.test(hostname))) return false;
    return true;
  } catch {
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

/**
 * Fetch the latest articles from a single RSS source.
 * Uses conditional requests (ETag/Last-Modified) to skip unchanged feeds.
 */
async function fetchSource(source) {
  if (!isSafeUrl(source.rss)) {
    logger.warn(`Skipping source "${source.name}": invalid or unsafe RSS URL`);
    return [];
  }

  try {
    logger.info(`Fetching: ${source.name}`);

    // Build conditional request headers
    const cached    = etagCache.get(source.rss);
    const reqHeaders = { 'User-Agent': USER_AGENT };
    if (cached?.etag)         reqHeaders['If-None-Match']     = cached.etag;
    if (cached?.lastModified) reqHeaders['If-Modified-Since'] = cached.lastModified;

    // Use native fetch so we can read response headers ourselves
    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), 15000);
    let res;
    try {
      res = await fetch(source.rss, { headers: reqHeaders, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }

    // 304 Not Modified — feed hasn't changed, use cached articles
    if (res.status === 304 && cached?.articles?.length > 0) {
      logger.info(`  ${source.name}: not modified (served from cache)`);
      return cached.articles;
    }

    if (!res.ok) {
      logger.error(`Failed to fetch ${source.name}: HTTP ${res.status}`);
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
    etagCache.set(source.rss, {
      etag:         res.headers.get('etag')          || null,
      lastModified: res.headers.get('last-modified') || null,
      articles
    });

    return articles;

  } catch (err) {
    // On error, return whatever we cached last so the bot keeps working
    const cached = etagCache.get(source.rss);
    logger.error(`Failed to fetch ${source.name}: ${err.message.split('\n')[0]}`);
    return cached?.articles || [];
  }
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

module.exports = { fetchAllSources, getFullArticleText, isSafeUrl };
