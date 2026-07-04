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
