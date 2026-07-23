const test = require('node:test');
const assert = require('node:assert/strict');
const {
  formatArticle,
  formatArticleForTelegram,
  isCritical
} = require('../src/formatter');

test('isCritical - detects critical keywords', () => {
  const keywords = ['zero-day', 'critical', 'RCE'];
  assert.equal(isCritical('Major Zero-Day flaw found in Chrome', keywords), true);
  assert.equal(isCritical('Minor bug update for Linux kernel', keywords), false);
});

test('formatArticle - includes severity alert for critical news', () => {
  const article = {
    title: 'Critical RCE vulnerability',
    source: 'Cyber Security News',
    category: '🔐 Cybersecurity',
    url: 'https://example.com/news/1',
    publishedAt: new Date().toISOString()
  };
  const result = formatArticle(article, '• Summary point 1', true, ['RCE']);
  assert.ok(result.includes('🚨 *CRITICAL ALERT* 🚨'));
  assert.ok(result.includes('🤖 AI summary'));
});

test('formatArticleForTelegram - produces valid HTML mode formatting', () => {
  const article = {
    title: 'Data breach at sample corp',
    source: 'HackRead',
    category: '🕵️ HackRead',
    url: 'https://example.com/news/2',
    publishedAt: new Date().toISOString()
  };
  const result = formatArticleForTelegram(article, '• Bullet point 1', false, []);
  assert.ok(result.includes('<b>Data breach at sample corp</b>'));
  assert.ok(result.includes('<i>auto-extracted</i>'));
});
