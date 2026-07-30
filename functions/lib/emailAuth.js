// Pure logic for email verification in the phone-first sign-up flow. The OTP
// generation / expiry / attempt-limit / send-throttle rules are the SAME
// hardened primitives used for phone (functions/lib/phoneAuth.js) — they are
// identity-agnostic, so we bind them to the normalized email instead of the
// E.164 phone. This module only adds the email-specific bits: normalization,
// validation, and a hashed doc key (raw email is never a Firestore doc id — it
// carries PII and characters Firestore rejects in ids).
//
// Security model: an email OTP proves control of the mailbox. It is only ever
// requested AFTER a phone OTP proved control of the number (a server-minted,
// single-use phoneVerifyTicket gates the request). Linking or account creation
// happens only when BOTH channels are proven in the same session — so holding
// just the phone can never claim an existing email account (no takeover).

const crypto = require('crypto');

// Lowercase, trim, and unwrap a "Name <addr>" display form to the bare address.
function normalizeEmail(addr) {
  if (!addr) return '';
  const m = String(addr).match(/<([^>]+)>/);
  const email = m ? m[1] : String(addr);
  return email.trim().toLowerCase();
}

// Deliberately lenient — SES is the real deliverability check. Just reject the
// obviously-malformed and cap length so a pathological value can't be abused.
function isValidEmail(addr) {
  const e = normalizeEmail(addr);
  return e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

// Hashed doc key for the per-email OTP doc. sha256 → first 32 hex: keeps raw
// email PII out of the doc id and sidesteps Firestore's id char restrictions
// (`/`, `__`, etc.). 32 hex chars ≈ 10^38 space → collisions vanishingly rare.
function emailDocKey(addr) {
  return crypto.createHash('sha256').update(normalizeEmail(addr)).digest('hex').slice(0, 32);
}

module.exports = { normalizeEmail, isValidEmail, emailDocKey };
