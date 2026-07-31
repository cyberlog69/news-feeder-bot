const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { buildSpokenScript } = require('../src/audio-generator');
const { generateAlertCard } = require('../src/card-generator');

test('buildSpokenScript - formats article and bullet points into spoken text', () => {
  const article = { title: 'Critical Zero-day Patched', source: 'Security Week' };
  const summary = '• A zero-day flaw was fixed.\n• Users should update immediately.';

  const script = buildSpokenScript(article, summary);
  assert.ok(script.includes('Security Week'));
  assert.ok(script.includes('Critical Zero-day Patched'));
  assert.ok(script.includes('A zero-day flaw was fixed. Users should update immediately.'));
});

test('generateAlertCard - generates valid SVG graphic file', () => {
  const article = { title: 'CVE-2024-30078 Exploit Detected', source: 'The Hacker News', category: 'Cyber' };
  const threatIntel = {
    cves: [{ cveId: 'CVE-2024-30078', cvss: 9.8, epss: 0.87 }]
  };

  const { cardPath, svgString } = generateAlertCard(article, true, threatIntel);

  assert.ok(fs.existsSync(cardPath));
  assert.ok(svgString.includes('CRITICAL SECURITY ALERT'));
  assert.ok(svgString.includes('CVE-2024-30078'));
  assert.ok(svgString.includes('CVSS 9.8'));
});
