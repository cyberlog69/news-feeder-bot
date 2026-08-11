const test = require('node:test');
const assert = require('node:assert/strict');
const {
  setSubscription,
  getUserSubscription,
  matchesArticle,
  deleteUserSubscription
} = require('../src/subscription-manager');
const { handleCommand } = require('../src/command-handler');

test('SubscriptionManager - sets and retrieves topics for target ID', () => {
  setSubscription('chat_123', 'telegram', 'ransomware, cve, critical');

  const topics = getUserSubscription('chat_123', 'telegram');
  assert.ok(topics.includes('ransomware'));
  assert.ok(topics.includes('cve'));
  assert.ok(topics.includes('critical'));
  assert.equal(topics.length, 3);
});

test('SubscriptionManager - matchesArticle evaluates topic matches correctly', () => {
  const topics = ['ransomware', 'cve', 'critical'];

  const articleMatch1 = {
    title: 'Major Hospital Hit by LockBit Ransomware Attack',
    category: 'Cyber',
    description: 'Database files encrypted.'
  };
  assert.equal(matchesArticle(topics, articleMatch1, false), true);

  const articleMatch2 = {
    title: 'Zero-day Vulnerability CVE-2024-1234 Patched',
    category: 'Cyber',
    description: 'Update available now.'
  };
  assert.equal(matchesArticle(topics, articleMatch2, false), true);

  const articleNonMatch = {
    title: 'New Smartphone Released with Foldable Screen',
    category: 'Gadgets',
    description: 'Specs and price revealed.'
  };
  assert.equal(matchesArticle(topics, articleNonMatch, false), false);

  // Critical flag override
  assert.equal(matchesArticle(topics, articleNonMatch, true), true);
});

test('SubscriptionManager - handles /subscribe and /subscriptions bot commands', async () => {
  const config = { sources: [] };
  const senderInfo = { targetId: 'user_456', platform: 'whatsapp' };

  const subRes = await handleCommand('/subscribe ai, cloud', config, Date.now(), senderInfo);
  assert.ok(subRes.includes('Subscription Updated'));
  assert.ok(subRes.includes('ai, cloud'));

  const viewRes = await handleCommand('/subscriptions', config, Date.now(), senderInfo);
  assert.ok(viewRes.includes('ai, cloud'));

  const unsubRes = await handleCommand('/unsubscribe', config, Date.now(), senderInfo);
  assert.ok(unsubRes.includes('Unsubscribed successfully'));
});
