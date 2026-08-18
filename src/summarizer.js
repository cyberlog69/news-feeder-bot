// src/summarizer.js — Multi-Provider AI Summarizer
//
// Supported providers (set SUMMARIZER_PROVIDER in .env):
//
//   groq        — Groq Cloud API (Auto-discovers & prioritizes flagship chat models)
//                 Free tier: 14,400 req/day, 30 RPM — very generous
//                 Get key: https://console.groq.com (free, no CC needed)
//
//   openrouter  — OpenRouter (Auto-discovers & prioritizes flagship free models)
//                 Get key: https://openrouter.ai (free)
//
//   gemini      — Google Gemini (Native REST)
//                 Get key: https://aistudio.google.com/app/apikey (free AIzaSy... key)
//
//   ollama      — Local LLM via Ollama (100% free, runs on your machine)
//                 Model: llama3.2 (default), mistral, phi3, gemma2, etc.
//                 No API key, no rate limits, full privacy
//                 Install: https://ollama.com
//
//   huggingface — Hugging Face Inference API
//                 Model: facebook/bart-large-cnn (specialized for summarization)
//                 Free tier: limited RPM, may have cold-start delays
//                 Get key: https://huggingface.co/settings/tokens (free)
//
//   extractive  — No AI — extracts top sentences directly from text
//                 Zero cost, zero latency, works offline, always available

const fs     = require('fs');
const path   = require('path');
const logger = require('./logger');

// ── Provider selection ────────────────────────────────────────────────────────
const PROVIDER = (process.env.SUMMARIZER_PROVIDER || 'groq').toLowerCase().trim();

// ── Input limits ──────────────────────────────────────────────────────────────
const MAX_TITLE_LENGTH   = 300;
const MAX_CONTENT_LENGTH = 2500;

// ── Persistent summary cache ──────────────────────────────────────────────────
const { getCachedSummary, setCachedSummary } = require('./db');

function loadSummaryCache() {
  // SQLite persistence initialized on demand via db.js
}

function saveSummaryCache(url, summary) {
  if (url && summary) {
    setCachedSummary(url, summary);
  }
}

// ── Rate limiter (per-provider gaps) ─────────────────────────────────────────
const RATE_LIMITS = {
  groq:        2500,   // 30 RPM free → 2.5s gap
  ollama:      0,      // local — no limit
  huggingface: 7000,   // conservative for free tier
  openrouter:  3000,   // free models vary
  gemini:      3000,   // flash free tier
  extractive:  0       // no API
};

let lastCallAt = 0;

async function enforceRateLimit(providerName) {
  const gap     = RATE_LIMITS[providerName] || 3000;
  const elapsed = Date.now() - lastCallAt;
  if (gap > 0 && elapsed < gap) {
    await sleep(gap - elapsed);
  }
  lastCallAt = Date.now();
}

// ── Prompt builder ────────────────────────────────────────────────────────────
function buildPrompt(title, content, bullets) {
  return (
    `Summarize this news article in exactly ${bullets} concise bullet points for a daily executive briefing.\n\n` +
    `CRITICAL INSTRUCTIONS:\n` +
    `1. Start your response directly with the first bullet point: "• "\n` +
    `2. Do NOT write any introduction, thinking, planning, role description, or preamble (e.g. NEVER write "Analyze User Input:", "Role:", "Task:", or "Here is a summary:").\n` +
    `3. Do NOT include category labels like "Threat:", "Impact:", or "Mitigation:".\n` +
    `4. Write each bullet as a complete, informative, human-readable sentence.\n\n` +
    `<article_title>${title}</article_title>\n` +
    `<article_content>${content}</article_content>`
  );
}

