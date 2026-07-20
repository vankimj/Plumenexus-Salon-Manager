import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, callFn, ALLOWED_EMAILS } from '../lib/firebase';
import { getCurrentTenant, subscribeTenant } from '../lib/currentTenant';
import { dedupe } from '../lib/inflight';
import useMyTenants from './useMyTenants';
import { getPreviewAs, subscribePreviewAs } from '../lib/previewAs';

// Resolves the signed-in user's access in the CURRENT tenant — the
// mobile equivalent of the web AppContext role flags
// (src/context/AppContext.jsx:616-631).
//
// Two sources, combined:
//   - useMyTenants() → coarse per-tenant role ('admin' | 'staff') + plan.
//   - getMyTenantRole callable → granular role ('admin' | 'readonly' |
//     'tech' | 'scheduler'), techName, scheduleAccess ('edit' | 'view').
//
// Returns:
//   { isAdmin, role, techName, scheduleAccess, plan, canEditSchedule,
//     email, loading }
//
// canEditSchedule mirrors the web's canEditSchedule rule predicate — an
// admin always can; a tech/scheduler can unless they're view-only. This
// gates the appointment Delete button (and the rules enforce the same).
export default function useTenantAccess() {
  const { tenants, current } = useMyTenants();
  const [granular, setGranular] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [kiosk,    setKiosk]    = useState(null);   // { tenantId, kioskId } | null
  const [preview,  setPreview]  = useState(getPreviewAs());   // admin "Preview as [role]"
  useEffect(() => subscribePreviewAs(setPreview), []);

  useEffect(() => {
    let cancelled = false;
    async function refetch() {
      const user = auth.currentUser;
      // A dedicated kiosk identity has NO email (custom token). Detect its claim
      // so the app renders the kiosk instead of treating it as "no access", and
      // skip getMyTenantRole (it has no staff role on purpose).
      if (user) {
        try {
          const r = await user.getIdTokenResult();
          if (!cancelled) setKiosk(r.claims?.kiosk === true ? { tenantId: r.claims.tenantId || null, kioskId: r.claims.kioskId || null } : null);
        } catch { if (!cancelled) setKiosk(null); }
      } else if (!cancelled) setKiosk(null);

      if (!user?.email) { setGranular(null); setLoading(false); return; }
      setLoading(true);
      try {
        const tid = getCurrentTenant();
        // Collapse the concurrent burst when several mounted components each
        // resolve access at once — they share one getMyTenantRole call.
        const res = await dedupe(`role:${tid}:${user.email.toLowerCase()}`, () => callFn('getMyTenantRole')({ tenantId: tid }));
        if (!cancelled) setGranular(res?.data || null);
      } catch {
        if (!cancelled) setGranular(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    const unsubAuth   = onAuthStateChanged(auth, () => refetch());
    const unsubTenant = subscribeTenant(() => refetch());
    return () => { cancelled = true; unsubAuth(); unsubTenant(); };
  }, []);

  const email   = (auth.currentUser?.email || '').toLowerCase();
  const coarse  = tenants.find(t => t.id === current);
  const realRole    = granular?.role || null;
  const realIsAdmin =
    realRole === 'admin' ||
    coarse?.role === 'admin' ||
    ALLOWED_EMAILS.includes(email);
  const realTechName   = granular?.techName || null;
  const scheduleAccess = granular?.scheduleAccess || 'edit';
  const plan           = coarse?.plan || null;

  // "Preview as [role]" (admin-only, client-side): when a real admin has picked
  // a role to preview, report THAT role + isAdmin:false so the whole app renders
  // as that role. Ignored for non-admins (defensive). Server enforces real perms.
  const previewing = realIsAdmin ? preview : null;
  const role     = previewing ? previewing.role : realRole;
  const isAdmin  = previewing ? false : realIsAdmin;
  const techName = previewing ? (previewing.techName || realTechName) : realTechName;
  const canEditSchedule = previewing
    ? previewing.role !== 'readonly'
    : (realIsAdmin || ((realRole === 'tech' || realRole === 'scheduler') && scheduleAccess !== 'view'));

  return {
    isAdmin, role, techName, scheduleAccess, plan, canEditSchedule, email, loading,
    isKioskSession: !!kiosk, kiosk,
    realIsAdmin, previewAs: previewing,
  };
}
