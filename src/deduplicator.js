// src/deduplicator.js
// Tracks articles we've already sent using a local JSON file so we never
// send duplicates — even across bot restarts.
//
// Performance: writes are debounced (batched) — only flushes to disk once
// per 5 seconds maximum, regardless of how many articles are marked seen.

const fs   = require('fs');
const path = require('path');
const logger = require('./logger');

const MAX_ENTRIES   = 5000;
const DEBOUNCE_MS   = 5000;  // batch writes: max 1 disk write per 5 seconds

class Deduplicator {
  constructor() {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    this.filePath   = path.join(dataDir, 'seen_articles.json');
    this.seen       = new Set();
    this.meta       = [];
    this._saveTimer = null;   // debounce handle
    this._dirty     = false;  // true if in-memory state differs from disk

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

  /** Returns true if this URL has already been sent. */
  isSeen(url) {
    return this.seen.has(url);
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
