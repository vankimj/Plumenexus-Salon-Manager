import { describe, it, expect } from 'vitest';
import { collectTechNames, missingTechNames } from './csvImport';

describe('collectTechNames', () => {
  it('gathers distinct techs from receipt + service + techSplit levels', () => {
    const receipts = [
      { techName: 'Yasmin D', services: [{ techName: 'Yasmin D' }, { techName: 'Alex Rivers' }] },
      { techName: 'Jamie Chen', payment: { techSplit: [{ techName: 'Morgan Lee' }] } },
    ];
    expect(collectTechNames(receipts).sort()).toEqual(['Alex Rivers', 'Jamie Chen', 'Morgan Lee', 'Yasmin D']);
  });

  it('dedupes case-insensitively, keeping the first spelling', () => {
    const receipts = [{ techName: 'Yasmin D' }, { techName: 'yasmin d' }, { services: [{ techName: 'YASMIN D' }] }];
    expect(collectTechNames(receipts)).toEqual(['Yasmin D']);
  });

  it('splits comma-joined multi-provider names', () => {
    expect(collectTechNames([{ techName: 'Yasmin D, Alex Rivers' }]).sort()).toEqual(['Alex Rivers', 'Yasmin D']);
  });

  it('skips blanks and non-tech placeholders (Walk-in / TBD / Front Desk)', () => {
    const receipts = [
      { techName: '' }, { techName: 'Walk-in' }, { techName: 'TBD' },
      { techName: 'Front Desk' }, { services: [{ techName: 'N/A' }] }, { techName: 'Real Tech' },
    ];
    expect(collectTechNames(receipts)).toEqual(['Real Tech']);
  });

  it('handles empty input', () => {
    expect(collectTechNames([])).toEqual([]);
    expect(collectTechNames(null)).toEqual([]);
  });
});

describe('missingTechNames', () => {
  it('returns referenced techs with no existing staff match (case-insensitive)', () => {
    const referenced = ['Yasmin D', 'Old Tech', 'Alex Rivers'];
    const existing = ['yasmin d', 'Alex Rivers', 'Someone Else'];
    expect(missingTechNames(referenced, existing)).toEqual(['Old Tech']);
  });

  it('returns all when there are no existing staff', () => {
    expect(missingTechNames(['A', 'B'], [])).toEqual(['A', 'B']);
  });

  it('returns none when everyone already exists', () => {
    expect(missingTechNames(['A'], ['a'])).toEqual([]);
  });
});