// ── Format raw LLM response into clean bullet points ──────────────────────────
function formatBullets(rawText, bullets) {
  if (!rawText || typeof rawText !== 'string') return '';

  // 1. Strip explicit chain-of-thought / reasoning XML tags (<think>...</think>, <reasoning>...</reasoning>)
  let cleaned = rawText
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
    .trim();

  if (!cleaned && rawText.includes('<think>')) {
    cleaned = rawText.replace(/<think>/gi, '').trim();
  }

  // 2. Parse lines and filter out meta-thinking / planning artifacts
  const allLines = (cleaned || rawText).split('\n').map((l) => l.trim()).filter(Boolean);
  const validBullets = [];

  for (const line of allLines) {
    // Check if this line is an internal reasoning/planning artifact from the LLM
    const isPlanningArtifact = /^(<think>|<\/think>|\*\*?(analyze|role|task|thinking|thought|input|guidelines|requirements|instructions|step \d|plan|objective|context|output format)\b|here'?s a (thinking|summary|breakdown)|let'?s (analyze|break down|summarize))/i.test(line);
    if (isPlanningArtifact) continue;

    // Strip leading bullets, dashes, or numbered lists
    let text = line.replace(/^[•▪\-*\d.)\]]+\s*/, '').trim();

    // Strip lingering robotic prompt prefixes
    text = text.replace(/^(Threat(\/CVE(\/affected systems)?)?|Attack vector(\/impact)?|Mitigation(\/patch status)?|Impact|Key Takeaway|Summary|Overview|Details|Observation|Analysis|Context):\s*/i, '').trim();

    // Skip markdown header-only lines like "**Comcast WiFi Motion Detection**"
    if (/^\*\*[^*]+\*\*$/.test(text) && text.length < 50) continue;

    // Remove bold asterisks from the start of the line if it was used as a pseudo-label
    text = text.replace(/^\*\*[^*]+:\*\*\s*/i, '');

    // Ensure it's a substantive sentence
    if (text.length >= 25) {
      validBullets.push(`• ${text}`);
    }
  }

  // If we collected clean bullet points, return them
  if (validBullets.length >= 1) {
    return validBullets.slice(0, bullets).join('\n');
  }

  // Fallback: extract longest meaningful sentences from original text
  const fallbackLines = (cleaned || rawText)
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.replace(/^[•▪\-*\d.]+\s*/, '').replace(/^\*\*|\*\*$/g, '').trim())
    .filter((s) => s.length > 35 && !/^(analyze|role|task|thinking)/i.test(s));

  if (fallbackLines.length > 0) {
    return fallbackLines.slice(0, bullets).map((s) => `• ${s}`).join('\n');
  }

  return '';
}

// ═════════════════════════════════════════════════════════════════════════════
// PROVIDER IMPLEMENTATIONS WITH FILTERED & PRIORITIZED MODEL DISCOVERY
// ═════════════════════════════════════════════════════════════════════════════

// ── Groq Model Discovery & Execution ──────────────────────────────────────────
const GROQ_FALLBACK_MODELS = [
  process.env.GROQ_MODEL,
  'llama-3.3-70b-versatile',
  'openai/gpt-oss-120b',
  'mixtral-8x7b-32768',
  'gemma2-9b-it',
  'openai/gpt-oss-20b',
  'qwen/qwen3.6-27b'
].filter(Boolean);

