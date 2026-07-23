// src/deduplicator.js
// Tracks articles we've already sent using SQLite database persistence.
// Maintains fast in-memory Set/Array cache for O(1) checks & Jaccard title similarity.

const { isUrlSeen, markUrlSeen, getSeenArticles, getTotalSeenCount } = require('./db');
const logger = require('./logger');

const FUZZY_THRESHOLD = 0.75;
const FUZZY_WINDOW_HOURS = 6;

function normalizeTitle(title) {
  return new Set(
    String(title || '')
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );
}

function jaccardSimilarity(setA, setB) {
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersectionCount = 0;
  for (const word of setA) {
    if (setB.has(word)) intersectionCount++;
  }
  const unionCount = setA.size + setB.size - intersectionCount;
  return intersectionCount / unionCount;
}

class Deduplicator {
  constructor() {
    this.seen = new Set();
    this.meta = [];
    this._reloadFromDb();
    logger.info(`Deduplicator ready — ${this.seen.size} articles in history`);
  }

  _reloadFromDb() {
    try {
      this.meta = getSeenArticles(1000);
      this.seen = new Set(this.meta.map((a) => a.url));
    } catch (err) {
      logger.warn(`Could not load seen articles from DB: ${err.message}`);
      this.meta = [];
      this.seen = new Set();
    }
  }

  isSeen(url) {
    if (this.seen.has(url)) return true;
    return isUrlSeen(url);
  }

  isSimilarTitle(title) {
    if (!title || title.length < 15) return { isDuplicate: false };

    const windowMs = FUZZY_WINDOW_HOURS * 60 * 60 * 1000;
    const cutoff = Date.now() - windowMs;
    const incomingWs = normalizeTitle(title);

    const recent = this.meta.filter((a) => {
      try { return new Date(a.sentAt).getTime() > cutoff; } catch { return false; }
    });

    for (const a of recent) {
      if (!a.title) continue;
      const storedWs = normalizeTitle(a.title);
      const score = jaccardSimilarity(incomingWs, storedWs);
      if (score >= FUZZY_THRESHOLD) {
        return { isDuplicate: true, matchedTitle: a.title, score };
      }
    }

    return { isDuplicate: false };
  }

  markSeen(url, title = '', source = '') {
    if (this.seen.has(url)) return;

    this.seen.add(url);
    const articleObj = {
      url: url.slice(0, 2048),
      title: title.slice(0, 120),
      source: String(source).slice(0, 100),
      sentAt: new Date().toISOString()
    };
    this.meta.unshift(articleObj);

    markUrlSeen(url, title, source);
  }

  getStats() {
    return { totalSent: getTotalSeenCount() };
  }

  getRecent(limit = 50) {
    return getSeenArticles(limit);
  }

  flush() {
    // SQLite synchronous writes do not require pending flush
  }
}

module.exports = Deduplicator;
