const test = require('node:test');
const assert = require('node:assert/strict');
const { generatePodcastScript, generatePodcastRssXml, compileDailyPodcast } = require('../src/podcast-generator');
const { startDashboard } = require('../src/web-dashboard');

test('Podcast Generator - generates broadcast daily cyber news podcast script', () => {
  const articles = [
    { title: 'Critical Zero-Day in Microsoft Windows Kernel Disclosed', url: 'https://example.com/1' },
    { title: 'Major Healthcare Network Hit by Ransomware Attack', url: 'https://example.com/2' }
  ];

  const podcast = generatePodcastScript(articles);

  assert.ok(podcast.title.includes('Daily Cyber Threat Briefing'));
  assert.ok(podcast.script.includes('Welcome to the Daily Cyber Threat Briefing'));
  assert.ok(podcast.script.includes('Critical Zero-Day in Microsoft Windows Kernel'));
  assert.ok(podcast.script.includes('Tactical takeaway for security teams'));
});

test('Podcast Generator - creates valid Apple/Spotify RSS 2.0 podcast XML feed', () => {
  compileDailyPodcast([
    { title: 'Ransomware Gang Leaks Stolen Corporate Data', url: 'https://example.com/leak' }
  ]);

  const xml = generatePodcastRssXml('http://localhost:3000');

  assert.ok(xml.includes('<rss version="2.0"'));
  assert.ok(xml.includes('<title>Daily Cyber Threat Briefing</title>'));
  assert.ok(xml.includes('xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"'));
  assert.ok(xml.includes('<enclosure url="http://localhost:3000/api/podcast/audio"'));
});

test('Dashboard APIs - /api/detection-rules, /api/pocs, /api/watchlist, /api/threat-map, /podcast.xml respond with 200', async () => {
  const mockPipeline = {
    getStats: () => ({ totalSent: 10 }),
    getRecentArticles: () => []
  };

  const server = startDashboard(mockPipeline, 0);
  await new Promise((res) => setTimeout(res, 300));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const rRules = await fetch(`${baseUrl}/api/detection-rules`);
    assert.equal(rRules.status, 200);
    const dRules = await rRules.json();
    assert.ok(Array.isArray(dRules.rules));

    const rPocs = await fetch(`${baseUrl}/api/pocs`);
    assert.equal(rPocs.status, 200);
    const dPocs = await rPocs.json();
    assert.ok(Array.isArray(dPocs.pocs));

    const rWatch = await fetch(`${baseUrl}/api/watchlist`);
    assert.equal(rWatch.status, 200);
    const dWatch = await rWatch.json();
    assert.ok(Array.isArray(dWatch.watchlist));

    const rMap = await fetch(`${baseUrl}/api/threat-map`);
    assert.equal(rMap.status, 200);
    const dMap = await rMap.json();
    assert.ok(Array.isArray(dMap.nodes));

    const rPodcastXml = await fetch(`${baseUrl}/podcast.xml`);
    assert.equal(rPodcastXml.status, 200);
    const xml = await rPodcastXml.text();
    assert.ok(xml.includes('<title>Daily Cyber Threat Briefing</title>'));
  } finally {
    server.close();
  }
});