async function getAvailableGroqModels(apiKey) {
  try {
    const res = await fetchWithTimeout('https://api.groq.com/openai/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    }, 8000);

    if (res.ok) {
      const data = await res.json();
      const allIds = (data.data || []).map((m) => m.id);

      // Exclude audio, moderation, Arabic-only, and non-text models
      const filtered = allIds.filter((id) => {
        if (!id) return false;
        const lower = id.toLowerCase();
        if (lower.includes('whisper') || lower.includes('guard') || lower.includes('orpheus') ||
            lower.includes('allam') || lower.includes('embed') || lower.includes('vision') ||
            lower.includes('tts') || lower.includes('audio') || lower.includes('distill-llama')) {
          return false;
        }
        return true;
      });

      // Sort by best text summarization models first
      filtered.sort((a, b) => {
        const score = (id) => {
          const lower = id.toLowerCase();
          if (lower.includes('llama-3.3-70b')) return 100;
          if (lower.includes('gpt-oss-120b')) return 90;
          if (lower.includes('llama-3.1-70b')) return 80;
          if (lower.includes('llama-3.1-8b')) return 70;
          if (lower.includes('mixtral')) return 60;
          if (lower.includes('gemma2')) return 50;
          if (lower.includes('qwen3.6')) return 40;
          if (lower.includes('gpt-oss-20b')) return 30;
          return 10;
        };
        return score(b) - score(a);
      });

      if (filtered.length > 0) return filtered;
    }
  } catch {}
  return [];
}

async function callGroq(title, content, bullets) {
  const apiKey = (process.env.GROQ_API_KEY || '').trim();
  if (!apiKey) throw new Error('GROQ_API_KEY not set');

  await enforceRateLimit('groq');

  const discovered = await getAvailableGroqModels(apiKey);
  const modelsToTry = [...new Set([...(process.env.GROQ_MODEL ? [process.env.GROQ_MODEL] : []), ...discovered, ...GROQ_FALLBACK_MODELS])];

  let lastError = null;

  for (const model of modelsToTry) {
    try {
      const res = await fetchWithTimeout('https://api.groq.com/openai/v1/chat/completions', {
        method:  'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: 'You are a direct news summarizer. Output only bullet points starting with "• ". Do NOT output thinking, planning, or role descriptions.' },
            { role: 'user',   content: buildPrompt(title, content, bullets) }
          ],
          max_tokens:  600,
          temperature: 0.2,
          stream:      false
        })
      }, 20000);

      const rawText = await res.text().catch(() => '');
      let data = null;
      try { data = JSON.parse(rawText); } catch {}

      if (!res.ok) {
        const errMsg = data?.error?.message || rawText || `HTTP ${res.status}`;
        const isModelError = res.status === 404 || res.status === 400 ||
          /model_not_found|does not exist|decommissioned|no longer supported|deprecated|invalid_model/i.test(errMsg);

        if (isModelError) {
          logger.warn(`Groq model "${model}" unavailable (${res.status}) — trying next fallback...`);
          lastError = new Error(`Groq model ${model} unavailable: ${errMsg}`);
          continue;
        }
        throw new Error(`Groq API error: HTTP ${res.status} — ${errMsg.slice(0, 200)}`);
      }

      const raw = data?.choices?.[0]?.message?.content?.trim() || '';
      if (!raw) throw new Error('Groq returned empty response');
      const formatted = formatBullets(raw, bullets);
      if (!formatted) {
        logger.warn(`Groq model "${model}" output could not be parsed as clean bullets — trying next model...`);
        lastError = new Error(`Groq model ${model} output only reasoning metadata`);
        continue;
      }
      return formatted;
    } catch (err) {
      if (/model_not_found|does not exist|404|400|decommissioned|no longer supported/i.test(err.message)) {
        lastError = err;
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error('All Groq models failed');
}

// ── OpenRouter Model Discovery & Execution ────────────────────────────────────
const OPENROUTER_FALLBACK_MODELS = [
  process.env.OPENROUTER_MODEL,
  'nvidia/nemotron-3.5-lightning:free',
  'liquid/lfm-2.5-2.6b:free',
  'dots-studio/dots-3-note-preview:free',
  'poolside/laguna-s-2.1:free',
  'meta-llama/llama-3.2-3b-instruct:free'
].filter(Boolean);

async function getAvailableOpenRouterModels(apiKey) {
  try {
    const res = await fetchWithTimeout('https://openrouter.ai/api/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    }, 8000);
    if (res.ok) {
      const data = await res.json();
      const freeModels = (data.data || [])
        .map((m) => m.id)
        .filter((id) => id && id.includes(':free') && !id.includes('whisper') && !id.includes('guard'));

      // Sort by best chat instruction models
      freeModels.sort((a, b) => {
        const score = (id) => {
          const lower = id.toLowerCase();
          if (lower.includes('nemotron')) return 100;
          if (lower.includes('gemini')) return 90;
          if (lower.includes('mistral')) return 80;
          if (lower.includes('llama-3.2')) return 70;
          if (lower.includes('lfm')) return 60;
          return 10;
        };
        return score(b) - score(a);
      });

      if (freeModels.length > 0) return freeModels;
    }
  } catch {}
  return [];
}

async function callOpenRouter(title, content, bullets) {
  const apiKey = (process.env.OPENROUTER_API_KEY || '').trim();
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not set');

  await enforceRateLimit('openrouter');

  const discovered = await getAvailableOpenRouterModels(apiKey);
  const modelsToTry = [...new Set([...(process.env.OPENROUTER_MODEL ? [process.env.OPENROUTER_MODEL] : []), ...discovered, ...OPENROUTER_FALLBACK_MODELS])];

  let lastError = null;

  for (const model of modelsToTry) {
    try {
      const res = await fetchWithTimeout('https://openrouter.ai/api/v1/chat/completions', {
        method:  'POST',
        headers: {
          'Authorization':   `Bearer ${apiKey}`,
          'Content-Type':    'application/json',
          'HTTP-Referer':    'https://github.com/cyberlog69/news-feeder-bot',
          'X-Title':         'News Feeder Bot'
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: 'You are a direct news summarizer. Output only bullet points starting with "• ". Do NOT output thinking, planning, or role descriptions.' },
            { role: 'user',   content: buildPrompt(title, content, bullets) }
          ],
          max_tokens:  600,
          temperature: 0.2
        })
      }, 30000);

      const rawText = await res.text().catch(() => '');
      let data = null;
      try { data = JSON.parse(rawText); } catch {}

      if (!res.ok) {
        const errMsg = data?.error?.message || rawText || `HTTP ${res.status}`;
        const isModelError = res.status === 404 || res.status === 400 ||
          /unavailable for free|not found|no endpoints|decommissioned|not available/i.test(errMsg);

        if (isModelError) {
          logger.warn(`OpenRouter model "${model}" unavailable (${res.status}) — trying fallback model...`);
          lastError = new Error(`OpenRouter model ${model} unavailable: ${errMsg}`);
          continue;
        }
        throw new Error(`OpenRouter API error: HTTP ${res.status} — ${errMsg.slice(0, 200)}`);
      }

      const raw = data?.choices?.[0]?.message?.content?.trim() || '';
      if (!raw) throw new Error('OpenRouter returned empty response');
      const formatted = formatBullets(raw, bullets);
      if (!formatted) {
        logger.warn(`OpenRouter model "${model}" output could not be parsed as clean bullets — trying next model...`);
        lastError = new Error(`OpenRouter model ${model} output only reasoning metadata`);
        continue;
      }
      return formatted;
    } catch (err) {
      if (/unavailable for free|not found|404|400|no endpoints/i.test(err.message)) {
        lastError = err;
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error('All OpenRouter free models failed');
}

// ── Gemini (Native REST API) ──────────────────────────────────────────────────
const GEMINI_FALLBACK_MODELS = [
  process.env.GEMINI_MODEL,
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-2.0-flash',
  'gemini-2.5-flash'
].filter(Boolean);

async function callGemini(title, content, bullets) {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  await enforceRateLimit('gemini');

  let lastError = null;
  const modelsToTry = [...new Set(GEMINI_FALLBACK_MODELS)];

  for (const modelName of modelsToTry) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
      const res = await fetchWithTimeout(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: buildPrompt(title, content, bullets) }]
          }],
          generationConfig: {
            maxOutputTokens: 600,
            temperature: 0.2
          }
        })
      }, 25000);

      const rawText = await res.text().catch(() => '');
      let data = null;
      try { data = JSON.parse(rawText); } catch {}

      if (!res.ok) {
        const errMsg = data?.error?.message || rawText || `HTTP ${res.status}`;
        const isModelError = res.status === 404 || /not found|no longer available|is not supported/i.test(errMsg);

        if (isModelError) {
          logger.warn(`Gemini model "${modelName}" unavailable — trying next fallback model...`);
          lastError = new Error(`Gemini model ${modelName} unavailable: ${errMsg}`);
          continue;
        }
        throw new Error(`Gemini API error: HTTP ${res.status} — ${errMsg.slice(0, 200)}`);
      }

      const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
      if (!raw) throw new Error('Gemini returned empty response');
      const formatted = formatBullets(raw, bullets);
      if (!formatted) throw new Error('Formatted summary was empty');
      return formatted;
    } catch (err) {
      if (/404|no longer available|not found|is not supported/i.test(err.message)) {
        lastError = err;
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error('All Gemini models failed');
}

// ── Ollama (local) ────────────────────────────────────────────────────────────
async function callOllama(title, content, bullets) {
  const baseUrl = (process.env.OLLAMA_URL || 'http://localhost:11434').replace(/\/$/, '');
  const model   = process.env.OLLAMA_MODEL || 'llama3.2';

  await enforceRateLimit('ollama');

  const res = await fetchWithTimeout(`${baseUrl}/api/generate`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt: buildPrompt(title, content, bullets),
      stream: false,
      options: { temperature: 0.2, num_predict: 600 }
    })
  }, 60000);

  const rawText = await res.text().catch(() => '');
  if (!res.ok) throw new Error(`Ollama error: HTTP ${res.status} — ${rawText.slice(0, 200)}`);

  let data = null;
  try { data = JSON.parse(rawText); } catch {}
  const raw = (data?.response || '').trim();
  if (!raw) throw new Error('Ollama returned empty response');
  return formatBullets(raw, bullets);
}

