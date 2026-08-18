import { describe, it, expect } from 'vitest';
import {
  stationTypeForService, apptStationUse, intervalOf,
  stationCaps, checkStationCapacity, buildStationTypeIndex,
} from './stationCapacity.js';

describe('server stationTypeForService / apptStationUse', () => {
  it('classifies by category then name; lane wins on appts', () => {
    expect(stationTypeForService({ name: 'Toe Polish Change', category: 'Pedicures' })).toBe('P');
    expect(stationTypeForService({ name: 'Gel Manicure' })).toBe('M');
    expect(apptStationUse({ lane: 'Pedicures', services: [{ name: 'Gel Manicure' }] })).toBe('P');
    expect(apptStationUse({ services: [{ name: 'Gel Manicure' }, { name: 'Spa Pedicure' }] })).toBe('MP');
  });
});

describe('intervalOf', () => {
  it('prefers services-sum, clamps, needs a valid startTime', () => {
    expect(intervalOf({ startTime: '10:00', duration: 45 })).toEqual({ s: 600, e: 645 });
    expect(intervalOf({ startTime: '10:00', duration: 999, services: [{ duration: 30 }, { duration: 15 }] })).toEqual({ s: 600, e: 645 });
    expect(intervalOf({ startTime: 'junk' })).toBeNull();
    expect(intervalOf({ startTime: '10:00' })).toEqual({ s: 600, e: 660 }); // default 60
  });
});

describe('checkStationCapacity', () => {
  const caps2 = stationCaps({ manicureStations: 2, pedicureStations: 1 });

  it('admits within capacity', () => {
    const existing = [{ startTime: '10:00', duration: 60, services: [{ name: 'Gel Manicure', duration: 60 }] }];
    const incoming = [{ startTime: '10:30', duration: 60, lane: 'Manicures' }];
    expect(checkStationCapacity({ existing, incoming, caps: caps2 })).toEqual({ ok: true });
  });

  it('rejects the overflow appointment and names the station', () => {
    const existing = [
      { startTime: '10:00', duration: 60, lane: 'Manicures' },
      { startTime: '10:00', duration: 60, lane: 'Manicures' },
    ];
    const incoming = [{ startTime: '10:30', duration: 30, lane: 'Manicures' }];
    expect(checkStationCapacity({ existing, incoming, caps: caps2 })).toEqual({ ok: false, station: 'M' });
  });

  it('counts the incoming batch against itself (simultaneous mani+pedi ×2 guests)', () => {
    const incoming = [
      { startTime: '10:00', duration: 45, lane: 'Pedicures' },
      { startTime: '10:00', duration: 45, lane: 'Pedicures' },
    ];
    expect(checkStationCapacity({ existing: [], incoming, caps: caps2 })).toEqual({ ok: false, station: 'P' });
  });

  it('ignores cancelled/no_show existing + unclassified services', () => {
    const existing = [
      { startTime: '10:00', duration: 60, lane: 'Pedicures', status: 'cancelled' },
      { startTime: '10:00', duration: 60, services: [{ name: 'Brow Wax', duration: 60 }] },
    ];
    const incoming = [{ startTime: '10:00', duration: 45, lane: 'Pedicures' }];
    expect(checkStationCapacity({ existing, incoming, caps: caps2 })).toEqual({ ok: true });
  });

  it('unlimited when unconfigured', () => {
    const incoming = Array.from({ length: 9 }, () => ({ startTime: '10:00', duration: 60, lane: 'Manicures' }));
    expect(checkStationCapacity({ existing: [], incoming, caps: stationCaps({}) })).toEqual({ ok: true });
  });
});

describe('server catalog join', () => {
  const index = buildStationTypeIndex([
    { id: 'svc1', name: 'Gel-X', category: 'Manicures' },
    { id: 'svc2', name: 'Toe Polish Change', category: 'Pedicures' },
  ]);
  it('classifies category-only names via the index', () => {
    expect(apptStationUse({ services: [{ name: 'Gel-X' }] }, index)).toBe('M');
    expect(apptStationUse({ services: [{ id: 'svc2', name: 'Renamed' }] }, index)).toBe('P');
  });
  it('checkStationCapacity catches an overflow of category-only services', () => {
    const existing = [
      { startTime: '10:00', duration: 30, services: [{ name: 'Toe Polish Change', duration: 30 }] },
      { startTime: '10:00', duration: 30, services: [{ name: 'Toe Polish Change', duration: 30 }] },
    ];
    const incoming = [{ startTime: '10:00', duration: 30, services: [{ name: 'Toe Polish Change', duration: 30 }] }];
    const caps = stationCaps({ pedicureStations: 2 });
    expect(checkStationCapacity({ existing, incoming, caps, index })).toEqual({ ok: false, station: 'P' });
    expect(checkStationCapacity({ existing, incoming, caps })).toEqual({ ok: true }); // blind without index
  });
});
