// Pure logic for staff phone sign-in / linking. All I/O (Firestore, SMS, custom
// tokens) lives in the callables in index.js; the rules that are easy to get
// wrong — code hashing, expiry, attempt limits, send throttling — live here so
// they're unit-tested without a live backend.
//
// Security model: sign-in works ONLY for a phone a staff member explicitly
// linked while authenticated. The link maps phone -> their existing uid, so the
// minted custom token inherits their email-based authorization (staffEmails) —
// no phone is ever trusted from an admin-typed employee record, and no Firestore
// rule needs to learn about phones.

const crypto = require('crypto');

const OTP_TTL_MS         = 10 * 60 * 1000; // code valid 10 min
const OTP_MAX_ATTEMPTS   = 5;              // wrong-code tries before lockout
const OTP_MIN_INTERVAL_MS= 30 * 1000;      // between sends to one phone
const OTP_SEND_WINDOW_MS  = 60 * 60 * 1000; // rolling window for send cap
const OTP_MAX_PER_WINDOW  = 5;             // sends per phone per window
const OTP_CODE_LEN        = 6;

// Cryptographically-strong 6-digit code, zero-padded, uniform (no modulo bias).
function generateOtpCode() {
  const n = crypto.randomInt(0, 10 ** OTP_CODE_LEN);
  return String(n).padStart(OTP_CODE_LEN, '0');
}

// Hash for storage — never store the plaintext code. Bound to the phone + a
// server-side pepper so a leaked doc can't be brute-forced offline without it.
function hashOtp(code, phoneE164, pepper) {
  return crypto.createHash('sha256').update(`${phoneE164}:${code}:${pepper || ''}`).digest('hex');
}

// Constant-time compare of two hex hashes (avoids timing side-channels).
function safeEqualHex(a, b) {
  const ba = Buffer.from(String(a || ''), 'hex');
  const bb = Buffer.from(String(b || ''), 'hex');
  if (ba.length !== bb.length || ba.length === 0) return false;
  return crypto.timingSafeEqual(ba, bb);
}

// May we send a new code to this phone right now? Enforces a minimum gap between
// sends and a rolling per-window cap. `record` is the current phoneAuthOtp doc
// (or null if none yet). Returns { allowed, reason, retryAfterMs }.
function canSendOtp(record, now, opts = {}) {
  const minInterval = opts.minIntervalMs ?? OTP_MIN_INTERVAL_MS;
  const windowMs    = opts.windowMs      ?? OTP_SEND_WINDOW_MS;
  const maxPerWindow= opts.maxPerWindow  ?? OTP_MAX_PER_WINDOW;
  if (!record) return { allowed: true };
  const lastSentAt = record.lastSentAt ? new Date(record.lastSentAt).getTime() : 0;
  if (lastSentAt && (now - lastSentAt) < minInterval) {
    return { allowed: false, reason: 'too_soon', retryAfterMs: minInterval - (now - lastSentAt) };
  }
  const windowStart = record.sendWindowStart ? new Date(record.sendWindowStart).getTime() : 0;
  const inWindow = windowStart && (now - windowStart) < windowMs;
  const sendCount = inWindow ? (Number(record.sendCount) || 0) : 0;
  if (sendCount >= maxPerWindow) {
    return { allowed: false, reason: 'rate_limited', retryAfterMs: windowMs - (now - windowStart) };
  }
  return { allowed: true };
}

// Build the updated send-accounting fields for a fresh send. Returns the fields
// to merge onto the phoneAuthOtp doc (windowStart resets when the window rolls).
function nextSendAccounting(record, now) {
  const windowStart = record?.sendWindowStart ? new Date(record.sendWindowStart).getTime() : 0;
  const inWindow = windowStart && (now - windowStart) < OTP_SEND_WINDOW_MS;
  const sendCount = (inWindow ? (Number(record?.sendCount) || 0) : 0) + 1;
  return {
    sendWindowStart: inWindow ? record.sendWindowStart : new Date(now).toISOString(),
    sendCount,
    lastSentAt: new Date(now).toISOString(),
  };
}

// Evaluate a verify attempt against the stored record. Pure — the caller does
// the Firestore read/write. Returns:
//   { ok:true }                              — code matches, still valid
//   { ok:false, reason, attemptsLeft?, locked? }
function evaluateOtp(record, code, phoneE164, pepper, now) {
  if (!record || !record.codeHash) return { ok: false, reason: 'no_code' };
  if (record.consumedAt) return { ok: false, reason: 'already_used' };
  const expiresAt = record.expiresAt ? new Date(record.expiresAt).getTime() : 0;
  if (!expiresAt || now >= expiresAt) return { ok: false, reason: 'expired' };
  const attempts = Number(record.attempts) || 0;
  if (attempts >= OTP_MAX_ATTEMPTS) return { ok: false, reason: 'locked', locked: true };
  const ok = safeEqualHex(record.codeHash, hashOtp(String(code || ''), phoneE164, pepper));
  if (!ok) {
    const left = OTP_MAX_ATTEMPTS - (attempts + 1);
    return { ok: false, reason: 'bad_code', attemptsLeft: Math.max(0, left), locked: left <= 0 };
  }
  return { ok: true };
}

// Deterministic key for the per-phone OTP doc + the phone→identity index. The
// phone is already normalized E.164; strip the leading '+' so it's a safe doc id.
function phoneDocKey(phoneE164) {
  return String(phoneE164 || '').replace(/[^0-9]/g, '');
}

module.exports = {
  OTP_TTL_MS, OTP_MAX_ATTEMPTS, OTP_MIN_INTERVAL_MS, OTP_SEND_WINDOW_MS, OTP_MAX_PER_WINDOW, OTP_CODE_LEN,
  generateOtpCode, hashOtp, safeEqualHex, canSendOtp, nextSendAccounting, evaluateOtp, phoneDocKey,
};
