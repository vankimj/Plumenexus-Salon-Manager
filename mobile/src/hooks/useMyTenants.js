import { useEffect, useState, useRef, useCallback } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, callFn } from '../lib/firebase';
import { getCurrentTenant, setCurrentTenant } from '../lib/currentTenant';
import { dedupe } from '../lib/inflight';

// Lists every tenant the signed-in user has staff/admin/owner access to,
// via the getMyTenants Cloud Function. Auto-selects the only tenant if
// the user is in exactly one. If the user is in multiple AND the
// currently-selected tenant isn't in the list, falls back to the first
// available so the rest of the app doesn't query a tenant the user
// can't read.
//
// Returns:
//   { tenants, loading, error, current, switchTo(id), reload() }
//
// `current` is the live tenant ID — re-read from getCurrentTenant() so
// callers re-render after switchTo() lands. `reload()` re-asks the server
// (bypassing the in-flight dedupe) — used by TenantGate's "Check again"
// after an admin grants access.
export default function useMyTenants() {
  const [tenants,   setTenants]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [current,   setCurrent]   = useState(getCurrentTenant());
  const reloadRef = useRef(() => {});

  useEffect(() => {
    let cancelled = false;

    async function check(user, { fresh = false } = {}) {
      if (cancelled) return;
      if (!user) {
        setTenants([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        // `fresh` (TenantGate's "Check again") varies the dedupe key so a
        // retry genuinely re-asks the server instead of joining a stale call.
        const key = `tenants:${(user.email || user.uid || '').toLowerCase()}${fresh ? `:retry-${Math.floor(performance.now?.() ?? 0)}-${Math.trunc(Math.random() * 1e9)}` : ''}`;
        const res = await dedupe(key, () => callFn('getMyTenants')({}));
        if (cancelled) return;
        const list = res?.data?.tenants || [];
        setTenants(list);

        // Auto-select if only one tenant, OR if the currently-stored
        // selection isn't in the user's accessible list (e.g. tenant
        // was revoked, or stale AsyncStorage value).
        const curId = getCurrentTenant();
        const hasCurrent = list.some(t => t.id === curId);
        if (list.length === 1) {
          await setCurrentTenant(list[0].id);
          setCurrent(list[0].id);
        } else if (list.length > 1 && !hasCurrent) {
          await setCurrentTenant(list[0].id);
          setCurrent(list[0].id);
        }
      } catch (e) {
        if (!cancelled) setError(e?.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    const unsub = onAuthStateChanged(auth, (user) => check(user));
    reloadRef.current = (opts) => check(auth.currentUser, { fresh: true, ...opts });
    return () => { cancelled = true; unsub(); };
  }, []);

  const reload = useCallback(() => reloadRef.current(), []);

  async function switchTo(tenantId) {
    if (!tenantId || tenantId === getCurrentTenant()) return;
    await setCurrentTenant(tenantId);
    setCurrent(tenantId);
  }

  return { tenants, loading, error, current, switchTo, reload };
}
