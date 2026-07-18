import { describe, it, expect } from 'vitest';
import { shouldPrompt, MIN_CHECKOUTS, COOLDOWN_DAYS } from './reviewPrompt';

const NOW = new Date('2026-07-18T12:00:00Z').getTime();
const daysAgo = (n) => new Date(NOW - n * 86400000).toISOString();

describe('reviewPrompt.shouldPrompt', () => {
  it('does not ask before MIN_CHECKOUTS', () => {
    expect(shouldPrompt({ count: MIN_CHECKOUTS - 1, lastAskedAt: null }, NOW)).toBe(false);
    expect(shouldPrompt({ count: 0, lastAskedAt: null }, NOW)).toBe(false);
  });

  it('asks on the first eligible checkout when never asked before', () => {
    expect(shouldPrompt({ count: MIN_CHECKOUTS, lastAskedAt: null }, NOW)).toBe(true);
  });

  it('does not re-ask inside the cooldown window', () => {
    expect(shouldPrompt({ count: 99, lastAskedAt: daysAgo(COOLDOWN_DAYS - 1) }, NOW)).toBe(false);
  });

  it('asks again once the cooldown has fully elapsed', () => {
    expect(shouldPrompt({ count: MIN_CHECKOUTS, lastAskedAt: daysAgo(COOLDOWN_DAYS) }, NOW)).toBe(true);
    expect(shouldPrompt({ count: MIN_CHECKOUTS, lastAskedAt: daysAgo(COOLDOWN_DAYS + 5) }, NOW)).toBe(true);
  });

  it('treats a corrupt lastAskedAt as never-asked (still gated by count)', () => {
    expect(shouldPrompt({ count: MIN_CHECKOUTS, lastAskedAt: 'not-a-date' }, NOW)).toBe(true);
    expect(shouldPrompt({ count: 1, lastAskedAt: 'not-a-date' }, NOW)).toBe(false);
  });

  it('handles empty/default state safely', () => {
    expect(shouldPrompt()).toBe(false);
    expect(shouldPrompt({})).toBe(false);
  });
});
