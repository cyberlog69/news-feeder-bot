// src/summarizer.js
// Uses Google Gemini Flash (free tier) to summarize news articles into
// clean bullet points. Falls back to extracting the first N sentences
// if no API key is configured.

const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('./logger');

let genAI  = null;
let model  = null;

/**
 * Call once at startup with your Gemini API key.
 * If apiKey is falsy, the module runs in fallback (no-AI) mode.
 */
function initGemini(apiKey) {
  if (!apiKey) {
    logger.warn('GEMINI_API_KEY not set — using basic (no-AI) summarization.');
    return;
  }
  genAI = new GoogleGenerativeAI(apiKey);
  model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  logger.success('Gemini AI summarizer ready (gemini-2.0-flash)');
}

/**
 * Summarize an article into bullet points.
 *
 * @param {string} title       - Article headline
 * @param {string} content     - Article body / RSS description
 * @param {number} bullets     - How many bullet points to produce
 * @returns {Promise<string>}  - Formatted bullet-point string
 */
async function summarizeArticle(title, content, bullets = 3) {
  // ── AI mode ──────────────────────────────────────────────────────────────
  if (model) {
    try {
      const prompt =
        `You are a news summarizer. Summarize the following news article in exactly ${bullets} ` +
        `concise bullet points. Each bullet must be ONE clear sentence. ` +
        `Focus on the most important facts. ` +
        `Do NOT include any intro text, headings, or markdown — output ONLY the bullet points.\n\n` +
        `Title: ${title}\n` +
        `Content: ${content.slice(0, 2500)}`;

      const result   = await model.generateContent(prompt);
      const response = result.response.text().trim();

      // Ensure every line starts with a bullet
      return response
        .split('\n')
        .filter((l) => l.trim().length > 0)
        .map((l) => l.startsWith('•') || l.startsWith('-') || l.startsWith('*')
          ? `• ${l.replace(/^[•\-*]\s*/, '')}`
          : `• ${l}`)
        .slice(0, bullets)
        .join('\n');

    } catch (err) {
      logger.warn(`Gemini error (falling back): ${err.message}`);
    }
  }

  // ── Fallback: first N meaningful sentences ────────────────────────────────
  const text = content || title;
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 30 && s.length < 300);

  if (sentences.length === 0) {
    return `• ${text.slice(0, 200).trim()}`;
  }

  return sentences
    .slice(0, bullets)
    .map((s) => `• ${s}`)
    .join('\n');
}

module.exports = { initGemini, summarizeArticle };
