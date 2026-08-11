// src/db-maintenance.js
// Automated SQLite Database Maintenance, WAL Checkpoints & Backup Engine
// Keeps database size optimal, creates timestamped backups, and enforces data retention policies.

const fs = require('fs');
const path = require('path');
const { initDb } = require('./db');
const logger = require('./logger');

const DB_PATH = path.join(process.cwd(), 'data', 'newsbot.sqlite');
const BACKUP_DIR = path.join(process.cwd(), 'data', 'backups');

/**
 * Create a timestamped backup of the SQLite database.
 *
 * @returns {string|null} Path to backup file
 */
function createDatabaseBackup() {
  try {
    if (!fs.existsSync(DB_PATH)) return null;

    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    const d = new Date();
    const timestamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}_${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
    const backupFile = path.join(BACKUP_DIR, `newsbot-backup-${timestamp}.sqlite`);

    fs.copyFileSync(DB_PATH, backupFile);
    logger.success(`[DB Maintenance] Database backup created: ${backupFile}`);
    return backupFile;
  } catch (err) {
    logger.warn(`[DB Maintenance] Backup failed: ${err.message}`);
    return null;
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
 * Prune seen articles and cached summaries older than retention threshold.
 *
 * @param {number} [retentionDays=90]
 * @returns {number} Number of deleted records
 */
function pruneOldRecords(retentionDays = 90) {
  try {
    const db = initDb();
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();

    const stmt = db.prepare('DELETE FROM seen_articles WHERE sent_at < ?');
    const res = stmt.run(cutoff);
    logger.info(`[DB Maintenance] Pruned ${res.changes} records older than ${retentionDays} days`);
    return res.changes;
  } catch (err) {
    logger.warn(`[DB Maintenance] Pruning failed: ${err.message}`);
    return 0;
  }
}

module.exports = {
  createDatabaseBackup,
  optimizeDatabase,
  pruneOldRecords
};
