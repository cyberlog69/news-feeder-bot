const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { startDashboard } = require('../src/web-dashboard');
const { getFeedHealth } = require('../src/fetcher');

test('getFeedHealth - returns empty or populated feed health array', () => {
  const health = getFeedHealth();
  assert.ok(Array.isArray(health));
});

test('Dashboard APIs - /api/feed-health and /api/sources respond with 200 JSON', async () => {
  const mockPipeline = {
    config: { sources: [{ name: 'Test Feed', rss: 'https://example.com/rss', category: 'Cyber', enabled: true }] },
    getStats: () => ({ totalDelivered: 10, totalRuns: 2, totalErrors: 0 }),
    getRecentArticles: () => [],
    isRunning: false
  };

  const server = startDashboard(mockPipeline, 0); // Port 0 uses random available port

  await new Promise((resolve) => server.on('listening', resolve));
  const port = server.address().port;

  try {
    const resHealth = await fetch(`http://localhost:${port}/api/feed-health`);
    assert.equal(resHealth.status, 200);
    const healthData = await resHealth.json();
    assert.ok(Array.isArray(healthData));

    const resSources = await fetch(`http://localhost:${port}/api/sources`);
    assert.equal(resSources.status, 200);
    const sourcesData = await resSources.json();
    assert.equal(sourcesData.length, 1);
    assert.equal(sourcesData[0].name, 'Test Feed');
  } finally {
    server.close();
  }
});
