// "Preview as role" — pure access overlay for the admin role-preview tool.
//
// An owner/admin can preview the app AS another role to see exactly what that
// role sees (which tiles, screens, and actions appear). This is a VISUAL
// overlay ONLY: the server still authorizes every action by the real signed-in
// token, so a preview can only ever HIDE things the real admin could see —
// never grant access (see the "UI gates are not security boundaries" rule).
//
// Kept pure + dependency-light so it's unit-testable without rendering.
import { resolveRoleCaps, normalizeRole, isOwner, roleLabel } from './rbac';

// Roles offered in the picker. Kiosk is excluded — it's a locked device mode,
// not a management role. Custom roles are appended from the tenant overlay.
export const PREVIEWABLE_BUILTIN_ROLES = ['owner', 'manager', 'staff', 'scheduler', 'readonly'];

// caps[] → can(cap) predicate.
export function makeCan(caps) {
  const set = new Set(Array.isArray(caps) ? caps : []);
  return (cap) => set.has(cap);
}

// Human label for any previewable role, including custom_* keys from the overlay.
export function previewRoleLabel(role, overlay) {
  if (!role) return '';
  const builtin = roleLabel(role);
  if (builtin && builtin !== 'No access') return builtin;
  const custom = overlay && Array.isArray(overlay.roles)
    ? overlay.roles.find(r => r && r.key === String(role).toLowerCase())
    : null;
  return (custom && (custom.name || custom.label)) || String(role);
}

// Given the REAL resolved access (what the signed-in user actually has) and a
// preview role (or null), return the EFFECTIVE access used for UI gating.
//
// Always augments the access object with: realIsAdmin, realRole, caps, can(),
// isPreviewing, previewRole. When previewing (real admin + a preview role set),
// isAdmin / role / caps / can / canEditSchedule are swapped to the previewed
// role's. Anyone who is NOT a real admin, or with no preview role, gets their
// real access back unchanged (plus the augmented fields).
export function applyPreviewAccess(real, previewRole, overlay) {
  const realRole = real.role || (real.isAdmin ? 'owner' : null);
  const realCaps = resolveRoleCaps(realRole || '', overlay);
  const base = {
    ...real,
    realIsAdmin: !!real.isAdmin,
    realRole,
    caps: realCaps,
    can: makeCan(realCaps),
    isPreviewing: false,
    previewRole: null,
  };
  // Guard: only a real admin may preview. (A non-admin previewing could only
  // ever restrict further anyway, but we keep it owner-driven for clarity.)
  if (!previewRole || !real.isAdmin) return base;

  const caps = resolveRoleCaps(previewRole, overlay);
  const ownerPreview = isOwner(previewRole);
  const isReadonly = normalizeRole(previewRole) === 'readonly';
  // Mirror the web canEditSchedule rule: owner always; otherwise a role with the
  // schedule cap can edit unless it's the view-only readonly role.
  const canEditSchedule = ownerPreview || (caps.includes('schedule') && !isReadonly);
  return {
    ...base,
    isAdmin: ownerPreview,
    role: previewRole,
    caps,
    can: makeCan(caps),
    canEditSchedule,
    isPreviewing: true,
    previewRole,
    previewLabel: previewRoleLabel(previewRole, overlay),
  };
}
