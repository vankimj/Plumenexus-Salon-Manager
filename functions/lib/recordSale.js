// Pure builders for the recordSale callable — server-side receipt/appt/split
// construction with NO Firestore or Stripe, so the payroll-critical logic
// (tech-split derivation, receipt shape, expected charge) is unit-testable in
// isolation. The callable in index.js does auth + Stripe PI verification +
// idempotency + the actual writes; all the money math lives here.
//
// Design (why it can't break live checkout): the total is NOT re-derived — it's
// taken from the client's payment.total (the amount actually charged to Stripe)
// and only VERIFIED against the PaymentIntent capture in the callable. So there
// is no recompute that could diverge by a cent and reject a legit sale. The one
// thing we override is `techSplit`: re-derived server-side from the line items
// (with the client-provided tipByTech, so a legit split matches exactly) — a
// tech can't hand-author a split crediting themselves.
const { buildTechSplit } = require('./kioskSale');

function sanitizeLines(lines) {
  return (Array.isArray(lines) ? lines : []).map(l => ({
    name: String(l?.name || '—').slice(0, 200),
    price: Math.max(0, Number(l?.price) || 0),
    techName: String(l?.techName || '').slice(0, 120),
    taxable: l?.taxable !== false,
  }));
}

// input: { saleId, method, lines[], products[], appts[], payment{}, tipByTech,
//          cashTendered, paidBy, client fields, date, startTime, walkIn,
//          locationId, nowIso }
// returns { payment, receipt, apptUpdates, expectedChargeCents, changeDue }.
function buildSaleRecords(input) {
  const {
    saleId, method = 'cash', lines: rawLines = [], products = [], appts = [],
    payment: pIn = {}, tipByTech = null, cashTendered = null, paidBy = 'staff',
    clientId = null, clientName = null, clientPhone = null, clientEmail = null,
    date = null, startTime = null, walkIn = false, locationId = null, nowIso,
  } = input || {};

  const lines = sanitizeLines(rawLines);
  const total = Math.max(0, Number(pIn.total) || 0);
  const tipAmt = Math.max(0, Number(pIn.tip) || 0);
  const sp = buildTechSplit(lines, tipAmt, tipByTech);   // server-derived split
  const retailProducts = (products || []).length > 0
    ? products.map(it => ({
        id: it?.product?.id || it?.id || null,
        name: it?.product?.name || it?.name || '—',
        price: Number(it?.product?.price ?? it?.price) || 0,
        qty: Number(it?.qty) || 1,
      }))
    : null;
  const changeDue = (method === 'cash' && cashTendered != null) ? Math.max(0, Number(cashTendered) - total) : null;
  const apptIds = (appts || []).map(a => a?.id).filter(Boolean);

  const payment = {
    ...pIn,
    total,
    tip: tipAmt,
    method: method === 'card' ? 'card' : 'cash',
    techSplit: sp,               // OVERRIDES any client-supplied split
    retailProducts,
    apptIds,
    ...(cashTendered != null ? { cashTendered: Number(cashTendered), changeDue } : {}),
    paidAt: nowIso,
    paidBy,
  };

  const clientNames = Array.from(new Set((appts || []).map(a => a?.clientName || null).filter(Boolean)));
  const primaryAppt = (appts || [])[0] || null;
  const receipt = {
    sent: false,
    clientId: clientId || primaryAppt?.clientId || null,
    clientName: clientName || clientNames.join(' + ') || 'Walk-in',
    clientPhone: clientPhone || primaryAppt?.clientPhone || null,
    clientEmail: clientEmail || null,
    viewToken: saleId,
    techName: sp ? sp.map(s => s.techName).join(', ') : (lines[0]?.techName || ''),
    date: date || primaryAppt?.date || (nowIso || '').slice(0, 10),
    startTime: startTime || primaryAppt?.startTime || '',
    services: lines.map(l => ({ name: l.name, price: l.price, techName: l.techName })),
    retailProducts,
    walkIn: !!walkIn,
    ...(locationId ? { locationId } : {}),
    payment,
    apptIds,
    createdAt: nowIso,
  };

  const apptUpdates = (appts || []).filter(a => a?.id).map(a => ({
    id: a.id,
    apptSubtotal: (a.services || []).reduce((s, x) => s + (Number(x?.price) || 0), 0),
  }));

  return { payment, receipt, apptUpdates, expectedChargeCents: Math.round(total * 100), changeDue };
}

// The Stripe-capture gate as a pure decision (unit-testable without the SDK):
// a card sale must have a succeeded PI for THIS tenant whose captured cents match
// the recorded total within 2c. Returns { ok, reason }.
function verifyCapture({ method, pi, tenantId, expectedChargeCents }) {
  if (method !== 'card') return { ok: true };
  if (!pi) return { ok: false, reason: 'no_payment_intent' };
  if (pi.status !== 'succeeded') return { ok: false, reason: `not_captured:${pi.status}` };
  if ((pi.metadata?.tenantId || '') !== tenantId) return { ok: false, reason: 'wrong_tenant' };
  const got = pi.amount_received || pi.amount || 0;
  if (Math.abs(got - expectedChargeCents) > 2) return { ok: false, reason: `amount_mismatch:${got}!=${expectedChargeCents}` };
  return { ok: true };
}

module.exports = { buildSaleRecords, sanitizeLines, verifyCapture };
