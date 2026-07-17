import { describe, it, expect, beforeEach } from 'vitest';
import { getPreviewAs, setPreviewAs, subscribePreviewAs } from './previewAs';

describe('previewAs store', () => {
  beforeEach(() => setPreviewAs(null));

  it('defaults to null (no preview)', () => {
    expect(getPreviewAs()).toBeNull();
  });

  it('setPreviewAs stores the { role, label } object', () => {
    setPreviewAs({ role: 'tech', label: 'Nail tech' });
    expect(getPreviewAs()).toEqual({ role: 'tech', label: 'Nail tech' });
  });

  it('setPreviewAs(null) clears the preview', () => {
    setPreviewAs({ role: 'manager', label: 'Manager' });
    setPreviewAs(null);
    expect(getPreviewAs()).toBeNull();
  });

  it('falsy input normalizes to null (never undefined)', () => {
    setPreviewAs(undefined);
    expect(getPreviewAs()).toBeNull();
  });

  it('notifies subscribers with the new value on every change', () => {
    const seen = [];
    const unsub = subscribePreviewAs(v => seen.push(v));
    setPreviewAs({ role: 'scheduler', label: 'Front desk' });
    setPreviewAs(null);
    expect(seen).toEqual([{ role: 'scheduler', label: 'Front desk' }, null]);
    unsub();
  });

  it('unsubscribe stops further notifications', () => {
    const seen = [];
    const unsub = subscribePreviewAs(v => seen.push(v));
    setPreviewAs({ role: 'readonly', label: 'Read-only' });
    unsub();
    setPreviewAs(null);
    expect(seen).toHaveLength(1);
  });

  it('a throwing subscriber does not break the others', () => {
    const seen = [];
    const unsubBad = subscribePreviewAs(() => { throw new Error('boom'); });
    const unsubGood = subscribePreviewAs(v => seen.push(v));
    expect(() => setPreviewAs({ role: 'tech', label: 'Nail tech' })).not.toThrow();
    expect(seen).toEqual([{ role: 'tech', label: 'Nail tech' }]);
    unsubBad(); unsubGood();
  });
});
