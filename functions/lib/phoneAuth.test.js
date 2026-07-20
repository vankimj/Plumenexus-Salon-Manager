import { describe, it, expect } from 'vitest';
import {
  generateOtpCode, hashOtp, safeEqualHex, canSendOtp, nextSendAccounting,
  evaluateOtp, phoneDocKey, OTP_MAX_ATTEMPTS, OTP_CODE_LEN,
} from './phoneAuth.js';

const PHONE = '+16145550100';
const PEP = 'server-pepper';
const T0 = new Date('2026-07-20T12:00:00Z').getTime();

describe('generateOtpCode', () => {
  it('is always a zero-padded 6-digit string', () => {
    for (let i = 0; i < 200; i++) {
      const c = generateOtpCode();
      expect(c).toMatch(/^\d{6}$/);
      expect(c.length).toBe(OTP_CODE_LEN);
    }
  });
});

describe('hashOtp / safeEqualHex', () => {
  it('is deterministic and bound to phone + pepper', () => {
    const h = hashOtp('123456', PHONE, PEP);
    expect(hashOtp('123456', PHONE, PEP)).toBe(h);
    expect(hashOtp('123456', PHONE, 'other')).not.toBe(h);        // pepper matters
    expect(hashOtp('123456', '+16145550999', PEP)).not.toBe(h);   // phone-bound
    expect(hashOtp('654321', PHONE, PEP)).not.toBe(h);            // code matters
  });
  it('safeEqualHex matches equal, rejects unequal/garbage', () => {
    const h = hashOtp('123456', PHONE, PEP);
    expect(safeEqualHex(h, h)).toBe(true);
    expect(safeEqualHex(h, hashOtp('000000', PHONE, PEP))).toBe(false);
    expect(safeEqualHex(h, '')).toBe(false);
    expect(safeEqualHex(h, 'zzzz')).toBe(false);
  });
});

describe('canSendOtp', () => {
  it('allows the first send (no record)', () => {
    expect(canSendOtp(null, T0).allowed).toBe(true);
  });
  it('blocks a second send inside the min interval', () => {
    const rec = { lastSentAt: new Date(T0).toISOString(), sendWindowStart: new Date(T0).toISOString(), sendCount: 1 };
    const r = canSendOtp(rec, T0 + 10_000);
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('too_soon');
  });
  it('allows again once the interval passes', () => {
    const rec = { lastSentAt: new Date(T0).toISOString(), sendWindowStart: new Date(T0).toISOString(), sendCount: 1 };
    expect(canSendOtp(rec, T0 + 31_000).allowed).toBe(true);
  });
  it('rate-limits after the per-window cap', () => {
    const rec = { lastSentAt: new Date(T0).toISOString(), sendWindowStart: new Date(T0).toISOString(), sendCount: 5 };
    const r = canSendOtp(rec, T0 + 60_000);
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('rate_limited');
  });
  it('resets the count when the window rolls over', () => {
    const rec = { lastSentAt: new Date(T0).toISOString(), sendWindowStart: new Date(T0).toISOString(), sendCount: 5 };
    expect(canSendOtp(rec, T0 + 60 * 60 * 1000 + 1000).allowed).toBe(true);
  });
});

describe('nextSendAccounting', () => {
  it('increments within the window, resets across it', () => {
    const rec = { sendWindowStart: new Date(T0).toISOString(), sendCount: 2 };
    const within = nextSendAccounting(rec, T0 + 5000);
    expect(within.sendCount).toBe(3);
    expect(within.sendWindowStart).toBe(rec.sendWindowStart);
    const across = nextSendAccounting(rec, T0 + 60 * 60 * 1000 + 1);
    expect(across.sendCount).toBe(1);
    expect(across.sendWindowStart).toBe(new Date(T0 + 60 * 60 * 1000 + 1).toISOString());
  });
  it('starts fresh with no prior record', () => {
    const a = nextSendAccounting(null, T0);
    expect(a.sendCount).toBe(1);
  });
});

describe('evaluateOtp', () => {
  const mk = (over = {}) => ({
    codeHash: hashOtp('123456', PHONE, PEP),
    expiresAt: new Date(T0 + 5 * 60 * 1000).toISOString(),
    attempts: 0,
    ...over,
  });

  it('accepts the correct code inside the window', () => {
    expect(evaluateOtp(mk(), '123456', PHONE, PEP, T0)).toEqual({ ok: true });
  });
  it('rejects a wrong code and reports attempts left', () => {
    const r = evaluateOtp(mk({ attempts: 1 }), '000000', PHONE, PEP, T0);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('bad_code');
    expect(r.attemptsLeft).toBe(OTP_MAX_ATTEMPTS - 2);
  });
  it('locks after max attempts', () => {
    const r = evaluateOtp(mk({ attempts: OTP_MAX_ATTEMPTS }), '123456', PHONE, PEP, T0);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('locked');
  });
  it('rejects an expired code', () => {
    const r = evaluateOtp(mk({ expiresAt: new Date(T0 - 1000).toISOString() }), '123456', PHONE, PEP, T0);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('expired');
  });
  it('rejects an already-consumed code', () => {
    const r = evaluateOtp(mk({ consumedAt: new Date(T0).toISOString() }), '123456', PHONE, PEP, T0);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('already_used');
  });
  it('rejects when no code was issued', () => {
    expect(evaluateOtp(null, '123456', PHONE, PEP, T0).reason).toBe('no_code');
  });
  it('a correct code cannot be replayed if the phone differs', () => {
    // record was issued for PHONE; verifying with the same hash but a different
    // phone must fail (hash is phone-bound).
    const r = evaluateOtp(mk(), '123456', '+16145550999', PEP, T0);
    expect(r.ok).toBe(false);
  });
});

describe('phoneDocKey', () => {
  it('reduces an E.164 number to digits only', () => {
    expect(phoneDocKey('+1 (614) 555-0100')).toBe('16145550100');
    expect(phoneDocKey('+16145550100')).toBe('16145550100');
  });
});
