const test = require('node:test');
const assert = require('node:assert/strict');
const { setCisaKev, getCisaKev } = require('../src/db');
const { checkCisaKev } = require('../src/cisa-kev');
const { formatRansomwareAlert } = require('../src/ransomware-tracker');
const { formatArticle, formatArticleForTelegram } = require('../src/formatter');

test('CISA KEV - caches and retrieves KEV status with ransomware flag', async () => {
  setCisaKev('CVE-2023-34362', {
    vendorProject: 'Progress Software',
    product: 'MOVEit Transfer',
    vulnerabilityName: 'SQL Injection Vulnerability',
    dateAdded: '2023-06-02',
    requiredAction: 'Apply mitigations per vendor instructions.',
    dueDate: '2023-06-23',
    knownRansomwareUse: true
  });

  const res = await checkCisaKev('CVE-2023-34362');
  assert.ok(res);
  assert.equal(res.isKev, true);
  assert.equal(res.cveId, 'CVE-2023-34362');
  assert.equal(res.product, 'MOVEit Transfer');
  assert.equal(res.knownRansomwareUse, true);
});

test('Ransomware Tracker - formats dark web leak alert', () => {
  const victim = {
    groupName: 'LockBit',
    victimName: 'Global Logistics Corp',
    country: 'United States',
    sector: 'Transportation',
    discoveredAt: new Date().toISOString()
  };

  const formatted = formatRansomwareAlert(victim);
  assert.ok(formatted.includes('RANSOMWARE LEAK ALERT'));
  assert.ok(formatted.includes('LOCKBIT'));
  assert.ok(formatted.includes('Global Logistics Corp'));
  assert.ok(formatted.includes('Transportation'));
});

test('Formatter - includes CISA KEV badges in WhatsApp and Telegram output', () => {
  const article = { title: 'Critical MOVEit Transfer Flaw Exploit Detected', source: 'SecurityWeek', category: 'Cyber' };
  const summary = '• Hackers actively exploiting zero-day flaw.';
  const threatIntel = {
    cves: [
      {
        cveId: 'CVE-2023-34362',
        cvss: 9.8,
        severity: 'CRITICAL',
        epss: 0.95,
        cisaKev: { isKev: true, knownRansomwareUse: true }
      }
    ]
  };

  const waOutput = formatArticle(article, summary, true, [], threatIntel);
  assert.ok(waOutput.includes('CISA KEV: ACTIVELY EXPLOITED'));
  assert.ok(waOutput.includes('RANSOMWARE USE'));

  const tgOutput = formatArticleForTelegram(article, summary, true, [], threatIntel);
  assert.ok(tgOutput.includes('CISA KEV: ACTIVELY EXPLOITED'));
  assert.ok(tgOutput.includes('RANSOMWARE USE'));
});
