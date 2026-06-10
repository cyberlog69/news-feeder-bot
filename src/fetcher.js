// src/fetcher.js
// Fetches news articles from RSS feeds.
// Falls back to article-extractor if the RSS snippet is too short to summarize.

const Parser  = require('rss-parser');
const { extract } = require('@extractus/article-extractor');
const logger  = require('./logger');

const parser = new Parser({
  timeout: 15000,
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  },
  // Handle Atom + RSS
  customFields: {
    item: [
      ['media:content', 'mediaContent'],
      ['content:encoded', 'contentEncoded']
    ]
  }
});

/**
 * Fetch the latest articles from a single RSS source.
 * Returns an array of article objects.
 */
async function fetchSource(source) {
  try {
    logger.info(`Fetching: ${source.name}`);
    const feed = await parser.parseURL(source.rss);

    return feed.items.slice(0, 15).map((item) => ({
      title:       cleanText(item.title || 'No Title'),
      url:         item.link || item.guid || '',
      description: cleanText(
        item.contentSnippet ||
        item.contentEncoded ||
        item.content ||
        item.summary ||
        ''
      ),
      publishedAt: item.pubDate || item.isoDate || new Date().toISOString(),
      source:      source.name,
      category:    source.category
    }));

  } catch (err) {
    logger.error(`Failed to fetch ${source.name}: ${err.message}`);
    return [];
  }
}

/**
 * Fetch all enabled sources in parallel.
 * Returns a flat array of all articles found.
 */
async function fetchAllSources(sources) {
  const enabled = sources.filter((s) => s.enabled);
  const results = await Promise.allSettled(enabled.map(fetchSource));

  const all = [];
  results.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      all.push(...result.value);
    } else {
      logger.warn(`Source ${enabled[i].name} rejected: ${result.reason}`);
    }
  });

  return all;
}

/**
 * Attempt to extract full article text from a URL.
 * Returns plain text string, or null on failure.
 * Used when the RSS snippet is too short to summarize well.
 */
async function getFullArticleText(url) {
  try {
    const article = await extract(url, {}, { timeout: 12000 });
    if (!article?.content) return null;

    // Strip HTML tags and collapse whitespace
    return article.content
      .replace(/<[^>]*>/g, ' ')
      .replace(/&[a-z]+;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 3000);  // cap at 3000 chars for Gemini
  } catch {
    return null;  // silently fail — description fallback is fine
  }
}

/** Strip HTML and collapse whitespace from a string */
function cleanText(str) {
  return str
    .replace(/<[^>]*>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = { fetchAllSources, getFullArticleText };
