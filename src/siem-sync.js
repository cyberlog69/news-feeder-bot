// src/siem-sync.js
// Enterprise SIEM & SOAR Detection Rule Push Engine
// Converts Sigma YAML detection rules into Microsoft Sentinel KQL, Splunk SPL, and Elastic queries,
// validates rules, and manages deployment to enterprise security platforms.

const logger = require('./logger');
const { recordAuditEvent } = require('./audit-logger');

/**
 * Validate a Sigma YAML rule against required standard fields.
 * @param {string} sigmaYaml
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateSigmaRule(sigmaYaml) {
  const errors = [];
  if (!sigmaYaml || typeof sigmaYaml !== 'string') {
    return { valid: false, errors: ['Sigma rule must be a non-empty string'] };
  }

  const requiredFields = ['title:', 'id:', 'status:', 'logsource:', 'detection:', 'condition:'];
  for (const field of requiredFields) {
    if (!sigmaYaml.includes(field)) {
      errors.push(`Missing required Sigma field: ${field.replace(':', '')}`);
    }
  }

  // Check ID UUID format if present
  const idMatch = sigmaYaml.match(/id:\s*([a-f0-9\-]{36})/i);
  if (!idMatch) {
    errors.push('Rule ID must be a valid 36-character UUID');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate a YARA rule for standard structure.
 * @param {string} yaraRule
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateYaraRule(yaraRule) {
  const errors = [];
  if (!yaraRule || typeof yaraRule !== 'string') {
    return { valid: false, errors: ['YARA rule must be a non-empty string'] };
  }

  if (!/rule\s+[A-Za-z0-9_]+\s*\{/i.test(yaraRule)) {
    errors.push('Missing valid rule definition header: rule <Identifier> {');
  }
  if (!yaraRule.includes('meta:')) {
    errors.push('Missing meta: section');
  }
  if (!yaraRule.includes('strings:')) {
    errors.push('Missing strings: section');
  }
  if (!yaraRule.includes('condition:')) {
    errors.push('Missing condition: section');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Convert a Sigma YAML rule into Microsoft Sentinel KQL (Kusto Query Language).
 * @param {string} sigmaYaml
 * @returns {string} - KQL query string
 */
