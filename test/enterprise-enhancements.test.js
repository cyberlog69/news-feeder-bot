const test = require('node:test');
const assert = require('node:assert/strict');

const { isPrivateIp, resolveSafeUrl, isSafeUrl } = require('../src/fetcher');
const { signPayload } = require('../src/webhook-sender');
const { markUrlSeen, getArticleArchive, searchArticleArchive, getArticleTrends } = require('../src/db');
const { escapeHtml, formatBriefingHtml } = require('../src/report-generator');
const EmailSender = require('../src/email-sender');

// ── SSRF: isPrivateIp exhaustively covers IPv4/IPv6 private ranges ───────────
test('isPrivateIp - blocks all private/reserved IPv4 ranges', () => {
  const privates = [
    '0.0.0.0', '10.0.0.1', '10.255.255.255',
    '100.64.0.1', '100.127.255.254',        // CGNAT
    '127.0.0.1', '169.254.169.254',          // loopback + AWS metadata
    '172.16.0.1', '172.31.255.255',          // 172.16/12
    '192.168.1.1', '192.0.0.10',
    '192.0.2.1',                            // TEST-NET
    '198.18.0.1', '198.51.100.5',
    '203.0.113.7', '224.0.0.1', '240.0.0.1'
  ];
  for (const ip of privates) assert.equal(isPrivateIp(ip), true, `${ip} should be private`);
});

test('isPrivateIp - allows public IPv4/IPv6 addresses', () => {
  const publics = ['8.8.8.8', '1.1.1.1', '93.184.216.34', '2606:4700:4700::1111', '2001:4860:4860::8888'];
  for (const ip of publics) assert.equal(isPrivateIp(ip), false, `${ip} should be public`);
});

test('isPrivateIp - handles IPv4-mapped IPv6 addresses', () => {
  assert.equal(isPrivateIp('::ffff:127.0.0.1'), true);
  assert.equal(isPrivateIp('::ffff:10.0.0.1'), true);
  assert.equal(isPrivateIp('::ffff:8.8.8.8'), false);
});

test('resolveSafeUrl - blocks private IP literals without performing DNS', async () => {
  assert.equal(await resolveSafeUrl('http://10.0.0.1/internal'), false);
  assert.equal(await resolveSafeUrl('http://127.0.0.1/admin'), false);
  assert.equal(await resolveSafeUrl('http://localhost/x'), false);
  assert.equal(await resolveSafeUrl('file:///etc/passwd'), false);
});

test('resolveSafeUrl - allows public IP literals (no DNS required)', async () => {
  assert.equal(await resolveSafeUrl('https://8.8.8.8/'), true);
  assert.equal(isSafeUrl('https://8.8.8.8/'), true);
});

// ── Webhook HMAC payload signing ─────────────────────────────────────────────
test('signPayload - produces deterministic HMAC-SHA256 header value', () => {
  const payload = { type: 'SECURITY_ALERT', severity: 'critical', title: 'Zero-day' };
  const sig1 = signPayload(payload, 'shared-secret');
  const sig2 = signPayload(payload, 'shared-secret');
  assert.equal(sig1.startsWith('sha256='), true);
  assert.equal(sig1, sig2); // deterministic
  assert.match(sig1.slice(7), /^[0-9a-f]{64}$/); // hex SHA-256 length
  assert.notEqual(signPayload(payload, 'other-secret'), sig1); // tamper-sensitive
});

// ── Article archive, search & trend analytics ────────────────────────────────
test('DB archive - getArticleArchive returns paginated history', () => {
  markUrlSeen('https://enh.test/archive-1', 'Archive Test Article One', 'TestFeed');
  markUrlSeen('https://enh.test/archive-2', 'Archive Test Article Two', 'TestFeed');

  const page1 = getArticleArchive(1, 0);
  assert.equal(page1.length, 1);
  assert.ok(page1[0].url);

  const all = getArticleArchive(10, 0);
  const found = all.find((a) => a.url === 'https://enh.test/archive-2');
  assert.ok(found, 'recently inserted article should appear in archive');
  assert.equal(found.title, 'Archive Test Article Two');
});

