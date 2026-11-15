// src/tts.js
// Configurable text-to-speech backend.
//
// TTS_PROVIDER:
//   google      — unofficial Google Translate TTS endpoint (no key, default)
//   openai      — OpenAI Audio Speech API (OPENAI_API_KEY)
//   elevenlabs  — ElevenLabs TTS (ELEVENLABS_API_KEY + ELEVENLABS_VOICE_ID)
//   none        — disable audio synthesis (text-only podcast/voice summaries)

const logger = require('./logger');

const GOOGLE_TTS = 'https://translate.google.com/translate_tts';
const OPENAI_TTS = 'https://api.openai.com/v1/audio/speech';
const ELEVENLABS_TTS = 'https://api.elevenlabs.io/v1/text-to-speech';

function provider() {
  return String(process.env.TTS_PROVIDER || 'google').toLowerCase().trim();
}

function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

async function googleTts(text, lang) {
  const url = `${GOOGLE_TTS}?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${encodeURIComponent(lang)}&client=tw-ob`;
  const res = await fetchWithTimeout(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  }, 8000);
  if (!res.ok) throw new Error(`Google TTS HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function openaiTts(text) {
  const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) throw new Error('OPENAI_API_KEY is required for TTS_PROVIDER=openai');

  const res = await fetchWithTimeout(OPENAI_TTS, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: process.env.OPENAI_TTS_MODEL || 'tts-1',
      voice: process.env.OPENAI_TTS_VOICE || 'alloy',
      input: text.slice(0, 4000),
      response_format: 'mp3'
    })
  }, 20000);
  if (!res.ok) throw new Error(`OpenAI TTS HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function elevenLabsTts(text) {
  const apiKey = String(process.env.ELEVENLABS_API_KEY || '').trim();
  const voiceId = String(process.env.ELEVENLABS_VOICE_ID || '').trim();
  if (!apiKey || !voiceId) {
    throw new Error('ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID are required for TTS_PROVIDER=elevenlabs');
  }

  const res = await fetchWithTimeout(`${ELEVENLABS_TTS}/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg'
    },
    body: JSON.stringify({
      text: text.slice(0, 4000),
      model_id: process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2'
    })
  }, 30000);
  if (!res.ok) throw new Error(`ElevenLabs TTS HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Synthesize a short chunk of text into an MP3 buffer.
 * @param {string} text
 * @param {string} [lang='en']
 * @returns {Promise<Buffer|null>} null when TTS is disabled
 */
async function synthesizeChunk(text, lang = 'en') {
  const selected = provider();
  if (selected === 'none' || selected === 'off' || selected === 'disabled') return null;

  if (selected === 'openai') return openaiTts(text);
  if (selected === 'elevenlabs') return elevenLabsTts(text);
  if (selected === 'google') return googleTts(text, lang);

  logger.warn(`Unknown TTS_PROVIDER "${selected}" — audio disabled. Use google, openai, elevenlabs, or none.`);
  return null;
}

module.exports = { provider, synthesizeChunk };
