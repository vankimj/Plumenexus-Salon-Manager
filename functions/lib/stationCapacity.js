'use strict';

// Server mirror of src/lib/stationCapacity.js — station (manicure/pedicure)
// capacity logic for the authoritative booking write. Keep the classification
// + concurrency rules in sync with the client module. Pure; unit-tested in
// stationCapacity.test.js.

// 'M' | 'P' | null — category wins over name.
function stationTypeForService(svc) {
  if (!svc) return null;
  const cat = String(svc.category || '').toLowerCase();
  if (/pedi/.test(cat)) return 'P';
  if (/mani/.test(cat)) return 'M';
  const name = String(svc.name || '').toLowerCase();
  if (/pedi/.test(name)) return 'P';
  if (/mani/.test(name)) return 'M';
  return null;
}

// '' | 'M' | 'P' | 'MP'. The multi-lane booking flow stamps `lane` — trust it;
// otherwise derive from the service lines (a mixed appt occupies both).
function apptStationUse(appt) {
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

// Occupied interval in minutes from midnight. Mirrors the overlap-check
// conventions used everywhere (services-sum falls back to duration then 60).
function intervalOf(appt) {
  const mth = /^(\d{1,2}):(\d{2})$/.exec(String(appt && appt.startTime || ''));
  if (!mth) return null;
  const s = Number(mth[1]) * 60 + Number(mth[2]);
  const svcSum = (appt.services || []).reduce((t, sv) => t + (Number(sv && sv.duration) || 0), 0);
  const dur = Math.max(0, Math.min(600, svcSum || Number(appt.duration) || 60));
  return { s, e: s + dur };
}

// Peak concurrency of half-open intervals inside [start, end). Ends release
// before starts at the same instant (back-to-back ≠ overlap).
function maxConcurrent(intervals, start, end) {
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

// Normalize bookingConfig fields. 0/unset → Infinity (unlimited = feature off).
function stationCaps(cfg) {
  const n = (v) => { const x = Number(v); return x > 0 ? Math.floor(x) : Infinity; };
  const w = Number(cfg && cfg.stationWaitToleranceMin);
  return {
    M: n(cfg && cfg.manicureStations),
    P: n(cfg && cfg.pedicureStations),
    waitTol: Number.isFinite(w) && w >= 0 ? Math.floor(w) : 15,
  };
}

// Would writing `incoming` (this booking's appts, same date) on top of
// `existing` (that day's stored appts) overflow either station?
// Exact check: union all intervals per station, peak concurrency ≤ cap.
// Returns { ok: true } or { ok: false, station: 'M'|'P' }.
function checkStationCapacity({ existing, incoming, caps }) {
  for (const type of ['M', 'P']) {
    const cap = caps[type];
    if (!(cap < Infinity)) continue;
    const ivs = [];
    for (const a of (existing || [])) {
      if (!a || a.status === 'cancelled' || a.status === 'no_show') continue;
      if (!apptStationUse(a).includes(type)) continue;
      const iv = intervalOf(a);
      if (iv) ivs.push(iv);
    }
    for (const a of (incoming || [])) {
      if (!a || !apptStationUse(a).includes(type)) continue;
      const iv = intervalOf(a);
      if (iv) ivs.push(iv);
    }
    if (maxConcurrent(ivs, 0, 24 * 60) > cap) return { ok: false, station: type };
  }
  return { ok: true };
}

module.exports = {
  stationTypeForService,
  apptStationUse,
  intervalOf,
  maxConcurrent,
  stationCaps,
  checkStationCapacity,
};
