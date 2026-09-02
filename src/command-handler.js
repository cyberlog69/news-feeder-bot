// src/command-handler.js
// Interactive command handler for incoming bot messages.
// Supported commands: /status, /search <keyword>, /sources, /help

const { searchSeenArticles, getTotalSeenCount } = require('./db');
const { answerQuestion } = require('./rag-engine');
const { setSubscription, getUserSubscription, deleteUserSubscription } = require('./subscription-manager');

/**
 * Handle incoming command text.
 * @param {string} text - Raw command string (e.g. "/search ransomware" or "/subscribe cve, ransomware")
 * @param {object} config - Application configuration object
 * @param {number} startTime - Bot boot timestamp
 * @param {object} [senderInfo] - { targetId, platform }
 * @returns {Promise<string>} - Formatted response string
 */
async function handleCommand(text, config, startTime, senderInfo = {}) {
  const trimmed = String(text || '').trim();
  if (!trimmed.startsWith('/')) return null;

  const targetId = senderInfo.targetId || 'default';
  const platform = senderInfo.platform || 'general';

  const parts = trimmed.split(/\s+/);
  const command = parts[0].toLowerCase();
  const args = parts.slice(1).join(' ');

  switch (command) {
    case '/status': {
      const uptimeSec = Math.floor((Date.now() - startTime) / 1000);
      const uptimeStr = uptimeSec < 60 ? `${uptimeSec}s`
        : uptimeSec < 3600 ? `${Math.floor(uptimeSec / 60)}m ${uptimeSec % 60}s`
        : `${Math.floor(uptimeSec / 3600)}h ${Math.floor((uptimeSec % 3600) / 60)}m`;

      const totalSent = getTotalSeenCount();
      const sourcesCount = (config.sources || []).filter((s) => s.enabled).length;

      return [
        '📊 *News Feeder Bot Status*',
        '━━━━━━━━━━━━━━━━━━━━━━━━━',
        `✅ Status: Active & Operational`,
        `⏱ Uptime: ${uptimeStr}`,
        `📰 Total Sent: ${totalSent} articles`,
        `📡 Active Sources: ${sourcesCount}`,
        `🤖 AI Provider: ${process.env.SUMMARIZER_PROVIDER || 'gemini'}`,
        '━━━━━━━━━━━━━━━━━━━━━━━━━'
      ].join('\n');
    }

    case '/sources': {
      const sources = (config.sources || []).filter((s) => s.enabled);
      return [
        '📡 *Active News Sources*',
        '━━━━━━━━━━━━━━━━━━━━━━━━━',
        ...sources.map((s) => `• *${s.name}* (${s.category})`),
        '━━━━━━━━━━━━━━━━━━━━━━━━━'
      ].join('\n');
    }

    case '/search': {
      if (!args) return '⚠️ Usage: `/search <keyword>` (e.g. `/search ransomware`)';

      // Security: cap keyword length and strip control/non-printable characters
      const keyword = args.replace(/[\x00-\x1F\x7F]/g, '').slice(0, 100).trim();
      if (!keyword) return '⚠️ Invalid search keyword.';

      const results = searchSeenArticles(keyword, 5);
      if (results.length === 0) {
        return `🔍 No recent articles found matching: *${keyword}*`;
      }

      return [
        `🔍 *Search Results for "${keyword}"*`,
        '━━━━━━━━━━━━━━━━━━━━━━━━━',
        ...results.map((r, i) => `${i + 1}. *${r.title}*\n   _${r.source}_ • [Link](${r.url})\n`),
        '━━━━━━━━━━━━━━━━━━━━━━━━━'
      ].join('\n');
    }

    case '/ask': {
      if (!args) return '⚠️ Usage: `/ask <question>` (e.g. `/ask What supply chain attacks occurred this week?`)';
      const question = args.replace(/[\x00-\x1F\x7F]/g, '').slice(0, 200).trim();
      return await answerQuestion(question);
    }

    case '/subscribe': {
      if (!args) {
        const current = getUserSubscription(targetId, platform);
        return `⚠️ Usage: \`/subscribe <topics>\` (e.g. \`/subscribe ransomware, cve, critical\` or \`/subscribe all\`)\n\nCurrent active topics: *${current.join(', ')}*`;
      }
      const cleanTopics = args.replace(/[\x00-\x1F\x7F]/g, '').slice(0, 200).trim();
      const updated = setSubscription(targetId, platform, cleanTopics);
      return [
        `✅ *Subscription Updated!*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `🎯 *Active Topics:* ${updated.join(', ')}`,
        `📡 You will only receive news matching these topics (or critical alerts).`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━`
      ].join('\n');
    }

    case '/unsubscribe': {
      deleteUserSubscription(targetId, platform);
      return `✅ *Unsubscribed successfully.* You will now receive all news updates by default.`;
    }

    case '/subscriptions':
    case '/mysubscriptions': {
      const current = getUserSubscription(targetId, platform);
      return [
        `📋 *Your Active Subscriptions*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `🎯 *Configured Topics:* ${current.join(', ')}`,
        `💡 Use \`/subscribe <topics>\` to update your preferences or \`/unsubscribe\` to reset.`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━`
      ].join('\n');
    }

    case '/briefing':
    case '/ciso-report': {
      const { generateCisoBriefing, formatBriefingMarkdown } = require('./report-generator');
      const briefing = generateCisoBriefing(10);
      return formatBriefingMarkdown(briefing);
    }

    case '/lookup':
    case '/cve': {
      if (!args) return '⚠️ Usage: `/lookup <CVE-ID>` (e.g. `/lookup CVE-2024-30078`)';
      const cveMatch = args.match(/CVE-\d{4}-\d{4,7}/i);
      if (!cveMatch) return '⚠️ Invalid CVE format. Expected format: `CVE-YYYY-NNNN` (e.g. `CVE-2024-30078`).';
      const cveId = cveMatch[0].toUpperCase();

      const { fetchCveAndEpss } = require('./threat-intel');
      const { checkCisaKev } = require('./cisa-kev');
      const { checkExploitPoC } = require('./poc-tracker');
      const { getCachedDetectionRule } = require('./db');

      const data = await fetchCveAndEpss(cveId);
      const cisa = await checkCisaKev(cveId).catch(() => null);
      const poc = await checkExploitPoC(cveId).catch(() => ({ hasPoc: false }));
      const rule = getCachedDetectionRule(cveId);

      const lines = [
        `🛡️ *Vulnerability Intelligence: ${cveId}*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `📊 *CVSS Base Score:* ${data.cvss ? `*${data.cvss}* (${data.severity || 'N/A'})` : 'Awaiting Score'}`,
        `📈 *EPSS Exploit Likelihood:* ${data.epss ? `*${(data.epss * 100).toFixed(2)}%* (Top ${((1 - (data.percentile || 0)) * 100).toFixed(0)}% most exploited)` : 'N/A'}`,
        `🏛️ *CISA KEV Catalog:* ${cisa ? `🚨 *YES* (Due: ${cisa.dueDate || 'Immediate'}${cisa.knownRansomwareUse ? ' | 🏴‍☠️ Ransomware Flag' : ''})` : 'No active KEV mandate'}`,
        `🔥 *Exploit PoC Available:* ${poc?.hasPoc ? `✅ *YES* ([GitHub Repo](${poc.pocUrl}))` : '❌ None publicly indexed'}`,
        `⚡ *Sigma & YARA Rules:* ${rule ? '✅ *Available* (Use `/rules ' + cveId + '` to view)' : '⚡ Auto-generated on delivery'}`,
        `🔗 *References:* [NVD Details](https://nvd.nist.gov/vuln/detail/${cveId}) • [MITRE](https://cve.mitre.org/cgi-bin/cvename.cgi?name=${cveId})`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━`
      ];

      return lines.join('\n');
    }

    case '/ip': {
      if (!args) return '⚠️ Usage: `/ip <IPv4>` (e.g. `/ip 198.51.100.25`)';
      const ipMatch = args.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/);
      if (!ipMatch) return '⚠️ Invalid IPv4 address provided.';
      const rawIp = ipMatch[0];
      const defanged = rawIp.replace(/\./g, '[.]');

      // Check if private/RFC1918
      const isPrivate = /^(?:10\.|127\.|172\.(?:1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.)/.test(rawIp);

      return [
        `🌐 *IP Reputation & Threat Assessment*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `🎯 *Target IP:* \`${defanged}\``,
        `🏷️ *Network Classification:* ${isPrivate ? '🏠 Private / Internal (RFC1918 / Loopback)' : '🌍 Public Internet Host'}`,
        `🔍 *Threat Status:* ${isPrivate ? 'Not Routable on Public Internet' : 'Suspicious IOC Indicator'}`,
        `🛡️ *Defanged Format:* \`${defanged}\``,
        `🔗 *Investigate:* [VirusTotal](https://www.virustotal.com/gui/ip-address/${rawIp}) • [AbuseIPDB](https://www.abuseipdb.com/check/${rawIp}) • [Shodan](https://www.shodan.io/host/${rawIp})`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━`
      ].join('\n');
    }

    case '/hash': {
      if (!args) return '⚠️ Usage: `/hash <MD5|SHA1|SHA256>`';
      const hash = args.trim().toLowerCase();
      let type = 'Unknown';
      if (hash.length === 32) type = 'MD5';
      else if (hash.length === 40) type = 'SHA-1';
      else if (hash.length === 64) type = 'SHA-256';
      else return '⚠️ Invalid hash length. Supported: MD5 (32 chars), SHA-1 (40 chars), SHA-256 (64 chars).';

      return [
        `🔬 *Malware File Hash Analysis*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `🔑 *Hash Type:* ${type}`,
        `📁 *Hash Value:* \`${hash}\``,
        `🛡️ *Threat Category:* Malware Sample / Suspicious Artifact`,
        `🔗 *Lookup:* [VirusTotal](https://www.virustotal.com/gui/file/${hash}) • [MalwareBazaar](https://bazaar.abuse.ch/sample/${hash}/)`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━`
      ].join('\n');
    }

    case '/watchlist': {
      const { getMonitoredTechnologies, addTechnology, removeTechnology } = require('./watchlist');
      const subParts = args.split(/\s+/);
      const subCmd = (subParts[0] || 'list').toLowerCase();
      const techKeyword = subParts.slice(1).join(' ').trim();

      if (subCmd === 'add') {
        if (!techKeyword) return '⚠️ Usage: `/watchlist add <technology>` (e.g. `/watchlist add fortinet`)';
        addTechnology(techKeyword, 'Custom', targetId);
        return `✅ Added *${techKeyword}* to your organization tech stack watchlist!`;
      }

      if (subCmd === 'remove' || subCmd === 'del' || subCmd === 'delete') {
        if (!techKeyword) return '⚠️ Usage: `/watchlist remove <technology>`';
        removeTechnology(techKeyword);
        return `🗑️ Removed *${techKeyword}* from your organization watchlist.`;
      }

      const list = getMonitoredTechnologies();
      return [
        `🎯 *Organization Tech Stack Watchlist*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `Monitored technologies receive elevated priority alerts when vulnerabilities or exploits are disclosed:`,
        '',
        ...list.map((item) => `• *${item.keyword}* (${item.category})`),
        '',
        `💡 Commands: \`/watchlist add <tech>\` • \`/watchlist remove <tech>\``,
        `━━━━━━━━━━━━━━━━━━━━━━━━━`
      ].join('\n');
    }

    case '/rules': {
      const { getCachedDetectionRule, getAllDetectionRules } = require('./db');
      if (args) {
        const cveMatch = args.match(/CVE-\d{4}-\d{4,7}/i);
        const cveId = cveMatch ? cveMatch[0].toUpperCase() : args.trim().toUpperCase();
        const rule = getCachedDetectionRule(cveId);
        if (!rule) return `⚠️ No cached Sigma/YARA rule found for *${cveId}*. Rules are generated automatically when news alerts are processed.`;

        return [
          `⚡ *Sigma Detection Rule for ${cveId}*`,
          `\`\`\`yaml`,
          rule.sigmaYaml,
          `\`\`\``
        ].join('\n');
      }

      const rules = getAllDetectionRules(5);
      if (rules.length === 0) return `⚡ No detection rules generated yet. They will appear here as security advisories are processed.`;

      return [
        `⚡ *Recent Detection Rules*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ...rules.map((r) => `• *${r.cveId}* (Generated: ${new Date(r.createdAt).toLocaleDateString()})\n  Use \`/rules ${r.cveId}\` to view full Sigma rule`),
        `━━━━━━━━━━━━━━━━━━━━━━━━━`
      ].join('\n');
    }

    case '/help':
    default: {
      return [
        '🤖 *News Feeder Bot Commands*',
        '━━━━━━━━━━━━━━━━━━━━━━━━━',
        '📊 *General & Feeds*',
        '• `/status` — View bot uptime, throughput, and system health',
        '• `/sources` — List all active RSS news feeds',
        '• `/search <keyword>` — Search recent articles by keyword',
        '• `/ask <question>` — Ask conversational AI questions over indexed news',
        '',
        '🛡️ *Threat Intelligence & Investigation*',
        '• `/lookup <CVE-ID>` — Full CVE intelligence (CVSS, EPSS %, CISA KEV, PoC)',
        '• `/ip <IPv4>` — IP reputation check, categorization & defanged format',
        '• `/hash <MD5|SHA1|SHA256>` — Malware file hash threat analysis',
        '• `/rules [CVE-ID]` — View auto-generated Sigma & YARA detection rules',
        '',
        '🎯 *Subscriptions & Customization*',
        '• `/watchlist` — View/manage organization tech stack monitor',
        '• `/briefing` — Generate an Executive CISO Threat Intelligence Briefing',
        '• `/subscribe <topics>` — Filter alerts (e.g. `ransomware, cve, critical`)',
        '• `/unsubscribe` — Reset topic filters to receive all news',
        '• `/subscriptions` — View your configured subscription topics',
        '━━━━━━━━━━━━━━━━━━━━━━━━━'
      ].join('\n');
    }
  }
}

module.exports = { handleCommand };
