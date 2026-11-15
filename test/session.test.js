require('./setup');
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  COOKIE_NAME,
  createSession,
  verifySession,
  parseCookies,
  sessionCookie,
  clearSessionCookie
} = require('../src/session');

test('session - signs, verifies and rejects tampered/expired values', () => {
  const saved = { SESSION_SECRET: process.env.SESSION_SECRET, ADMIN_TOKEN: process.env.ADMIN_TOKEN };
  try {
    process.env.SESSION_SECRET = 'unit-test-session-secret';
    delete process.env.ADMIN_TOKEN;

    const value = createSession('admin', 60);
    assert.ok(value && value.includes('.'));
    assert.equal(verifySession(value), 'admin');

    const tampered = `${value.slice(0, -1)}${value.endsWith('a') ? 'b' : 'a'}`;
    assert.equal(verifySession(tampered), null);
    assert.equal(verifySession('garbage'), null);
    assert.equal(verifySession(''), null);

    const expired = createSession('analyst', -10);
    assert.equal(verifySession(expired), null);
  } finally {
    if (saved.SESSION_SECRET === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = saved.SESSION_SECRET;
    if (saved.ADMIN_TOKEN === undefined) delete process.env.ADMIN_TOKEN;
    else process.env.ADMIN_TOKEN = saved.ADMIN_TOKEN;
  }
});

test('session - cookie helpers set HttpOnly/SameSite and can clear', () => {
  const cookies = parseCookies('a=1; newsbot_session=abc.def; b=two');
  assert.equal(cookies.a, '1');
  assert.equal(cookies.b, 'two');
  assert.equal(cookies[COOKIE_NAME], 'abc.def');

  const set = sessionCookie('abc.def', { secure: true });
  assert.ok(set.includes('HttpOnly'));
  assert.ok(set.includes('SameSite=Strict'));
  assert.ok(set.includes('Secure'));

  const clear = clearSessionCookie();
  assert.ok(clear.includes('Max-Age=0'));
});
