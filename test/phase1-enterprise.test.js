// test/phase1-enterprise.test.js
// Unit tests covering Phase 1 capabilities:
// - SIEM/SOAR Rule Push & Deployment (Sentinel KQL, Splunk, Elastic)
// - TIP Threat Sharing (STIX 2.1 & MISP Exporter, TAXII 2.1 Server)
// - Neural Podcast Audio Synthesis (MP3 Generation & Streaming)
// - Granular Source Reputation & Adaptive Weighting

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const http = require('http');

const {
  validateSigmaRule,
  validateYaraRule,
  sigmaToKQL,
  sigmaToSplunk,
  sigmaToElastic,
  formatSiemPackage,
  pushRuleToSentinel
} = require('../src/siem-sync');

const {
  exportToStix21,
  exportToMISPEvent,
  getTaxiiDiscovery,
  getTaxiiApiRoot,
  getTaxiiCollections,
  getAggregatedStixBundle
} = require('../src/tip-sync');

const {
  synthesizePodcastAudio,
  getPodcastAudioPath,
  createMinimalMp3Buffer
} = require('../src/podcast-generator');

const {
  scoreArticle,
  getSourceReputation,
  setSourceReputation,
  getAllSourceReputations,
  calculateBreakerBonus
} = require('../src/scorer');

const { startDashboard } = require('../src/web-dashboard');

// ── 1. SIEM & SOAR Translation & Validation Tests ─────────────────────────────

test('SIEM Sync - validateSigmaRule validates required fields and UUID', () => {
  const validYaml = `title: Detect CVE-2026-9999
id: 12345678-1234-4234-a234-123456789012
status: experimental
logsource:
  product: windows
detection:
  selection:
    CommandLine|contains: 'malware'
  condition: selection`;

  const validResult = validateSigmaRule(validYaml);
  assert.equal(validResult.valid, true);
  assert.equal(validResult.errors.length, 0);

  const invalidResult = validateSigmaRule('title: Incomplete Rule');
  assert.equal(invalidResult.valid, false);
  assert.ok(invalidResult.errors.length > 0);
});

test('SIEM Sync - validateYaraRule validates YARA syntax structure', () => {
  const validYara = `rule Detect_Malware {
    meta:
        description = "Test rule"
    strings:
        $s1 = "malicious_string" ascii
    condition:
        $s1
}`;

  const validResult = validateYaraRule(validYara);
  assert.equal(validResult.valid, true);

  const invalidResult = validateYaraRule('not a valid yara rule');
  assert.equal(invalidResult.valid, false);
  assert.ok(invalidResult.errors.length > 0);
});

test('SIEM Sync - sigmaToKQL transpiles Sigma YAML into Sentinel KQL', () => {
  const sigmaYaml = `title: Detect CVE-2026-1111
id: 11111111-1111-4111-a111-111111111111
status: experimental
logsource:
  product: windows
detection:
  selection_process:
    CommandLine|contains:
      - 'CVE-2026-1111'
  condition: selection_process`;

  const kql = sigmaToKQL(sigmaYaml);
  assert.ok(kql.includes('DeviceProcessEvents'));
  assert.ok(kql.includes('CVE-2026-1111'));
  assert.ok(kql.includes('| extend AlertSeverity = "High"'));
});

test('SIEM Sync - sigmaToSplunk and sigmaToElastic generate valid queries', () => {
  const sigmaYaml = `title: Detect CVE-2026-2222
id: 22222222-2222-4222-a222-222222222222
status: experimental
logsource:
  product: windows
detection:
  selection:
    CommandLine|contains:
      - 'CVE-2026-2222'
  condition: selection`;

  const splunk = sigmaToSplunk(sigmaYaml);
  assert.ok(splunk.includes('sourcetype='));
  assert.ok(splunk.includes('CVE-2026-2222'));

  const elastic = sigmaToElastic(sigmaYaml);
  assert.ok(elastic.includes('process.command_line:'));
  assert.ok(elastic.includes('CVE-2026-2222'));
});

