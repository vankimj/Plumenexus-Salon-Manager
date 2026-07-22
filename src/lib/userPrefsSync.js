// Cross-device sync for per-user UI prefs (favorites, collapsed sections,
// density). localStorage (userPrefs.js) stays the instant source of truth on
// each device; this module mirrors it to Firestore at
// tenants/{tid}/userPrefs/{uid} (rules: each signed-in user, own doc only) and
// live-applies remote changes via onSnapshot. Reconcile = newer updatedAt wins.
//
// Kept separate from userPrefs.js so that module stays pure/Firebase-free
// (it's unit-tested in a bare node env). AppContext starts/stops the sync as
// auth changes. Any Firestore failure (rules, offline, kiosk custom-token
// users) degrades silently to device-local behavior.

import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { TENANT_ID } from './tenant';
import { getUserPrefs, setUserPrefs, subscribeUserPrefs, newerOf } from './userPrefs';

const prefsDocRef = (uid) => doc(db, 'tenants', TENANT_ID, 'userPrefs', uid);

let stop = null;
let activeUid = null;
let applyingRemote = false;

export function startUserPrefsSync(uid) {
  if (!uid || uid === activeUid) return;
  stopUserPrefsSync();
  activeUid = uid;

  const push = (p) => setDoc(prefsDocRef(uid), { ...p }, { merge: true }).catch(() => {});

  // Remote → local. The first snapshot doubles as the initial reconcile.
  const unsubSnap = onSnapshot(prefsDocRef(uid), (snap) => {
    const cloud = snap.exists() ? snap.data() : null;
    const local = getUserPrefs(uid);
    const winner = newerOf(local, cloud);
    if (winner === 'cloud') {
      applyingRemote = true;
      try { setUserPrefs(uid, cloud); } finally { applyingRemote = false; }
    } else if (winner === 'local' && local.updatedAt) {
      // Cloud missing or stale (e.g. first sign-in from a device with history).
      push(local);
    }
  }, () => {} /* permission-denied / offline → stay device-local */);

  // Local → remote write-through. applyingRemote suppresses the echo of a
  // just-adopted cloud copy (subscribers fire synchronously inside setUserPrefs).
  const unsubLocal = subscribeUserPrefs((u, p) => {
    if (u !== uid || applyingRemote) return;
    push(p);
  });

  stop = () => { unsubSnap(); unsubLocal(); };
}

export function stopUserPrefsSync() {
  try { stop?.(); } catch (_) { /* already torn down */ }
  stop = null;
  activeUid = null;
}
