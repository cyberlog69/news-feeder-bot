const test = require('node:test');
const assert = require('node:assert/strict');
const { scoreArticle, passesScoreThreshold } = require('../src/scorer');

test('scoreArticle - high value keyword boosts score', () => {
  const article = {
    title: 'Critical zero-day vulnerability found',
    description: 'Active remote code execution exploit detected in the wild.',
    publishedAt: new Date().toISOString(),
    source: 'The Hacker News'
  };

  const score = scoreArticle(article);
  assert.ok(score >= 0.5, `Expected high score for critical article, got ${score}`);
});

test('scoreArticle - low value content gets low score', () => {
  const article = {
    title: 'Routine software update released',
    description: 'Minor bug fixes.',
    publishedAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    source: 'Tech Blog'
  };

  const score = scoreArticle(article);
  assert.ok(score < 0.3, `Expected low score for routine article, got ${score}`);
});

test('passesScoreThreshold - correctly evaluates thresholds', () => {
  const article = {
    title: 'Critical CVE-2026-1234 Emergency Patch',
    description: 'Vendor issues hotfix for authentication bypass.',
    publishedAt: new Date().toISOString(),
    source: 'BleepingComputer'
  };

  assert.equal(passesScoreThreshold(article, 0.3), true);
  assert.equal(passesScoreThreshold(article, 0.99), false);
});
