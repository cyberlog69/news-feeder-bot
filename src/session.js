// src/session.js
// Signed, HttpOnly cookie sessions for the web dashboard.
// The raw admin/analyst token is never stored in the cookie.

const crypto = require('crypto');

const COOKIE_NAME = 'newsbot_session';
const DEFAULT_TTL_SECONDS = 12 * 60 * 60; // 12 hours

function getSecret() {
  return String(
    process.env.SESSION_SECRET ||
    process.env.ADMIN_TOKEN ||
    process.env.DASHBOARD_TOKEN ||
    ''
  ).trim();
}

function sign(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a || ''));
  const bufB = Buffer.from(String(b || ''));
  if (bufA.length === 0 || bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Create a signed session value for a role.
 * @param {'admin'|'analyst'|'auditor'} role
 * @param {number} [ttlSeconds]
 * @returns {string|null} null when no session secret is available
 */
function createSession(role, ttlSeconds = DEFAULT_TTL_SECONDS) {
  const secret = getSecret();
  if (!secret || !role) return null;

  const payload = Buffer.from(JSON.stringify({
    role,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds
  })).toString('base64url');

  return `${payload}.${sign(payload, secret)}`;
}

/**
 * Verify a signed session value and return its role.
 * @param {string} value
 * @returns {'admin'|'analyst'|'auditor'|null}
 */
function verifySession(value) {
  const secret = getSecret();
  if (!secret || !value) return null;

  const parts = String(value).split('.');
  if (parts.length !== 2) return null;

  const [payload, signature] = parts;
  if (!safeEqual(signature, sign(payload, secret))) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data || !data.role || !data.exp) return null;
    if (Number(data.exp) < Math.floor(Date.now() / 1000)) return null;
    if (!['admin', 'analyst', 'auditor'].includes(data.role)) return null;
    return data.role;
  } catch {
    return null;
  }
}

/** Parse a Cookie header into a plain object. */
function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (!key) continue;
    try {
      out[key] = decodeURIComponent(value);
    } catch {
      out[key] = value;
    }
  }
  return out;
}

/** Build a Set-Cookie header value. */
function sessionCookie(value, { secure = false, ttlSeconds = DEFAULT_TTL_SECONDS } = {}) {
  const attrs = [
    `${COOKIE_NAME}=${encodeURIComponent(value)}`,
    'HttpOnly',
    'SameSite=Strict',
    'Path=/',
    `Max-Age=${ttlSeconds}`
  ];
  if (secure) attrs.push('Secure');
  return attrs.join('; ');
}

/** Build a Set-Cookie header that removes the session. */
function clearSessionCookie({ secure = false } = {}) {
  const attrs = [
    `${COOKIE_NAME}=`,
    'HttpOnly',
    'SameSite=Strict',
    'Path=/',
    'Max-Age=0'
  ];
  if (secure) attrs.push('Secure');
  return attrs.join('; ');
}

module.exports = {
  COOKIE_NAME,
  DEFAULT_TTL_SECONDS,
  createSession,
  verifySession,
  parseCookies,
  sessionCookie,
  clearSessionCookie
};
