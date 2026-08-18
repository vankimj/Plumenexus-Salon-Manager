import { describe, it, expect } from 'vitest';
import {
  stationTypeForService, apptStationUse, maxConcurrent,
  stationCaps, stationFits, arrangeLanes, stationIntervals, stationOverruns, buildStationTypeIndex,
} from './stationCapacity';

describe('stationTypeForService', () => {
  it('classifies by category first', () => {
    expect(stationTypeForService({ name: 'Toe Polish Change', category: 'Pedicures' })).toBe('P');
    expect(stationTypeForService({ name: 'Gel-X', category: 'Manicures' })).toBe('M');
  });
  it('falls back to the name', () => {
    expect(stationTypeForService({ name: 'Spa Pedicure' })).toBe('P');
    expect(stationTypeForService({ name: 'Gel Manicure', category: 'Add-ons' })).toBe('M');
  });
  it('unknown → null (no station constraint)', () => {
    expect(stationTypeForService({ name: 'Brow Wax', category: 'Waxing' })).toBeNull();
    expect(stationTypeForService(null)).toBeNull();
  });
});

describe('apptStationUse', () => {
  it('lane field wins', () => {
    expect(apptStationUse({ lane: 'Pedicures', services: [{ name: 'Gel Manicure' }] })).toBe('P');
    expect(apptStationUse({ lane: 'Manicures' })).toBe('M');
  });
  it('derives from service lines; combo occupies both', () => {
    expect(apptStationUse({ services: [{ name: 'Gel Manicure' }, { name: 'Spa Pedicure' }] })).toBe('MP');
    expect(apptStationUse({ services: [{ name: 'Nail Art' }] })).toBe('');
  });
});

describe('maxConcurrent', () => {
  const ivs = [{ s: 60, e: 120 }, { s: 90, e: 150 }, { s: 120, e: 180 }];
  it('counts peak overlap inside the window', () => {
    expect(maxConcurrent(ivs, 60, 180)).toBe(2);   // 90-120 has two
    expect(maxConcurrent(ivs, 0, 60)).toBe(0);
  });
  it('back-to-back is not overlap (half-open)', () => {
    expect(maxConcurrent([{ s: 60, e: 120 }, { s: 120, e: 180 }], 60, 180)).toBe(1);
  });
  it('clips to the window', () => {
    expect(maxConcurrent([{ s: 0, e: 600 }], 100, 130)).toBe(1);
  });
});

describe('stationCaps / stationFits', () => {
  it('0/unset = unlimited; wait defaults 15', () => {
    expect(stationCaps({})).toEqual({ M: Infinity, P: Infinity, waitTol: 15 });
    expect(stationCaps({ manicureStations: 4, pedicureStations: 0, stationWaitToleranceMin: 30 }))
      .toEqual({ M: 4, P: Infinity, waitTol: 30 });
  });
  it('fits until the cap, then blocks', () => {
    const busy = [{ s: 60, e: 120 }, { s: 60, e: 120 }];
    expect(stationFits(busy, 60, 60, 3)).toBe(true);   // 2 busy + 1 = 3 ≤ 3
    expect(stationFits(busy, 60, 60, 2)).toBe(false);  // would be 3rd on a 2-cap
    expect(stationFits(busy, 120, 60, 2)).toBe(true);  // after they end
    expect(stationFits(busy, 60, 60, Infinity)).toBe(true);
  });
});