test('SIEM Sync - pushRuleToSentinel prepares Azure Sentinel payload and audits', async () => {
  const pkg = formatSiemPackage('CVE-2026-5555', `title: Detect CVE-2026-5555
id: 55555555-5555-4555-a555-555555555555
status: experimental
logsource:
  product: windows
detection:
  selection:
    CommandLine|contains: 'exploit'
  condition: selection`, `rule Detect_5555 { meta: d="" strings: $s="x" condition: $s }`);

  const result = await pushRuleToSentinel(pkg, { dryRun: true });
  assert.equal(result.success, true);
  assert.equal(result.platform, 'Microsoft Sentinel');
  assert.equal(result.dryRun, true);
  assert.ok(result.payload.query.includes('DeviceProcessEvents'));
});

// ── 2. STIX 2.1 & MISP Threat Intel Sharing Tests ─────────────────────────────

test('TIP Sync - exportToStix21 generates valid STIX 2.1 JSON bundle', () => {
  const article = {
    title: 'Severe RCE Vulnerability in Apache Web Server CVE-2026-8888',
    url: 'https://example.com/advisory',
    publishedAt: new Date().toISOString()
  };
  const threatIntel = {
    cves: [{ cveId: 'CVE-2026-8888' }],
    mitreTechniques: [{ id: 'T1190', name: 'Exploit Public-Facing Application' }],
    iocs: {
      ips: ['198.51.100.23'],
      hashes: ['e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
      domains: ['malicious-c2.org']
    }
  };

  const bundle = exportToStix21(article, threatIntel);
  assert.equal(bundle.type, 'bundle');
  assert.equal(bundle.spec_version, '2.1');
  assert.ok(bundle.objects.length >= 4);

  const types = bundle.objects.map((o) => o.type);
  assert.ok(types.includes('vulnerability'));
  assert.ok(types.includes('attack-pattern'));
  assert.ok(types.includes('indicator'));
  assert.ok(types.includes('relationship'));

  const vuln = bundle.objects.find((o) => o.type === 'vulnerability');
  assert.equal(vuln.name, 'CVE-2026-8888');
});

test('TIP Sync - exportToMISPEvent creates structured MISP event with attributes', () => {
  const article = {
    title: 'Active Ransomware Campaign Targeting Healthcare',
    publishedAt: new Date().toISOString()
  };
  const threatIntel = {
    cves: [{ cveId: 'CVE-2026-7777' }],
    iocs: {
      ips: ['203.0.113.5'],
      hashes: ['d41d8cd98f00b204e9800998ecf8427e']
    },
    mitreTechniques: [{ id: 'T1486' }]
  };

  const misp = exportToMISPEvent(article, threatIntel);
  assert.ok(misp.Event);
  assert.ok(misp.Event.info.includes('NewsFeederBot'));
  assert.ok(misp.Event.Attribute.length >= 2);

  const ipAttr = misp.Event.Attribute.find((a) => a.type === 'ip-dst');
  assert.equal(ipAttr.value, '203.0.113.5');
});

test('TIP Sync - TAXII 2.1 discovery and collections metadata format correctly', () => {
  const discovery = getTaxiiDiscovery('http://localhost:3000');
  assert.ok(discovery.default.includes('/taxii2/root/'));

  const root = getTaxiiApiRoot('http://localhost:3000');
  assert.ok(root.versions.includes('application/taxii+json;version=2.1'));

  const collections = getTaxiiCollections('http://localhost:3000');
  assert.ok(collections.collections.length >= 2);
});

// ── 3. Podcast Audio Synthesis Tests ──────────────────────────────────────────

test('Podcast Generator - createMinimalMp3Buffer and synthesizePodcastAudio generate valid MP3', async () => {
  const buf = createMinimalMp3Buffer(1);
  assert.ok(buf.length > 0);
  assert.equal(buf[0], 0xFF);
  assert.equal(buf[1], 0xFB); // MPEG-1 Layer 3 sync word

  const episodeId = 'ep-test-unit-audio';
  const script = 'Welcome to the Daily Cyber Threat Briefing. Testing audio synthesis.';
  const result = await synthesizePodcastAudio(episodeId, script);

  assert.ok(result.audioPath.endsWith('.mp3'));
  assert.ok(result.fileSize > 0);
  assert.ok(fs.existsSync(result.audioPath));

  const fetchedPath = getPodcastAudioPath(episodeId);
  assert.equal(fetchedPath, result.audioPath);
});

// ── 4. Granular Source Reputation & Adaptive Weighting Tests ──────────────────

test('Scorer - source reputation loads defaults and updates dynamically', () => {
  const cisaRep = getSourceReputation('CISA Advisories');
  assert.equal(cisaRep, 1.0);

  const bleepingRep = getSourceReputation('BleepingComputer');
  assert.equal(bleepingRep, 0.92);

  setSourceReputation('Custom Trusted Feed', 0.98);
  assert.equal(getSourceReputation('Custom Trusted Feed'), 0.98);

  const all = getAllSourceReputations();
  assert.ok(all['cisa advisories'] === 1.0);
});

test('Scorer - calculateBreakerBonus detects emergency 0-day disclosures', () => {
  const normalArticle = { title: 'Routine patch release', description: 'Minor security fix' };
  assert.equal(calculateBreakerBonus(normalArticle), 0);

  const emergencyArticle = {
    title: 'Emergency patch issued for actively exploited zero-day vulnerability in firewalls',
    description: 'Attackers are weaponizing this in-the-wild.'
  };
  const bonus = calculateBreakerBonus(emergencyArticle);
  assert.ok(bonus > 0, `Expected breaker bonus > 0, got ${bonus}`);
});

test('Scorer - reputation and breaker bonus elevate article score', () => {
  const criticalCisa = {
    title: 'CISA KEV: Actively exploited zero-day in core network routers',
    description: 'Immediate remediation required for in-the-wild exploitation.',
    publishedAt: new Date().toISOString(),
    source: 'CISA Advisories'
  };

  const score = scoreArticle(criticalCisa);
  assert.ok(score >= 0.70, `Expected elevated score for CISA KEV breaker, got ${score}`);
});

// ── 5. Dashboard Phase 1 Endpoints Integration Tests ──────────────────────────

test('Phase 1 Dashboard APIs - /taxii2/, /api/stix/bundle, /api/misp/events, /api/sources/reputation, /api/podcast/audio respond with 200', async () => {
  const mockPipeline = {
    getStats: () => ({ totalSent: 20 }),
    getRecentArticles: () => [
      {
        title: 'Critical CVE-2026-4444 RCE Active',
        description: 'Compromised IP 192.0.2.100 observed connecting to C2.',
        publishedAt: new Date().toISOString(),
        source: 'CISA Advisories'
      }
    ]
  };

  const server = startDashboard(mockPipeline, 0);
  await new Promise((res) => setTimeout(res, 200));

  const port = server.address().port;

  function req(path) {
    return new Promise((resolve, reject) => {
      http.get(`http://localhost:${port}${path}`, (res) => {
        let data = '';
        res.on('data', (c) => { data += c; });
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, data }));
      }).on('error', reject);
    });
  }

  // 1. TAXII 2.1 Discovery
  const taxiiRes = await req('/taxii2/');
  assert.equal(taxiiRes.status, 200);
  assert.ok(taxiiRes.data.includes('TAXII 2.1 Server'));

  // 2. STIX 2.1 Bundle
  const stixRes = await req('/api/stix/bundle');
  assert.equal(stixRes.status, 200);
  assert.ok(stixRes.data.includes('"type": "bundle"'));

  // 3. MISP Events
  const mispRes = await req('/api/misp/events');
  assert.equal(mispRes.status, 200);
  assert.ok(mispRes.data.includes('"Event"'));

  // 4. Source Reputations API
  const repRes = await req('/api/sources/reputation');
  assert.equal(repRes.status, 200);
  assert.ok(repRes.data.includes('cisa advisories'));

  // 5. Podcast Audio Stream (MP3)
  const audioRes = await req('/api/podcast/audio');
  assert.equal(audioRes.status, 200);
  assert.equal(audioRes.headers['content-type'], 'audio/mpeg');

  // 6. SIEM Rules API
  const siemRes = await req('/api/siem/rules');
  assert.equal(siemRes.status, 200);

  server.close();
});
