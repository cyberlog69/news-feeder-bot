const test = require('node:test');
const assert = require('node:assert/strict');
const { timingSafeEqual, validateToken, createRateLimiter } = require('../src/security-guard');
const { formatCefEvent, formatEcsEvent, recordAuditEvent } = require('../src/audit-logger');
const { optimizeDatabase, pruneOldRecords } = require('../src/db-maintenance');
const { startDashboard } = require('../src/web-dashboard');

test('Security Guard - timingSafeEqual correctly compares tokens', () => {
  assert.equal(timingSafeEqual('secret_token_123', 'secret_token_123'), true);
  assert.equal(timingSafeEqual('secret_token_123', 'wrong_token_456'), false);
  assert.equal(timingSafeEqual('short', 'much_longer_token'), false);
});

test('Security Guard - sliding-window rate limiter blocks excessive requests', () => {
  const limiter = createRateLimiter({ windowMs: 1000, maxRequests: 3 });

  assert.equal(limiter.checkLimit('192.168.1.10').allowed, true);
  assert.equal(limiter.checkLimit('192.168.1.10').allowed, true);
  assert.equal(limiter.checkLimit('192.168.1.10').allowed, true);
  assert.equal(limiter.checkLimit('192.168.1.10').allowed, false);

  // Different IP should still be allowed
  assert.equal(limiter.checkLimit('192.168.1.20').allowed, true);
});

test('SIEM Audit Logger - formats standard CEF and ECS compliant audit events', () => {
  const event = {
    type: 'CISA_KEV_MATCH',
    name: 'Actively Exploited Zero-day Detected',
    severity: 'critical',
    actor: 'pipeline_worker',
    details: 'CVE-2024-3400 matched CISA KEV catalog with ransomware flag',
    ip: '10.0.0.5'
  };

  const cef = formatCefEvent(event);
  assert.ok(cef.startsWith('CEF:0|NewsFeederBot|SOCEngine|3.13|CISA_KEV_MATCH'));
  assert.ok(cef.includes('suser=pipeline_worker'));
  assert.ok(cef.includes('msg=CVE-2024-3400'));

  const ecs = formatEcsEvent(event);
  assert.equal(ecs.event.kind, 'alert');
  assert.equal(ecs.event.severity, 10);
  assert.equal(ecs.user.name, 'pipeline_worker');

  // Verify write
  recordAuditEvent(event);
});

test('DB Maintenance - executes WAL checkpoint and record pruning', () => {
  const opt = optimizeDatabase();
  assert.equal(opt, true);

  const pruned = pruneOldRecords(365);
  assert.equal(typeof pruned, 'number');
});

test('Dashboard Security & Audit APIs - /api/audit-log responds with 200 JSON', async () => {
  const mockPipeline = {
    getStats: () => ({ totalSent: 1 }),
    getRecentArticles: () => [],
    runOnce: async () => ({ sent: 0 }),
    config: { sources: [] }
  };

  const server = startDashboard(mockPipeline, 0, Date.now());
  await new Promise((resolve) => server.once('listening', resolve));
  const port = server.address().port;

  try {
    const res = await fetch(`http://localhost:${port}/api/audit-log`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.logs));
  } finally {
    server.close();
  }
});
