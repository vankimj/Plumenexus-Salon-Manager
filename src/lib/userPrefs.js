// Per-device, per-user UI preferences (web).
//
// These describe how YOU like the app on THIS browser — they are NOT tenant
// config (that's settings.hiddenTiles / disabledModules, admin-only) and NOT
// security-sensitive. So they live in localStorage keyed by your Firebase
// uid, with no Firestore round-trip — instant, and one overwhelmed user's
// "Simple" choice never touches anyone else.
//
// Mirror of mobile/src/lib/userPrefs.js. Upgrade path for cross-device sync:
// persist into usersFull[email].uiPrefs later (the shape is forward-compatible).
//
//   density: 'simple'   → fewest tiles; advanced groups always start collapsed
//            'standard'  → curated home (Core open, Grow/Admin behind "Show more")
//            'everything'→ every tile expanded; power-user mode
//   homeExpanded: remembers whether the "Show more" groups were left open

import { useState, useEffect } from 'react';

export const DENSITIES = ['simple', 'standard', 'everything'];
//   favorites:  module ids you've hearted → shown in a Favorites section up top
//   collapsed:  { [sectionKey]: true } for home sections you've collapsed via the caret
export const DEFAULT_PREFS = { density: 'standard', homeExpanded: false, favorites: [], collapsed: {} };

const keyFor = (uid) => `pn:uiPrefs:${uid || 'anon'}`;

const subscribers = new Set();
function notify(uid, prefs) {
  subscribers.forEach(cb => { try { cb(uid || 'anon', prefs); } catch (_) {} });
}

export function getUserPrefs(uid) {
  try {
    const raw = localStorage.getItem(keyFor(uid));
    if (!raw) return { ...DEFAULT_PREFS };
    const p = JSON.parse(raw);
    return {
      density:      DENSITIES.includes(p?.density) ? p.density : DEFAULT_PREFS.density,
      homeExpanded: !!p?.homeExpanded,
      favorites:    Array.isArray(p?.favorites) ? p.favorites.filter(x => typeof x === 'string') : [],
      collapsed:    (p?.collapsed && typeof p.collapsed === 'object' && !Array.isArray(p.collapsed)) ? p.collapsed : {},
      // Last-write timestamp — the cross-device reconcile key (userPrefsSync).
      updatedAt:    typeof p?.updatedAt === 'string' ? p.updatedAt : '',
    };
  } catch (_) {
    return { ...DEFAULT_PREFS };
  }
}

export function setUserPrefs(uid, patch) {
  // Stamp updatedAt unless the caller supplies one (userPrefsSync passes the
  // cloud's stamp through when adopting a remote copy, so the two devices
  // converge on identical timestamps instead of ping-ponging).
  const merged = { ...getUserPrefs(uid), ...patch };
  if (!patch || typeof patch.updatedAt !== 'string') merged.updatedAt = new Date().toISOString();
  try { localStorage.setItem(keyFor(uid), JSON.stringify(merged)); } catch (_) {}
  const clean = getUserPrefs(uid); // re-read so density is sanitized for the return value + subscribers
  notify(uid, clean);
  return clean;
}

// Cross-device reconcile: which copy wins, by updatedAt (missing/blank stamps
// lose to real ones). Pure — consumed by userPrefsSync.js, unit-tested here.
export function newerOf(local, cloud) {
  if (!cloud) return 'local';
  const l = local?.updatedAt || '';
  const c = cloud?.updatedAt || '';
  if (c > l) return 'cloud';
  if (l > c) return 'local';
  return 'equal';
}

// Subscribe to in-tab pref changes. cb receives (uid, prefs).
export function subscribeUserPrefs(cb) {
  subscribers.add(cb);
  return () => subscribers.delete(cb);
}

// React hook: [prefs, update]. Reacts to same-tab updates (via subscribe) and
// cross-tab updates (via the storage event).
export function useUserPrefs(uid) {
  const [prefs, setLocal] = useState(() => getUserPrefs(uid));

  useEffect(() => {
    setLocal(getUserPrefs(uid));
    const norm = uid || 'anon';
    const unsub = subscribeUserPrefs((u, p) => { if (u === norm) setLocal(p); });
    const onStorage = (e) => { if (e.key === keyFor(uid)) setLocal(getUserPrefs(uid)); };
    window.addEventListener('storage', onStorage);
    return () => { unsub(); window.removeEventListener('storage', onStorage); };
  }, [uid]);

  const update = (patch) => setLocal(setUserPrefs(uid, patch));
  return [prefs, update];
}
