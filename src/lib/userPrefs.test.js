import { describe, it, expect, beforeEach } from 'vitest';
import { getUserPrefs, setUserPrefs, DEFAULT_PREFS, DENSITIES, newerOf } from './userPrefs';

// Minimal in-memory localStorage for the node test env (no jsdom).
beforeEach(() => {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
});

describe('userPrefs', () => {
  it('returns defaults when nothing stored', () => {
    expect(getUserPrefs('u1')).toEqual(DEFAULT_PREFS);
  });

  it('persists density and reads it back, isolated per uid', () => {
    setUserPrefs('u1', { density: 'simple' });
    expect(getUserPrefs('u1').density).toBe('simple');
    expect(getUserPrefs('u2').density).toBe('standard'); // other user untouched
  });

  it('falls back to the default for an invalid density', () => {
    setUserPrefs('u1', { density: 'bogus' });
    expect(getUserPrefs('u1').density).toBe('standard');
  });

  it('setUserPrefs returns a sanitized density (not the raw patch)', () => {
    const out = setUserPrefs('u1', { density: 'bogus' });
    expect(out.density).toBe('standard');
  });

  it('coerces homeExpanded to a boolean', () => {
    setUserPrefs('u1', { homeExpanded: 1 });
    expect(getUserPrefs('u1').homeExpanded).toBe(true);
  });

  it('exposes the three density levels', () => {
    expect(DENSITIES).toEqual(['simple', 'standard', 'everything']);
  });

  it('stamps updatedAt on every set (the cross-device reconcile key)', () => {
    const out = setUserPrefs('u1', { favorites: ['schedule'] });
    expect(out.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('preserves a caller-supplied updatedAt (cloud adoption must not re-stamp)', () => {
    const out = setUserPrefs('u1', { favorites: ['schedule'], updatedAt: '2026-01-01T00:00:00.000Z' });
    expect(out.updatedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('sanitizes favorites and collapsed on read', () => {
    setUserPrefs('u1', { favorites: ['schedule', 42, null], collapsed: { core: true } });
    const p = getUserPrefs('u1');
    expect(p.favorites).toEqual(['schedule']);
    expect(p.collapsed).toEqual({ core: true });
  });
});

describe('newerOf (cross-device reconcile)', () => {
  it('local wins when there is no cloud copy', () => {
    expect(newerOf({ updatedAt: '2026-01-02' }, null)).toBe('local');
  });
  it('cloud wins with a newer stamp; local with a newer stamp; equal when identical', () => {
    expect(newerOf({ updatedAt: '2026-01-01' }, { updatedAt: '2026-01-02' })).toBe('cloud');
    expect(newerOf({ updatedAt: '2026-01-03' }, { updatedAt: '2026-01-02' })).toBe('local');
    expect(newerOf({ updatedAt: '2026-01-02' }, { updatedAt: '2026-01-02' })).toBe('equal');
  });
  it('a blank local stamp loses to any real cloud stamp (fresh device adopts profile)', () => {
    expect(newerOf({ updatedAt: '' }, { updatedAt: '2026-01-01' })).toBe('cloud');
    expect(newerOf({}, { updatedAt: '2026-01-01' })).toBe('cloud');
  });
});
