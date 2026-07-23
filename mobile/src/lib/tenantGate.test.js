import { describe, it, expect } from 'vitest';
import { gateState } from './tenantGate';

// Full decision table for the root membership gate. This logic is what stands
// between a fresh Sign-in-with-Apple user and the hollow fallback-tenant shell
// that got the app rejected (Guideline 2.1a, 2026-07-23).
describe('gateState', () => {
  const base = { hasStored: false, isAnonymous: false, dev: false, loading: false, tenants: [], error: null };

  it('existing user with a persisted tenant passes IMMEDIATELY — even mid-load or on error', () => {
    expect(gateState({ ...base, hasStored: true, loading: true })).toBe('pass');
    expect(gateState({ ...base, hasStored: true, error: 'network' })).toBe('pass');
    expect(gateState({ ...base, hasStored: true })).toBe('pass');
  });

  it('Expo Go dev anonymous sign-in passes (no email — the CF would always throw)', () => {
    expect(gateState({ ...base, dev: true, isAnonymous: true, loading: true })).toBe('pass');
  });

  it('anonymous outside dev does NOT bypass the gate', () => {
    expect(gateState({ ...base, isAnonymous: true })).toBe('pending');
  });

  it('fresh user waits on the membership answer', () => {
    expect(gateState({ ...base, loading: true })).toBe('spinner');
  });

  it('fresh user with zero tenants → pending (the App-Review dead end, now a real screen)', () => {
    expect(gateState({ ...base, tenants: [] })).toBe('pending');
  });

  it('fresh user with membership passes', () => {
    expect(gateState({ ...base, tenants: [{ id: 'demo' }] })).toBe('pass');
    expect(gateState({ ...base, tenants: [{ id: 'a' }, { id: 'b' }] })).toBe('pass');
  });

  it('membership-check error → pending (covers Apple hidden-email permission-denied)', () => {
    expect(gateState({ ...base, error: 'permission-denied: No email on token' })).toBe('pending');
    expect(gateState({ ...base, error: 'internal' })).toBe('pending');
  });

  it('tenants may be undefined without crashing', () => {
    expect(gateState({ ...base, tenants: undefined })).toBe('pending');
  });
});
