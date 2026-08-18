const test = require('node:test');
const assert = require('node:assert/strict');
const EmailSender = require('../src/email-sender');
const PushSender = require('../src/push-sender');
const WebhookSender = require('../src/webhook-sender');

test('EmailSender - builds responsive HTML email template with threat intel', () => {
  const sender = new EmailSender({ toEmail: 'test@example.com' });
  const article = { title: 'CVE-2024-30078 RCE Fixed', source: 'Security News', category: 'Cyber', url: 'https://example.com' };
  const summary = '• Critical RCE vulnerability patched.\n• Immediate update required.';
  const threatIntel = { cves: [{ cveId: 'CVE-2024-30078', cvss: 9.8 }] };

  const html = sender.buildHtmlEmailTemplate(article, summary, threatIntel);

  assert.ok(html.includes('CVE-2024-30078 RCE Fixed'));
  assert.ok(html.includes('Critical RCE vulnerability patched'));
  assert.ok(html.includes('CVSS 9.8'));
  assert.ok(html.includes('https://example.com'));
});

test('PushSender - initializes with Ntfy configuration', async () => {
  const sender = new PushSender({ provider: 'ntfy', topicUrl: 'https://ntfy.sh/test_news' });
  await sender.initialize();
  assert.equal(sender.provider, 'ntfy');
});

test('PushSender - safely processes unicode smart quotes and emojis', async () => {
  const sender = new PushSender({ provider: 'demo' });
  await sender.initialize();
  // Character 8217 is ’ (smart quote)
  await assert.doesNotReject(async () => {
    await sender.sendPush("Microsoft’s Latest Zero-Day Patch — Exploit Detected", "• Patch is available immediately.", "https://example.com", true);
  });
});

test('WebhookSender - initializes with Outbound Webhook configuration', async () => {
  const sender = new WebhookSender('https://example.com/webhook', 'secret123');
  await sender.initialize();
  assert.equal(sender.webhookUrl, 'https://example.com/webhook');
});
