// Mobile copy of the web module catalog (src/lib/modules.js).
//
// The catalog + filtering logic below is a VERBATIM port of the web's
// pure module system — keep getVisibleModules / effectivePlan / plan
// gating identical so the mobile Manage grid hides exactly what the web
// home grid hides. Only the MOBILE_MODULE_META map at the bottom is
// mobile-specific (icon + nav target per module).

import { roleCan, roleExists } from './rbac';

export const PLAN_RANK = { starter: 0, studio: 1, pro: 2, enterprise: 3 };

// `cap` mirrors the web catalog — the capability a role must have to see the
// tile. getVisibleModules gates on it when the role is known (a nail tech /
// 'staff' has no reports/walkin cap, so those tiles hide); adminOnly is the
// legacy fallback for callers without a role.
export const MODULES = [
  // ── Starter ───────────────
  { id: 'schedule',    label: 'Schedule',         desc: 'Appointments & calendar',           plan: 'starter', adminOnly: false, cap: 'schedule'         },
  { id: 'clients',     label: 'Clients',          desc: 'Profiles & visit history',          plan: 'starter', adminOnly: false, cap: 'clients'          },
  { id: 'services',    label: 'Services',         desc: 'Menu & pricing',                    plan: 'starter', adminOnly: false, cap: 'services_edit'    },
  { id: 'employees',   label: 'Employees',        desc: 'Team & profiles',                   plan: 'starter', adminOnly: true,  cap: 'employees'        },
  { id: 'walkin',      label: 'Walk-in Manager',  desc: 'Turn rotation + waitlist',          plan: 'starter', adminOnly: false, cap: 'walkin'           },

  // ── Studio ─
  { id: 'reports',     label: 'Reports',          desc: 'Revenue & analytics + AI assistant', plan: 'studio',  adminOnly: false, cap: 'reports'         },
  { id: 'earnings',    label: 'Earnings',         desc: 'Tips, services & take-home',        plan: 'studio',  adminOnly: false, cap: 'earnings_own'     },
  { id: 'attendance',  label: 'Attendance',       desc: 'Clock-in / clock-out times',        plan: 'studio',  adminOnly: true,  cap: 'attendance'       },
  { id: 'giftcards',   label: 'Gift Cards',       desc: 'Gift cards & promo codes',          plan: 'studio',  adminOnly: true,  cap: 'giftcards_manage' },
  { id: 'meetings',    label: 'Meetings',         desc: 'Internal team meetings',            plan: 'studio',  adminOnly: true,  cap: 'meetings'         },
  { id: 'products',    label: 'Products',         desc: 'Retail inventory & stock',          plan: 'studio',  adminOnly: true,  cap: 'products_edit'    },

  // ── Pro ─
  { id: 'chat',        label: 'Communications',   desc: 'SMS, email & in-app messages',      plan: 'pro',     adminOnly: false, cap: 'chat'             },
  { id: 'marketing',   label: 'Marketing',        desc: 'Email campaigns & outreach',        plan: 'pro',     adminOnly: true,  cap: 'marketing'        },
  { id: 'hr',          label: 'HR',               desc: 'Payroll & compensation',            plan: 'pro',     adminOnly: true,  cap: 'hr'               },
  { id: 'memberships', label: 'Memberships',      desc: 'Recurring plans & members',         plan: 'pro',     adminOnly: true,  cap: 'memberships'      },
];

export function effectivePlan(settings) {
  const plan = settings?.plan || 'pro';
  const trialEndsAt = settings?.trialEndsAt;
  if (trialEndsAt && (plan === 'pro' || plan === 'studio')) {
    if (new Date(trialEndsAt).getTime() < Date.now()) return 'starter';
  }
  return plan;
}

export function isModuleAvailableForPlan(moduleOrId, plan) {
  const mod = typeof moduleOrId === 'string' ? MODULES.find(m => m.id === moduleOrId) : moduleOrId;
  if (!mod) return false;
  return PLAN_RANK[mod.plan] <= PLAN_RANK[plan];
}

export function isModuleEnabled(settings, moduleId) {
  return !(settings?.disabledModules || []).includes(moduleId);
}

// Plan gate + role gate + owner-disabled + per-tile hide. Pure — same as web.
export function getVisibleModules(settings, { isAdmin, role, hiddenTiles, customRoles } = {}) {
  const plan = effectivePlan(settings);
  const hidden = new Set(hiddenTiles || settings?.hiddenTiles || []);
  // isAdmin ALWAYS wins: an admin can be flagged admin (bootstrap email / coarse
  // 'admin') while their granular `role` from getMyTenantRole resolves to a
  // non-owner value — gating on that role alone would wrongly hide admin tiles.
  // Treat admins as owner (full caps); gate everyone else on their role's caps.
  const effRole = isAdmin ? 'owner' : role;
  const known = !!(effRole && roleExists(effRole, customRoles));
  return MODULES.filter(m => {
    if (known) { if (m.cap && !roleCan(effRole, m.cap, customRoles)) return false; }  // RBAC capability gate
    else if (m.adminOnly && !isAdmin) return false;                                   // legacy fallback (no/unknown role)
    if (!isModuleAvailableForPlan(m, plan)) return false;
    if (!isModuleEnabled(settings, m.id)) return false;
    if (hidden.has(m.id)) return false;
    return true;
  });
}

// ── Mobile-specific routing + icon per module ──────────────────────
// nav target:
//   { tab:   'X' } → switch to bottom tab X (modules that are already tabs)
//   { screen:'X' } → push screen X inside the Manage stack
//   { screen: null } → not yet built → ModulePlaceholder ("Coming soon")
export const MOBILE_MODULE_META = {
  schedule:    { icon: 'calendar',  tab: 'Schedule' },
  clients:     { icon: 'people',    tab: 'Clients' },
  earnings:    { icon: 'dollar',    tab: 'Earnings' },
  chat:        { icon: 'chat',      screen: 'ManageChat' },
  services:    { icon: 'scissors',  screen: 'Services' },
  products:    { icon: 'box',       screen: 'Products' },
  attendance:  { icon: 'clock',     screen: 'Attendance' },
  giftcards:   { icon: 'gift',      screen: 'GiftCards' },
  memberships: { icon: 'star',      screen: 'Memberships' },
  employees:   { icon: 'idcard',    screen: 'Employees' },
  walkin:      { icon: 'walk',      screen: 'Walkin' },
  meetings:    { icon: 'users',     screen: 'Meetings' },
  reports:     { icon: 'chart',     screen: 'Reports' },
  marketing:   { icon: 'megaphone', screen: 'Marketing' },
  hr:          { icon: 'briefcase', screen: 'HR' },
};

export function moduleMeta(id) {
  return MOBILE_MODULE_META[id] || { icon: 'grid', screen: null };
}
