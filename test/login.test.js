require('./setup');

// Configure auth BEFORE requiring the dashboard module (it snapshots the
// token configuration at require time).
process.env.ADMIN_TOKEN = 'unit-test-admin-token';
process.env.SESSION_SECRET = 'unit-test-session-secret';

const test = require('node:test');
const assert = require('node:assert/strict');
const { startDashboard } = require('../src/web-dashboard');

test('Dashboard login - protects the console and read-only APIs, accepts a signed cookie', async () => {
  const mockPipeline = {
    getStats: () => ({ totalSent: 3 }),
    getRecentArticles: () => [],
    config: { sources: [] },
    isRunning: false
  };

  const server = startDashboard(mockPipeline, 0);
  await new Promise((resolve) => server.on('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  try {
    // Dashboard redirects to login.
    let res = await fetch(`${base}/`, { redirect: 'manual' });
    assert.equal(res.status, 302);
    assert.match(res.headers.get('location'), /^\/login/);

    // Read-only APIs are protected.
    res = await fetch(`${base}/api/articles`);
    assert.equal(res.status, 401);
    res = await fetch(`${base}/api/subscriptions`);
    assert.equal(res.status, 401);
    res = await fetch(`${base}/api/audit-log`);
    assert.equal(res.status, 401);

    // Wrong token is rejected.
    res = await fetch(`${base}/login`, {
      method: 'POST',
      body: new URLSearchParams({ token: 'wrong', next: '/' }),
      redirect: 'manual'
    });
    assert.equal(res.status, 401);

    // Correct token issues a session cookie.
    res = await fetch(`${base}/login`, {
      method: 'POST',
      body: new URLSearchParams({ token: 'unit-test-admin-token', next: '/' }),
      redirect: 'manual'
    });
    assert.equal(res.status, 302);

    const setCookie = res.headers.get('set-cookie') || '';
    assert.match(setCookie, /newsbot_session=/);
    assert.match(setCookie, /HttpOnly/);
    const cookie = setCookie.split(';')[0];

    // Cookie authorizes the dashboard and APIs.
    res = await fetch(`${base}/`, { headers: { cookie } });
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('Signed in as admin'));

    res = await fetch(`${base}/api/articles`, { headers: { cookie } });
    assert.equal(res.status, 200);

    res = await fetch(`${base}/api/audit-log`, { headers: { cookie } });
    assert.equal(res.status, 200);

    // Admin cookie satisfies the admin-only trigger auth (503 because this
    // test does not pass an onTrigger callback).
    res = await fetch(`${base}/trigger`, { method: 'POST', headers: { cookie } });
    assert.equal(res.status, 503);

    // Logout clears the cookie.
    res = await fetch(`${base}/logout`, { redirect: 'manual' });
    assert.equal(res.status, 302);
    assert.match(res.headers.get('set-cookie') || '', /Max-Age=0/);
  } finally {
    server.close();
  }
});
