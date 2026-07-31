// src/vector-store.js
// Vector Storage & TF-IDF Semantic Indexing Engine for RAG
// Indexes news articles into SQLite and retrieves relevant context using Cosine Similarity.

const { saveArticleVector, getAllArticleVectors } = require('./db');
const logger = require('./logger');

const STOP_WORDS = new Set([
  'a', 'about', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
  'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to',
  'was', 'were', 'will', 'with', 'this', 'have', 'had', 'been', 'which', 'or'
]);

/**
 * Tokenize and convert text into a normalized Term-Frequency (TF) vector object.
 * @param {string} text
 * @returns {object} Map of { term: normalized_frequency }
 */
function textToVector(text) {
  if (!text) return {};
  const words = String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

  if (words.length === 0) return {};

  const counts = {};
  for (const w of words) {
    counts[w] = (counts[w] || 0) + 1;
  }

  // Calculate L2 norm for vector normalization
  let sumSq = 0;
  for (const count of Object.values(counts)) {
    sumSq += count * count;
  }
  const norm = Math.sqrt(sumSq) || 1;

  const vector = {};
  for (const [w, count] of Object.entries(counts)) {
    vector[w] = count / norm;
  }

  return vector;
}

/**
 * Calculate Cosine Similarity between two term-frequency vector objects.
 * @param {object} vecA
 * @param {object} vecB
 * @returns {number} Score between 0.0 and 1.0
 */
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB) return 0;
  let dotProduct = 0;

  for (const term of Object.keys(vecA)) {
    if (vecB[term]) {
      dotProduct += vecA[term] * vecB[term];
    }
  }

  return dotProduct;
}

/**
 * Index an article and its summary into SQLite vector storage.
 * @param {object} article
 * @param {string} summary
 */
function indexArticle(article, summary = '') {
  if (!article || !article.title || !article.url) return;

  try {
    const combinedText = `${article.title} ${article.description || ''} ${summary}`;
    const vector = textToVector(combinedText);
    saveArticleVector(
      article.url,
      article.title,
      summary,
      article.source,
      article.publishedAt,
      JSON.stringify(vector)
    );
    logger.info(`Indexed article for RAG: "${article.title.slice(0, 45)}…"`);
  } catch (err) {
    logger.warn(`Failed to index article vector: ${err.message}`);
  }
}

/**
 * Search indexed articles using semantic vector similarity.
 * @param {string} queryText
 * @param {number} [limit=5]
 * @param {number} [minScore=0.02]
 * @returns {Array<{ article: object, score: number }>}
 */
function searchArticles(queryText, limit = 5, minScore = 0.02) {
  const queryVec = textToVector(queryText);
  if (Object.keys(queryVec).length === 0) return [];

  const rows = getAllArticleVectors(200);
  const scored = [];

  for (const row of rows) {
    let vec = {};
    try {
      vec = JSON.parse(row.vectorJson || '{}');
    } catch {
      continue;
    }

    const score = cosineSimilarity(queryVec, vec);
    if (score >= minScore) {
      scored.push({
        article: {
          url: row.url,
          title: row.title,
          summary: row.summary,
          source: row.source,
          publishedAt: row.publishedAt
        },
        score
      });
    }
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

module.exports = {
  textToVector,
  cosineSimilarity,
  indexArticle,
  searchArticles
};
