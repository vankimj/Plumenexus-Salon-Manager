'use strict';

// Pure, side-effect-free helpers for multi-location Google Business Profile
// review sync. Kept out of index.js so they can be unit-tested by the root
// vitest suite (functions/index.js has heavy top-level side effects and can't
// be imported). See functions/gbpMatch.test.js.

// Generic words that appear across most salon listings / addresses and so carry
// no signal for telling ONE location apart from another. Dropped before scoring.
const STOPWORDS = new Set([
  'the', 'and', 'llc', 'inc', 'co', 'of', 'for',
  'nail', 'nails', 'salon', 'spa', 'studio', 'bar', 'lounge', 'shop', 'beauty',
  'suite', 'ste', 'unit', 'apt', 'floor',
  'ave', 'avenue', 'st', 'street', 'rd', 'road', 'blvd', 'boulevard',
  'dr', 'drive', 'ln', 'lane', 'ct', 'court', 'way', 'pkwy', 'hwy',
  'us', 'usa',
]);

function tokenize(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(t => t.length >= 3 && !STOPWORDS.has(t));
}

// A GBP storefrontAddress is { addressLines[], locality, administrativeArea,
// postalCode, regionCode }. An app location's `address` is usually a plain
// string. Flatten either into one string for tokenizing.
function addressString(addr) {
  if (!addr) return '';
  if (typeof addr === 'string') return addr;
  if (typeof addr !== 'object') return '';
  return []
    .concat(Array.isArray(addr.addressLines) ? addr.addressLines : [])
    .concat([addr.locality, addr.administrativeArea, addr.postalCode].filter(Boolean))
    .join(' ');
}

// Count of shared UNIQUE tokens between two token lists.
function tokenOverlapScore(aTokens, bTokens) {
  const b = new Set(bTokens);
  const seen = new Set();
  let n = 0;
  for (const t of aTokens) {
    if (b.has(t) && !seen.has(t)) { n++; seen.add(t); }
  }
  return n;
}

// Mirror of src/lib/locations.js activeLocations/isMultiLocation (re-implemented
// server-side — that module imports firebase and can't be required here).
function activeLocations(state) {
  return (state && Array.isArray(state.list) ? state.list : [])
    .filter(l => l && l.active !== false)
    .sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0) || (a.name || '').localeCompare(b.name || ''));
}
function isMultiLocation(state) {
  return activeLocations(state).length > 1;
}

// Best-effort default mapping of a Google location to an app-location id.
//  - 0 active app locations → the default id (nothing to choose from).
//  - exactly 1 active app location → map every Google listing to it.
//  - ≥2 → the app location with the single highest token overlap; a TIE or no
//    overlap returns null so the admin picks manually (never a wrong guess).
function autoMapAppLocation(gbpLoc, locState) {
  const list = activeLocations(locState);
  if (list.length === 0) return (locState && locState.defaultLocationId) || 'main';
  if (list.length === 1) return list[0].id;

  const gTokens = tokenize((gbpLoc && gbpLoc.title ? gbpLoc.title : '') + ' ' + addressString(gbpLoc && gbpLoc.storefrontAddress));
  let best = null, bestScore = 0, tie = false;
  for (const loc of list) {
    const lTokens = tokenize((loc.name || '') + ' ' + addressString(loc.address));
    const score = tokenOverlapScore(gTokens, lTokens);
    if (score > bestScore) { bestScore = score; best = loc.id; tie = false; }
    else if (score === bestScore && score > 0) { tie = true; }
  }
  return (bestScore >= 1 && !tie) ? best : null;
}

// Merge freshly-enumerated Google locations into the stored locations[], keyed
// by locationName. An existing entry is updated (account/title/token refreshed,
// re-activated) but a MANUALLY-set appLocationId is preserved. New entries are
// appended — so re-authing with a different Google login ADDS its listings
// rather than clobbering the ones already connected. Order is preserved.
function mergeLocationsByName(existing, incoming) {
  const out = (Array.isArray(existing) ? existing : []).map(e => ({ ...e }));
  const idx = new Map(out.map((e, i) => [e.locationName, i]));
  for (const inc of (Array.isArray(incoming) ? incoming : [])) {
    if (!inc || !inc.locationName) continue;
    if (idx.has(inc.locationName)) {
      const i = idx.get(inc.locationName);
      const cur = out[i];
      out[i] = {
        ...cur,
        accountName:     inc.accountName || cur.accountName,
        locationTitle:   inc.locationTitle || cur.locationTitle,
        refreshTokenEnc: inc.refreshTokenEnc || cur.refreshTokenEnc,
        active:          true,
        appLocationId:   (cur.appLocationId != null) ? cur.appLocationId : (inc.appLocationId != null ? inc.appLocationId : null),
      };
    } else {
      out.push({
        ...inc,
        appLocationId: inc.appLocationId != null ? inc.appLocationId : null,
        active:        inc.active !== false,
      });
      idx.set(inc.locationName, out.length - 1);
    }
  }
  return out;
}

// Lazy migration: a legacy auth doc (top-level fields, no locations[]) becomes a
// single-entry array so every read path can treat all docs uniformly.
function synthEntryFromLegacy(auth) {
  if (!auth || !auth.refreshTokenEnc || !auth.locationName) return [];
  return [{
    accountName:     auth.accountName || '',
    locationName:    auth.locationName,
    locationTitle:   auth.locationTitle || '',
    appLocationId:   auth.appLocationId != null ? auth.appLocationId : null,
    refreshTokenEnc: auth.refreshTokenEnc,
    active:          true,
    lastSyncAt:      auth.lastSyncAt != null ? auth.lastSyncAt : null,
    lastSyncCount:   auth.lastSyncCount != null ? auth.lastSyncCount : 0,
    lastSyncError:   auth.lastSyncError != null ? auth.lastSyncError : null,
  }];
}

// From a location's already-normalized reviews (the shape written to
// googleReviewsLog), pick the top N with text for the PUBLIC webfront cache.
// Highest rating first, then most recent.
function pickPublicReviews(reviews, n = 8) {
  return (Array.isArray(reviews) ? reviews : [])
    .filter(r => r && r.text && String(r.text).trim())
    .sort((a, b) => (b.rating || 0) - (a.rating || 0)
      || String(b.publishTime || '').localeCompare(String(a.publishTime || '')))
    .slice(0, n)
    .map(r => ({
      name:        r.authorName || 'Google Reviewer',
      rating:      r.rating || 5,
      text:        r.text || '',
      date:        r.date || '',
      publishTime: r.publishTime || null,
      photoUrl:    r.authorPhoto || null,
    }));
}

module.exports = {
  tokenize,
  addressString,
  tokenOverlapScore,
  activeLocations,
  isMultiLocation,
  autoMapAppLocation,
  mergeLocationsByName,
  synthEntryFromLegacy,
  pickPublicReviews,
};
