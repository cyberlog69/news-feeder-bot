// src/story-clusterer.js
// Semantic Story Clustering & Multi-Source AI Fusion Engine
// Clusters duplicate breaking news articles across multiple RSS feeds into unified Master Bulletins.

const { textToVector, cosineSimilarity } = require('./vector-store');
const { extractCVEs } = require('./threat-intel');
const logger = require('./logger');

/**
 * Cluster a list of articles by semantic cosine similarity or shared CVE IDs.
 *
 * @param {Array<object>} articles
 * @param {number} [minSimilarity=0.45]
 * @returns {{ singleArticles: Array<object>, clusters: Array<object> }}
 */
function clusterArticles(articles = [], minSimilarity = 0.45) {
  if (!articles || articles.length <= 1) {
    return { singleArticles: articles || [], clusters: [] };
  }

  // Pre-calculate vectors and CVEs for each article
  const enrichedArticles = articles.map((a, index) => ({
    ...a,
    _index: index,
    _vector: textToVector(`${a.title} ${a.description || ''}`),
    _cves: extractCVEs(`${a.title} ${a.description || ''}`)
  }));

  const visited = new Set();
  const clusters = [];
  const singleArticles = [];

  for (let i = 0; i < enrichedArticles.length; i++) {
    if (visited.has(i)) continue;

    const current = enrichedArticles[i];
    const clusterMembers = [current];
    visited.add(i);

    for (let j = i + 1; j < enrichedArticles.length; j++) {
      if (visited.has(j)) continue;

      const candidate = enrichedArticles[j];

      // Check 1: Shared CVE IDs
      const sharedCves = current._cves.filter((c) => candidate._cves.includes(c));
      const hasSharedCve = sharedCves.length > 0;

      // Check 2: Cosine vector similarity
      const similarity = cosineSimilarity(current._vector, candidate._vector);

      if (hasSharedCve || similarity >= minSimilarity) {
        clusterMembers.push(candidate);
        visited.add(j);
        logger.info(
          `[Clustering] Matched "${candidate.title.slice(0, 35)}…" with "${current.title.slice(0, 35)}…" (sim: ${similarity.toFixed(2)}, cve: ${hasSharedCve})`
        );
      }
    }

    if (clusterMembers.length > 1) {
      // Clean internal properties
      const cleanMembers = clusterMembers.map((m) => {
        const { _index, _vector, _cves, ...clean } = m;
        return clean;
      });

      const uniqueSources = [...new Set(cleanMembers.map((m) => m.source))];
      const uniqueUrls = cleanMembers.map((m) => ({ source: m.source, url: m.url }));

      clusters.push({
        primaryArticle: cleanMembers[0],
        memberArticles: cleanMembers,
        sources: uniqueSources,
        sourceLinks: uniqueUrls,
        isMasterBulletin: true
      });
    } else {
      const { _index, _vector, _cves, ...clean } = current;
      singleArticles.push(clean);
    }
  }

  if (clusters.length > 0) {
    logger.success(`[Clustering] Formed ${clusters.length} multi-source story cluster(s) from ${articles.length} articles`);
  }

  return { singleArticles, clusters };
}

/**
 * Fuse a multi-source story cluster into a unified Master Bulletin.
 *
 * @param {object} cluster - Cluster object from clusterArticles()
 * @param {Function} [summarizeFn] - AI summarization function
 * @returns {Promise<{ fusedArticle: object, summary: string }>}
 */
async function fuseStoryCluster(cluster, summarizeFn) {
  const members = cluster.memberArticles || [cluster.primaryArticle];
  const primary = cluster.primaryArticle;

  // Build combined text with multi-source headers
  const combinedDescriptions = members.map((m, idx) => {
    return `[Source ${idx + 1}: ${m.source}] Title: ${m.title}\n${m.description || ''}`;
  }).join('\n\n');

  const fusedArticle = {
    ...primary,
    title: `[MASTER BULLETIN] ${primary.title}`,
    isMasterBulletin: true,
    sources: cluster.sources || [primary.source],
    sourceLinks: cluster.sourceLinks || [{ source: primary.source, url: primary.url }]
  };

  let summary = '';
  if (typeof summarizeFn === 'function') {
    try {
      summary = await summarizeFn(fusedArticle, combinedDescriptions);
    } catch {
      summary = buildExtractiveClusterSummary(members);
    }
  } else {
    summary = buildExtractiveClusterSummary(members);
  }

  return {
    fusedArticle,
    summary: summary || buildExtractiveClusterSummary(members)
  };
}

/**
 * Extractive fallback summary for clustered articles.
 */
function buildExtractiveClusterSummary(members) {
  const bullets = [];
  members.forEach((m) => {
    const rawLines = (m.description || m.title || '')
      .split(/\.\s+/)
      .map((l) => l.replace(/^[•▪\-*\d.]+\s*/, '').trim())
      .filter((l) => l.length > 20);

    if (rawLines.length > 0) {
      bullets.push(`• [${m.source}] ${rawLines[0].replace(/\.+$/, '')}.`);
    }
  });

  return bullets.slice(0, 5).join('\n') || `• Multi-source coverage reported by ${members.map((m) => m.source).join(', ')}.`;
}

module.exports = {
  clusterArticles,
  fuseStoryCluster
};
