// Clock-in "on shift" gate — mobile twin of web src/lib/shiftGate.js. Keep the
// two in sync (mobile & web parity is a hard rule).
//
// Business rule (decided 2026-06-08): a nail tech who isn't clocked in cannot
// run checkouts or edit their calendar *while on shift* — "on shift" = the
// salon is within its open hours right now. Off shift (salon closed) they may
// edit freely. Admins/owners are always exempt.
//
// settings.storeHours shape: { Mon:{ open:'10:00', close:'19:00', closed:false }, … }

function hhmmToMins(s) {
  if (!s || typeof s !== 'string') return null;
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10), min = parseInt(m[2], 10);
  if (Number.isNaN(h) || Number.isNaN(min)) return null;
  return h * 60 + min;
}

export function isSalonOpenNow(settings, now = new Date()) {
  const hours = settings && settings.storeHours;
  if (!hours || typeof hours !== 'object') return false;
  const dow = now.toLocaleDateString('en-US', { weekday: 'short' });
  const day = hours[dow];
  if (!day || day.closed) return false;
  const open  = hhmmToMins(day.open);
  const close = hhmmToMins(day.close);
  if (open == null || close == null) return false;
  const cur = now.getHours() * 60 + now.getMinutes();
  return cur >= open && cur < close;
}

// Bookable window (minutes since midnight) for a weekday short-name ('Mon'…'Sun').
// Mobile twin of web src/lib/booking.js bookableWindow — keep the two in sync.
// Combines store hours with the (typically wider) appointment-hours window so an
// appointment may run until whichever closes later; on a day the store is marked
// closed only the appointment-hours window applies. Falls back to 9am–8pm.
export function bookableWindow(settings, dow) {
  const day = (settings && settings.storeHours && settings.storeHours[dow]) || {};
  const wk  = (settings && settings.walkIn) || {};
  const ah  = (settings && settings.apptHours) || {};
  const mins = (v, fb) => { const m = hhmmToMins(v); return m == null ? hhmmToMins(fb) : m; };
  const storeOpen  = mins(day.open,  wk.open  || '09:00');
  const storeClose = mins(day.close, wk.close || '18:00');
  const apptOpen   = mins(ah.open,  '09:00');
  const apptClose  = mins(ah.close, '20:00');
  const closed = !!day.closed;
  return {
    closed,
    open:  closed ? apptOpen  : Math.min(storeOpen,  apptOpen),
    close: closed ? apptClose : Math.max(storeClose, apptClose),
  };
}

export function isEntryClockedIn(entry) {
  if (!entry) return false;
  const events = entry.events;
  if (Array.isArray(events) && events.length) {
    const kind = events[events.length - 1] && events[events.length - 1].kind;
    return kind === 'in' || kind === 'break_start' || kind === 'break_end';
  }
  return !!(entry.clockInAt && !entry.clockOutAt);
}

function norm(s) { return String(s || '').trim().toLowerCase(); }

export function clockedInNameSet(attendance) {
  const set = new Set();
  ((attendance && attendance.entries) || []).forEach(e => {
    if (isEntryClockedIn(e) && e.employeeName) set.add(norm(e.employeeName));
  });
  return set;
}

// The subset of `techNames` (in their original casing) whose employee is
// currently clocked in. Powers the calendar's "Working now" filter — maps the
// normalized clocked-in names back to the exact tech-column names.
export function workingTechNames(techNames, attendance) {
  const inSet = clockedInNameSet(attendance);
  return (techNames || []).filter(t => inSet.has(norm(t)));
}

export function offClockTechNames(techNames, attendance) {
  const inSet = clockedInNameSet(attendance);
  const seen = new Set();
  const missing = [];
  (techNames || []).forEach(n => {
    const key = norm(n);
    if (!key || key === 'walk-in' || key === 'tbd' || seen.has(key)) return;
    seen.add(key);
    if (!inSet.has(key)) missing.push(String(n).trim());
  });
  return missing;
}

export function attendanceKey(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
