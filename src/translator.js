// src/translator.js
// Multi-Language & Internationalization Engine
// Translates news titles, summaries, and threat intelligence into target languages with SQLite caching.

const { getCachedTranslation, setCachedTranslation } = require('./db');
const logger = require('./logger');

const SUPPORTED_LANGUAGES = {
  en: 'English',
  es: 'Spanish',
  de: 'German',
  fr: 'French',
  hi: 'Hindi',
  ja: 'Japanese',
  pt: 'Portuguese',
  zh: 'Chinese',
  it: 'Italian',
  ru: 'Russian',
  ar: 'Arabic',
  nl: 'Dutch',
  ko: 'Korean'
};

/**
 * Translate a block of text into the specified target language.
 * Uses SQLite caching and AI / free API translation fallback.
 *
 * @param {string} text       — Text to translate
 * @param {string} targetLang — ISO 639-1 language code (e.g. 'es', 'de', 'hi')
 * @returns {Promise<string>}
 */
async function translateText(text, targetLang = 'en') {
  const langCode = String(targetLang || 'en').toLowerCase().trim();
  if (langCode === 'en' || !text || !text.trim()) {
    return text;
  }

  const langName = SUPPORTED_LANGUAGES[langCode] || langCode;

  // Check SQLite cache first
  const cached = getCachedTranslation(text, langCode);
  if (cached) {
    return cached;
  }

  // Attempt 1: AI Provider translation
  let translated = await callAiTranslation(text, langName).catch(() => null);

  // Attempt 2: Free MyMemory REST Translation API fallback
  if (!translated) {
    translated = await callMyMemoryTranslation(text, langCode).catch(() => null);
  }

  // If all translation attempts fail, return original text as safe fallback
  if (!translated) {
    return text;
  }

  // Cache in SQLite
  setCachedTranslation(text, langCode, translated);
  return translated;
}

/**
 * AI-powered translation using configured Groq/Gemini/OpenRouter key if set.
 */
async function callAiTranslation(text, langName) {
  const apiKey = process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY || process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  const prompt =
    `You are a professional translator. Translate the following text into ${langName}.\n` +
    `CRITICAL: Output ONLY the translated text. Do not add intro, explanations, or quotes. Keep all URLs, CVE IDs, formatting, and emojis intact.\n\n` +
    `${text}`;

  if (process.env.GROQ_API_KEY) {
    const res = await fetchWithTimeout('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 600
      })
    }, 10000);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.choices?.[0]?.message?.content?.trim() || null;
  }

  return null;
}

/**
 * Free REST translation via MyMemory API (no API key required).
 */
async function callMyMemoryTranslation(text, langCode) {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0, 500))}&langpair=en|${langCode}`;
  const res = await fetchWithTimeout(url, 6000);
  if (!res.ok) return null;
  const data = await res.json();
  const matches = data?.responseData?.translatedText;
  return matches && matches !== text ? matches : null;
}

/**
 * Translate an article object and its summary/threat intel into target language.
 *
 * @param {object} article
 * @param {string} summary
 * @param {object|null} threatIntel
 * @param {string} targetLang
 * @returns {Promise<{ article: object, summary: string, threatIntel: object|null }>}
 */
async function translateArticleData(article, summary, threatIntel, targetLang = 'en') {
  const langCode = String(targetLang || 'en').toLowerCase().trim();
  if (langCode === 'en') {
    return { article, summary, threatIntel };
  }

  logger.info(`Translating article into [${langCode.toUpperCase()}]…`);

  const [translatedTitle, translatedSummary] = await Promise.all([
    translateText(article.title, langCode),
    translateText(summary, langCode)
  ]);

  const localizedArticle = {
    ...article,
    title: translatedTitle || article.title
  };

  return {
    article: localizedArticle,
    summary: translatedSummary || summary,
    threatIntel
  };
}

async function fetchWithTimeout(url, optionsOrTimeout, timeoutMs) {
  let opts = {};
  let ms = 5000;
  if (typeof optionsOrTimeout === 'number') {
    ms = optionsOrTimeout;
  } else {
    opts = optionsOrTimeout || {};
    ms = timeoutMs || 5000;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  SUPPORTED_LANGUAGES,
  translateText,
  translateArticleData
};
