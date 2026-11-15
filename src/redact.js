// src/redact.js
// Helpers for keeping secrets and recipient identifiers out of logs.
// The dashboard can expose log lines, so URLs with embedded tokens, email
// addresses, and chat IDs must never be written verbatim.

function mask(value, visible = 4) {
  const str = String(value || '');
  if (!str) return '';
  if (str.length <= visible * 2) return '*'.repeat(str.length);
  const tailLength = Math.max(1, Math.min(visible, str.length - visible * 2));
  return `${str.slice(0, visible)}…${str.slice(-tailLength)}`;
}

function maskUrl(value) {
  try {
    const url = new URL(String(value));
    return `${url.protocol}//${url.hostname}/***`;
  } catch {
    return mask(value, 6);
  }
}

function maskEmail(value) {
  const str = String(value || '');
  const at = str.lastIndexOf('@');
  if (at <= 0) return mask(str);
  return `${str.slice(0, Math.min(2, at))}***@${str.slice(at + 1)}`;
}

module.exports = { mask, maskUrl, maskEmail };
