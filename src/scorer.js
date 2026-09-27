// src/scorer.js
// Enterprise Importance & Source Reputation Scorer (0.0–1.0)
// Evaluates articles based on keyword severity, source credibility, publication recency,
// description richness, and real-time breaker bonuses.

const fs = require('fs');
const path = require('path');
const logger = require('./logger');

// High-impact cybersecurity keywords
const HIGH_VALUE_KEYWORDS = [
  'zero-day', '0-day', 'critical', 'rce', 'remote code execution',
  'actively exploited', 'ransomware', 'data breach', 'supply chain',
  'nation-state', 'apt', 'backdoor', 'authentication bypass',
  'privilege escalation', 'patch tuesday', 'cve-', 'emergency'
];

// Medium-impact cybersecurity keywords
const MEDIUM_VALUE_KEYWORDS = [
  'vulnerability', 'exploit', 'phishing', 'malware', 'trojan', 'botnet',
  'ddos', 'injection', 'xss', 'sqli', 'bypass', 'leaked', 'exposed',
  'breach', 'hack', 'attack', 'stolen', 'compromise'
];

// Default baseline reputation weights (0.0–1.0)
const DEFAULT_SOURCE_REPUTATIONS = {
  'cisa advisories': 1.0,
  'unit 42 threat research': 0.95,
  'microsoft security blog': 0.95,
  'cisco talos intelligence': 0.95,
  'krebs on security': 0.95,
  'bleepingcomputer': 0.92,
  'securityweek': 0.90,
  'the hacker news': 0.90,
  'dark reading': 0.88,
  'cyber security news': 0.85,
  'ars technica security': 0.80,
  'hacker news': 0.70
};

// Runtime dynamic reputation weights map
const dynamicReputations = new Map();

/**
 * Initialize reputations from config.json if present.
 */
function initReputations() {
  try {
    const configPath = path.join(process.cwd(), 'config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (Array.isArray(config.sources)) {
        for (const src of config.sources) {
          if (src.name && typeof src.reputation === 'number') {
            dynamicReputations.set(src.name.toLowerCase().trim(), Math.min(Math.max(src.reputation, 0.1), 1.0));
          }
        }
      }
    }
  } catch {}
}

initReputations();

/**
 * Get reputation weight for a given source name (0.0–1.0).
 * @param {string} sourceName
 * @returns {number}
 */
function getSourceReputation(sourceName) {
  if (!sourceName) return 0.70;
  const key = String(sourceName).toLowerCase().trim();
  if (dynamicReputations.has(key)) {
    return dynamicReputations.get(key);
  }
  if (DEFAULT_SOURCE_REPUTATIONS[key] !== undefined) {
    return DEFAULT_SOURCE_REPUTATIONS[key];
  }
  return 0.70; // default unknown source credibility
}

/**
 * Set a dynamic reputation weight for a given source.
 * @param {string} sourceName
 * @param {number} weight - 0.0 to 1.0
 */
function setSourceReputation(sourceName, weight) {
  if (!sourceName) return;
  const normalized = Math.min(Math.max(Number(weight) || 0.70, 0.0), 1.0);
  dynamicReputations.set(String(sourceName).toLowerCase().trim(), normalized);
  logger.info(`[Scorer] Updated source reputation for "${sourceName}": ${normalized.toFixed(2)}`);
}

/**
 * Get all configured source reputations.
 * @returns {Record<string, number>}
 */
function getAllSourceReputations() {
  const result = { ...DEFAULT_SOURCE_REPUTATIONS };
  for (const [key, val] of dynamicReputations.entries()) {
    result[key] = val;
  }
  return result;
}

/**
 * Evaluate if an article qualifies for an emergency "Breaker Bonus" (0.0–0.10).
 * Triggered by actively exploited 0-days, emergency out-of-band patches, or CISA KEV mentions.
 * @param {object} article
 * @returns {number}
 */
function calculateBreakerBonus(article) {
  const text = `${article.title || ''} ${article.description || ''}`.toLowerCase();
  let bonus = 0.0;

  if (text.includes('actively exploited') || text.includes('in-the-wild')) {
    bonus += 0.05;
  }
  if (text.includes('zero-day') || text.includes('0-day')) {
    bonus += 0.03;
  }
  if (text.includes('emergency patch') || text.includes('out-of-band') || text.includes('cisa kev')) {
    bonus += 0.04;
  }

  return Math.min(bonus, 0.10);
}

/**
 * Calculate a 0.0–1.0 importance score for an article.
 *
 * Scoring factors:
 *   1. Keyword relevance (0.0–0.45)
 *   2. Publication recency (0.0–0.25)
 *   3. Description richness (0.0–0.15)
 *   4. Source reputation weight (0.0–0.15)
 *   5. Real-time breaker bonus (0.0–0.10)
 *
 * @param {object} article - { title, description, publishedAt, source }
 * @returns {number}  0.0 = ignore, 1.0 = highest priority
 */
function scoreArticle(article = {}) {
  let score = 0.0;
  const text = `${article.title || ''} ${article.description || ''}`.toLowerCase();

  // ── Factor 1: Keyword matches (0–0.45 points) ─────────────────────────────
  let keywordScore = 0;
  HIGH_VALUE_KEYWORDS.forEach((kw) => {
    if (text.includes(kw.toLowerCase())) keywordScore += 0.10;
  });
  MEDIUM_VALUE_KEYWORDS.forEach((kw) => {
    if (text.includes(kw.toLowerCase())) keywordScore += 0.04;
  });
  score += Math.min(keywordScore, 0.45);

  // ── Factor 2: Recency (0–0.25 points) ────────────────────────────────────
  try {
    const ageMs  = Date.now() - new Date(article.publishedAt || Date.now()).getTime();
    const ageHrs = ageMs / (1000 * 60 * 60);

    if (ageHrs < 1)       score += 0.25;
    else if (ageHrs < 3)  score += 0.20;
    else if (ageHrs < 6)  score += 0.15;
    else if (ageHrs < 12) score += 0.10;
    else if (ageHrs < 24) score += 0.05;
  } catch {}

  // ── Factor 3: Description richness (0–0.15 points) ────────────────────────
  const descLen = (article.description || '').length;
  score += Math.min(descLen / 5000, 0.15);

  // ── Factor 4: Source reputation weight (0–0.15 points) ────────────────────
  const reputation = getSourceReputation(article.source);
  score += reputation * 0.15;

  // ── Factor 5: Real-time Breaker Bonus (0–0.10 points) ────────────────────
  score += calculateBreakerBonus(article);

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

module.exports = {
  scoreArticle,
  passesScoreThreshold,
  getSourceReputation,
  setSourceReputation,
  getAllSourceReputations,
  calculateBreakerBonus
};
