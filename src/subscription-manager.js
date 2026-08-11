// src/subscription-manager.js
// Per-User & Channel Subscription Topic Management Engine
// Enables custom topic filtering per recipient across WhatsApp, Telegram, Discord, and Slack.

const { saveSubscription, getSubscription, getAllSubscriptions, deleteSubscription } = require('./db');
const logger = require('./logger');

/**
 * Set topic subscriptions for a recipient.
 * @param {string} targetId - User ID, Chat ID, or Channel ID
 * @param {string} platform - 'telegram', 'whatsapp', 'discord', 'slack', etc.
 * @param {string|string[]} topics - e.g. ['ransomware', 'cve', 'critical'] or 'ransomware, cve'
 */
function setSubscription(targetId, platform, topics) {
  if (!targetId || !platform) return;

  const topicList = (Array.isArray(topics) ? topics : String(topics || '').split(','))
    .map((t) => t.toLowerCase().trim())
    .filter(Boolean);

  const topicsStr = topicList.length > 0 ? topicList.join(',') : 'all';
  saveSubscription(targetId, platform, topicsStr);
  logger.info(`[Subscription] ${platform}:${targetId} subscribed to [${topicsStr}]`);
  return topicList;
}

/**
 * Get active subscription topics for a recipient.
 * @param {string} targetId
 * @param {string} platform
 * @returns {string[]} List of active topics (defaults to ['all'])
 */
function getUserSubscription(targetId, platform) {
  if (!targetId || !platform) return ['all'];
  const record = getSubscription(targetId, platform);
  if (!record || !record.topics) return ['all'];

  return record.topics.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
}

/**
 * Check whether an article satisfies a subscriber's topic preferences.
 * @param {string[]} subscriptionTopics
 * @param {object} article
 * @param {boolean} isCritical
 * @returns {boolean}
 */
function matchesArticle(subscriptionTopics, article, isCritical = false) {
  if (!subscriptionTopics || subscriptionTopics.length === 0 || subscriptionTopics.includes('all')) {
    return true;
  }

  if (subscriptionTopics.includes('critical') && isCritical) {
    return true;
  }

  const textToScan = `${article.title || ''} ${article.category || ''} ${article.description || ''}`.toLowerCase();

  return subscriptionTopics.some((topic) => {
    if (topic === 'all') return true;
    if (topic === 'cve' && /\bcve-\d{4}-\d{4,7}\b/i.test(textToScan)) return true;
    return textToScan.includes(topic);
  });
}

/**
 * Reset or remove subscription for a recipient.
 * @param {string} targetId
 * @param {string} platform
 */
function deleteUserSubscription(targetId, platform) {
  deleteSubscription(targetId, platform);
  logger.info(`[Subscription] Removed subscription for ${platform}:${targetId}`);
}

/**
 * List all active subscriptions.
 * @returns {Array<object>}
 */
function listSubscriptions() {
  return getAllSubscriptions();
}

module.exports = {
  setSubscription,
  getUserSubscription,
  matchesArticle,
  deleteUserSubscription,
  listSubscriptions
};
