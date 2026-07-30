import { describe, it, expect } from 'vitest';
import { normalizeEmail, isValidEmail, emailDocKey } from './emailAuth.js';
import { hashOtp, evaluateOtp } from './phoneAuth.js';

describe('emailAuth.normalizeEmail', () => {
  it('lowercases and trims', () => {
    expect(normalizeEmail('  Foo.Bar@Example.COM ')).toBe('foo.bar@example.com');
  });
  it('unwraps a display-name form', () => {
    expect(normalizeEmail('Jane Doe <Jane@Example.com>')).toBe('jane@example.com');
  });
  it('handles empty / nullish', () => {
    expect(normalizeEmail('')).toBe('');
    expect(normalizeEmail(null)).toBe('');
    expect(normalizeEmail(undefined)).toBe('');
  });
});

describe('emailAuth.isValidEmail', () => {
  it('accepts ordinary addresses', () => {
    expect(isValidEmail('a@b.co')).toBe(true);
    expect(isValidEmail('First.Last+tag@sub.example.com')).toBe(true);
  });
  it('rejects malformed / spaced / overlong', () => {
    expect(isValidEmail('nope')).toBe(false);
    expect(isValidEmail('a@b')).toBe(false);
    expect(isValidEmail('a b@c.com')).toBe(false);
    expect(isValidEmail('a@@b.com')).toBe(false);
    expect(isValidEmail('x'.repeat(250) + '@b.com')).toBe(false);
  });
});

describe('emailAuth.emailDocKey', () => {
  it('is stable and case/space-insensitive', () => {
    const a = emailDocKey('Foo@Example.com');
    const b = emailDocKey('  foo@example.com  ');
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{32}$/);
  });
  it('differs for different addresses and has no unsafe id chars', () => {
    expect(emailDocKey('a@b.com')).not.toBe(emailDocKey('c@d.com'));
    expect(emailDocKey('a/b@c.com')).toMatch(/^[0-9a-f]{32}$/);
  });
});

// The OTP primitives are shared with phone auth; verify they behave correctly
// when BOUND TO AN EMAIL (the binding string is the only email-specific input).
describe('shared OTP primitives bound to email', () => {
  const pepper = 'test-pepper';
  const email = 'client@example.com';
  const now = 1_000_000_000_000;

  it('hash is bound to the email — wrong email never matches', () => {
    const code = '123456';
    const rec = { codeHash: hashOtp(code, email, pepper), expiresAt: new Date(now + 60_000).toISOString(), attempts: 0 };
    expect(evaluateOtp(rec, code, email, pepper, now).ok).toBe(true);
    expect(evaluateOtp(rec, code, 'other@example.com', pepper, now).ok).toBe(false);
  });

  it('locks out after 5 wrong attempts', () => {
    const rec = { codeHash: hashOtp('111111', email, pepper), expiresAt: new Date(now + 60_000).toISOString(), attempts: 4 };
    const r = evaluateOtp(rec, '000000', email, pepper, now);
    expect(r.ok).toBe(false);
    expect(r.locked).toBe(true);
  });

  it('rejects an expired code', () => {
    const rec = { codeHash: hashOtp('222222', email, pepper), expiresAt: new Date(now - 1).toISOString(), attempts: 0 };
    expect(evaluateOtp(rec, '222222', email, pepper, now).reason).toBe('expired');
  });

  it('rejects an already-consumed code', () => {
    const rec = { codeHash: hashOtp('333333', email, pepper), expiresAt: new Date(now + 60_000).toISOString(), attempts: 0, consumedAt: new Date(now).toISOString() };
    expect(evaluateOtp(rec, '333333', email, pepper, now).reason).toBe('already_used');
  });
});
