const test = require('node:test');
const assert = require('node:assert/strict');
const { matchTechWatchlist, addTechnology, removeTechnology, getMonitoredTechnologies } = require('../src/watchlist');
const { handleCommand } = require('../src/command-handler');

test('Tech Watchlist - matches technology keywords in article text', () => {
  addTechnology('fortinet', 'Firewall/VPN', 'test');
  addTechnology('nginx', 'Web Server', 'test');

  const match1 = matchTechWatchlist('Critical Remote Code Execution Disclosed in Fortinet FortiOS');
  assert.equal(match1.matched, true);
  assert.ok(match1.matches.some((m) => m.keyword === 'fortinet'));

  const match2 = matchTechWatchlist('Zero-day bug found in WordPress plugins');
  assert.ok(!match2.matches.some((m) => m.keyword === 'fortinet'));
});

test('Interactive Commands - /lookup returns CVE intelligence and PoC status', async () => {
  const res = await handleCommand('/lookup CVE-2024-30078', {}, Date.now());
  assert.ok(res.includes('Vulnerability Intelligence: CVE-2024-30078'));
  assert.ok(res.includes('CVSS Base Score'));
  assert.ok(res.includes('EPSS Exploit Likelihood'));
  assert.ok(res.includes('CISA KEV Catalog'));
});

test('Interactive Commands - /ip categorizes and defangs IPv4 targets', async () => {
  const res = await handleCommand('/ip 198.51.100.25', {}, Date.now());
  assert.ok(res.includes('198[.]51[.]100[.]25'));
  assert.ok(res.includes('Public Internet Host'));
  assert.ok(res.includes('VirusTotal'));
});

test('Interactive Commands - /hash validates and analyzes malware hashes', async () => {
  const res = await handleCommand('/hash e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', {}, Date.now());
  assert.ok(res.includes('SHA-256'));
  assert.ok(res.includes('Malware Sample'));
  assert.ok(res.includes('MalwareBazaar'));
});

test('Interactive Commands - /watchlist manages organization monitored tech stack', async () => {
  const addRes = await handleCommand('/watchlist add vmware', {}, Date.now());
  assert.ok(addRes.includes('Added *vmware* to your organization'));

  const listRes = await handleCommand('/watchlist list', {}, Date.now());
  assert.ok(listRes.includes('Organization Tech Stack Watchlist'));
  assert.ok(listRes.includes('vmware'));

  const removeRes = await handleCommand('/watchlist remove vmware', {}, Date.now());
  assert.ok(removeRes.includes('Removed *vmware*'));
});
