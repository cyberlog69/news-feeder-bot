// src/audio-generator.js
// Text-to-Speech (TTS) Voice Summary Generator
// Converts news summaries into MP3 audio files with local disk caching.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const logger = require('./logger');

const AUDIO_DIR = path.join(process.cwd(), 'data', 'audio');

function ensureAudioDir() {
  if (!fs.existsSync(AUDIO_DIR)) {
    fs.mkdirSync(AUDIO_DIR, { recursive: true });
  }
}

/**
 * Format article title and bullet points into a natural spoken script.
 * @param {object} article
 * @param {string} summary
 * @returns {string}
 */
function buildSpokenScript(article, summary) {
  const title = String(article.title || '').replace(/<[^>]{0,500}>/g, '').trim();
  const bullets = summary
    .split('\n')
    .map((l) => l.replace(/^[•▪\-*\d.]+\s*/, '').replace(/\.+$/, '').trim())
    .filter((l) => l.length > 0)
    .join('. ');

  return `News update from ${article.source || 'News Feeder'}. ${title}. Key points: ${bullets}.`;
}

/**
 * Generate an MP3 audio summary using free TTS with local disk caching.
 *
 * @param {object} article
 * @param {string} summary
 * @param {string} [lang] — ISO 639-1 language code (default: 'en')
 * @returns {Promise<{ audioPath: string, script: string }|null>}
 */
async function generateAudioSummary(article, summary, lang = 'en') {
  try {
    ensureAudioDir();

    const script = buildSpokenScript(article, summary);
    const hash = crypto.createHash('sha256').update(`${script}_${lang}`).digest('hex').slice(0, 16);
    const audioPath = path.join(AUDIO_DIR, `news_${hash}.mp3`);

    // Return cached audio file if it exists
    if (fs.existsSync(audioPath)) {
      return { audioPath, script };
    }

    const ttsLang = String(lang || 'en').toLowerCase().trim();
    const chunks = splitTextIntoChunks(script, 180);
    const audioBuffers = [];

    for (const chunk of chunks) {
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(chunk)}&tl=${ttsLang}&client=tw-ob`;
      const res = await fetchWithTimeout(url, 6000);
      if (!res.ok) {
        throw new Error(`TTS API HTTP ${res.status}`);
      }
      const buffer = Buffer.from(await res.arrayBuffer());
      audioBuffers.push(buffer);
    }

    const fullBuffer = Buffer.concat(audioBuffers);
    fs.writeFileSync(audioPath, fullBuffer);

    logger.info(`Generated audio summary MP3: ${path.basename(audioPath)} (${Math.round(fullBuffer.length / 1024)} KB)`);
    return { audioPath, script };

  } catch (err) {
    logger.warn(`Audio generation failed: ${err.message}`);
    return null;
  }
}

/** Split long text into sentence/word-boundary chunks of max length */
function splitTextIntoChunks(text, maxLength = 180) {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const chunks = [];
  let current = '';

  for (const s of sentences) {
    if ((current + s).length <= maxLength) {
      current += s;
    } else {
      if (current) chunks.push(current.trim());
      current = s;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  buildSpokenScript,
  generateAudioSummary
};
