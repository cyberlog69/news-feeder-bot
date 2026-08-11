// src/security-guard.js
// Enterprise Security Hardening, RBAC, and Rate Limiting Guard
// Provides timing-safe token verification, multi-tiered RBAC, and sliding-window rate limiting.

const crypto = require('crypto');
const logger = require('./logger');

/**
 * Constant-time comparison of two strings to prevent timing attacks.
 *
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;

  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);

  if (bufA.length !== bufB.length) {
    // Prevent timing discrepancy on length by comparing with dummy buffer
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }

  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Validate token against configured roles.
 *
 * @param {string} providedToken
 * @param {string} [requiredRole='analyst'] - 'admin', 'analyst', 'auditor'
 * @returns {boolean}
 */
function validateToken(providedToken, requiredRole = 'analyst') {
  const token = String(providedToken || '').trim();
  if (!token) return false;

  const adminToken = (process.env.ADMIN_TOKEN || process.env.DASHBOARD_TOKEN || '').trim();
  const analystToken = (process.env.ANALYST_TOKEN || '').trim();
  const auditorToken = (process.env.AUDITOR_TOKEN || '').trim();

  // If no tokens configured, open in development mode
  if (!adminToken && !analystToken && !auditorToken) return true;

  // Admin token has access to everything
  if (adminToken && timingSafeEqual(token, adminToken)) return true;

  if (requiredRole === 'analyst') {
    if (analystToken && timingSafeEqual(token, analystToken)) return true;
  }

  if (requiredRole === 'auditor') {
    if (auditorToken && timingSafeEqual(token, auditorToken)) return true;
    if (analystToken && timingSafeEqual(token, analystToken)) return true;
  }

  return false;
}

/**
 * Create a sliding-window rate limiter per IP address.
 *
 * @param {object} [options]
 * @param {number} [options.windowMs=60000] - Window duration in ms (1 min)
 * @param {number} [options.maxRequests=100] - Max requests allowed per window
 * @returns {{ checkLimit: Function, reset: Function }}
 */
function createRateLimiter(options = {}) {
  const windowMs = options.windowMs || 60000;
  const maxRequests = options.maxRequests || 100;
  const ipMap = new Map();

  // Cleanup interval
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of ipMap.entries()) {
      if (now - record.startTime > windowMs) {
        ipMap.delete(ip);
      }
    }
  }, Math.max(windowMs, 30000));

  if (cleanupInterval.unref) cleanupInterval.unref();

  return {
    checkLimit(ip = '127.0.0.1') {
      const now = Date.now();
      let record = ipMap.get(ip);

      if (!record || now - record.startTime > windowMs) {
        record = { count: 1, startTime: now };
        ipMap.set(ip, record);
        return { allowed: true, remaining: maxRequests - 1, resetMs: windowMs };
      }

      record.count += 1;
      const remaining = Math.max(0, maxRequests - record.count);
      const allowed = record.count <= maxRequests;
      const resetMs = Math.max(0, windowMs - (now - record.startTime));

      if (!allowed) {
        logger.warn(`[Security] Rate limit exceeded for IP: ${ip} (${record.count}/${maxRequests})`);
      }

      return { allowed, remaining, resetMs };
    },
    reset() {
      ipMap.clear();
    }
  };
}

module.exports = {
  timingSafeEqual,
  validateToken,
  createRateLimiter
};