// ── Hugging Face Inference API ────────────────────────────────────────────────
async function callHuggingFace(content, bullets, retryCount = 0) {
  const apiKey = (process.env.HF_API_KEY || '').trim();
  if (!apiKey) throw new Error('HF_API_KEY not set');

  const model  = process.env.HF_MODEL || 'facebook/bart-large-cnn';
  await enforceRateLimit('huggingface');

  const input = `${content}`.slice(0, 1024);
  const res = await fetchWithTimeout(`https://api-inference.huggingface.co/models/${model}`, {
    method:  'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      inputs: input,
      parameters: { max_length: 200, min_length: 60, do_sample: false }
    })
  }, 30000);

  if (res.status === 503 && retryCount < 1) {
    const data = await res.json().catch(() => ({}));
    const wait = (data.estimated_time || 20) + 2;
    logger.warn(`HuggingFace model loading — waiting ${Math.round(wait)}s...`);
    await sleep(wait * 1000);
    return callHuggingFace(content, bullets, retryCount + 1);
  }

  if (res.status === 503) {
    throw new Error('HuggingFace model still loading after retry — skipping');
  }

  const rawText = await res.text().catch(() => '');
  if (!res.ok) throw new Error(`HuggingFace API error: HTTP ${res.status} — ${rawText.slice(0, 200)}`);

  let data = null;
  try { data = JSON.parse(rawText); } catch {}
  const summary = data?.[0]?.summary_text?.trim() || '';
  if (!summary) throw new Error('HuggingFace returned empty response');

  const sentences = summary
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s.length > 20)
    .slice(0, bullets);

  return sentences.map((s) => `• ${s}`).join('\n');
}

