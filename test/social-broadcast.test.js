const test = require('node:test');
const assert = require('node:assert/strict');
const { formatSocialPost } = require('../src/social-broadcaster');
const { generateRssXml, generateAtomXml, generateJsonFeed } = require('../src/feed-generator');
const { startDashboard } = require('../src/web-dashboard');

test('Social Broadcaster - formats character-capped posts with hashtags and links', () => {
  const article = {
    title: 'Zero-day Exploit in Enterprise VPN Disclosed with Active Ransomware Use',
    url: 'https://securityweek.com/vpn-0day',
    category: 'Vulnerabilities',
    isCritical: true
  };
  const summary = '• Hackers weaponizing CVE-2024-9999 to deploy ransomware payloads across corporate networks.';

  const post = formatSocialPost(article, summary, 280);

  assert.ok(post.includes('CRITICAL ALERT'));
  assert.ok(post.includes('CVE-2024-9999') || post.includes('Zero-day'));
  assert.ok(post.includes('#CyberSecurity'));
  assert.ok(post.includes('#Ransomware'));
  assert.ok(post.includes('https://securityweek.com/vpn-0day'));
  assert.ok(post.length <= 300);
});

test('Feed Generator - creates valid RSS 2.0 XML, Atom 1.0 XML, and JSON Feed 1.1', () => {
  const articles = [
    {
      title: 'Critical Zero-day Flaw Patched',
      url: 'https://example.com/cve-patch',
      description: 'Vendor released an emergency patch.',
      category: 'Cyber',
      source: 'SecurityWeek',
      sentAt: new Date().toISOString()
    }
  ];

  const rss = generateRssXml(articles, 'http://localhost:3000');
  assert.ok(rss.includes('<?xml version="1.0" encoding="UTF-8"?>'));
  assert.ok(rss.includes('<rss version="2.0"'));
  assert.ok(rss.includes('Critical Zero-day Flaw Patched'));

  const atom = generateAtomXml(articles, 'http://localhost:3000');
  assert.ok(atom.includes('<feed xmlns="http://www.w3.org/2005/Atom">'));
  assert.ok(atom.includes('<title>Critical Zero-day Flaw Patched</title>'));

  const jsonFeed = generateJsonFeed(articles, 'http://localhost:3000');
  assert.equal(jsonFeed.version, 'https://jsonfeed.org/version/1.1');
  assert.equal(jsonFeed.items.length, 1);
  assert.equal(jsonFeed.items[0].title, 'Critical Zero-day Flaw Patched');
});

test('Dashboard Syndication - /feed.xml, /atom.xml, and /feed.json endpoints respond correctly', async () => {
  const mockPipeline = {
    getStats: () => ({ totalSent: 5 }),
    getRecentArticles: () => [
      { title: 'Incident 1', url: 'https://example.com/1', source: 'Source1', sentAt: new Date().toISOString() }
    ],
    runOnce: async () => ({ sent: 0 }),
    config: { sources: [] }
  };

  const server = startDashboard(mockPipeline, 0, Date.now());
  await new Promise((resolve) => server.once('listening', resolve));
  const port = server.address().port;

  try {
    const resRss = await fetch(`http://localhost:${port}/feed.xml`);
    assert.equal(resRss.status, 200);
    const textRss = await resRss.text();
    assert.ok(textRss.includes('<rss version="2.0"'));

    const resAtom = await fetch(`http://localhost:${port}/atom.xml`);
    assert.equal(resAtom.status, 200);
    const textAtom = await resAtom.text();
    assert.ok(textAtom.includes('<feed xmlns="http://www.w3.org/2005/Atom">'));

    const resJson = await fetch(`http://localhost:${port}/feed.json`);
    assert.equal(resJson.status, 200);
    const dataJson = await resJson.json();
    assert.equal(dataJson.version, 'https://jsonfeed.org/version/1.1');
  } finally {
    server.close();
  }
});
