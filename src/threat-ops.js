// src/threat-ops.js
// Daily Threat Operations Orchestrator
// Wires the CISA KEV catalog sync and dark-web ransomware tracker into the
// running application. Also emits SIEM audit events for every operation.
//
// Previously these subsystems were implemented but never invoked — this module
// is the glue that makes them live.

const { syncCisaKevCatalog } = require('./cisa-kev');
const { fetchRansomwareVictims, formatRansomwareAlert } = require('./ransomware-tracker');
const { markRansomwareVictimSeen } = require('./db');
const { recordAuditEvent } = require('./audit-logger');
const logger = require('./logger');

// How many unseen victims to alert on per sync cycle.
const MAX_VICTIMS_PER_CYCLE = 10;

/**
 * Sync the CISA KEV catalog (fire-and-forget friendly). Safe to call at
 * startup and from a daily cron — internally rate-limited to once per day
 * unless `force` is true.
 */
async function syncThreatData(force = false) {
  const before = Date.now();
  await syncCisaKevCatalog(force);
  recordAuditEvent({
    type: 'THREAT_DATA_SYNC',
    name: 'CISA KEV catalog sync',
    severity: 'low',
    actor: 'threat-ops',
    details: `CISA KEV catalog sync ${force ? 'forced' : 'scheduled'} completed in ${Date.now() - before}ms`,
    ip: 'internal'
  });
}

/**
 * Fetch new ransomware leak-portal victims and broadcast alerts to all senders.
 * Each newly disclosed victim is alerted once, then marked as seen so it is
 * never re-broadcast on later cycles.
 *
 * @param {Array<{name:string, sender:object, type:string}>} senders
 * @param {number} [limit=10]
 * @returns {Promise<number>} Number of new victims alerted
 */
async function runRansomwareTracking(senders = [], limit = MAX_VICTIMS_PER_CYCLE) {
  const victims = await fetchRansomwareVictims(limit);
  if (victims.length === 0) {
    logger.info('Threat Ops: no new ransomware leak disclosures found.');
    return 0;
  }

  let alerted = 0;
  for (const victim of victims) {
    const message = formatRansomwareAlert(victim);

    for (const { name, sender, type } of senders) {
      try {
        if (typeof sender.sendMessage === 'function') {
          await sender.sendMessage(message);
        } else {
          continue;
        }
        logger.success(`[Threat Ops] Ransomware alert sent via ${name}`);
      } catch (err) {
        logger.warn(`[Threat Ops] Ransomware alert failed via ${name}: ${err.message.split('\n')[0]}`);
      }
    }

    // Persist so the same victim is never alerted twice
    markRansomwareVictimSeen(
      victim.victimId,
      victim.groupName,
      victim.victimName,
      victim.country,
      victim.sector,
      victim.discoveredAt
    );

    recordAuditEvent({
      type: 'RANSOMWARE_DISCLOSURE',
      name: 'New dark-web ransomware disclosure',
      severity: 'high',
      actor: 'threat-ops',
      details: `Group=${victim.groupName} Victim=${victim.victimName} Country=${victim.country} Sector=${victim.sector}`,
      ip: 'internal'
    });

    alerted++;
  }

  logger.success(`Threat Ops: alerted on ${alerted} new ransomware disclosures.`);
  return alerted;
}

/**
 * Broadcast a critical threat article to configured social networks
 * (Mastodon / Bluesky) and emit an audit event.
 */
async function broadcastThreatArticle(article, summary, isCritical) {
  if (!isCritical) return false;
  try {
    const { broadcastSocial } = require('./social-broadcaster');
    await broadcastSocial({ ...article, isCritical: true }, summary);
    recordAuditEvent({
      type: 'SOCIAL_BROADCAST',
      name: 'Critical alert broadcast to social networks',
      severity: 'medium',
      actor: 'pipeline',
      details: `Title=${article.title} URL=${article.url}`,
      ip: 'internal'
    });
    return true;
  } catch (err) {
    logger.warn(`[Threat Ops] Social broadcast failed: ${err.message.split('\n')[0]}`);
    return false;
  }
}

module.exports = {
  syncThreatData,
  runRansomwareTracking,
  broadcastThreatArticle
};