const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isUrlSeen,
  markUrlSeen,
  getSeenArticles,
  searchSeenArticles,
  getCachedSummary,
  setCachedSummary
} = require('../src/db');

test('SQLite DB - markUrlSeen and isUrlSeen', () => {
  const testUrl = `https://example.com/test-sqlite-1-${Date.now()}`;
  assert.equal(isUrlSeen(testUrl), false);

  markUrlSeen(testUrl, 'Test Title', 'Test Source');
  assert.equal(isUrlSeen(testUrl), true);
});

test('SQLite DB - searchSeenArticles', () => {
  const testUrl = `https://example.com/test-sqlite-2-${Date.now()}`;
  const testTitle = 'Ransomware outbreak in critical infrastructure';

  markUrlSeen(testUrl, testTitle, 'Security Blog');
  const results = searchSeenArticles('Ransomware', 5);

  assert.ok(results.length > 0);
  assert.ok(results.some((r) => r.title.includes('Ransomware')));
});

test('SQLite DB - summary cache operations', () => {
  const url = 'https://example.com/test-summary-key';
  const summary = '• Bullet point 1\n• Bullet point 2';

  setCachedSummary(url, summary);
  const fetched = getCachedSummary(url);

  assert.equal(fetched, summary);
});
