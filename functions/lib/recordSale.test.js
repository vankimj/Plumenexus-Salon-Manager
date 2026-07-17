import { describe, it, expect } from 'vitest';
import { buildSaleRecords, verifyCapture, sanitizeLines } from './recordSale.js';

const NOW = '2026-07-08T12:00:00.000Z';
const base = (over = {}) => ({
  saleId: 'sale_1',
  method: 'card',
  lines: [{ name: 'Gel Mani', price: 50, techName: 'Yara', taxable: true }],
  appts: [{ id: 'a1', clientId: 'c1', clientName: 'Ann', clientPhone: '+1614', date: '2026-07-08', startTime: '10:00', services: [{ price: 50 }] }],
  payment: { total: 55, tip: 5, subtotal: 50, techSplit: [{ techName: 'HACKER', revenue: 9999 }] },
  paidBy: 'yara@x.com',
  nowIso: NOW,
  ...over,
});

describe('buildSaleRecords', () => {
  it('single tech → techSplit null (no split needed)', () => {
    const { payment, receipt } = buildSaleRecords(base());
    expect(payment.techSplit).toBeNull();
    expect(receipt.techName).toBe('Yara');
    expect(receipt.services).toEqual([{ name: 'Gel Mani', price: 50, techName: 'Yara' }]);
  });

  it('OVERRIDES a forged client techSplit with the server-derived one', () => {
    // client tried to credit "HACKER" 9999 — server ignores it entirely.
    const { payment } = buildSaleRecords(base({
      lines: [
        { name: 'Mani', price: 40, techName: 'Yara' },
        { name: 'Pedi', price: 60, techName: 'Sam' },
      ],
      payment: { total: 100, tip: 0, techSplit: [{ techName: 'HACKER', revenue: 9999, tip: 9999 }] },
    }));
    expect(payment.techSplit).not.toBeNull();
    const byTech = Object.fromEntries(payment.techSplit.map(s => [s.techName, s.revenue]));
    expect(byTech).toEqual({ Yara: 40, Sam: 60 });   // derived from lines, not client
    expect(payment.techSplit.find(s => s.techName === 'HACKER')).toBeUndefined();
  });

  it('multi-tech split honors client tipByTech exactly (matches legit client math)', () => {
    const { payment } = buildSaleRecords(base({
      lines: [
        { name: 'Mani', price: 40, techName: 'Yara' },
        { name: 'Pedi', price: 60, techName: 'Sam' },
      ],
      payment: { total: 120, tip: 20 },
      tipByTech: [{ techName: 'Yara', amount: 8 }, { techName: 'Sam', amount: 12 }],
    }));
    const tips = Object.fromEntries(payment.techSplit.map(s => [s.techName, s.tip]));
    expect(tips).toEqual({ Yara: 8, Sam: 12 });
  });

  it('total is taken from payment.total (never re-derived) → expectedChargeCents matches', () => {
    const { expectedChargeCents, payment } = buildSaleRecords(base({ payment: { total: 55.55, tip: 5 } }));
    expect(payment.total).toBe(55.55);
    expect(expectedChargeCents).toBe(5555);
  });

  it('cash change = tendered − total', () => {
    const { changeDue, payment } = buildSaleRecords(base({ method: 'cash', cashTendered: 60, payment: { total: 55, tip: 0 } }));
    expect(changeDue).toBe(5);
    expect(payment.cashTendered).toBe(60);
    expect(payment.changeDue).toBe(5);
  });

  it('receipt carries the payroll-critical fields + apptIds + viewToken', () => {
    const { receipt } = buildSaleRecords(base());
    expect(receipt.viewToken).toBe('sale_1');
    expect(receipt.apptIds).toEqual(['a1']);
    expect(receipt.clientName).toBe('Ann');
    expect(receipt.payment.paidBy).toBe('yara@x.com');
    expect(receipt.sent).toBe(false);
    expect(receipt.createdAt).toBe(NOW);
  });

  it('apptUpdates carry each appt id + its service subtotal', () => {
    const { apptUpdates } = buildSaleRecords(base({
      appts: [{ id: 'a1', services: [{ price: 30 }, { price: 20 }] }, { id: 'a2', services: [{ price: 10 }] }, { clientName: 'no-id' }],
    }));
    expect(apptUpdates).toEqual([{ id: 'a1', apptSubtotal: 50 }, { id: 'a2', apptSubtotal: 10 }]);
  });

  it('sanitizes hostile line input (negative price, long strings, missing fields)', () => {
    const lines = sanitizeLines([{ name: 'x'.repeat(500), price: -5, techName: 'y'.repeat(500) }, {}]);
    expect(lines[0].price).toBe(0);
    expect(lines[0].name.length).toBe(200);
    expect(lines[0].techName.length).toBe(120);
    expect(lines[1]).toEqual({ name: '—', price: 0, techName: '', taxable: true });
  });

  it('walk-in with no client falls back to "Walk-in"', () => {
    const { receipt } = buildSaleRecords(base({ appts: [{ id: 'a1' }], clientName: null }));
    expect(receipt.clientName).toBe('Walk-in');
  });
});

describe('verifyCapture (the anti-fraud card gate)', () => {
  const pi = (over) => ({ status: 'succeeded', metadata: { tenantId: 'merakinailstudio' }, amount_received: 5555, ...over });
  it('cash never needs a capture', () => {
    expect(verifyCapture({ method: 'cash', tenantId: 'merakinailstudio', expectedChargeCents: 5555 }).ok).toBe(true);
  });
  it('accepts a succeeded PI for this tenant with matching cents (±2)', () => {
    expect(verifyCapture({ method: 'card', pi: pi({ amount_received: 5556 }), tenantId: 'merakinailstudio', expectedChargeCents: 5555 }).ok).toBe(true);
  });
  it('rejects a not-yet-captured PI', () => {
    const r = verifyCapture({ method: 'card', pi: pi({ status: 'requires_capture' }), tenantId: 'merakinailstudio', expectedChargeCents: 5555 });
    expect(r.ok).toBe(false); expect(r.reason).toContain('not_captured');
  });
  it("rejects another tenant's PI (can't record someone else's charge)", () => {
    const r = verifyCapture({ method: 'card', pi: pi({ metadata: { tenantId: 'other' } }), tenantId: 'merakinailstudio', expectedChargeCents: 5555 });
    expect(r.ok).toBe(false); expect(r.reason).toBe('wrong_tenant');
  });
  it('rejects when captured cents ≠ recorded total (the payroll-inflation block)', () => {
    // tech recorded $500 but only captured $50 → rejected.
    const r = verifyCapture({ method: 'card', pi: pi({ amount_received: 5000 }), tenantId: 'merakinailstudio', expectedChargeCents: 50000 });
    expect(r.ok).toBe(false); expect(r.reason).toContain('amount_mismatch');
  });
  it('rejects a missing PI on a card sale', () => {
    expect(verifyCapture({ method: 'card', pi: null, tenantId: 'merakinailstudio', expectedChargeCents: 5555 }).ok).toBe(false);
  });
});
