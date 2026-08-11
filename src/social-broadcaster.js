// src/social-broadcaster.js
// Public Threat Intelligence & Social Media Broadcaster
// Broadcasts critical security alerts to Mastodon/Fediverse and Bluesky (AT Protocol).

const logger = require('./logger');

/**
 * Format a social media alert post with hashtags and link.
 *
 * @param {object} article
 * @param {string} summary
 * @param {number} [maxLength=300]
 * @returns {string}
 */
function formatSocialPost(article, summary, maxLength = 300) {
  const isCritical = Boolean(article.isCritical);
  const prefix = isCritical ? '🚨 [CRITICAL ALERT] ' : '🛡️ [THREAT INTEL] ';

  // Extract hashtags
  const hashtags = ['#CyberSecurity', '#Infosec'];
  const textToCheck = `${article.title} ${article.category || ''} ${summary}`.toLowerCase();
  if (textToCheck.includes('ransomware')) hashtags.push('#Ransomware');
  if (/\bcve-\d{4}-\d{4,7}\b/i.test(textToCheck)) hashtags.push('#CVE');
  if (textToCheck.includes('zero-day') || textToCheck.includes('0-day')) hashtags.push('#ZeroDay');

  const tagLine = hashtags.join(' ');
  const link = article.url || '';

  // Clean first bullet of summary
  const cleanSummary = (summary || '')
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => l.replace(/^[•▪\-*\d.]+\s*/, '').trim())[0] || '';

  let availableLen = maxLength - tagLine.length - link.length - prefix.length - 8;
  if (availableLen < 40) availableLen = 40;

  let title = article.title || '';
  if (title.length > availableLen) {
    title = title.slice(0, availableLen - 3) + '…';
  }

  const parts = [`${prefix}${title}`];
  if (cleanSummary && parts.join('\n').length + cleanSummary.length + link.length + tagLine.length < maxLength - 10) {
    parts.push(`• ${cleanSummary}`);
  }

  if (link) parts.push(link);
  parts.push(tagLine);

  return parts.join('\n\n');
}

/**
 * Broadcast post to Mastodon/Fediverse instance.
 * @param {object} article
 * @param {string} summary
 * @param {object} [opts]
 * @returns {Promise<boolean>}
 */
async function broadcastToMastodon(article, summary, opts = {}) {
  const instance = opts.instanceUrl || process.env.MASTODON_INSTANCE_URL;
  const token = opts.accessToken || process.env.MASTODON_ACCESS_TOKEN;

  if (!instance || !token) return false;

  const url = `${instance.replace(/\/+$/, '')}/api/v1/statuses`;
  const statusText = formatSocialPost(article, summary, 500);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        status: statusText,
        visibility: 'public'
      })
    });

    if (res.ok) {
      logger.success(`[Social] Published to Mastodon (${instance})`);
      return true;
    } else {
      const err = await res.text();
      logger.warn(`[Social] Mastodon error (${res.status}): ${err.slice(0, 100)}`);
      return false;
    }
  } catch (err) {
    logger.warn(`[Social] Mastodon network error: ${err.message}`);
    return false;
  }
}

/**
 * Broadcast post to Bluesky (AT Protocol).
 * @param {object} article
 * @param {string} summary
 * @param {object} [opts]
 * @returns {Promise<boolean>}
 */
async function broadcastToBluesky(article, summary, opts = {}) {
  const identifier = opts.identifier || process.env.BLUESKY_IDENTIFIER;
  const password = opts.password || process.env.BLUESKY_APP_PASSWORD;

  if (!identifier || !password) return false;

  try {
    // 1. Authenticate with AT Protocol
    const sessionRes = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password })
    });

    if (!sessionRes.ok) {
      logger.warn(`[Social] Bluesky authentication failed (${sessionRes.status})`);
      return false;
    }

    const session = await sessionRes.json();
    const statusText = formatSocialPost(article, summary, 300);

    // 2. Create post record
    const postRes = await fetch('https://bsky.social/xrpc/com.atproto.repo.createRecord', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.accessJwt}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        repo: session.did,
        collection: 'app.bsky.feed.post',
        record: {
          text: statusText,
          createdAt: new Date().toISOString()
        }
      })
    });

    if (postRes.ok) {
      logger.success('[Social] Published to Bluesky');
      return true;
    } else {
      logger.warn(`[Social] Bluesky post failed (${postRes.status})`);
      return false;
    }
  } catch (err) {
    logger.warn(`[Social] Bluesky network error: ${err.message}`);
    return false;
  }
}

/**
 * Broadcast article across all configured social networks.
 */
async function broadcastSocial(article, summary) {
  const tasks = [];
  if (process.env.MASTODON_INSTANCE_URL && process.env.MASTODON_ACCESS_TOKEN) {
    tasks.push(broadcastToMastodon(article, summary));
  }
  if (process.env.BLUESKY_IDENTIFIER && process.env.BLUESKY_APP_PASSWORD) {
    tasks.push(broadcastToBluesky(article, summary));
  }

  if (tasks.length > 0) {
    await Promise.allSettled(tasks);
  }
}

module.exports = {
  formatSocialPost,
  broadcastToMastodon,
  broadcastToBluesky,
  broadcastSocial
};