test('DB search - searchArticleArchive filters by keyword and returns total', () => {
  const { results, total } = searchArticleArchive('Archive Test', 20, 0);
  assert.ok(total >= 2);
  assert.ok(results.length >= 2);
  assert.ok(results.every((r) => r.title.includes('Archive Test')));

  const none = searchArticleArchive('zzz-no-such-keyword-zzz', 20, 0);
  assert.equal(none.total, 0);
  assert.equal(none.results.length, 0);
});

test('DB trends - getArticleTrends returns total, bySource and contiguous byDay series', () => {
  const trends = getArticleTrends(14);
  assert.equal(typeof trends.total, 'number');
  assert.ok(trends.total >= 2);
  assert.ok(Array.isArray(trends.bySource));
  assert.ok(trends.bySource.some((s) => s.source === 'TestFeed' && s.count >= 1));
  assert.equal(trends.byDay.length, 14, 'byDay should be contiguous for the full window');
  assert.ok(trends.byDay.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.date)));
});

// ── XSS-safe HTML briefing rendering ─────────────────────────────────────────
test('escapeHtml - neutralizes XSS payloads', () => {
  assert.equal(escapeHtml('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
  assert.equal(escapeHtml('a&b"c\'d'), 'a&amp;b&quot;c&#39;d');
});

test('formatBriefingHtml - does not emit raw HTML from untrusted fields', () => {
  const briefing = {
    generatedAt: new Date().toISOString(),
    title: 'Daily SOC Briefing',
    date: new Date().toISOString().slice(0, 10),
    executiveSummary: 'Summary with <script>alert("xss")</script> and <img src=x onerror=alert(1)> payload',
    metrics: {
      totalArticlesProcessed: 42,
      activeCisaKevZeroDays: 1,
      ransomwareDisclosures: 0
    },
    topThreats: [],
    cisaKevWatchlist: [{ cveId: 'CVE-2024-0001', vendor: 'Test<Co>', product: 'Prod', name: 'Flaw', ransomwareUse: true }],
    ransomwareActivity: [{ groupName: 'Gang<b>', victimName: 'Victim', sector: 'Sector', country: 'US' }],
    strategicActionItems: ['Patch: Apply vendor update immediately', 'NoColonActionItem'],
    kevCount: 1,
    ransomwareCount: 0,
    sourceCount: 1,
    reportPeriod: '24h'
  };

  const html = formatBriefingHtml(briefing);
  assert.ok(!html.includes('<script>alert("xss")</script>'), 'raw script tag must not appear');
  assert.ok(html.includes('&lt;script&gt;alert('), 'script payload should be HTML-escaped');
  assert.ok(html.includes('&lt;img'), 'img payload should be HTML-escaped');
  assert.ok(html.includes('&lt;b&gt;'), 'HTML from watchlist fields must be escaped');
  assert.ok(html.includes('<strong>Patch:</strong> Apply vendor update immediately'), 'colon action item renders with bold prefix');
  assert.ok(html.includes('NoColonActionItem'), 'action item without a colon still renders');
});

// ── Email sender provider dispatch + SMTP config ─────────────────────────────
test('EmailSender - resolves provider-specific API keys', () => {
  const old = { ...process.env };
  process.env.SENDGRID_API_KEY = 'SG.test';
  process.env.RESEND_API_KEY = 're_test';
  process.env.EMAIL_API_KEY = 'legacy';

  try {
    const sg = new EmailSender({ toEmail: 'a@b.com' });
    assert.equal(sg.provider, 'sendgrid');
    assert.equal(sg.apiKey, 'SG.test');

    const re = new EmailSender({ toEmail: 'a@b.com', provider: 'resend' });
    assert.equal(re.apiKey, 're_test');

    const smtp = new EmailSender({ toEmail: 'a@b.com', provider: 'smtp' });
    assert.equal(smtp.apiKey, '');
  } finally {
    process.env = old;
  }
});

test('EmailSender - buildHtmlEmailTemplate hides button and escapes URL when absent', () => {
  const sender = new EmailSender({ toEmail: 'a@b.com' });
  const html = sender.buildHtmlEmailTemplate(
    { title: '<b>title</b>', source: 'src', category: 'sec', url: '' },
    '• bullet one\n• bullet two',
    null
  );
  assert.ok(!html.includes('Read Full Article'), 'no button when URL is empty');
  assert.ok(html.includes('&lt;b&gt;title&lt;/b&gt;'), 'title is escaped');
  assert.ok(html.includes('bullet one'), 'summary bullets included');
});