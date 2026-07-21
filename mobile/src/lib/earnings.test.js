import { describe, it, expect } from 'vitest';
import { computeTechSlice } from './earnings';

// Regression suite for the Dashboard "SERVICES 1" undercount bug: services must
// be counted from receipts (per-tech via line techName) exactly like revenue,
// so all four tiles agree — not from a separate appointments filter that missed
// walk-ins and multi-tech splits.

const YAS = 'Yasmin D';

describe('computeTechSlice — services tile', () => {
  it('counts a single-tech receipt with multiple service lines', () => {
    const receipts = [{
      date: '2026-07-13', clientId: 'c1', techName: YAS,
      payment: { techSplit: [{ techName: YAS, revenue: 120, tip: 20 }] },
      services: [
        { name: 'Gel Manicure', price: 45, techName: YAS },
        { name: 'Spa Pedicure', price: 75, techName: YAS },
      ],
    }];
    const r = computeTechSlice(receipts, YAS);
    expect(r.serviceCount).toBe(2);
    expect(r.revenue).toBe(120);
    expect(r.clientCount).toBe(1);
  });

  it('counts walk-in receipts that have no linked appointment (the original bug)', () => {
    // Walk-in: clientId '', no appointment — the old appointments-based count
    // skipped these entirely, collapsing the tile toward 1.
    const receipts = [
      { date: '2026-07-13', clientId: '', clientName: 'Walk-in', techName: YAS,
        payment: { techSplit: [{ techName: YAS, revenue: 50 }] },
        services: [{ name: 'Polish Change', price: 50, techName: YAS }] },
      { date: '2026-07-13', clientId: '', clientName: 'Walk-in', techName: YAS,
        payment: { techSplit: [{ techName: YAS, revenue: 60 }] },
        services: [{ name: 'Dip Powder', price: 60, techName: YAS }] },
    ];
    const r = computeTechSlice(receipts, YAS);
    expect(r.serviceCount).toBe(2);
  });

  it('attributes each line of a MULTI-TECH split to exactly one tech (no double count)', () => {
    const receipts = [{
      date: '2026-07-13', clientId: 'c9', techName: `${YAS}, Alex Rivers`,
      payment: { techSplit: [
        { techName: YAS, revenue: 45 },
        { techName: 'Alex Rivers', revenue: 75 },
      ] },
      services: [
        { name: 'Gel Manicure', price: 45, techName: YAS },
        { name: 'Gel-X Extensions', price: 75, techName: 'Alex Rivers' },
      ],
    }];
    expect(computeTechSlice(receipts, YAS).serviceCount).toBe(1);
    expect(computeTechSlice(receipts, 'Alex Rivers').serviceCount).toBe(1);
  });

  it('does NOT dedupe repeated service names', () => {
    const receipts = [{
      date: '2026-07-13', clientId: 'c2', techName: YAS,
      payment: { techSplit: [{ techName: YAS, revenue: 90 }] },
      services: [
        { name: 'Gel Manicure', price: 45, techName: YAS },
        { name: 'Gel Manicure', price: 45, techName: YAS },
      ],
    }];
    const r = computeTechSlice(receipts, YAS);
    expect(r.serviceCount).toBe(2);
    expect(r.serviceList).toEqual([{ name: 'Gel Manicure', count: 2, revenue: 90 }]);
  });

  it('falls back to receipt techName when a line omits techName', () => {
    const receipts = [{
      date: '2026-07-13', clientId: 'c3', techName: YAS,
      payment: { techSplit: [{ techName: YAS, revenue: 45 }] },
      services: [{ name: 'Gel Manicure', price: 45 }],
    }];
    expect(computeTechSlice(receipts, YAS).serviceCount).toBe(1);
  });

  it('excludes refunds/voids from the service count (no negative services)', () => {
    const receipts = [
      { date: '2026-07-13', clientId: 'c4', techName: YAS,
        payment: { techSplit: [{ techName: YAS, revenue: 45 }] },
        services: [{ name: 'Gel Manicure', price: 45, techName: YAS }] },
      { date: '2026-07-13', clientId: 'c4', techName: YAS, transactionType: 'void',
        payment: { techSplit: [{ techName: YAS, revenue: 45 }] },
        services: [{ name: 'Gel Manicure', price: 45, techName: YAS }] },
    ];
    const r = computeTechSlice(receipts, YAS);
    expect(r.serviceCount).toBe(1);
  });

  it('keeps revenue and services consistent across a mixed week', () => {
    const receipts = [
      { date: '2026-07-13', clientId: 'c5', techName: YAS,
        payment: { techSplit: [{ techName: YAS, revenue: 45, tip: 10 }] },
        services: [{ name: 'Gel Manicure', price: 45, techName: YAS }] },
      { date: '2026-07-14', clientId: '', clientName: 'Walk-in', techName: YAS,
        payment: { techSplit: [{ techName: YAS, revenue: 75, tip: 15 }] },
        services: [{ name: 'Dip Powder', price: 75, techName: YAS }] },
      { date: '2026-07-15', clientId: 'c6', techName: 'Someone Else',
        payment: { techSplit: [{ techName: 'Someone Else', revenue: 99 }] },
        services: [{ name: 'Acrylic Full Set', price: 99, techName: 'Someone Else' }] },
    ];
    const r = computeTechSlice(receipts, YAS);
    expect(r.revenue).toBe(120);
    expect(r.tips).toBe(25);
    expect(r.serviceCount).toBe(2);
    // Only c5 counts: the walk-in has clientId '' (excluded, like the CLIENTS
    // tile), and the third receipt belongs to another tech.
    expect(r.clientCount).toBe(1);
  });
});
