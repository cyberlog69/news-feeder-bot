// src/scorer.js
// Calculates an importance score (0.0–1.0) for each article.
// Used when config.scoring.enabled = true to filter out low-value content.
//
// Scoring factors:
//   1. Source reputation weight  (configurable per-source in future)
//   2. Recency (articles < 1 hour old score higher)
//   3. Keyword relevance matches
//   4. Description richness (length / 5000 chars)

// Keywords that boost an article's score
const HIGH_VALUE_KEYWORDS = [
  'zero-day', '0-day', 'critical', 'rce', 'remote code execution',
  'actively exploited', 'ransomware', 'data breach', 'supply chain',
  'nation-state', 'apt', 'backdoor', 'authentication bypass',
  'privilege escalation', 'patch tuesday', 'cve-', 'emergency'
];

const MEDIUM_VALUE_KEYWORDS = [
  'vulnerability', 'exploit', 'phishing', 'malware', 'trojan', 'botnet',
  'ddos', 'injection', 'xss', 'sqli', 'bypass', 'leaked', 'exposed',
  'breach', 'hack', 'attack', 'stolen', 'compromise'
];

/**
 * Calculate a 0.0–1.0 importance score for an article.
 *
 * @param {object} article - { title, description, publishedAt, source }
 * @returns {number}  0.0 = ignore, 1.0 = highest priority
 */
function scoreArticle(article) {
  let score = 0.0;

  const text = `${article.title} ${article.description}`.toLowerCase();

  // ── Factor 1: Keyword matches (0–0.50 points) ─────────────────────────────
  let keywordScore = 0;
  HIGH_VALUE_KEYWORDS.forEach((kw) => {
    if (text.includes(kw.toLowerCase())) keywordScore += 0.10;
  });
  MEDIUM_VALUE_KEYWORDS.forEach((kw) => {
    if (text.includes(kw.toLowerCase())) keywordScore += 0.04;
  });
  score += Math.min(keywordScore, 0.50);

  // ── Factor 2: Recency (0–0.30 points) ────────────────────────────────────
  try {
    const ageMs  = Date.now() - new Date(article.publishedAt).getTime();
    const ageHrs = ageMs / (1000 * 60 * 60);

    if (ageHrs < 1)  score += 0.30;
    else if (ageHrs < 3)  score += 0.20;
    else if (ageHrs < 6)  score += 0.15;
    else if (ageHrs < 12) score += 0.10;
    else if (ageHrs < 24) score += 0.05;
    // > 24 hours = no recency bonus
  } catch {}

  // ── Factor 3: Description richness (0–0.20 points) ────────────────────────
  const descLen = (article.description || '').length;
  score += Math.min(descLen / 5000, 0.20);

  return Math.min(Math.max(score, 0), 1.0);
}

/**
 * Check whether an article passes the minimum score threshold.
 * @param {object}  article
 * @param {number}  minScore  — from config.scoring.minScore
 * @returns {boolean}
 */
function passesScoreThreshold(article, minScore) {
  const score = scoreArticle(article);
  return score >= minScore;
}

module.exports = { scoreArticle, passesScoreThreshold };
