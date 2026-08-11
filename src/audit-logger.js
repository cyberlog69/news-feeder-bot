// src/audit-logger.js
// Enterprise SIEM & SOC Audit Logging Exporter
// Produces RFC/CEF (Common Event Format) and ECS (Elastic Common Schema) audit trails for compliance.

const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const AUDIT_DIR = path.join(process.cwd(), 'data', 'logs');

function getAuditLogPath() {
  const d = new Date();
  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return path.join(AUDIT_DIR, `audit-${dateStr}.log`);
}

/**
 * Format an event into ArcSight Common Event Format (CEF).
 * Format: CEF:Version|Device Vendor|Device Product|Device Version|Signature ID|Name|Severity|Extension
 *
 * @param {object} event
 * @returns {string}
 */
function formatCefEvent(event) {
  const severityMap = { low: 1, medium: 5, high: 8, critical: 10 };
  const sevNum = severityMap[String(event.severity || 'low').toLowerCase()] || 3;

  const type = event.type || 'SECURITY_ALERT';
  const name = String(event.name || 'Security Event').replace(/\|/g, '\\|');
  const details = String(event.details || '').replace(/=/g, '\\=');
  const actor = event.actor || 'system';

  return `CEF:0|NewsFeederBot|SOCEngine|3.13|${type}|${name}|${sevNum}|src=${event.ip || '127.0.0.1'} suser=${actor} msg=${details} rt=${Date.now()}`;
}

/**
 * Format an event into Elastic Common Schema (ECS) JSON.
 *
 * @param {object} event
 * @returns {object}
 */
function formatEcsEvent(event) {
  return {
    '@timestamp': new Date().toISOString(),
    event: {
      kind: 'alert',
      category: ['threat', 'security'],
      type: [event.type || 'info'],
      action: event.action || 'detected',
      severity: event.severity === 'critical' ? 10 : 5
    },
    threat: {
      indicator: {
        type: event.indicatorType || 'vulnerability',
        name: event.name || 'Security Finding'
      }
    },
    user: {
      name: event.actor || 'system'
    },
    message: event.details || ''
  };
}

/**
 * Record a security audit event to disk.
 *
 * @param {object} event
 */
function recordAuditEvent(event) {
  try {
    if (!fs.existsSync(AUDIT_DIR)) {
      fs.mkdirSync(AUDIT_DIR, { recursive: true });
    }

    const cefLine = formatCefEvent(event);
    fs.appendFileSync(getAuditLogPath(), `${cefLine}\n`, 'utf-8');
  } catch (err) {
    logger.warn(`[AuditLogger] Failed to write audit event: ${err.message}`);
  }
}

/**
 * Read recent audit logs.
 *
 * @param {number} [limit=50]
 * @returns {Array<string>}
 */
function getRecentAuditLogs(limit = 50) {
  try {
    const logPath = getAuditLogPath();
    if (!fs.existsSync(logPath)) return [];
    return fs.readFileSync(logPath, 'utf-8').trim().split('\n').slice(-limit).reverse();
  } catch {
    return [];
  }
}

module.exports = {
  formatCefEvent,
  formatEcsEvent,
  recordAuditEvent,
  getRecentAuditLogs
};