describe('arrangeLanes — the juggle', () => {
  const mk = (blocked) => (type, start, dur) =>
    !blocked.some(b => b.type === type && b.s < start + dur && b.e > start);

  it('prefers the configured shape when it fits', () => {
    const a = arrangeLanes({ slot: 600, maniDur: 30, pediDur: 45, shape: 'back-to-back', canPlace: () => true });
    expect(a).toMatchObject({ maniStart: 600, pediStart: 630, gap: 0, order: 'mani-first' });
  });
  it('swaps to pedi-first when the mani station is busy at the anchor', () => {
    // mani station blocked 600-630 → mani-first fails, pedi-first (pedi 600-645, mani 645-675) works
    const a = arrangeLanes({ slot: 600, maniDur: 30, pediDur: 45, shape: 'back-to-back', canPlace: mk([{ type: 'M', s: 600, e: 630 }]) });
    expect(a).toMatchObject({ order: 'pedi-first', pediStart: 600, maniStart: 645, gap: 0 });
  });
  it('inserts a wait when both orders are blocked but a gap frees the pedi station', () => {
    // pedi station busy 600-640: mani-first no-gap needs pedi at 630 (blocked);
    // pedi-first needs pedi at 600 (blocked); mani-first + 10min gap → pedi at 640 ✓
    const a = arrangeLanes({ slot: 600, maniDur: 30, pediDur: 45, shape: 'back-to-back', waitTol: 15, step: 5, canPlace: mk([{ type: 'P', s: 600, e: 640 }]) });
    expect(a).toMatchObject({ order: 'mani-first', maniStart: 600, pediStart: 640, gap: 10 });
  });
  it('respects the wait tolerance', () => {
    // pedi blocked 600-700; max gap 15 can't reach → null
    const a = arrangeLanes({ slot: 600, maniDur: 30, pediDur: 45, shape: 'back-to-back', waitTol: 15, canPlace: mk([{ type: 'P', s: 600, e: 700 }]) });
    expect(a).toBeNull();
  });
  it('simultaneous falls back to back-to-back when one station is full', () => {
    const a = arrangeLanes({ slot: 600, maniDur: 30, pediDur: 30, shape: 'simultaneous', canPlace: mk([{ type: 'P', s: 600, e: 630 }]) });
    expect(a).toMatchObject({ order: 'mani-first', maniStart: 600, pediStart: 630 });
  });
  it('rejects arrangements past maxEnd', () => {
    const a = arrangeLanes({ slot: 600, maniDur: 30, pediDur: 45, shape: 'back-to-back', maxEnd: 660, canPlace: () => true });
    expect(a).toBeNull();  // mani-first ends 675, pedi-first ends 675 — both past 660
  });
});

describe('stationIntervals', () => {
  it('uses the server st tag, skips cancelled, sums service durations', () => {
    const { M, P } = stationIntervals([
      { startTime: '10:00', duration: 60, st: 'M' },
      { startTime: '10:30', st: 'P', services: [{ duration: 45 }] },
      { startTime: '11:00', duration: 60, st: 'M', status: 'cancelled' },
      { startTime: '12:00', duration: 30, st: 'MP' },
      { startTime: '13:00', duration: 30, st: '' },
    ]);
    expect(M).toEqual([{ s: 600, e: 660 }, { s: 720, e: 750 }]);
    expect(P).toEqual([{ s: 630, e: 675 }, { s: 720, e: 750 }]);
  });
  it('derives from services when st is absent', () => {
    const { P } = stationIntervals([{ startTime: '09:00', duration: 40, services: [{ name: 'Spa Pedicure', duration: 40 }] }]);
    expect(P).toEqual([{ s: 540, e: 580 }]);
  });
});

