const test = require('node:test');
const assert = require('node:assert/strict');
const { generateSigmaRule, generateYaraRule, getOrGenerateDetectionRules } = require('../src/sigma-generator');

test('Sigma & YARA Generator - creates valid Sigma YAML rule from threat intel', () => {
  const article = {
    title: 'Critical Citrix NetScaler ADC Remote Code Execution Disclosed',
    url: 'https://example.com/citrix-rce',
    source: 'BleepingComputer'
  };
  const threatIntel = {
    cves: [{ cveId: 'CVE-2024-30078', cvss: 9.8 }],
    mitreTechniques: [{ id: 'T1190', name: 'Exploit Public-Facing Application' }],
    iocs: {
      ips: ['198.51.100.25'],
      domains: ['malicious-c2.example.com'],
      hashes: ['e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855']
    }
  };

  const yaml = generateSigmaRule(article, threatIntel);

  assert.ok(yaml.includes('title: Detect Potential Exploitation'));
  assert.ok(yaml.includes('status: experimental'));
  assert.ok(yaml.includes('logsource:'));
  assert.ok(yaml.includes('198.51.100.25'));
  assert.ok(yaml.includes('malicious-c2.example.com'));
  assert.ok(yaml.includes('attack.t1190'));
  assert.ok(yaml.includes('cve.cve-2024-30078'));
});

test('Sigma & YARA Generator - creates valid YARA rule with IOC string definitions', () => {
  const article = {
    title: 'LockBit Ransomware Deploys New Encryptor Variant',
    url: 'https://example.com/lockbit-variant'
  };
  const threatIntel = {
    cves: [{ cveId: 'CVE-2024-21412' }],
    iocs: {
      domains: ['lockbit-pay.onion.com'],
      hashes: ['44d88612fea8a8f36de82e1278abb02f']
    }
  };

  const yara = generateYaraRule(article, threatIntel);

  assert.ok(yara.includes('rule Detect_CVE_2024_21412'));
  assert.ok(yara.includes('strings:'));
  assert.ok(yara.includes('$cve = "CVE-2024-21412"'));
  assert.ok(yara.includes('$dom_0 = "lockbit-pay.onion.com"'));
  assert.ok(yara.includes('condition:'));
});

test('Sigma & YARA Generator - caches and retrieves detection rules in SQLite', () => {
  const uniqueCve = `CVE-2026-${Date.now()}`;
  const article = { title: `${uniqueCve} Remote Shell Exploit` };
  const threatIntel = { cves: [{ cveId: uniqueCve }] };

  const firstGen = getOrGenerateDetectionRules(article, threatIntel);
  assert.equal(firstGen.cached, false);
  assert.ok(firstGen.sigmaYaml);

  const secondGen = getOrGenerateDetectionRules(article, threatIntel);
  assert.equal(secondGen.cached, true);
  assert.equal(secondGen.sigmaYaml, firstGen.sigmaYaml);
});