// ── Extractive (no AI) ────────────────────────────────────────────────────────
function extractive(content, title, bullets) {
  const text = content || title;
  const sentences = text
    .replace(/<[^>]{0,500}>/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 30 && s.length < 400);

  if (sentences.length === 0) return `• ${text.slice(0, 250).trim()}`;
  return sentences.slice(0, bullets).map((s) => `• ${s}`).join('\n');
}

// ═════════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═════════════════════════════════════════════════════════════════════════════

function initSummarizer() {
  const providerInfo = {
    groq:        `Groq Cloud   (prioritizing flagship models) — free 14,400 req/day`,
    ollama:      `Ollama Local (model: ${process.env.OLLAMA_MODEL || 'llama3.2'})  — unlimited, no API key`,
    huggingface: `HuggingFace  (model: ${process.env.HF_MODEL || 'facebook/bart-large-cnn'})  — free tier`,
    openrouter:  `OpenRouter   (prioritizing flagship free models)`,
    gemini:      `Gemini       (model: ${process.env.GEMINI_MODEL || 'gemini-1.5-flash'})  — free tier`,
    extractive:  `Extractive   — no AI, no API key, always works`
  };

  const info = providerInfo[PROVIDER] || `Unknown provider: "${PROVIDER}" — falling back to extractive`;
  logger.success(`Summarizer: ${info}`);

  if (PROVIDER !== 'extractive') loadSummaryCache();
}

async function summarizeArticle(title, content, bullets = 3, url = '') {
  const safeTitle   = String(title   || '').slice(0, MAX_TITLE_LENGTH);
  const safeContent = String(content || '').slice(0, MAX_CONTENT_LENGTH);

  if (PROVIDER !== 'extractive' && url) {
    const cached = getCachedSummary(url);
    if (cached) {
      logger.info('Using cached summary');
      return { summary: cached, aiUsed: true, provider: PROVIDER };
    }
  }

  const fallbackOrder = [PROVIDER, 'groq', 'gemini', 'openrouter', 'huggingface', 'ollama'];
  const tried = new Set();

  for (const p of fallbackOrder) {
    if (p === 'extractive' || tried.has(p)) continue;
    tried.add(p);

    const result = await tryProvider(p, safeTitle, safeContent, bullets);
    if (result) {
      if (url) { saveSummaryCache(url, result); }
      return { summary: result, aiUsed: true, provider: p };
    }
  }

  logger.warn('All AI providers failed — using extractive fallback');

  return {
    summary:  extractive(safeContent, safeTitle, bullets),
    aiUsed:   false,
    provider: 'extractive'
  };
}

async function tryProvider(provider, title, content, bullets, attempt = 1) {
  try {
    switch (provider) {
      case 'groq':        return await callGroq(title, content, bullets);
      case 'ollama':      return await callOllama(title, content, bullets);
      case 'huggingface': return await callHuggingFace(content, bullets);
      case 'openrouter':  return await callOpenRouter(title, content, bullets);
      case 'gemini':      return await callGemini(title, content, bullets);
      default:
        logger.warn(`Unknown SUMMARIZER_PROVIDER "${provider}" — using extractive`);
        return null;
    }
  } catch (err) {
    const is429 = /429|rate.?limit|quota|too many/i.test(err.message);

    if (is429 && attempt <= 2) {
      const wait = attempt * 30;
      logger.warn(`${provider} rate limited — waiting ${wait}s (attempt ${attempt}/2)`);
      await sleep(wait * 1000);
      return tryProvider(provider, title, content, bullets, attempt + 1);
    }

    logger.warn(`${provider} summarizer failed: ${err.message.split('\n')[0]}`);
    return null;
  }
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err.name === 'AbortError') throw new Error(`Request timeout after ${timeoutMs}ms`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function initGemini() { initSummarizer(); }

module.exports = { initSummarizer, initGemini, summarizeArticle };
