// src/rag-engine.js
// RAG Conversational Engine (Ask Your News)
// Answers user queries by synthesizing relevant news context using AI.

const { searchArticles } = require('./vector-store');
const logger = require('./logger');

/**
 * Answer a natural language user question using RAG over indexed news articles.
 *
 * @param {string} question
 * @returns {Promise<string>}
 */
async function answerQuestion(question) {
  const q = String(question || '').trim();
  if (!q) {
    return '⚠️ Please provide a question after `/ask` (e.g. `/ask What ransomware attacks occurred this week?`).';
  }

  logger.info(`RAG Query: "${q.slice(0, 60)}…"`);

  const results = searchArticles(q, 5);
  if (results.length === 0) {
    return `🔍 No recent news articles found matching: *"${q}"*. Try a broader topic or keyword.`;
  }

  // Attempt AI synthesis
  const aiAnswer = await callAiRagSynthesis(q, results).catch(() => null);
  if (aiAnswer) {
    return aiAnswer;
  }

  // Fallback extractive RAG response
  return buildExtractiveRagResponse(q, results);
}

/**
 * AI RAG Synthesis using Groq/Gemini/OpenRouter.
 */
async function callAiRagSynthesis(question, results) {
  const apiKey = process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY || process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  const contextText = results.map((r, i) => {
    return `[Article ${i + 1}] Title: ${r.article.title}\nSource: ${r.article.source}\nSummary: ${r.article.summary}\nURL: ${r.article.url}`;
  }).join('\n\n');

  const prompt =
    `You are an expert cybersecurity news assistant. Answer the user's question accurately using ONLY the provided news articles below.\n` +
    `Include clear markdown citations pointing to the source and URL for every key point mentioned.\n\n` +
    `User Question: ${question}\n\n` +
    `Context Articles:\n${contextText}`;

  if (process.env.GROQ_API_KEY) {
    const res = await fetchWithTimeout('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 500
      })
    }, 12000);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.choices?.[0]?.message?.content?.trim() || null;
  }

  return null;
}

/**
 * Extractive RAG response fallback (no AI key needed).
 */
function buildExtractiveRagResponse(question, results) {
  const lines = [
    `🤖 *News RAG Intelligence for "${question}"*`,
    '━━━━━━━━━━━━━━━━━━━━━━━━━'
  ];

  results.forEach((r, i) => {
    lines.push(`${i + 1}. *${r.article.title}*`);
    lines.push(`   _${r.article.source}_ • [Link](${r.article.url})`);
    if (r.article.summary) {
      lines.push(`   ${r.article.summary.split('\n')[0]}`);
    }
    lines.push('');
  });

  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━');
  return lines.join('\n');
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  answerQuestion
};
