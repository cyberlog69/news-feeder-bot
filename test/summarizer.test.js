const test = require('node:test');
const assert = require('node:assert/strict');
const { summarizeArticle } = require('../src/summarizer');

test('summarizeArticle - returns extractive summary when AI API keys missing', async () => {
  const article = {
    title: 'Test Article Title',
    content: 'This is a test article content line 1. It contains detailed information line 2.',
    url: 'https://example.com/test-article-123'
  };

  const res = await summarizeArticle(article.title, article.content, 2, article.url);
  assert.ok(res.summary, 'Summary should be generated');
  assert.ok(typeof res.aiUsed === 'boolean');
});
