// scripts/test-ai.js
// Zero-dependency diagnostic utility to test all configured AI summarizer providers.
// Run with: npm run test-ai  OR  docker compose exec news-feeder-bot npm run test-ai

const fs = require('fs');
const path = require('path');

// Zero-dependency .env loader (works across all Node.js environments)
function loadEnv() {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    if (typeof process.loadEnvFile === 'function') {
      try { process.loadEnvFile(envPath); } catch {}
    } else {
      try {
        const content = fs.readFileSync(envPath, 'utf-8');
        content.split('\n').forEach((line) => {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#')) {
            const eqIdx = trimmed.indexOf('=');
            if (eqIdx > 0) {
              const key = trimmed.slice(0, eqIdx).trim();
              const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
              if (!process.env[key]) process.env[key] = val;
            }
          }
        });
      } catch {}
    }
  }
}

loadEnv();

const { summarizeArticle, initSummarizer } = require('../src/summarizer');

const SAMPLE_ARTICLE = {
  title: 'Critical Zero-Day Vulnerability in Enterprise Gateways Actively Exploited in the Wild',
  content: `Security researchers have discovered an actively exploited zero-day vulnerability (CVE-2026-9999) affecting enterprise VPN and security gateways.
Unauthenticated remote attackers can execute arbitrary code with root privileges by sending specially crafted network packets.
Multiple nation-state threat actors have been observed deploying custom backdoors and exfiltrating sensitive corporate data.
CISA has added the flaw to its Known Exploited Vulnerabilities catalog.
The vendor has released emergency security patches and strongly advises all administrators to apply the updates immediately or restrict administrative interfaces from the public internet.`,
  url: 'https://example.com/test-ai-diagnostic-' + Date.now()
};

async function runDiagnostic() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('       🔍  NEWS FEEDER BOT — AI SUMMARIZER DIAGNOSTIC      ');
  console.log('═══════════════════════════════════════════════════════════\n');

  const provider = (process.env.SUMMARIZER_PROVIDER || 'groq').toLowerCase().trim();
  console.log(`📌 Configured Provider:  ${provider.toUpperCase()}`);
  console.log(`🔑 GROQ_API_KEY:         ${process.env.GROQ_API_KEY ? '✔ Configured (' + process.env.GROQ_API_KEY.slice(0, 8) + '…)' : '❌ Not set'}`);
  console.log(`🔑 GEMINI_API_KEY:       ${process.env.GEMINI_API_KEY ? '✔ Configured (' + process.env.GEMINI_API_KEY.slice(0, 8) + '…)' : '❌ Not set'}`);
  console.log(`🔑 OPENROUTER_API_KEY:   ${process.env.OPENROUTER_API_KEY ? '✔ Configured (' + process.env.OPENROUTER_API_KEY.slice(0, 8) + '…)' : '❌ Not set'}`);
  console.log(`🔑 HF_API_KEY:           ${process.env.HF_API_KEY ? '✔ Configured (' + process.env.HF_API_KEY.slice(0, 8) + '…)' : '❌ Not set'}`);
  console.log('───────────────────────────────────────────────────────────\n');

  initSummarizer();

  console.log('\n🚀 Testing live article summarization…\n');
  const startTime = Date.now();

  try {
    const result = await summarizeArticle(
      SAMPLE_ARTICLE.title,
      SAMPLE_ARTICLE.content,
      3,
      SAMPLE_ARTICLE.url
    );

    const elapsed = Date.now() - startTime;

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('                       RESULTS                             ');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`⚡ Execution Time:  ${elapsed} ms`);
    console.log(`🤖 AI Utilized:     ${result.aiUsed ? '✅ YES (Live LLM AI Summary)' : '⚠️ NO (Extractive Fallback Used)'}`);
    console.log(`🏢 Active Provider: ${result.provider.toUpperCase()}`);
    console.log('───────────────────────────────────────────────────────────');
    console.log('📝 Generated Summary:\n');
    console.log(result.summary);
    console.log('\n═══════════════════════════════════════════════════════════');

    if (result.aiUsed) {
      console.log('🎉 SUCCESS: AI Summarization is 100% operational and healthy!\n');
    } else {
      console.log('⚠️ NOTE: Summarization succeeded via extractive fallback. Check your API keys if you wish to use LLM synthesis.\n');
    }
  } catch (err) {
    console.error('\n❌ DIAGNOSTIC FAILED:', err.message);
  }
}

runDiagnostic();
