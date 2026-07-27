import { describe, it, expect } from 'vitest';
import { getVisibleModules } from './modules';

// pro plan → every tile is plan-available, so we isolate ROLE gating.
const settings = { plan: 'pro' };
const ids = (opts) => getVisibleModules(settings, opts).map(m => m.id);

describe('getVisibleModules — mobile role gating', () => {
  it('a nail tech (staff) does NOT see reports or walk-in', () => {
    const v = ids({ role: 'staff' });
    expect(v).not.toContain('reports');
    expect(v).not.toContain('walkin');
    // …but keeps their own tiles (services needs services_edit → hidden, same as web)
    expect(v).toEqual(expect.arrayContaining(['schedule', 'clients', 'earnings', 'chat']));
    expect(v).not.toContain('services');
  });

  it("the 'tech' alias resolves to staff — same gating", () => {
    expect(ids({ role: 'tech' })).not.toContain('reports');
    expect(ids({ role: 'tech' })).not.toContain('walkin');
  });

  it('an owner/admin sees reports + walk-in', () => {
    const v = ids({ role: 'owner' });
    expect(v).toEqual(expect.arrayContaining(['reports', 'walkin', 'hr', 'marketing']));
  });

  it('REGRESSION: isAdmin ALWAYS wins over a non-owner granular role', () => {
    // The bug: an admin whose getMyTenantRole role resolved to 'staff' lost
    // Reports/Walk-in. isAdmin must override the cap gate and show everything.
    for (const role of ['staff', 'scheduler', null, undefined, 'admin']) {
      const v = ids({ isAdmin: true, role });
      expect(v).toEqual(expect.arrayContaining(['reports', 'walkin', 'employees', 'hr', 'marketing']));
    }
  });

  it('a scheduler sees walk-in but NOT reports', () => {
    const v = ids({ role: 'scheduler' });
    expect(v).toContain('walkin');
    expect(v).not.toContain('reports');
  });

  it('no/unknown role → legacy adminOnly fallback (non-admin hides adminOnly tiles only)', () => {
    const v = ids({ isAdmin: false });
    expect(v).not.toContain('employees');   // adminOnly:true
    expect(v).toContain('reports');          // adminOnly:false → still shown without a role
  });
});

describe('getVisibleModules — demo visitor (server caps)', () => {
  // The demo 'visitor' pseudo-role isn't in the rbac matrix, so `known` is
  // false. Before the fix it fell to the adminOnly fallback and showed the
  // wrong tiles. With server-resolved caps it must show EXACTLY the read-only
  // showcase and NONE of the write-only tiles that error for a read-only user.
  const VISITOR_CAPS = ['schedule', 'schedule_all', 'clients', 'reports', 'earnings_all', 'employees', 'memberships', 'meetings', 'programs', 'store'];
  const vis = getVisibleModules({ plan: 'pro' }, { isAdmin: false, role: 'visitor', caps: VISITOR_CAPS }).map(m => m.id);

  it('shows the intended read-only tiles', () => {
    expect(vis).toEqual(expect.arrayContaining(['schedule', 'clients', 'reports', 'employees', 'meetings', 'memberships']));
  });
  it('hides every write-oriented tile a visitor would only error on', () => {
    for (const id of ['services', 'walkin', 'chat', 'marketing', 'hr', 'giftcards', 'products', 'attendance', 'earnings']) {
      expect(vis).not.toContain(id);
    }
  });
  it('without caps, an unknown role still uses the legacy adminOnly fallback', () => {
    const v = getVisibleModules({ plan: 'pro' }, { isAdmin: false, role: 'visitor' }).map(m => m.id);
    expect(v).toContain('schedule'); // non-adminOnly tiles still show (unchanged legacy behavior)
    expect(v).not.toContain('employees'); // adminOnly hidden
  });
});
