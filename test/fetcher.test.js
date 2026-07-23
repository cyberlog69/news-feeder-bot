const test = require('node:test');
const assert = require('node:assert/strict');
const { isSafeUrl } = require('../src/fetcher');

test('isSafeUrl - allows valid public http/https URLs', () => {
  assert.equal(isSafeUrl('https://thehackernews.com/rss.xml'), true);
  assert.equal(isSafeUrl('http://feeds.feedburner.com/TheHackersNews'), true);
});

test('isSafeUrl - blocks private IPs and non-http schemes (SSRF prevention)', () => {
  assert.equal(isSafeUrl('http://localhost:3000'), false);
  assert.equal(isSafeUrl('http://127.0.0.1/admin'), false);
  assert.equal(isSafeUrl('http://192.168.1.1/router'), false);
  assert.equal(isSafeUrl('http://10.0.0.1/internal'), false);
  assert.equal(isSafeUrl('file:///etc/passwd'), false);
  assert.equal(isSafeUrl('javascript:alert(1)'), false);
});