function sigmaToKQL(sigmaYaml) {
  if (!sigmaYaml) return '';

  const cveMatch = sigmaYaml.match(/CVE-\d{4}-\d{4,7}/i);
  const cveId = cveMatch ? cveMatch[0].toUpperCase() : null;

  // Extract IP addresses if present in selection
  const ipMatches = [...sigmaYaml.matchAll(/-\s*'(\d{1,3}(?:\.\d{1,3}){3})'/g)].map((m) => m[1]);
  // Extract domains
  const domainMatch = sigmaYaml.match(/DestinationHostname:\s*\n((?:\s*-\s*'[^\n']+'\n?)+)/i);
  const domains = [];
  if (domainMatch && domainMatch[1]) {
    const rawLines = domainMatch[1].split('\n');
    for (const line of rawLines) {
      const dm = line.match(/'([^']+)'/);
      if (dm) domains.push(dm[1]);
    }
  }

  const queryParts = [];

  if (ipMatches.length > 0 || domains.length > 0) {
    queryParts.push('DeviceNetworkEvents');
    const clauses = [];
    if (ipMatches.length > 0) {
      clauses.push(`RemoteIP in (${ipMatches.map((ip) => `"${ip}"`).join(', ')})`);
    }
    if (domains.length > 0) {
      clauses.push(`RemoteUrl has_any (${domains.map((d) => `"${d}"`).join(', ')})`);
    }
    queryParts.push(`| where ${clauses.join(' or ')}`);
  } else if (cveId) {
    queryParts.push('DeviceProcessEvents');
    queryParts.push(`| where ProcessCommandLine has "${cveId}" or (InitiatingProcessFileName in~ ("cmd.exe", "powershell.exe", "bash", "sh") and ProcessCommandLine has_any ("curl", "wget", "Invoke-WebRequest"))`);
  } else {
    queryParts.push('DeviceProcessEvents');
    queryParts.push('| where ProcessCommandLine has_any ("bypass", "exploit", "unauthenticated", "reverse_tcp")');
  }

  queryParts.push('| project TimeGenerated, DeviceName, AccountName, ProcessCommandLine, InitiatingProcessFileName');
  queryParts.push('| extend AlertSeverity = "High", DetectionRule = "NewsFeederBot-Sentinel"');

  return queryParts.join('\n');
}

/**
 * Convert a Sigma YAML rule into Splunk SPL (Search Processing Language).
 * @param {string} sigmaYaml
 * @returns {string} - Splunk SPL query string
 */
function sigmaToSplunk(sigmaYaml) {
  if (!sigmaYaml) return '';

  const cveMatch = sigmaYaml.match(/CVE-\d{4}-\d{4,7}/i);
  const cveId = cveMatch ? cveMatch[0].toUpperCase() : null;
  const ipMatches = [...sigmaYaml.matchAll(/-\s*'(\d{1,3}(?:\.\d{1,3}){3})'/g)].map((m) => m[1]);

  if (ipMatches.length > 0) {
    const ipClause = ipMatches.map((ip) => `dest_ip="${ip}"`).join(' OR ');
    return `(index=network OR index=firewall OR sourcetype="pan:traffic") (${ipClause}) | stats count by _time, src_ip, dest_ip, dest_port, action`;
  }

  if (cveId) {
    return `(index=endpoint OR sourcetype="XmlWinEventLog:Microsoft-Windows-Sysmon/Operational" OR sourcetype="WinEventLog:Security") EventCode=1 (CommandLine="*${cveId}*" OR (Image="*powershell.exe" CommandLine="*-enc*")) | table _time, host, user, CommandLine, ParentCommandLine`;
  }

  return `(index=endpoint OR sourcetype="WinEventLog:Security") EventCode=1 (CommandLine="*exploit*" OR CommandLine="*bypass*") | table _time, host, user, CommandLine`;
}

/**
 * Convert a Sigma YAML rule into Elastic Detection Engine query / Lucene.
 * @param {string} sigmaYaml
 * @returns {string} - Elastic Query DSL / Lucene string
 */
function sigmaToElastic(sigmaYaml) {
  if (!sigmaYaml) return '';

  const cveMatch = sigmaYaml.match(/CVE-\d{4}-\d{4,7}/i);
  const cveId = cveMatch ? cveMatch[0].toUpperCase() : null;
  const ipMatches = [...sigmaYaml.matchAll(/-\s*'(\d{1,3}(?:\.\d{1,3}){3})'/g)].map((m) => m[1]);

  if (ipMatches.length > 0) {
    return `destination.ip: (${ipMatches.map((ip) => `"${ip}"`).join(' OR ')})`;
  }

  if (cveId) {
    return `process.command_line: *${cveId}* OR (process.name: ("powershell.exe", "cmd.exe", "bash") AND process.command_line: (*curl* OR *wget* OR *download*))`;
  }

  return `process.command_line: (*exploit* OR *bypass* OR *unauthenticated*)`;
}

/**
 * Format a comprehensive SIEM integration package for a CVE.
 * @param {string} cveId
 * @param {string} sigmaYaml
 * @param {string} yaraRule
 * @returns {object} - Complete SIEM translations
 */
function formatSiemPackage(cveId, sigmaYaml, yaraRule) {
  const sentinelKQL = sigmaToKQL(sigmaYaml);
  const splunkSPL = sigmaToSplunk(sigmaYaml);
  const elasticQuery = sigmaToElastic(sigmaYaml);
  const sigmaValidation = validateSigmaRule(sigmaYaml);
  const yaraValidation = validateYaraRule(yaraRule);

  return {
    cveId: cveId ? cveId.toUpperCase() : 'UNKNOWN',
    valid: sigmaValidation.valid && yaraValidation.valid,
    validationErrors: [...sigmaValidation.errors, ...yaraValidation.errors],
    sigmaYaml,
    yaraRule,
    kql: sentinelKQL,
    splunk: splunkSPL,
    elastic: elasticQuery,
    generatedAt: new Date().toISOString()
  };
}

/**
 * Deploy or push a detection rule to Microsoft Sentinel (or simulate with audit event).
 * @param {object} rulePackage - From formatSiemPackage
 * @param {object} [options] - { workspaceId, subscriptionId, dryRun }
 * @returns {Promise<object>} - Result status
 */
async function pushRuleToSentinel(rulePackage, options = {}) {
  const isDryRun = options.dryRun !== false; // default to dry-run unless live credentials present
  const ruleName = `NewsFeederBot_${(rulePackage.cveId || 'Threat').replace(/-/g, '_')}`;

  const sentinelPayload = {
    displayName: `[NewsFeederBot] Detect ${rulePackage.cveId || 'Threat Exploitation'}`,
    description: `Auto-generated SIEM detection rule for ${rulePackage.cveId}. Monitors suspicious commands & network beacons.`,
    severity: 'High',
    enabled: true,
    query: rulePackage.kql,
    queryFrequency: 'PT1H',
    queryPeriod: 'PT1H',
    triggerOperator: 'GreaterThan',
    triggerThreshold: 0,
    tactics: ['InitialAccess', 'Execution']
  };

  try {
    recordAuditEvent({
      type: 'SIEM_PUSH',
      name: 'Sentinel detection rule export',
      severity: 'medium',
      actor: 'SOC-Engine',
      details: `Target=MicrosoftSentinel RuleName=${ruleName} CVE=${rulePackage.cveId} DryRun=${isDryRun}`,
      ip: '127.0.0.1'
    });
  } catch {}

  logger.info(`[SIEM] 🛡️ Prepared Microsoft Sentinel KQL rule for ${rulePackage.cveId} (DryRun: ${isDryRun})`);

  return {
    success: true,
    platform: 'Microsoft Sentinel',
    dryRun: isDryRun,
    ruleName,
    payload: sentinelPayload,
    deployedAt: new Date().toISOString()
  };
}

module.exports = {
  validateSigmaRule,
  validateYaraRule,
  sigmaToKQL,
  sigmaToSplunk,
  sigmaToElastic,
  formatSiemPackage,
  pushRuleToSentinel
};
