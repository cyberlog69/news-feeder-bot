const test = require('node:test');
const assert = require('node:assert/strict');
const { textToVector, cosineSimilarity, indexArticle, searchArticles } = require('../src/vector-store');
const { answerQuestion } = require('../src/rag-engine');
const { handleCommand } = require('../src/command-handler');

test('textToVector & cosineSimilarity - vectorizes text and calculates similarity', () => {
  const vec1 = textToVector('Ransomware attack encrypted hospital servers');
  const vec2 = textToVector('Hospital servers locked by ransomware breach');
  const vec3 = textToVector('Agricultural commodity market prices increased');

  const sim12 = cosineSimilarity(vec1, vec2);
  const sim13 = cosineSimilarity(vec1, vec3);

  assert.ok(sim12 > 0.3); // high similarity
  assert.ok(sim13 < 0.1); // low similarity
});

test('indexArticle & searchArticles - indexes article into SQLite and retrieves via query', () => {
  const article = {
    url: 'https://example.com/ransomware-breach-2026',
    title: 'Major Healthcare Provider Hit by Ransomware Attack',
    description: 'Attackers used compromised credentials to deploy encryption payload.',
    source: 'Cyber Intel',
    publishedAt: new Date().toISOString()
  };
  const summary = '• Healthcare network encrypted by ransomware.\n• Attackers demanded 5 million ransom.';

  indexArticle(article, summary);

  const results = searchArticles('ransomware attack healthcare', 5);
  assert.ok(results.length > 0);
  assert.equal(results[0].article.url, 'https://example.com/ransomware-breach-2026');
  assert.ok(results[0].score > 0.2);
});

test('handleCommand - /ask returns RAG answer citing indexed articles', async () => {
  const config = { sources: [] };
  const response = await handleCommand('/ask What happened with the healthcare ransomware attack?', config, Date.now());

  assert.ok(response);
  assert.ok(response.includes('Healthcare Provider Hit by Ransomware Attack') || response.includes('RAG'));
  assert.ok(response.includes('https://example.com/ransomware-breach-2026'));
});
