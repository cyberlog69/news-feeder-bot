const test = require('node:test');
const assert = require('node:assert/strict');
const GoogleChatSender = require('../src/google-chat-sender');

test('GoogleChatSender - validates webhook URL syntax', async () => {
  const validSender = new GoogleChatSender('https://chat.googleapis.com/v1/spaces/AAAA1234/messages?key=123&token=abc');
  await validSender.initialize();

  const invalidSender = new GoogleChatSender('https://example.com/invalid');
  await assert.rejects(async () => {
    await invalidSender.initialize();
  }, /Invalid GOOGLE_CHAT_WEBHOOK_URL/);
});
