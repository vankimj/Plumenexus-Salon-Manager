import { describe, it, expect } from 'vitest';
import { selectRebookCandidates, futureClientIdSet, addDaysISO, rebookTargetDates } from './rebookNudge.js';

describe('selectRebookCandidates', () => {
  const base = [
    { id: 'a1', clientId: 'c1', status: 'done' },
    { id: 'a2', clientId: 'c2', status: 'completed' },
  ];

  it('selects completed appts with a clientId and no future booking', () => {
    const out = selectRebookCandidates(base, new Set());
    expect(out.map(a => a.clientId).sort()).toEqual(['c1', 'c2']);
  });

  it('excludes non-completed appts (scheduled/cancelled/no-show)', () => {
    const appts = [
      { id: 'a1', clientId: 'c1', status: 'scheduled' },
      { id: 'a2', clientId: 'c2', status: 'cancelled' },
      { id: 'a3', clientId: 'c3', status: 'no-show' },
      { id: 'a4', clientId: 'c4', status: 'done' },
    ];
    expect(selectRebookCandidates(appts, new Set()).map(a => a.clientId)).toEqual(['c4']);
  });

  it('excludes walk-ins / anonymous visits with no clientId', () => {
    const appts = [
      { id: 'a1', clientId: '', status: 'done' },
      { id: 'a2', status: 'done' },
      { id: 'a3', clientId: 'c3', status: 'done' },
    ];
    expect(selectRebookCandidates(appts, new Set()).map(a => a.clientId)).toEqual(['c3']);
  });

  it('excludes clients who already have a future appointment', () => {
    const out = selectRebookCandidates(base, new Set(['c1']));
    expect(out.map(a => a.clientId)).toEqual(['c2']);
  });

  it('excludes appts already nudged (idempotent re-run)', () => {
    const appts = [
      { id: 'a1', clientId: 'c1', status: 'done', rebookNudgeSent: true },
      { id: 'a2', clientId: 'c2', status: 'done' },
    ];
    expect(selectRebookCandidates(appts, new Set()).map(a => a.clientId)).toEqual(['c2']);
  });

  it('dedupes to one nudge per client when they had multiple services that day', () => {
    const appts = [
      { id: 'a1', clientId: 'c1', status: 'done', serviceName: 'Mani' },
      { id: 'a2', clientId: 'c1', status: 'done', serviceName: 'Pedi' },
    ];
    const out = selectRebookCandidates(appts, new Set());
    expect(out).toHaveLength(1);
    expect(out[0].clientId).toBe('c1');
  });

  it('respects a custom sent-field name', () => {
    const appts = [{ id: 'a1', clientId: 'c1', status: 'done', altSent: true }];
    expect(selectRebookCandidates(appts, new Set(), 'altSent')).toHaveLength(0);
  });

  it('handles empty / missing input safely', () => {
    expect(selectRebookCandidates(null, null)).toEqual([]);
    expect(selectRebookCandidates([], new Set())).toEqual([]);
  });
});

describe('futureClientIdSet', () => {
  it('collects clientIds with a non-cancelled appt strictly after the date', () => {
    const appts = [
      { clientId: 'c1', date: '2026-07-20', status: 'scheduled' },
      { clientId: 'c2', date: '2026-07-18', status: 'scheduled' }, // == afterDate, excluded
      { clientId: 'c3', date: '2026-07-25', status: 'cancelled' }, // cancelled, excluded
      { clientId: 'c4', date: '2026-08-01', status: 'scheduled' },
    ];
    const s = futureClientIdSet(appts, '2026-07-18');
    expect([...s].sort()).toEqual(['c1', 'c4']);
  });

  it('ignores appts with no clientId or no date', () => {
    const appts = [
      { date: '2026-08-01', status: 'scheduled' },
      { clientId: 'c1', status: 'scheduled' },
    ];
    expect(futureClientIdSet(appts, '2026-07-18').size).toBe(0);
  });
});

describe('date helpers', () => {
  it('addDaysISO is DST-safe across the spring-forward boundary', () => {
    expect(addDaysISO('2026-03-07', 1)).toBe('2026-03-08'); // US DST starts 2026-03-08
    expect(addDaysISO('2026-03-08', -1)).toBe('2026-03-07');
    expect(addDaysISO('2026-07-18', -28)).toBe('2026-06-20');
  });

  it('rebookTargetDates returns the target week-offset date plus a look-back window', () => {
    // 4 weeks before 2026-07-18 is 2026-06-20; window includes the 2 prior days.
    expect(rebookTargetDates('2026-07-18', 4)).toEqual(['2026-06-18', '2026-06-19', '2026-06-20']);
  });

  it('rebookTargetDates with no look-back is a single date', () => {
    expect(rebookTargetDates('2026-07-18', 4, 0)).toEqual(['2026-06-20']);
  });
});
