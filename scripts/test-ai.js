// scripts/test-ai.js
// Zero-dependency diagnostic utility to test all 6 free AI summarizer providers.
// Run with: npm run test-ai

const fs = require('fs');
const path = require('path');

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

async function testGroqModelsEndpoint(apiKey) {
  if (!apiKey) return;
  try {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey.trim()}` }
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      const chatModels = (data.data || []).map(m => m.id).filter(id => !id.includes('whisper') && !id.includes('guard'));
      console.log(`🤖 Groq Live Models Available (${chatModels.length}): ${chatModels.slice(0, 4).join(', ')}…`);
    } else {
      console.log(`⚠️ Groq Key Validation: HTTP ${res.status} — ${data?.error?.message || 'Invalid key'}`);
    }
  } catch (err) {
    console.log(`⚠️ Groq Connection: ${err.message}`);
  }
}

async function testCerebrasModelsEndpoint(apiKey) {
  if (!apiKey) return;
  try {
    const res = await fetch('https://api.cerebras.ai/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey.trim()}` }
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      const chatModels = (data.data || []).map(m => m.id);
      console.log(`⚡ Cerebras Live Models Available (${chatModels.length}): ${chatModels.slice(0, 3).join(', ')}…`);
    } else {
      console.log(`⚠️ Cerebras Key Validation: HTTP ${res.status} — ${data?.error?.message || 'Invalid key'}`);
    }
  } catch (err) {
    console.log(`⚠️ Cerebras Connection: ${err.message}`);
  }
}

async function testMistralModelsEndpoint(apiKey) {
  if (!apiKey) return;
  try {
    const res = await fetch('https://api.mistral.ai/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey.trim()}` }
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      const chatModels = (data.data || []).map(m => m.id);
      console.log(`🇫🇷 Mistral Live Models Available (${chatModels.length}): ${chatModels.slice(0, 3).join(', ')}…`);
    } else {
      console.log(`⚠️ Mistral Key Validation: HTTP ${res.status} — ${data?.error?.message || 'Invalid key'}`);
    }
  } catch (err) {
    console.log(`⚠️ Mistral Connection: ${err.message}`);
  }
}

async function runDiagnostic() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('    🔍  NEWS FEEDER BOT — TOP 6 FREE AI DIAGNOSTICS        ');
  console.log('═══════════════════════════════════════════════════════════\n');

  const provider = (process.env.SUMMARIZER_PROVIDER || 'groq').toLowerCase().trim();
  const groqKey = (process.env.GROQ_API_KEY || '').trim();
  const geminiKey = (process.env.GEMINI_API_KEY || '').trim();
  const cerebrasKey = (process.env.CEREBRAS_API_KEY || '').trim();
  const mistralKey = (process.env.MISTRAL_API_KEY || '').trim();
  const cohereKey = (process.env.COHERE_API_KEY || '').trim();
  const cloudflareToken = (process.env.CLOUDFLARE_API_TOKEN || '').trim();
  const openrouterKey = (process.env.OPENROUTER_API_KEY || '').trim();

  console.log(`📌 Primary Configured Provider: ${provider.toUpperCase()}`);
  console.log('───────────────────────────────────────────────────────────');
  console.log(`🥇 GROQ_API_KEY:         ${groqKey ? '✔ Configured (' + groqKey.slice(0, 8) + '…)' : '❌ Not set'}`);
  console.log(`🥈 GEMINI_API_KEY:       ${geminiKey ? '✔ Configured (' + geminiKey.slice(0, 8) + '…)' : '❌ Not set'}`);
  console.log(`🥉 CEREBRAS_API_KEY:     ${cerebrasKey ? '✔ Configured (' + cerebrasKey.slice(0, 8) + '…)' : '❌ Not set'}`);
  console.log(`4️⃣ MISTRAL_API_KEY:      ${mistralKey ? '✔ Configured (' + mistralKey.slice(0, 8) + '…)' : '❌ Not set'}`);
  console.log(`5️⃣ COHERE_API_KEY:       ${cohereKey ? '✔ Configured (' + cohereKey.slice(0, 8) + '…)' : '❌ Not set'}`);
  console.log(`6️⃣ CLOUDFLARE_API_TOKEN: ${cloudflareToken ? '✔ Configured (' + cloudflareToken.slice(0, 8) + '…)' : '❌ Not set'}`);
  console.log(`🌐 OPENROUTER_API_KEY:   ${openrouterKey ? '✔ Configured (' + openrouterKey.slice(0, 8) + '…)' : '❌ Not set'}`);
  console.log('───────────────────────────────────────────────────────────');

  if (groqKey) await testGroqModelsEndpoint(groqKey);
  if (cerebrasKey) await testCerebrasModelsEndpoint(cerebrasKey);
  if (mistralKey) await testMistralModelsEndpoint(mistralKey);

  console.log('───────────────────────────────────────────────────────────\n');

  initSummarizer();

  console.log('\n🚀 Testing live article summarization & multi-provider cascade…\n');
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
      console.log('⚠️ NOTE: Summarization fell back to extractive. Check key validity above.\n');
    }
  } catch (err) {
    console.error('\n❌ DIAGNOSTIC FAILED:', err.message);
  }
}

runDiagnostic();
