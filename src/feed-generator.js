// src/feed-generator.js
// Public Syndication Feed Generator
// Outputs RSS 2.0 XML, Atom 1.0 XML, and JSON Feed 1.1 from curated seen articles.

function escXml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generate RSS 2.0 XML feed.
 * @param {Array<object>} articles
 * @param {string} baseUrl
 * @returns {string}
 */
function generateRssXml(articles = [], baseUrl = 'http://localhost:3000') {
  const items = articles.map((a) => `
    <item>
      <title>${escXml(a.title)}</title>
      <link>${escXml(a.url)}</link>
      <guid isPermaLink="true">${escXml(a.url)}</guid>
      <pubDate>${new Date(a.sentAt || a.publishedAt || Date.now()).toUTCString()}</pubDate>
      <description>${escXml(a.description || a.title)}</description>
      <category>${escXml(a.category || 'Cybersecurity')}</category>
      <source url="${escXml(baseUrl)}">${escXml(a.source || 'News Feeder Bot')}</source>
    </item>
  `).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>News Feeder Bot — Curated Cybersecurity Intelligence</title>
    <link>${escXml(baseUrl)}</link>
    <description>Automated cybersecurity threat intelligence and breaking news feed.</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${escXml(baseUrl)}/feed.xml" rel="self" type="application/rss+xml"/>
    ${items}
  </channel>
</rss>`;
}

/**
 * Generate Atom 1.0 XML feed.
 * @param {Array<object>} articles
 * @param {string} baseUrl
 * @returns {string}
 */
function generateAtomXml(articles = [], baseUrl = 'http://localhost:3000') {
  const entries = articles.map((a) => `
    <entry>
      <title>${escXml(a.title)}</title>
      <link href="${escXml(a.url)}"/>
      <id>${escXml(a.url)}</id>
      <updated>${new Date(a.sentAt || a.publishedAt || Date.now()).toISOString()}</updated>
      <summary>${escXml(a.description || a.title)}</summary>
      <author><name>${escXml(a.source || 'News Feeder Bot')}</name></author>
    </entry>
  `).join('');

  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>News Feeder Bot — Curated Cybersecurity Intelligence</title>
  <link href="${escXml(baseUrl)}"/>
  <link href="${escXml(baseUrl)}/atom.xml" rel="self"/>
  <updated>${new Date().toISOString()}</updated>
  <id>${escXml(baseUrl)}/</id>
  ${entries}
</feed>`;
}

/**
 * Generate JSON Feed 1.1 format.
 * @param {Array<object>} articles
 * @param {string} baseUrl
 * @returns {object}
 */
function generateJsonFeed(articles = [], baseUrl = 'http://localhost:3000') {
  return {
    version: 'https://jsonfeed.org/version/1.1',
    title: 'News Feeder Bot — Curated Cybersecurity Intelligence',
    home_page_url: baseUrl,
    feed_url: `${baseUrl}/feed.json`,
    description: 'Automated cybersecurity threat intelligence and breaking news feed.',
    items: articles.map((a) => ({
      id: a.url,
      url: a.url,
      title: a.title,
      content_text: a.description || a.title,
      date_published: new Date(a.sentAt || a.publishedAt || Date.now()).toISOString(),
      tags: [a.category || 'Cybersecurity', a.source || 'News'].filter(Boolean)
    }))
  };
}

module.exports = {
  generateRssXml,
  generateAtomXml,
  generateJsonFeed
};
