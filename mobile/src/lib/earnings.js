// Pure earnings math for a single tech, extracted from EarningsPanel so it is
// unit-testable. Everything is receipt-driven (payment.techSplit for per-tech
// attribution) so all four Dashboard tiles — revenue, tips, services, clients —
// share one data source and one attribution model.

export function computeTechSlice(receipts, techName) {
  let revenue = 0, tips = 0, serviceCount = 0;
  const clientIds = new Set(), tipEntries = [], redoEntries = [], services = {}, byDay = {};
  receipts.forEach(r => {
    const p = r.payment || {};
    const refundList = Array.isArray(r.refunds) ? r.refunds : (r.refund ? [r.refund] : []);
    const structured = refundList.length > 0;
    const legacyNeg = !structured && (r.transactionType === 'refund' || r.transactionType === 'void' || r.transactionType === 'cancellation');
    const sign = legacyNeg ? -1 : 1;
    let rTake = 0, myRev = 0, totalRev = 0;
    if (p.techSplit && p.techSplit.length) {
      p.techSplit.forEach(s => { totalRev += Number(s.revenue) || 0; });
      p.techSplit.forEach(s => {
        if (s.techName !== techName) return;
        myRev += Number(s.revenue) || 0;
        const rev = sign * (Number(s.revenue) || 0); const tip = sign * (Number(s.tip) || 0);
        revenue += rev; tips += tip; rTake += rev + tip;
        if (s.tip && !legacyNeg) tipEntries.push({ date: r.date, amount: Number(s.tip), clientName: r.clientName || 'Walk-in' });
      });
    } else if (r.techName === techName) {
      const baseRev = Number(p.subtotal) || ((r.services || []).reduce((s, sv) => s + (Number(sv.price) || 0), 0));
      myRev = baseRev; totalRev = baseRev;
      const rev = sign * baseRev; const tip = sign * (Number(p.tip) || 0);
      revenue += rev; tips += tip; rTake += rev + tip;
      if (p.tip && !legacyNeg) tipEntries.push({ date: r.date, amount: Number(p.tip), clientName: r.clientName || 'Walk-in' });
    }
    if (structured && myRev > 0 && totalRev > 0) {
      refundList.forEach(rf => {
        const treat = (rf.commissionByTech && rf.commissionByTech[techName]) || 'withhold';
        if (treat === 'withhold') { const dock = (myRev / totalRev) * (Number(rf.amount) || 0); revenue -= dock; rTake -= dock; }
      });
    }
    // Redo transfer: the original tech loses the redone service's revenue; the
    // redo tech gains it. Captured as audit lines so the tech sees why pay moved.
    (Array.isArray(r.redos) ? r.redos : []).forEach(rd => {
      (rd.services || []).forEach(it => {
        if (it.fromTech === techName) { const d = Number(it.amount) || 0; revenue -= d; rTake -= d; redoEntries.push({ date: rd.redoneAt || r.date, dir: 'out', amount: d, label: it.name, other: rd.toTech, reason: rd.reason, client: r.clientName || 'Walk-in' }); }
      });
      if (rd.toTech === techName) { const d = Number(rd.amount) || 0; revenue += d; rTake += d; redoEntries.push({ date: rd.redoneAt || r.date, dir: 'in', amount: d, label: (rd.services || []).map(s => s.name).join(', '), other: [...new Set((rd.services || []).map(s => s.fromTech).filter(Boolean))].join(', '), reason: rd.reason, client: r.clientName || 'Walk-in' }); }
    });
    if (rTake !== 0 && r.date) byDay[r.date] = (byDay[r.date] || 0) + rTake;
    if (r.clientId && !legacyNeg && (r.techName === techName || (p.techSplit || []).some(s => s.techName === techName))) clientIds.add(r.clientId);
    // Services: count receipt line items attributed to THIS tech — same
    // receipt+techSplit source as revenue, so the four tiles stay consistent.
    // (Previously counted from `appointments` filtered by appt.techName+status,
    // which missed walk-ins, multi-tech splits, and receipt-only sales → showed 1.)
    if (!legacyNeg) {
      (r.services || []).forEach(sv => {
        if ((sv.techName || r.techName || '') !== techName) return;
        const name = sv.name || 'Service';
        if (!services[name]) services[name] = { count: 0, revenue: 0 };
        services[name].count += 1; services[name].revenue += Number(sv.price) || 0; serviceCount += 1;
      });
    }
  });
  tipEntries.sort((a, b) => `${b.date}`.localeCompare(`${a.date}`));
  redoEntries.sort((a, b) => `${b.date}`.localeCompare(`${a.date}`));
  const serviceList = Object.entries(services).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.count - a.count);
  return { revenue, tips, serviceCount, clientCount: clientIds.size, tipEntries, redoEntries, serviceList, byDay };
}
