// Pure candidate selection for the auto-rebook SMS nudge. Kept out of index.js
// so the eligibility rules are unit-testable without Firestore. The scheduled
// function does the I/O (query the target-date appts, the future-appt set, the
// client docs) and hands the plain arrays here.

const DONE_STATUSES = ['done', 'completed'];

// From the appointments completed on the target date, pick those eligible for a
// rebook nudge and dedupe to one per client (a client with two services that
// day gets a single text). Excludes:
//   - non-completed appts (still scheduled / cancelled / no-show)
//   - walk-ins / anonymous visits (no clientId — no one to text or verify opt-in)
//   - appts already nudged (idempotent re-runs)
//   - clients who already have ANY upcoming appointment (they don't need a nudge)
// Consent (smsOptIn) is enforced later by sendSms(kind:'marketing'); it is NOT
// re-checked here because opt-in lives on the live client doc, not the appt.
function selectRebookCandidates(targetDateAppts, futureClientIds, sentField = 'rebookNudgeSent') {
  const future = futureClientIds instanceof Set ? futureClientIds : new Set(futureClientIds || []);
  const seen = new Set();
  const out = [];
  for (const a of targetDateAppts || []) {
    if (!a || !a.clientId) continue;
    if (!DONE_STATUSES.includes(a.status)) continue;
    if (a[sentField]) continue;
    if (future.has(a.clientId)) continue;
    if (seen.has(a.clientId)) continue;
    seen.add(a.clientId);
    out.push(a);
  }
  return out;
}

// Set of clientIds that have any non-cancelled appointment strictly after
// `afterDate` (YYYY-MM-DD). Built from a plain array so it's testable.
function futureClientIdSet(futureAppts, afterDate) {
  const s = new Set();
  for (const a of futureAppts || []) {
    if (!a || !a.clientId || !a.date) continue;
    if (a.status === 'cancelled') continue;
    if (a.date > afterDate) s.add(a.clientId);
  }
  return s;
}

// Add `days` to a YYYY-MM-DD string using noon-UTC anchoring so pure date
// arithmetic is immune to DST. Returns YYYY-MM-DD.
function addDaysISO(dateStr, days) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// The visit dates a nudge run should examine: the date `weeks` weeks ago, plus
// a small look-back window so a missed cron day still catches that cohort (the
// per-appt sent-marker makes re-runs idempotent). Returned oldest→newest, ≤10
// entries so it fits a Firestore `where('date','in',[...])` (single-field, no
// composite index).
function rebookTargetDates(todayISO, weeks, lookbackDays = 2) {
  const target = addDaysISO(todayISO, -weeks * 7);
  const out = [];
  for (let i = Math.max(0, lookbackDays); i >= 0; i--) out.push(addDaysISO(target, -i));
  return out;
}

module.exports = { selectRebookCandidates, futureClientIdSet, addDaysISO, rebookTargetDates, DONE_STATUSES };
