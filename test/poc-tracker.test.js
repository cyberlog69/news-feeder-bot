const test = require('node:test');
const assert = require('node:assert/strict');
const { checkExploitPoC, recordExploitPoC, listTrackedPoCs } = require('../src/poc-tracker');

test('PoC Tracker - records and retrieves cached exploit PoC status', async () => {
  const cveId = 'CVE-2024-30078';
  const pocRepo = 'https://github.com/threat-hunter/CVE-2024-30078-PoC';

  recordExploitPoC(cveId, pocRepo, 'GitHub Verified');

  const status = await checkExploitPoC(cveId);
  assert.equal(status.hasPoc, true);
  assert.equal(status.pocUrl, pocRepo);
  assert.equal(status.source, 'GitHub Verified');
  assert.equal(status.cached, true);
});

test('PoC Tracker - lists all actively tracked exploit PoCs', () => {
  recordExploitPoC('CVE-2026-11111', 'https://github.com/exploit/poc-1', 'Exploit-DB');
  recordExploitPoC('CVE-2026-22222', 'https://github.com/exploit/poc-2', 'PacketStorm');

  const pocs = listTrackedPoCs(10);
  assert.ok(pocs.length >= 2);
  const found = pocs.find((p) => p.cveId === 'CVE-2026-11111');
  assert.ok(found);
  assert.equal(found.pocUrl, 'https://github.com/exploit/poc-1');
});
