require('./setup');
// test/security.test.js
// SSRF URL validation and RBAC token behaviour.

const test = require('node:test');
const assert = require('node:assert/strict');
const { isSafeUrl, isPrivateIp } = require('../src/fetcher');
const {
  timingSafeEqual,
  validateToken,
  identifyToken,
  roleSatisfies
} = require('../src/security-guard');
const { mask, maskUrl, maskEmail } = require('../src/redact');

test('isPrivateIp - blocks private, loopback, link-local and CGNAT ranges', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '::1', 'fd00::1']) {
    assert.equal(isPrivateIp(ip), true, `${ip} should be private`);
  }
  for (const ip of ['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111']) {
    assert.equal(isPrivateIp(ip), false, `${ip} should be public`);
  }
});

test('isSafeUrl - rejects non-HTTP schemes and private literals', () => {
  assert.equal(isSafeUrl('https://example.com/feed.xml'), true);
  assert.equal(isSafeUrl('http://example.com/feed.xml'), true);
  assert.equal(isSafeUrl('file:///etc/passwd'), false);
  assert.equal(isSafeUrl('javascript:alert(1)'), false);
  assert.equal(isSafeUrl('http://127.0.0.1/feed'), false);
  assert.equal(isSafeUrl('http://169.254.169.254/latest/meta-data'), false);
  assert.equal(isSafeUrl('http://[::1]/feed'), false);
  assert.equal(isSafeUrl('not a url'), false);
});

test('timingSafeEqual - compares tokens without accepting empty values', () => {
  assert.equal(timingSafeEqual('abc', 'abc'), true);
  assert.equal(timingSafeEqual('abc', 'abd'), false);
  assert.equal(timingSafeEqual('abc', 'abcd'), false);
  assert.equal(timingSafeEqual('', ''), false);
  assert.equal(timingSafeEqual(null, 'abc'), false);
});

test('redaction - masks webhook tokens, emails and chat IDs in logs', () => {
  assert.equal(maskUrl('https://hooks.slack.com/services/SECRET/TOKEN'), 'https://hooks.slack.com/***');
  assert.equal(maskEmail('analyst@example.com'), 'an***@example.com');
  assert.equal(mask('1234567890', 3), '123…890');
  assert.equal(mask('abc', 3), '***');
});

test('RBAC - identifyToken maps tokens to roles and roleSatisfies enforces hierarchy', () => {
  const saved = {
    ADMIN_TOKEN: process.env.ADMIN_TOKEN,
    DASHBOARD_TOKEN: process.env.DASHBOARD_TOKEN,
    ANALYST_TOKEN: process.env.ANALYST_TOKEN,
    AUDITOR_TOKEN: process.env.AUDITOR_TOKEN
  };
  try {
    process.env.ADMIN_TOKEN = 'a';
    process.env.ANALYST_TOKEN = 'b';
    process.env.AUDITOR_TOKEN = 'c';
    delete process.env.DASHBOARD_TOKEN;

    assert.equal(identifyToken('a'), 'admin');
    assert.equal(identifyToken('b'), 'analyst');
    assert.equal(identifyToken('c'), 'auditor');
    assert.equal(identifyToken('nope'), null);

    assert.equal(roleSatisfies('admin', 'admin'), true);
    assert.equal(roleSatisfies('analyst', 'admin'), false);
    assert.equal(roleSatisfies('analyst', 'auditor'), true);
    assert.equal(roleSatisfies('auditor', 'analyst'), false);
    assert.equal(roleSatisfies(null, 'auditor'), false);
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('validateToken - role hierarchy and production fail-closed', () => {
  const saved = {
    NODE_ENV: process.env.NODE_ENV,
    ADMIN_TOKEN: process.env.ADMIN_TOKEN,
    DASHBOARD_TOKEN: process.env.DASHBOARD_TOKEN,
    ANALYST_TOKEN: process.env.ANALYST_TOKEN,
    AUDITOR_TOKEN: process.env.AUDITOR_TOKEN
  };

  try {
    process.env.ADMIN_TOKEN = 'admin-secret';
    process.env.ANALYST_TOKEN = 'analyst-secret';
    process.env.AUDITOR_TOKEN = 'auditor-secret';
    delete process.env.DASHBOARD_TOKEN;

    assert.equal(validateToken('admin-secret', 'admin'), true);
    assert.equal(validateToken('analyst-secret', 'admin'), false);
    assert.equal(validateToken('analyst-secret', 'analyst'), true);
    assert.equal(validateToken('auditor-secret', 'auditor'), true);
    assert.equal(validateToken('wrong', 'auditor'), false);

    // Production with no tokens configured must fail closed.
    delete process.env.ADMIN_TOKEN;
    delete process.env.ANALYST_TOKEN;
    delete process.env.AUDITOR_TOKEN;
    process.env.NODE_ENV = 'production';
    assert.equal(validateToken('anything', 'admin'), false);
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
