// App-wide "Preview as [role]" — admin-only, client-side role impersonation.
//
// When set, useTenantAccess reports the previewed role + isAdmin:false, so the
// whole app re-renders as that role: it's how an owner sees exactly what a nail
// tech / scheduler / read-only user sees on the iPad. Mirrors the web viewAs.
//
// UI-ONLY: the Firebase auth token is unchanged, so the SERVER still enforces
// the admin's real permissions — preview only narrows what's shown, it can never
// grant or lose real access. Cleared on tenant switch (the caller re-mounts).
//
// Same tiny get/set/subscribe store shape as currentTenant.js so any component
// can react to preview changes.

let preview = null;              // { role, label } | null
const subscribers = new Set();

export function getPreviewAs() { return preview; }

export function setPreviewAs(next) {
  preview = next || null;
  subscribers.forEach(cb => { try { cb(preview); } catch (_) {} });
}

export function subscribePreviewAs(cb) {
  subscribers.add(cb);
  return () => subscribers.delete(cb);
}
