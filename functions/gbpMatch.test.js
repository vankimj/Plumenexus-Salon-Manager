import { describe, it, expect } from 'vitest';
import {
  tokenize, addressString, tokenOverlapScore,
  activeLocations, isMultiLocation,
  autoMapAppLocation, mergeLocationsByName, synthEntryFromLegacy, pickPublicReviews,
} from './gbpMatch.js';

const single = { list: [{ id: 'main', name: 'Meraki Nail Studio', isPrimary: true, active: true }], defaultLocationId: 'main' };
const multi = {
  list: [
    { id: 'downtown', name: 'Meraki Downtown', address: '55 Main St, Columbus OH 43215', isPrimary: true, active: true },
    { id: 'north',    name: 'Meraki Northside', address: '900 Polaris Pkwy, Columbus OH 43240', active: true },
    { id: 'closed',   name: 'Old Place', address: '1 Gone Rd', active: false },
  ],
  defaultLocationId: 'downtown',
};

describe('tokenize / addressString / overlap', () => {
  it('drops generic + short + stopword tokens', () => {
    expect(tokenize('Meraki Nail Studio')).toEqual(['meraki']);
    expect(tokenize('  ')).toEqual([]);
  });
  it('flattens a GBP storefrontAddress object and a plain string', () => {
    expect(addressString({ addressLines: ['900 Polaris Pkwy'], locality: 'Columbus', administrativeArea: 'OH', postalCode: '43240' }))
      .toBe('900 Polaris Pkwy Columbus OH 43240');
    expect(addressString('55 Main St')).toBe('55 Main St');
    expect(addressString(null)).toBe('');
  });
  it('counts shared unique tokens', () => {
    expect(tokenOverlapScore(['polaris', 'columbus'], ['polaris', 'columbus', 'columbus'])).toBe(2);
    expect(tokenOverlapScore(['a'], ['b'])).toBe(0);
  });
});

describe('activeLocations / isMultiLocation', () => {
  it('filters inactive, primary-first', () => {
    expect(activeLocations(multi).map(l => l.id)).toEqual(['downtown', 'north']);
    expect(isMultiLocation(multi)).toBe(true);
    expect(isMultiLocation(single)).toBe(false);
  });
});

describe('autoMapAppLocation', () => {
  it('single app-location → maps every Google listing to it', () => {
    expect(autoMapAppLocation({ title: 'Anything', storefrontAddress: {} }, single)).toBe('main');
  });
  it('multi → best unique token overlap wins', () => {
    const g = { title: 'Meraki Northside', storefrontAddress: { addressLines: ['900 Polaris Pkwy'], locality: 'Columbus', administrativeArea: 'OH', postalCode: '43240' } };
    expect(autoMapAppLocation(g, multi)).toBe('north');
  });
  it('multi → no distinguishing overlap returns null', () => {
    // "meraki" is shared by both active app locations → tie → null
    const g = { title: 'Meraki', storefrontAddress: {} };
    expect(autoMapAppLocation(g, multi)).toBeNull();
  });
  it('empty location state → default id', () => {
    expect(autoMapAppLocation({ title: 'x' }, { list: [], defaultLocationId: 'main' })).toBe('main');
  });
});

describe('mergeLocationsByName', () => {
  const existing = [
    { accountName: 'accounts/1', locationName: 'locations/A', locationTitle: 'A', appLocationId: 'downtown', refreshTokenEnc: 'tokA', active: true, lastSyncCount: 5 },
  ];
  it('appends a new location (different login) without clobbering', () => {
    const incoming = [{ accountName: 'accounts/2', locationName: 'locations/B', locationTitle: 'B', appLocationId: 'north', refreshTokenEnc: 'tokB' }];
    const out = mergeLocationsByName(existing, incoming);
    expect(out.map(e => e.locationName)).toEqual(['locations/A', 'locations/B']);
    expect(out[0].lastSyncCount).toBe(5); // untouched
  });
  it('updates an existing entry but preserves a manual appLocationId', () => {
    const incoming = [{ accountName: 'accounts/1', locationName: 'locations/A', locationTitle: 'A renamed', appLocationId: 'SHOULD_NOT_WIN', refreshTokenEnc: 'tokA2' }];
    const out = mergeLocationsByName(existing, incoming);
    expect(out).toHaveLength(1);
    expect(out[0].appLocationId).toBe('downtown');      // manual mapping kept
    expect(out[0].locationTitle).toBe('A renamed');     // metadata refreshed
    expect(out[0].refreshTokenEnc).toBe('tokA2');       // token rotated
  });
  it('fills appLocationId only when previously unset', () => {
    const ex = [{ locationName: 'locations/C', appLocationId: null, refreshTokenEnc: 't' }];
    const out = mergeLocationsByName(ex, [{ locationName: 'locations/C', appLocationId: 'north', refreshTokenEnc: 't' }]);
    expect(out[0].appLocationId).toBe('north');
  });
});

describe('synthEntryFromLegacy', () => {
  it('wraps a legacy doc into one entry', () => {
    const out = synthEntryFromLegacy({ accountName: 'accounts/1', locationName: 'locations/A', locationTitle: 'A', refreshTokenEnc: 'tok', lastSyncCount: 3 });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ locationName: 'locations/A', appLocationId: null, active: true, lastSyncCount: 3 });
  });
  it('returns [] for an incomplete/empty doc', () => {
    expect(synthEntryFromLegacy(null)).toEqual([]);
    expect(synthEntryFromLegacy({ locationName: 'locations/A' })).toEqual([]); // no token
  });
});

describe('pickPublicReviews', () => {
  it('keeps only reviews with text, ranked rating desc then recency, capped', () => {
    const reviews = [
      { authorName: 'Empty', rating: 5, text: '', publishTime: '2026-01-01' },
      { authorName: 'Low',   rating: 3, text: 'ok',   publishTime: '2026-05-01' },
      { authorName: 'HighOld', rating: 5, text: 'great', publishTime: '2026-01-01' },
      { authorName: 'HighNew', rating: 5, text: 'amazing', authorPhoto: 'p', publishTime: '2026-06-01' },
    ];
    const out = pickPublicReviews(reviews, 2);
    expect(out.map(r => r.name)).toEqual(['HighNew', 'HighOld']); // 5★ newest first, empty dropped, 2-cap
    expect(out[0]).toMatchObject({ name: 'HighNew', rating: 5, text: 'amazing', photoUrl: 'p' });
  });
});
