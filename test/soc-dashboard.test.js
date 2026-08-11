const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { startDashboard } = require('../src/web-dashboard');

const mockPipeline = {
  getStats: () => ({ totalSent: 42, activeFeeds: 5 }),
  getRecentArticles: () => [
    { title: 'Major Breach Reported', url: 'https://example.com/1', source: 'BleepingComputer', sentAt: new Date().toISOString() }
  ],
  runOnce: async () => ({ sent: 1 }),
  config: { sources: [{ name: 'SecurityWeek', category: 'Cyber', rss: 'https://securityweek.com/rss', enabled: true }] }
};

test('SOC Dashboard APIs - /api/threat-intel, /api/subscriptions, /api/system-status respond with 200 JSON', async () => {
  const server = startDashboard(mockPipeline, 0, Date.now());
  await new Promise((resolve) => server.once('listening', resolve));
  const port = server.address().port;

  try {
    // Test /api/threat-intel
    const resThreat = await fetch(`http://localhost:${port}/api/threat-intel`);
    assert.equal(resThreat.status, 200);
    const dataThreat = await resThreat.json();
    assert.ok(dataThreat.cisaKev !== undefined);
    assert.ok(dataThreat.ransomwareVictims !== undefined);

    // Test /api/subscriptions
    const resSubs = await fetch(`http://localhost:${port}/api/subscriptions`);
    assert.equal(resSubs.status, 200);
    const dataSubs = await resSubs.json();
    assert.ok(Array.isArray(dataSubs.subscriptions));

    // Test /api/system-status
    const resSys = await fetch(`http://localhost:${port}/api/system-status`);
    assert.equal(resSys.status, 200);
    const dataSys = await resSys.json();
    assert.equal(dataSys.status, 'healthy');
    assert.ok(dataSys.channels !== undefined);
    assert.ok(dataSys.memory !== undefined);
  } finally {
    server.close();
  }
});
