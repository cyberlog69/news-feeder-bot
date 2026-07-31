const test = require('node:test');
const assert = require('node:assert/strict');
const {
  SUPPORTED_LANGUAGES,
  translateText,
  translateArticleData
} = require('../src/translator');

test('translateText - returns original text for English target', async () => {
  const original = 'Critical security vulnerability discovered in Windows Kernel.';
  const result = await translateText(original, 'en');
  assert.equal(result, original);
});

test('translateText - handles supported language codes', () => {
  assert.equal(SUPPORTED_LANGUAGES['es'], 'Spanish');
  assert.equal(SUPPORTED_LANGUAGES['de'], 'German');
  assert.equal(SUPPORTED_LANGUAGES['hi'], 'Hindi');
  assert.equal(SUPPORTED_LANGUAGES['fr'], 'French');
});

test('translateArticleData - translates title and summary for non-English target', async () => {
  const article = {
    title: 'Zero-day vulnerability patched in popular browser',
    url: 'https://example.com/news/123',
    source: 'Cyber News',
    category: 'Security'
  };
  const summary = '• A major zero-day flaw was fixed today.\n• Users are advised to update immediately.';

  const result = await translateArticleData(article, summary, null, 'es');

  assert.ok(result.article.title);
  assert.ok(result.summary);
  assert.equal(result.article.url, 'https://example.com/news/123'); // URL preserved
  assert.equal(result.article.source, 'Cyber News'); // Source preserved
});
