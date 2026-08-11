// src/db.js
// Native SQLite database persistence layer using Node.js built-in node:sqlite.
// Manages deduplication history and AI summary cache with auto-migration from legacy JSON files.

const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'newsbot.sqlite');

let db = null;

function initDb() {
  if (db) return db;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  try {
    const { DatabaseSync } = require('node:sqlite');
    db = new DatabaseSync(DB_PATH);

    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA busy_timeout = 5000;');

    // Create tables
    db.exec(`
      CREATE TABLE IF NOT EXISTS seen_articles (
        url TEXT PRIMARY KEY,
        title TEXT,
        source TEXT,
        sent_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_seen_sent_at ON seen_articles(sent_at);

      CREATE TABLE IF NOT EXISTS summary_cache (
        url TEXT PRIMARY KEY,
        summary TEXT,
        created_at TEXT
      );

      CREATE TABLE IF NOT EXISTS threat_intel_cache (
        cve_id TEXT PRIMARY KEY,
        cvss REAL,
        severity TEXT,
        epss REAL,
        percentile REAL,
        updated_at TEXT
      );

      CREATE TABLE IF NOT EXISTS translation_cache (
        text_hash TEXT,
        target_lang TEXT,
        translation TEXT,
        created_at TEXT,
        PRIMARY KEY (text_hash, target_lang)
      );

      CREATE TABLE IF NOT EXISTS article_vectors (
        url TEXT PRIMARY KEY,
        title TEXT,
        summary TEXT,
        source TEXT,
        published_at TEXT,
        vector_json TEXT,
        created_at TEXT
      );

      CREATE TABLE IF NOT EXISTS cisa_kev_cache (
        cve_id TEXT PRIMARY KEY,
        vendor_project TEXT,
        product TEXT,
        vulnerability_name TEXT,
        date_added TEXT,
        required_action TEXT,
        due_date TEXT,
        known_ransomware_use INTEGER,
        updated_at TEXT
      );

      CREATE TABLE IF NOT EXISTS ransomware_victims (
        victim_id TEXT PRIMARY KEY,
        group_name TEXT,
        victim_name TEXT,
        country TEXT,
        sector TEXT,
        discovered_at TEXT,
        created_at TEXT
      );
    `);

    // Migrate legacy JSON files if they exist
    migrateLegacyJson(db);

    logger.info(`SQLite database initialized at: data/newsbot.sqlite`);
    return db;
  } catch (err) {
    logger.error(`SQLite database init failed: ${err.message}`);
    throw err;
  }
}

function migrateLegacyJson(database) {
  const seenJsonPath = path.join(DATA_DIR, 'seen_articles.json');
  const cacheJsonPath = path.join(DATA_DIR, 'summary_cache.json');

  // 1. Migrate seen_articles.json
  if (fs.existsSync(seenJsonPath)) {
    try {
      const raw = fs.readFileSync(seenJsonPath, 'utf-8');
      const data = JSON.parse(raw);
      const articles = Array.isArray(data.articles) ? data.articles : [];

      if (articles.length > 0) {
        const stmt = database.prepare(`
          INSERT OR IGNORE INTO seen_articles (url, title, source, sent_at)
          VALUES (?, ?, ?, ?)
        `);

        let count = 0;
        for (const a of articles) {
          if (a.url) {
            stmt.run(a.url, a.title || '', a.source || '', a.sentAt || new Date().toISOString());
            count++;
          }
        }
        logger.success(`Migrated ${count} articles from seen_articles.json into SQLite`);
      }
      fs.renameSync(seenJsonPath, `${seenJsonPath}.migrated`);
    } catch (err) {
      logger.warn(`Could not migrate seen_articles.json: ${err.message}`);
    }
  }

  // 2. Migrate summary_cache.json
  if (fs.existsSync(cacheJsonPath)) {
    try {
      const raw = fs.readFileSync(cacheJsonPath, 'utf-8');
      const data = JSON.parse(raw);

      if (data && typeof data === 'object') {
        const stmt = database.prepare(`
          INSERT OR IGNORE INTO summary_cache (url, summary, created_at)
          VALUES (?, ?, ?)
        `);

        let count = 0;
        const now = new Date().toISOString();
        for (const [url, summary] of Object.entries(data)) {
          if (url && summary) {
            stmt.run(url, summary, now);
            count++;
          }
        }
        logger.success(`Migrated ${count} cached summaries from summary_cache.json into SQLite`);
      }
      fs.renameSync(cacheJsonPath, `${cacheJsonPath}.migrated`);
    } catch (err) {
      logger.warn(`Could not migrate summary_cache.json: ${err.message}`);
    }
  }
}

