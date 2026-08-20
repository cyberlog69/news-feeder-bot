// src/db-maintenance.js
// Automated SQLite Database Maintenance, WAL Checkpoints & Backup Engine
// Keeps database size optimal, creates timestamped backups, and enforces data retention policies.

const fs = require('fs');
const path = require('path');
const { initDb } = require('./db');
const logger = require('./logger');

const DB_PATH = path.join(process.cwd(), 'data', 'newsbot.sqlite');
const BACKUP_DIR = path.join(process.cwd(), 'data', 'backups');
const MAX_BACKUPS = 7; // retention: keep the most recent 7 backups

/**
 * Create a timestamped backup of the SQLite database.
 * WAL frames are checkpointed first so the copy is consistent.
 *
 * @returns {string|null} Path to backup file
 */
function createDatabaseBackup() {
  try {
    if (!fs.existsSync(DB_PATH)) return null;

    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    // Flush WAL frames into the main DB file so the copy is crash-consistent
    try {
      initDb().exec('PRAGMA wal_checkpoint(TRUNCATE);');
    } catch (err) {
      logger.warn(`[DB Maintenance] WAL checkpoint before backup failed: ${err.message}`);
    }

    const d = new Date();
    const timestamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}_${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
    const backupFile = path.join(BACKUP_DIR, `newsbot-backup-${timestamp}.sqlite`);

    fs.copyFileSync(DB_PATH, backupFile);
    logger.success(`[DB Maintenance] Database backup created: ${backupFile}`);

    // Retention: remove oldest backups beyond MAX_BACKUPS
    pruneOldBackups();

    return backupFile;
  } catch (err) {
    logger.warn(`[DB Maintenance] Backup failed: ${err.message}`);
    return null;
  }
}

/** Delete oldest backups beyond the retention limit. */
function pruneOldBackups(max = MAX_BACKUPS) {
  try {
    if (!fs.existsSync(BACKUP_DIR)) return;
    const files = fs.readdirSync(BACKUP_DIR)
      .filter((f) => /^newsbot-backup-\d{8}_\d{4}\.sqlite$/.test(f))
      .sort();
    while (files.length > max) {
      const old = files.shift();
      fs.rmSync(path.join(BACKUP_DIR, old), { force: true });
      logger.info(`[DB Maintenance] Removed old backup: ${old}`);
    }
  } catch (err) {
    logger.warn(`[DB Maintenance] Backup retention prune failed: ${err.message}`);
  }
}

/**
 * Optimize database via WAL checkpoint and VACUUM.
 *
 * @returns {boolean}
 */
function optimizeDatabase() {
  try {
    const db = initDb();
    db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
    db.exec('VACUUM;');
    logger.success('[DB Maintenance] WAL checkpointed and database vacuumed successfully');
    return true;
  } catch (err) {
    logger.warn(`[DB Maintenance] Optimization error: ${err.message}`);
    return false;
  }
}

/**
 * Prune old records across all cache tables and cleanup generated media.
 * Previously only `seen_articles` was pruned — summary/translation/intel
 * caches and generated audio/cards grew forever.
 *
 * @param {number} [retentionDays=90]
 * @returns {number} Total number of deleted records
 */
function pruneOldRecords(retentionDays = 90) {
  try {
    const db = initDb();
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();

    let total = 0;

    const prune = (table, column) => {
      try {
        const res = db.prepare(`DELETE FROM ${table} WHERE ${column} < ?`).run(cutoff);
        total += res.changes;
      } catch { /* table may not exist yet */ }
    };

    prune('seen_articles', 'sent_at');
    prune('summary_cache', 'created_at');
    prune('translation_cache', 'created_at');
    prune('threat_intel_cache', 'updated_at');
    prune('article_vectors', 'created_at');
    prune('cisa_kev_cache', 'updated_at');       // old KEV entries can be safely re-synced
    prune('ransomware_victims', 'created_at');   // old victim disclosures expire naturally

    logger.info(`[DB Maintenance] Pruned ${total} records older than ${retentionDays} days`);
    return total;
  } catch (err) {
    logger.warn(`[DB Maintenance] Pruning failed: ${err.message}`);
    return 0;
  }
}

/**
 * Delete generated audio and alert-card files older than `days` to prevent
 * unbounded growth of data/audio and data/cards.
 *
 * @param {number} [days=30]
 * @returns {number} Number of files removed
 */
function cleanupGeneratedMedia(days = 30) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  let removed = 0;

  for (const dir of ['data', 'audio', 'cards']) {
    const full = path.join(process.cwd(), 'data', dir);
    try {
      if (!fs.existsSync(full)) continue;
      for (const f of fs.readdirSync(full)) {
        const filePath = path.join(full, f);
        try {
          const stat = fs.statSync(filePath);
          if (stat.isFile() && stat.mtimeMs < cutoff) {
            fs.rmSync(filePath, { force: true });
            removed++;
          }
        } catch {}
      }
    } catch {}
  }

  if (removed > 0) {
    logger.info(`[DB Maintenance] Cleaned up ${removed} stale generated media files`);
  }
  return removed;
}

module.exports = {
  createDatabaseBackup,
  optimizeDatabase,
  pruneOldRecords,
  cleanupGeneratedMedia
};
