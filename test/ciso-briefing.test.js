const test = require('node:test');
const assert = require('node:assert/strict');
const { generateCisoBriefing, formatBriefingMarkdown, formatBriefingHtml } = require('../src/report-generator');
const { handleCommand } = require('../src/command-handler');
const { startDashboard } = require('../src/web-dashboard');

test('CISO Briefing - generates structured executive intelligence briefing', () => {
  const briefing = generateCisoBriefing(10);

  assert.ok(briefing.title);
  assert.ok(briefing.executiveSummary);
  assert.ok(Array.isArray(briefing.strategicActionItems));
  assert.ok(briefing.strategicActionItems.length >= 3);
  assert.ok(briefing.metrics !== undefined);
});

test('CISO Briefing - formats Markdown and HTML templates with badges and tables', () => {
  const mockBriefing = {
    title: 'Executive Cybersecurity & Threat Intelligence Briefing',
    date: 'Monday, August 12, 2026',
    generatedAt: new Date().toISOString(),
    metrics: { totalArticlesProcessed: 12, activeCisaKevZeroDays: 2, ransomwareDisclosures: 1 },
    executiveSummary: 'Executive overview test summary content.',
    cisaKevWatchlist: [
      { cveId: 'CVE-2024-1234', vendor: 'ExampleCorp', product: 'Gateway', name: 'RCE Exploit', ransomwareUse: 1 }
    ],
    ransomwareActivity: [
      { groupName: 'LockBit', victimName: 'TargetHospital', sector: 'Healthcare', country: 'US' }
    ],
    recentIncidents: [],
    strategicActionItems: ['Patching: Apply updates immediately.']
  };

  const md = formatBriefingMarkdown(mockBriefing);
  assert.ok(md.includes('Executive Overview'));
  assert.ok(md.includes('CVE-2024-1234'));
  assert.ok(md.includes('LockBit'));

  const html = formatBriefingHtml(mockBriefing);
  assert.ok(html.includes('<!DOCTYPE html>'));
  assert.ok(html.includes('CVE-2024-1234'));
  assert.ok(html.includes('TargetHospital'));
});

test('CISO Briefing - /briefing bot command and /api/ciso-briefing endpoint', async () => {
  // Test bot command
  const botRes = await handleCommand('/briefing', { sources: [] }, Date.now());
  assert.ok(botRes.includes('Executive Overview') || botRes.includes('CISO'));

  // Test dashboard API
  const mockPipeline = {
    getStats: () => ({ totalSent: 10 }),
    getRecentArticles: () => [],
    runOnce: async () => ({ sent: 0 }),
    config: { sources: [] }
  };

  const server = startDashboard(mockPipeline, 0, Date.now());
  await new Promise((resolve) => server.once('listening', resolve));
  const port = server.address().port;

  try {
    const resJson = await fetch(`http://localhost:${port}/api/ciso-briefing`);
    assert.equal(resJson.status, 200);
    const dataJson = await resJson.json();
    assert.ok(dataJson.title !== undefined);

    const resHtml = await fetch(`http://localhost:${port}/api/ciso-briefing?format=html`);
    assert.equal(resHtml.status, 200);
    const textHtml = await resHtml.text();
    assert.ok(textHtml.includes('<!DOCTYPE html>'));
  } finally {
    server.close();
  }
});
