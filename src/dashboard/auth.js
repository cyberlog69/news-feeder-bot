// src/dashboard/auth.js
// Request-level authentication for the dashboard:
// Authorization: Bearer <token> or a signed HttpOnly session cookie.

const {
  identifyToken,
  roleSatisfies,
  hasConfiguredTokens
} = require('../security-guard');
const { verifySession, parseCookies, COOKIE_NAME } = require('../session');
const { recordAuditEvent } = require('../audit-logger');

/** Extract a bearer token from the Authorization header. */
function providedToken(req) {
  const header = req.headers['authorization'] || '';
  return String(header).replace(/^Bearer\s+/i, '').trim();
}

/** Determine the requester role from a bearer token or session cookie. */
function requestRole(req) {
  const token = providedToken(req);
  if (token) {
    const role = identifyToken(token);
    if (role) return role;
  }

  const cookies = parseCookies(req.headers.cookie);
  return verifySession(cookies[COOKIE_NAME]);
}

/**
 * Is this request authorized for the required role?
 * Development without configured tokens stays open; production fails closed.
 */
function isAuthorized(req, requiredRole = 'analyst') {
  if (!hasConfiguredTokens()) {
    return process.env.NODE_ENV !== 'production';
  }
  return roleSatisfies(requestRole(req), requiredRole);
}

/** Record a SIEM audit event for a failed authentication attempt. */
function recordAuthFailure(endpoint, tokenProvided, clientIp) {
  try {
    recordAuditEvent({
      type: 'AUTH_FAILURE',
      name: 'Unauthorized API access attempt',
      severity: 'high',
      actor: 'unknown',
      details: `Endpoint=${endpoint} IP=${clientIp} TokenProvided=${tokenProvided ? 'yes' : 'no'}`,
      ip: clientIp
    });
  } catch {
    // audit logging must never break the request path
  }
}

/** Authorize and audit failures (used by every protected route). */
function isTokenValid(req, requiredRole = 'analyst', clientIp = null) {
  const ok = isAuthorized(req, requiredRole);
  if (!ok) {
    recordAuthFailure(
      req.url,
      Boolean(providedToken(req)),
      clientIp || req.socket?.remoteAddress || '127.0.0.1'
    );
  }
  return ok;
}

module.exports = {
  providedToken,
  requestRole,
  isAuthorized,
  isTokenValid,
  recordAuthFailure
};
