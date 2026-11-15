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
  if (!a || !b) return false; // Empty string is never a valid authorization token

  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);

  if (bufA.length === 0 || bufB.length === 0) return false;

  if (bufA.length !== bufB.length) {
    // Prevent timing discrepancy on length by comparing with dummy buffer
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }

  return crypto.timingSafeEqual(bufA, bufB);
}

/** True when at least one RBAC token is configured. */
function hasConfiguredTokens() {
  return Boolean(
    (process.env.ADMIN_TOKEN || process.env.DASHBOARD_TOKEN || '').trim() ||
    (process.env.ANALYST_TOKEN || '').trim() ||
    (process.env.AUDITOR_TOKEN || '').trim()
  );
}

/**
 * Identify which role a token belongs to.
 *
 * @param {string} providedToken
 * @returns {'admin'|'analyst'|'auditor'|null}
 */
function identifyToken(providedToken) {
  const token = String(providedToken || '').trim();
  if (!token) return null;

  const adminToken = (process.env.ADMIN_TOKEN || process.env.DASHBOARD_TOKEN || '').trim();
  const analystToken = (process.env.ANALYST_TOKEN || '').trim();
  const auditorToken = (process.env.AUDITOR_TOKEN || '').trim();

  if (adminToken && timingSafeEqual(token, adminToken)) return 'admin';
  if (analystToken && timingSafeEqual(token, analystToken)) return 'analyst';
  if (auditorToken && timingSafeEqual(token, auditorToken)) return 'auditor';
  return null;
}

/**
 * Does `role` satisfy the role required by an endpoint?
 * admin > analyst > auditor (read-only).
 */
function roleSatisfies(role, requiredRole = 'analyst') {
  if (!role) return false;
  if (role === 'admin') return true;
  if (requiredRole === 'admin') return false;
  if (requiredRole === 'analyst') return role === 'analyst';
  if (requiredRole === 'auditor') return role === 'analyst' || role === 'auditor';
  return false;
}

/**
 * Validate token against configured roles.
 *
 * @param {string} providedToken
 * @param {string} [requiredRole='analyst'] - 'admin', 'analyst', 'auditor'
 * @returns {boolean}
 */
function validateToken(providedToken, requiredRole = 'analyst') {
  // If no tokens are configured: open in development, FAIL CLOSED in production.
  // A production deployment that forgets to set tokens must NOT silently
  // expose administrative endpoints.
  if (!hasConfiguredTokens()) {
    return process.env.NODE_ENV !== 'production';
  }

  return roleSatisfies(identifyToken(providedToken), requiredRole);
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
  identifyToken,
  roleSatisfies,
  hasConfiguredTokens,
  validateToken,
  createRateLimiter
};
