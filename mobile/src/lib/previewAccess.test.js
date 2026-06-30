import { describe, it, expect } from 'vitest';
import { applyPreviewAccess, previewRoleLabel, PREVIEWABLE_BUILTIN_ROLES } from './previewAccess';

const ownerReal = { isAdmin: true,  role: 'admin',     canEditSchedule: true,  plan: 'pro', email: 'o@x.com' };
const staffReal = { isAdmin: false, role: 'tech',      canEditSchedule: true,  plan: 'pro', email: 's@x.com' };

describe('applyPreviewAccess', () => {
  it('no preview role → returns real access, augmented, not previewing', () => {
    const a = applyPreviewAccess(ownerReal, null);
    expect(a.isPreviewing).toBe(false);
    expect(a.isAdmin).toBe(true);
    expect(a.realIsAdmin).toBe(true);
    expect(a.caps).toContain('settings');      // owner has everything
    expect(typeof a.can).toBe('function');
    expect(a.can('hr')).toBe(true);
  });

  it('a non-admin can never enter preview (override ignored)', () => {
    const a = applyPreviewAccess(staffReal, 'owner');
    expect(a.isPreviewing).toBe(false);
    expect(a.isAdmin).toBe(false);
    expect(a.role).toBe('tech');
  });

  it('owner previewing STAFF → loses admin, gets staff caps, can still edit schedule', () => {
    const a = applyPreviewAccess(ownerReal, 'staff');
    expect(a.isPreviewing).toBe(true);
    expect(a.previewRole).toBe('staff');
    expect(a.isAdmin).toBe(false);              // grid hides admin-only tiles
    expect(a.realIsAdmin).toBe(true);           // banner/exit still know they're admin
    expect(a.can('pos')).toBe(true);
    expect(a.can('hr')).toBe(false);            // staff can't see HR
    expect(a.can('settings')).toBe(false);
    expect(a.canEditSchedule).toBe(true);       // staff edits own calendar
  });

  it('owner previewing READONLY → view-only, cannot edit schedule', () => {
    const a = applyPreviewAccess(ownerReal, 'readonly');
    expect(a.isPreviewing).toBe(true);
    expect(a.isAdmin).toBe(false);
    expect(a.can('reports')).toBe(true);        // readonly can view reports
    expect(a.can('pos')).toBe(false);
    expect(a.canEditSchedule).toBe(false);      // view-only
  });

  it('owner previewing OWNER → still admin (full preview = real)', () => {
    const a = applyPreviewAccess(ownerReal, 'owner');
    expect(a.isPreviewing).toBe(true);
    expect(a.isAdmin).toBe(true);
    expect(a.can('billing')).toBe(true);
  });

  it('owner previewing SCHEDULER → front-desk caps, edits all calendars', () => {
    const a = applyPreviewAccess(ownerReal, 'scheduler');
    expect(a.isAdmin).toBe(false);
    expect(a.can('giftcards_sell')).toBe(true);
    expect(a.can('reports')).toBe(false);       // scheduler has no reports
    expect(a.canEditSchedule).toBe(true);
  });

  it('honors a custom-role overlay for caps + label', () => {
    const overlay = { roles: [{ key: 'custom_leadtech', name: 'Lead Tech', caps: ['schedule', 'clients', 'reports'] }], overrides: {} };
    const a = applyPreviewAccess(ownerReal, 'custom_leadtech', overlay);
    expect(a.isPreviewing).toBe(true);
    expect(a.isAdmin).toBe(false);
    expect(a.can('reports')).toBe(true);
    expect(a.can('hr')).toBe(false);
    expect(a.canEditSchedule).toBe(true);       // has schedule cap, not readonly
    expect(a.previewLabel).toBe('Lead Tech');
  });

  it('preview is restrict-only: a previewed role never gains a cap the real admin lacks set semantics', () => {
    // owner has all caps, so any preview is a subset — sanity that staff ⊂ owner
    const owner = applyPreviewAccess(ownerReal, 'owner');
    const staff = applyPreviewAccess(ownerReal, 'staff');
    expect(staff.caps.every(c => owner.caps.includes(c))).toBe(true);
  });
});

describe('previewRoleLabel', () => {
  it('labels built-in roles', () => {
    expect(previewRoleLabel('staff')).toBe('Staff (tech)');
    expect(previewRoleLabel('owner')).toBe('Owner');
  });
  it('falls back to overlay name for custom roles, else the raw key', () => {
    const overlay = { roles: [{ key: 'custom_x', name: 'Floor Lead', caps: [] }] };
    expect(previewRoleLabel('custom_x', overlay)).toBe('Floor Lead');
    expect(previewRoleLabel('custom_unknown', overlay)).toBe('custom_unknown');
  });
});

describe('PREVIEWABLE_BUILTIN_ROLES', () => {
  it('offers the management roles and excludes kiosk', () => {
    expect(PREVIEWABLE_BUILTIN_ROLES).toContain('owner');
    expect(PREVIEWABLE_BUILTIN_ROLES).toContain('readonly');
    expect(PREVIEWABLE_BUILTIN_ROLES).not.toContain('kiosk');
  });
});
