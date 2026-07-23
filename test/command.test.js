const test = require('node:test');
const assert = require('node:assert/strict');
const { handleCommand } = require('../src/command-handler');

test('handleCommand - /status returns formatted status string', () => {
  const config = { sources: [{ name: 'Test Feed', enabled: true }] };
  const res = handleCommand('/status', config, Date.now() - 10000);

  assert.ok(res.includes('News Feeder Bot Status'));
  assert.ok(res.includes('Uptime'));
});

test('handleCommand - /sources lists active feeds', () => {
  const config = { sources: [{ name: 'BleepingComputer', category: 'Tech', enabled: true }] };
  const res = handleCommand('/sources', config, Date.now());

  assert.ok(res.includes('BleepingComputer'));
});

test('handleCommand - /search returns formatted result or empty warning', () => {
  const config = { sources: [] };
  const res = handleCommand('/search non_existent_keyword_123', config, Date.now());

  assert.ok(res.includes('No recent articles found matching'));
});
