// test/setup.js
// Runs before every test file via `node --require ./test/setup.js`.
// Tests must never read or write the real data/ directory.

const fs = require('fs');
const os = require('os');
const path = require('path');

if (!process.env.NEWSBOT_DATA_DIR) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'newsbot-test-'));
  process.env.NEWSBOT_DATA_DIR = dir;
  process.on('exit', () => {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
  });
}

// Keep demo fixtures enabled for the existing suite while ensuring sample data
// can never be inserted into a real deployment.
process.env.DEMO_MODE = process.env.DEMO_MODE || 'true';

// Tests must never inherit a production environment (which would correctly make
// admin endpoints fail closed) or real deployment tokens.
process.env.NODE_ENV = 'test';
delete process.env.ADMIN_TOKEN;
delete process.env.DASHBOARD_TOKEN;
delete process.env.ANALYST_TOKEN;
delete process.env.AUDITOR_TOKEN;

// Make the suite deterministic and offline. Local dashboard servers stay
// reachable; any external URL is rejected. Set NEWSBOT_ALLOW_EXTERNAL_TESTS=true
// when you intentionally want to hit live APIs.
const realFetch = global.fetch;
if (realFetch && process.env.NEWSBOT_ALLOW_EXTERNAL_TESTS !== 'true') {
  global.fetch = (input, init) => {
    const href = typeof input === 'string' ? input : (input && input.url) || String(input);
    if (/^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(?::\d+)?(\/|$)/i.test(href)) {
      return realFetch(input, init);
    }
    return Promise.reject(new Error(`External network disabled in tests: ${href}`));
  };
}