describe('stationOverruns', () => {
  const caps = { M: 2, P: 1, waitTol: 15 };
  it('finds the overbooked window with its peak', () => {
    const appts = [
      { startTime: '10:00', duration: 60, st: 'M' },
      { startTime: '10:00', duration: 60, st: 'M' },
      { startTime: '10:30', duration: 60, st: 'M' },   // 3rd concurrent 10:30-11:00
    ];
    const out = stationOverruns(appts, caps);
    expect(out).toEqual([{ type: 'M', s: 630, e: 660, peak: 3, cap: 2 }]);
  });
  it('no overrun at exactly cap; back-to-back never triggers', () => {
    const appts = [
      { startTime: '10:00', duration: 60, st: 'M' },
      { startTime: '10:00', duration: 60, st: 'M' },
      { startTime: '11:00', duration: 60, st: 'M' },   // starts as the others end
    ];
    expect(stationOverruns(appts, caps)).toEqual([]);
  });
  it('tracks both station types independently and sorts by start', () => {
    const appts = [
      { startTime: '14:00', duration: 30, st: 'P' },
      { startTime: '14:00', duration: 30, st: 'P' },   // P cap 1 → overrun 14:00-14:30
      { startTime: '09:00', duration: 30, st: 'M' },
      { startTime: '09:00', duration: 30, st: 'M' },
      { startTime: '09:00', duration: 30, st: 'M' },   // M cap 2 → overrun 09:00-09:30
    ];
    const out = stationOverruns(appts, caps);
    expect(out).toEqual([
      { type: 'M', s: 540, e: 570, peak: 3, cap: 2 },
      { type: 'P', s: 840, e: 870, peak: 2, cap: 1 },
    ]);
  });
  it('unlimited caps → nothing; cancelled excluded', () => {
    const appts = [
      { startTime: '10:00', duration: 60, st: 'P' },
      { startTime: '10:00', duration: 60, st: 'P', status: 'cancelled' },
    ];
    expect(stationOverruns(appts, { M: Infinity, P: Infinity })).toEqual([]);
    expect(stationOverruns(appts, caps)).toEqual([]);   // only 1 live pedi ≤ cap 1
  });
});

describe('buildStationTypeIndex — catalog join for category-only names', () => {
  const catalog = [
    { id: 'svc1', name: 'Gel-X', category: 'Manicures' },
    { id: 'svc2', name: 'Toe Polish Change', category: 'Pedicures' },
    { id: 'svc3', name: 'Brow Wax', category: 'Waxing' },
  ];
  const idx = buildStationTypeIndex(catalog);

  it('classifies lines by id, by name, and by "Service — Option" base name', () => {
    expect(apptStationUse({ services: [{ id: 'svc1', name: 'Gel-X' }] }, idx)).toBe('M');
    expect(apptStationUse({ services: [{ name: 'Toe Polish Change' }] }, idx)).toBe('P');
    expect(apptStationUse({ services: [{ name: 'Gel-X — Long' }] }, idx)).toBe('M');
    expect(apptStationUse({ services: [{ name: 'Brow Wax' }] }, idx)).toBe('');
  });
  it('finds an overrun for category-only names that no regex matches', () => {
    const appts = [
      { startTime: '10:00', duration: 30, services: [{ name: 'Toe Polish Change', duration: 30 }] },
      { startTime: '10:00', duration: 30, services: [{ name: 'Toe Polish Change', duration: 30 }] },
      { startTime: '10:00', duration: 30, services: [{ name: 'Toe Polish Change', duration: 30 }] },
    ];
    expect(stationOverruns(appts, { M: Infinity, P: 2, waitTol: 15 }, idx))
      .toEqual([{ type: 'P', s: 600, e: 630, peak: 3, cap: 2 }]);
    expect(stationOverruns(appts, { M: Infinity, P: 2, waitTol: 15 })).toEqual([]); // without the index: blind
  });
});

describe('stationOverruns — same-instant handoff stays one window', () => {
  it('merges windows split by a back-to-back end/start at the same minute', () => {
    const appts = [
      { startTime: '10:00', duration: 60, st: 'M' },
      { startTime: '10:00', duration: 60, st: 'M' },
      { startTime: '11:00', duration: 60, st: 'M' },
      { startTime: '11:00', duration: 60, st: 'M' },
    ];
    expect(stationOverruns(appts, { M: 1, P: Infinity, waitTol: 15 }))
      .toEqual([{ type: 'M', s: 600, e: 720, peak: 2, cap: 1 }]);
  });
  it('keeps genuinely separate windows separate', () => {
    const appts = [
      { startTime: '10:00', duration: 30, st: 'M' },
      { startTime: '10:00', duration: 30, st: 'M' },
      { startTime: '12:00', duration: 30, st: 'M' },
      { startTime: '12:00', duration: 30, st: 'M' },
    ];
    expect(stationOverruns(appts, { M: 1, P: Infinity, waitTol: 15 })).toEqual([
      { type: 'M', s: 600, e: 630, peak: 2, cap: 1 },
      { type: 'M', s: 720, e: 750, peak: 2, cap: 1 },
    ]);
  });
});
