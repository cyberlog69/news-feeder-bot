// test/exposed-ip.test.js
// Tests for Exposed IP & WAN Perimeter Intelligence, Monthly Filtering,
// Sorting, and Print/PDF/Word report generation.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const { initDb, getExposedIps, getExposedIpStats, seedSampleExposedIps } = require('../src/db');
const { generatePrintableHtml, generateWordDoc } = require('../src/exposed-ip-report');
const { startDashboard } = require('../src/web-dashboard');

test('Exposed IP DB - seeds sample data and parses JSON columns properly', () => {
  const db = initDb();
  seedSampleExposedIps(db);

  const ips = getExposedIps(10);
  assert.ok(ips.length > 0, 'Should have seeded exposed IPs');

  const sample = ips[0];
  assert.ok(sample.ip, 'Record must have an IP');
  assert.ok(Array.isArray(sample.ports), 'Ports must be an array');
  assert.ok(Array.isArray(sample.services), 'Services must be an array');
  assert.ok(Array.isArray(sample.cves), 'CVEs must be an array');
  assert.equal(typeof sample.riskScore, 'number', 'Risk score must be numeric');
});

test('Exposed IP DB - supports monthly filtering and sorting', () => {
  const db = initDb();
  seedSampleExposedIps(db);

  const stats = getExposedIpStats();
  assert.ok(Array.isArray(stats.availableMonths), 'Should return available months array');
  assert.ok(stats.availableMonths.length > 0, 'Should have at least 1 month');

  // Test sorting by IP ascending
  const sortedByIp = getExposedIps(10, { sortBy: 'ip_asc' });
  for (let i = 0; i < sortedByIp.length - 1; i++) {
    assert.ok(sortedByIp[i].ip <= sortedByIp[i + 1].ip, 'IPs must be sorted ascending');
  }

  // Test sorting by Risk descending
  const sortedByRisk = getExposedIps(10, { sortBy: 'risk_desc' });
  for (let i = 0; i < sortedByRisk.length - 1; i++) {
    assert.ok(sortedByRisk[i].riskScore >= sortedByRisk[i + 1].riskScore, 'Risk scores must be sorted descending');
  }

  // Test country filtering
  const indiaIps = getExposedIps(10, { countryCode: 'IN' });
  indiaIps.forEach((rec) => {
    assert.equal(rec.countryCode, 'IN', 'All records must be India');
  });
});

test('Exposed IP Reports - generates printable HTML and Word DOC formats', () => {
  const ips = getExposedIps(5);
  const stats = getExposedIpStats();

  const html = generatePrintableHtml(ips, stats, { month: '2026-10', countryCode: 'IN', sortBy: 'risk_desc' });
  assert.ok(html.includes('<!DOCTYPE html>'), 'Must produce standard HTML5 document');
  assert.ok(html.includes('Exposed IP &amp; WAN Perimeter Intelligence Report'), 'Must contain header');
  assert.ok(html.includes('window.print()'), 'Must contain print trigger');

  const doc = generateWordDoc(ips, stats, { month: '2026-10', countryCode: 'IN' });
  assert.ok(doc.includes('xmlns:w="urn:schemas-microsoft-com:office:word"'), 'Must contain Word XML namespace');
  assert.ok(doc.includes('Cyber Threat Intelligence'), 'Must contain document title');
  assert.ok(doc.includes(ips[0].ip), 'Must contain exposed IP addresses');
});

test('Dashboard Exposed IP Endpoints - /api/exposed-ips, /report, and /export respond with 200', async () => {
  const mockPipeline = {
    getStats: () => ({ totalSent: 10, queueLength: 0, byPlatform: {} }),
    getRecentArticles: () => [],
    config: { sources: [] }
  };

  const server = startDashboard(mockPipeline, 0);

  await new Promise((resolve) => {
    if (server.listening) return resolve();
    server.on('listening', resolve);
  });

  const port = server.address().port;

  function httpGet(path) {
    return new Promise((resolve, reject) => {
      http.get(`http://localhost:${port}${path}`, (res) => {
        let body = '';
        res.on('data', (c) => { body += c; });
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
      }).on('error', reject);
    });
  }

  try {
    // 1. JSON API with filter
    const apiRes = await httpGet('/api/exposed-ips?country=IN&sort=risk_desc');
    assert.equal(apiRes.status, 200);
    const json = JSON.parse(apiRes.body);
    assert.ok(Array.isArray(json.ips));
    assert.ok(json.stats);

    // 2. Printable HTML report
    const reportRes = await httpGet('/api/exposed-ips/report?country=IN&month=2026-10');
    assert.equal(reportRes.status, 200);
    assert.ok(reportRes.headers['content-type'].includes('text/html'));
    assert.ok(reportRes.body.includes('Exposed IP &amp; WAN Perimeter Intelligence Report'));

    // 3. Word Document download
    const exportRes = await httpGet('/api/exposed-ips/export?format=doc&country=IN');
    assert.equal(exportRes.status, 200);
    assert.ok(exportRes.headers['content-type'].includes('application/msword'));
    assert.ok(exportRes.headers['content-disposition'].includes('.doc'));
  } finally {
    server.close();
  }
});
