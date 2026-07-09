// src/deduplicator.js
// Tracks articles we've already sent using a local JSON file so we never
// send duplicates — even across bot restarts.
//
// Deduplication methods:
//   1. Exact URL match  — primary check (O(1) Set lookup)
//   2. Fuzzy title match — catches the same story from multiple sources
//      Uses Jaccard word-set similarity. Articles with >80% title similarity
//      published within 6 hours are treated as duplicates.
//
// Performance: writes are debounced (batched) — only flushes to disk once
// per 5 seconds maximum, regardless of how many articles are marked seen.

const fs   = require('fs');
const path = require('path');
const logger = require('./logger');

const MAX_ENTRIES        = 5000;
const DEBOUNCE_MS        = 5000;   // batch writes: max 1 disk write per 5 seconds
const FUZZY_THRESHOLD    = 0.75;   // Jaccard similarity score for title match (0.75 = ~3/4 words match)
const FUZZY_WINDOW_HOURS = 6;      // only compare titles within this time window

// ── Title similarity (Jaccard word-set) ──────────────────────────────────────
/**
 * Normalise a title for comparison: lowercase, strip punctuation, split into words.
 * @param {string} title
 * @returns {Set<string>}
 */
function normalizeTitle(title) {
  return new Set(
    String(title || '')
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, '')   // strip punctuation
      .split(/\s+/)
      .filter((w) => w.length > 2)  // ignore short stop-words (a, is, the…)
  );
}

/**
 * Jaccard similarity between two word sets: |intersection| / |union|
 * Returns 0.0 (completely different) to 1.0 (identical).
 * @param {Set<string>} setA
 * @param {Set<string>} setB
 * @returns {number}
 */
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
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    this.filePath   = path.join(dataDir, 'seen_articles.json');
    this.seen       = new Set();   // URL index for O(1) exact lookup
    this.meta       = [];          // full article objects for fuzzy check + dashboard
    this._saveTimer = null;        // debounce handle
    this._dirty     = false;       // true if in-memory state differs from disk

    this._load();
    logger.info(`Deduplicator ready — ${this.seen.size} articles already in history`);
  }

  /** Load existing data from disk into memory. */
  _load() {
    if (!fs.existsSync(this.filePath)) return;
    try {
      const raw  = fs.readFileSync(this.filePath, 'utf-8');
      const data = JSON.parse(raw);
      this.meta = Array.isArray(data.articles) ? data.articles : [];
      this.seen = new Set(this.meta.map((a) => a.url));
    } catch (err) {
      logger.warn(`Could not read seen_articles.json — starting fresh. (${err.message})`);
      this.meta = [];
      this.seen = new Set();
    }
  }

  /** Immediately persist current state to disk. */
  _save() {
    // Trim oldest entries if we've exceeded the limit
    if (this.meta.length > MAX_ENTRIES) {
      this.meta = this.meta.slice(this.meta.length - MAX_ENTRIES);
      this.seen = new Set(this.meta.map((a) => a.url));
    }

    const payload = {
      lastUpdated: new Date().toISOString(),
      totalCount:  this.meta.length,
      articles:    this.meta
    };

    try {
      fs.writeFileSync(
        this.filePath,
        JSON.stringify(payload, null, 2),
        { encoding: 'utf-8', mode: 0o600 }
      );
      this._dirty = false;
    } catch (err) {
      logger.error(`Failed to save seen_articles.json: ${err.message}`);
    }
  }

  /**
   * Schedule a deferred save (debounced).
   * Multiple calls within DEBOUNCE_MS result in only one disk write.
   */
  _saveLater() {
    this._dirty = true;
    if (this._saveTimer) return;  // already scheduled
    this._saveTimer = setTimeout(() => {
      this._saveTimer = null;
      if (this._dirty) this._save();
    }, DEBOUNCE_MS);
  }

  /**
   * Force an immediate flush to disk (call on graceful shutdown).
   */
  flush() {
    if (this._saveTimer) {
      clearTimeout(this._saveTimer);
      this._saveTimer = null;
    }
    if (this._dirty) this._save();
  }

  /** Returns true if this URL has already been sent (exact match). */
  isSeen(url) {
    return this.seen.has(url);
  }

  /**
   * Check whether a title is too similar to a recently-sent article.
   * Only compares articles sent within FUZZY_WINDOW_HOURS hours to avoid
   * false positives for ongoing stories.
   *
   * @param {string} title
   * @returns {{ isDuplicate: boolean, matchedTitle?: string, score?: number }}
   */
  isSimilarTitle(title) {
    if (!title || title.length < 15) return { isDuplicate: false };

    const windowMs   = FUZZY_WINDOW_HOURS * 60 * 60 * 1000;
    const cutoff     = Date.now() - windowMs;
    const incomingWs = normalizeTitle(title);

    // Only check recent articles within the time window
    const recent = this.meta.filter((a) => {
      try { return new Date(a.sentAt).getTime() > cutoff; } catch { return false; }
    });

    for (const a of recent) {
      if (!a.title) continue;
      const storedWs = normalizeTitle(a.title);
      const score    = jaccardSimilarity(incomingWs, storedWs);
      if (score >= FUZZY_THRESHOLD) {
        return { isDuplicate: true, matchedTitle: a.title, score };
      }
    }

    return { isDuplicate: false };
  }

  /** Mark a URL as seen so it won't be sent again. Uses debounced write. */
  markSeen(url, title = '', source = '') {
    if (this.seen.has(url)) return;

    this.seen.add(url);
    this.meta.push({
      url:    url.slice(0, 2048),
      title:  title.slice(0, 120),
      source: String(source).slice(0, 100),
      sentAt: new Date().toISOString()
    });

    this._saveLater();   // debounced — not immediate
  }

  /** Return summary stats. */
  getStats() {
    return { totalSent: this.seen.size };
  }

  /** Return recent articles (for digest / dashboard). */
  getRecent(limit = 50) {
    return this.meta.slice(-limit).reverse();
  }
}

module.exports = Deduplicator;
