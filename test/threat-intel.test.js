const test = require('node:test');
const assert = require('node:assert/strict');
const {
  extractCVEs,
  extractIOCs,
  detectMitreAttck,
  enrichArticle
} = require('../src/threat-intel');

test('extractCVEs - correctly identifies and deduplicates CVE IDs', () => {
  const sample = 'Critical zero-day CVE-2024-30078 and CVE-2024-30078 also CVE-2023-12345 in Windows kernel.';
  const cves = extractCVEs(sample);
  assert.deepEqual(cves, ['CVE-2024-30078', 'CVE-2023-12345']);
});

test('extractIOCs - parses IPs, hashes, and defanged domains', () => {
  const sample = `
    Malicious host 198.51.100.45 communicating with malware hash 4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdedf91c.
    C2 domain bad-site[.]org and local IP 192.168.1.1 (should be ignored).
  `;
  const iocs = extractIOCs(sample);

  assert.ok(iocs.ips.includes('198.51.100.45'));
  assert.equal(iocs.ips.includes('192.168.1.1'), false); // private IP ignored
  assert.ok(iocs.hashes.includes('4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdedf91c'));
  assert.ok(iocs.domains.includes('bad-site[.]org'));
});

test('detectMitreAttck - maps keywords to MITRE ATT&CK technique IDs', () => {
  const sample = 'Attackers executed a PowerShell script to perform unauthenticated RCE and deploy ransomware.';
  const mitre = detectMitreAttck(sample);

  const ids = mitre.map((m) => m.id);
  assert.ok(ids.includes('T1059')); // Command and Scripting Interpreter
  assert.ok(ids.includes('T1190')); // Exploit Public-Facing Application
  assert.ok(ids.includes('T1486')); // Data Encrypted for Impact
});

test('enrichArticle - returns null for articles with no threat intel', async () => {
  const article = { title: 'New Open Source Release v1.0', description: 'A great new JavaScript library was released today.' };
  const enriched = await enrichArticle(article, '');
  assert.equal(enriched, null);
});

test('enrichArticle - parses full threat intel object for security news', async () => {
  const article = {
    title: 'CVE-2024-30078: Critical Windows Wi-Fi RCE Vulnerability Discovered',
    description: 'Attackers can exploit CVE-2024-30078 using PowerShell to deploy ransomware from 203.0.113.50.'
  };

  const enriched = await enrichArticle(article, '');
  assert.ok(enriched !== null);
  assert.ok(enriched.cves.some((c) => c.cveId === 'CVE-2024-30078'));
  assert.ok(enriched.iocs.ips.includes('203.0.113.50'));
  assert.ok(enriched.mitre.length > 0);
});
