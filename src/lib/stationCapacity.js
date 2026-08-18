// Station-capacity helpers. A salon has a fixed number of manicure and
// pedicure stations; booking must not admit more concurrent mani (or pedi)
// appointments than there are stations. Pure — unit-tested in
// stationCapacity.test.js. Server mirror: functions/lib/stationCapacity.cjs
// (keep the classification + concurrency logic in sync).
//
// Config lives on data/bookingConfig: { manicureStations, pedicureStations,
// stationWaitToleranceMin }. 0 / unset stations = unlimited (feature off) so
// unconfigured tenants behave exactly as before.

// Which station a service occupies: 'M' (manicure), 'P' (pedicure), or null
// (no station constraint — waxing, brows, unknown custom categories). Category
// wins over name so "Toe Polish Change" under Pedicures classifies right even
// if the name doesn't say "pedi".
export function stationTypeForService(svc) {
  if (!svc) return null;
  const cat = String(svc.category || '').toLowerCase();
  if (/pedi/.test(cat)) return 'P';
  if (/mani/.test(cat)) return 'M';
  const name = String(svc.name || '').toLowerCase();
  if (/pedi/.test(name)) return 'P';
  if (/mani/.test(name)) return 'M';
  return null;
}

// Station usage of a whole appointment: '' | 'M' | 'P' | 'MP'. The online
// multi-lane flow writes `lane` per appointment — trust it (accurate windows);
// otherwise scan the service lines. An appointment with both mani + pedi lines
// (admin-created combo) conservatively occupies BOTH stations for its whole
// duration.
export function apptStationUse(appt) {
  if (!appt) return '';
  if (appt.lane === 'Manicures') return 'M';
  if (appt.lane === 'Pedicures') return 'P';
  let m = false, p = false;
  for (const sv of (appt.services || [])) {
    const t = stationTypeForService(sv);
    if (t === 'M') m = true;
    else if (t === 'P') p = true;
  }
  return (m ? 'M' : '') + (p ? 'P' : '');
}

// Max number of intervals ([{s,e}] minutes, half-open) simultaneously live at
// any instant inside [start, end). Sweep line; ends release before starts at
// the same instant (back-to-back is not overlap — matches isTechFreeAt).
export function maxConcurrent(intervals, start, end) {
  const events = [];
  for (const iv of (intervals || [])) {
    const s = Math.max(iv.s, start);
    const e = Math.min(iv.e, end);
    if (s < e) { events.push([s, 1]); events.push([e, -1]); }
  }
  events.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let cur = 0, max = 0;
  for (const [, d] of events) { cur += d; if (cur > max) max = cur; }
  return max;
}

// Normalize the bookingConfig station fields. 0/unset → Infinity (unlimited).
export function stationCaps(cfg) {
  const n = (v) => { const x = Number(v); return x > 0 ? Math.floor(x) : Infinity; };
  const w = Number(cfg?.stationWaitToleranceMin);
  return {
    M: n(cfg?.manicureStations),
    P: n(cfg?.pedicureStations),
    waitTol: Number.isFinite(w) && w >= 0 ? Math.floor(w) : 15,
  };
}

// Would adding ONE more appointment of `dur` minutes at `start` overflow the
// station? `busy` = existing intervals on that station type. cap Infinity →
// always fits.
export function stationFits(busy, start, dur, cap) {
  if (!(cap < Infinity)) return true;
  return maxConcurrent(busy, start, start + dur) + 1 <= cap;
}

// The juggle. For a cart holding BOTH a manicure and a pedicure, find an
// arrangement of the two lanes anchored at `slot` that both the techs and the
// stations can absorb. Tries, in order of client convenience:
//   preferred shape → swapped order → growing wait gaps (step minutes, up to
//   waitTol) in both orders.
// `canPlace(type, start, dur)` must verify BOTH tech availability and station
// capacity for that lane window (caller closes over its own data). `maxEnd`
// (optional) rejects arrangements running past the booking window.
// Returns { maniStart, pediStart, gap, order } or null.
export function arrangeLanes({ slot, maniDur, pediDur, shape, waitTol = 15, step = 5, canPlace, maxEnd }) {
  const candidates = [];
  const push = (maniStart, pediStart, gap, order) => candidates.push({ maniStart, pediStart, gap, order });

  if (shape === 'simultaneous') {
    push(slot, slot, 0, 'simultaneous');
    push(slot, slot + maniDur, 0, 'mani-first');
    push(slot + pediDur, slot, 0, 'pedi-first');
  } else {
    push(slot, slot + maniDur, 0, 'mani-first');
    push(slot + pediDur, slot, 0, 'pedi-first');
  }
  for (let g = step; g <= waitTol; g += step) {
    push(slot, slot + maniDur + g, g, 'mani-first');
    push(slot + pediDur + g, slot, g, 'pedi-first');
  }

  for (const c of candidates) {
    if (maxEnd != null && Math.max(c.maniStart + maniDur, c.pediStart + pediDur) > maxEnd) continue;
    if (canPlace('M', c.maniStart, maniDur) && canPlace('P', c.pediStart, pediDur)) return c;
  }
  return null;
}

// Build per-station busy interval lists from a day's appointments. Each appt
// needs { startTime:'HH:mm', duration, st? } — st is the server-computed
// station-use tag ('M'|'P'|'MP') on the public availability feed; fall back to
// deriving from the full doc when absent (admin surfaces).
export function stationIntervals(appts) {
  const M = [], P = [];
  for (const a of (appts || [])) {
    if (a.status === 'cancelled' || a.status === 'no_show') continue;
    const use = a.st != null ? a.st : apptStationUse(a);
    if (!use) continue;
    const [h, m] = String(a.startTime || '0:0').split(':').map(Number);
    const s = (h || 0) * 60 + (m || 0);
    const dur = (a.services || []).reduce((t, sv) => t + (Number(sv.duration) || 0), 0) || (Number(a.duration) || 60);
    const iv = { s, e: s + dur };
    if (use.includes('M')) M.push(iv);
    if (use.includes('P')) P.push(iv);
  }
  return { M, P };
}
