import { describe, it, expect } from 'vitest';
import { workingTechNames } from './shiftGate';

// Attendance entry shape (isEntryClockedIn): clocked-in when clockInAt is set
// and clockOutAt is not.
const inNow  = (name) => ({ employeeName: name, clockInAt: '2026-07-20T09:00:00Z' });
const outNow = (name) => ({ employeeName: name, clockInAt: '2026-07-20T09:00:00Z', clockOutAt: '2026-07-20T12:00:00Z' });
const att = (...entries) => ({ entries });

const TECHS = ['Yasmin D', 'Audriana L', 'Samantha T'];

describe('workingTechNames', () => {
  it('returns only techs currently clocked in, in original casing', () => {
    const a = att(inNow('Yasmin D'), inNow('Samantha T'), outNow('Audriana L'));
    expect(workingTechNames(TECHS, a)).toEqual(['Yasmin D', 'Samantha T']);
  });

  it('matches case-insensitively but preserves the tech-column casing', () => {
    const a = att(inNow('yasmin d'), inNow('SAMANTHA T'));
    expect(workingTechNames(TECHS, a)).toEqual(['Yasmin D', 'Samantha T']);
  });

  it('excludes clocked-out staff', () => {
    expect(workingTechNames(TECHS, att(outNow('Yasmin D')))).toEqual([]);
  });

  it('ignores clocked-in people who are not tech columns', () => {
    const a = att(inNow('Some Front Desk'), inNow('Audriana L'));
    expect(workingTechNames(TECHS, a)).toEqual(['Audriana L']);
  });

  it('handles empty / missing input safely', () => {
    expect(workingTechNames(TECHS, null)).toEqual([]);
    expect(workingTechNames(TECHS, att())).toEqual([]);
    expect(workingTechNames(null, att(inNow('Yasmin D')))).toEqual([]);
  });
});