// ── Seen Articles API ─────────────────────────────────────────────────────────

function isUrlSeen(url) {
  const database = initDb();
  const stmt = database.prepare('SELECT 1 FROM seen_articles WHERE url = ? LIMIT 1');
  const row = stmt.get(url);
  return Boolean(row);
}

function markUrlSeen(url, title = '', source = '') {
  const database = initDb();
  const stmt = database.prepare(`
    INSERT OR REPLACE INTO seen_articles (url, title, source, sent_at)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(url, title, source, new Date().toISOString());
}

function getSeenArticles(limit = 50) {
  const database = initDb();
  const stmt = database.prepare(`
    SELECT url, title, source, sent_at as sentAt
    FROM seen_articles
    ORDER BY sent_at DESC
    LIMIT ?
  `);
  return stmt.all(limit);
}

function searchSeenArticles(keyword, limit = 10) {
  const database = initDb();
  const stmt = database.prepare(`
    SELECT url, title, source, sent_at as sentAt
    FROM seen_articles
    WHERE title LIKE ? OR source LIKE ?
    ORDER BY sent_at DESC
    LIMIT ?
  `);
  const pattern = `%${keyword}%`;
  return stmt.all(pattern, pattern, limit);
}

function getTotalSeenCount() {
  const database = initDb();
  const stmt = database.prepare('SELECT COUNT(*) as count FROM seen_articles');
  const row = stmt.get();
  return row ? row.count : 0;
}

// ── Summary Cache API ─────────────────────────────────────────────────────────

function getCachedSummary(url) {
  if (!url) return null;
  const database = initDb();
  const stmt = database.prepare('SELECT summary FROM summary_cache WHERE url = ? LIMIT 1');
  const row = stmt.get(url);
  return row ? row.summary : null;
}

function setCachedSummary(url, summary) {
  if (!url || !summary) return;
  const database = initDb();
  const stmt = database.prepare(`
    INSERT OR REPLACE INTO summary_cache (url, summary, created_at)
    VALUES (?, ?, ?)
  `);
  stmt.run(url, summary, new Date().toISOString());
}

// ── Threat Intel Cache API ────────────────────────────────────────────────────

function getCveCache(cveId) {
  if (!cveId) return null;
  const database = initDb();
  const stmt = database.prepare('SELECT cve_id as cveId, cvss, severity, epss, percentile FROM threat_intel_cache WHERE cve_id = ? LIMIT 1');
  return stmt.get(cveId) || null;
}

function setCveCache(cveId, data) {
  if (!cveId || !data) return;
  const database = initDb();
  const stmt = database.prepare(`
    INSERT OR REPLACE INTO threat_intel_cache (cve_id, cvss, severity, epss, percentile, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(cveId, data.cvss || null, data.severity || null, data.epss || null, data.percentile || null, new Date().toISOString());
}

// ── Translation Cache API ────────────────────────────────────────────────────

const crypto = require('crypto');

function hashText(text) {
  return crypto.createHash('sha256').update(String(text || '')).digest('hex');
}

function getCachedTranslation(text, targetLang) {
  if (!text || !targetLang) return null;
  const database = initDb();
  const h = hashText(text);
  const stmt = database.prepare('SELECT translation FROM translation_cache WHERE text_hash = ? AND target_lang = ? LIMIT 1');
  const row = stmt.get(h, String(targetLang).toLowerCase().trim());
  return row ? row.translation : null;
}

function setCachedTranslation(text, targetLang, translation) {
  if (!text || !targetLang || !translation) return;
  const database = initDb();
  const h = hashText(text);
  const stmt = database.prepare(`
    INSERT OR REPLACE INTO translation_cache (text_hash, target_lang, translation, created_at)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(h, String(targetLang).toLowerCase().trim(), translation, new Date().toISOString());
}

// ── Vector RAG Storage API ───────────────────────────────────────────────────

function saveArticleVector(url, title, summary, source, publishedAt, vectorJson) {
  if (!url || !title) return;
  const database = initDb();
  const stmt = database.prepare(`
    INSERT OR REPLACE INTO article_vectors (url, title, summary, source, published_at, vector_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(url, title, summary || '', source || '', publishedAt || new Date().toISOString(), vectorJson || '{}', new Date().toISOString());
}

function getAllArticleVectors(limit = 100) {
  const database = initDb();
  const stmt = database.prepare(`
    SELECT url, title, summary, source, published_at as publishedAt, vector_json as vectorJson
    FROM article_vectors
    ORDER BY created_at DESC
    LIMIT ?
  `);
  return stmt.all(limit);
}

// ── CISA KEV & Ransomware Storage API ─────────────────────────────────────────

function getCisaKev(cveId) {
  if (!cveId) return null;
  const database = initDb();
  const stmt = database.prepare(`
    SELECT cve_id as cveId, vendor_project as vendorProject, product,
           vulnerability_name as vulnerabilityName, date_added as dateAdded,
           required_action as requiredAction, due_date as dueDate,
           known_ransomware_use as knownRansomwareUse
    FROM cisa_kev_cache
    WHERE cve_id = ?
  `);
  const row = stmt.get(cveId.toUpperCase().trim());
  if (!row) return null;
  return {
    ...row,
    knownRansomwareUse: Boolean(row.knownRansomwareUse)
  };
}

function setCisaKev(cveId, kevData) {
  if (!cveId || !kevData) return;
  const database = initDb();
  const stmt = database.prepare(`
    INSERT OR REPLACE INTO cisa_kev_cache (
      cve_id, vendor_project, product, vulnerability_name,
      date_added, required_action, due_date, known_ransomware_use, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    cveId.toUpperCase().trim(),
    kevData.vendorProject || '',
    kevData.product || '',
    kevData.vulnerabilityName || '',
    kevData.dateAdded || '',
    kevData.requiredAction || '',
    kevData.dueDate || '',
    kevData.knownRansomwareUse ? 1 : 0,
    new Date().toISOString()
  );
}

function isRansomwareVictimSeen(victimId) {
  if (!victimId) return false;
  const database = initDb();
  const stmt = database.prepare(`SELECT 1 FROM ransomware_victims WHERE victim_id = ?`);
  return Boolean(stmt.get(victimId));
}

function markRansomwareVictimSeen(victimId, groupName, victimName, country, sector, discoveredAt) {
  if (!victimId || !groupName) return;
  const database = initDb();
  const stmt = database.prepare(`
    INSERT OR REPLACE INTO ransomware_victims (
      victim_id, group_name, victim_name, country, sector, discovered_at, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    victimId,
    groupName,
    victimName || '',
    country || '',
    sector || '',
    discoveredAt || new Date().toISOString(),
    new Date().toISOString()
  );
}

module.exports = {
  initDb,
  isUrlSeen,
  markUrlSeen,
  getSeenArticles,
  searchSeenArticles,
  getTotalSeenCount,
  getCachedSummary,
  setCachedSummary,
  getCveCache,
  setCveCache,
  getCachedTranslation,
  setCachedTranslation,
  saveArticleVector,
  getAllArticleVectors,
  getCisaKev,
  setCisaKev,
  isRansomwareVictimSeen,
  markRansomwareVictimSeen
};
