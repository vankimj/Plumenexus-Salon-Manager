// Demo-visitor Firestore rules tests — run against the emulator:
//   npm run test:rules
// Proves the demo-visitor security invariants server-side:
//   1. Any signed-in account can READ the widened demo-tenant collections.
//   2. The same account can WRITE none of them (read-only is a rules
//      boundary, not a UI gate).
//   3. PII surfaces (data/users, data/usersFull, logs, expenses,
//      attendance, employee contact) stay DENIED for visitors.
//   4. The widening is demo-only: the identical reads against another
//      tenant are denied (cross-tenant isolation).
//   5. Demo carve-outs close the public write vectors (waitlist create,
//      appointment check-in flap, portal-chat create) for 'demo' while
//      leaving them open for real tenants.
//   6. Real demo staff/admin membership still works unchanged.
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

const PROJECT = 'plumenexus-prod';
const OTHER = 'merakinailstudio';

let env;
let pass = 0;
let fail = 0;
const failures = [];

async function check(label, promise) {
  try {
    await promise;
    pass++;
    console.log(`  ok ${label}`);
  } catch (e) {
    fail++;
    failures.push(label);
    console.error(`FAIL ${label}: ${e.message}`);
  }
}

env = await initializeTestEnvironment({
  projectId: PROJECT,
  firestore: { rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8') },
});

// ── Seed (rules bypassed) ────────────────────────────────
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  for (const t of ['demo', OTHER]) {
    await setDoc(doc(db, 'tenants', t), { name: t, active: true, ownerEmail: 'owner@plumenexus.test' });
    await setDoc(doc(db, 'tenants', t, 'data', 'users'), {
      staffEmails: ['staff@plumenexus.test', 'admin@plumenexus.test'],
      adminEmails: ['admin@plumenexus.test'],
    });
    await setDoc(doc(db, 'tenants', t, 'data', 'usersFull'), { users: [{ email: 'staff@plumenexus.test', role: 'tech' }] });
    await setDoc(doc(db, 'tenants', t, 'data', 'settings'), { timeoutMin: 5 });
    await setDoc(doc(db, 'tenants', t, 'clients', 'c1'), { name: 'Demo Client', _demo: true });
    await setDoc(doc(db, 'tenants', t, 'appointments', 'a1'), { clientName: 'Demo Client', date: '2026-07-23', _demo: true });
    await setDoc(doc(db, 'tenants', t, 'receipts', 'r1'), { total: 50, _demo: true });
    await setDoc(doc(db, 'tenants', t, 'ledger', 'l1'), { amount: 50, kind: 'sale' });
    await setDoc(doc(db, 'tenants', t, 'timeOff', 't1'), { tech: 'Demo Tech' });
    await setDoc(doc(db, 'tenants', t, 'products', 'p1'), { name: 'Polish', stock: 3 });
    await setDoc(doc(db, 'tenants', t, 'meetings', 'm1'), { title: 'Open standup', private: false });
    await setDoc(doc(db, 'tenants', t, 'meetings', 'm2'), { title: '1:1 review', private: true });
    await setDoc(doc(db, 'tenants', t, 'expenses', 'e1'), { amount: 100 });
    await setDoc(doc(db, 'tenants', t, 'attendance', '2026-07-23'), { rows: [] });
    await setDoc(doc(db, 'tenants', t, 'logs', 'log1'), { action: 'seed' });
    await setDoc(doc(db, 'tenants', t, 'employees', 'emp1', 'contact', 'main'), { phone: '555' });
  }
});

const visitor = env.authenticatedContext('visitor-uid', { email: 'visitor@example.com', email_verified: true }).firestore();
const anon = env.unauthenticatedContext().firestore();
const demoStaff = env.authenticatedContext('staff-uid', { email: 'staff@plumenexus.test', email_verified: true }).firestore();
const demoAdmin = env.authenticatedContext('admin-uid', { email: 'admin@plumenexus.test', email_verified: true }).firestore();

// ── 1. Visitor READS on demo: allowed ────────────────────
console.log('\n[1] visitor reads on demo — must ALLOW');
await check('read demo settings', assertSucceeds(getDoc(doc(visitor, 'tenants/demo/data/settings'))));
await check('read demo client', assertSucceeds(getDoc(doc(visitor, 'tenants/demo/clients/c1'))));
await check('read demo appointment', assertSucceeds(getDoc(doc(visitor, 'tenants/demo/appointments/a1'))));
await check('read demo receipt', assertSucceeds(getDoc(doc(visitor, 'tenants/demo/receipts/r1'))));
await check('read demo ledger', assertSucceeds(getDoc(doc(visitor, 'tenants/demo/ledger/l1'))));
await check('read demo timeOff', assertSucceeds(getDoc(doc(visitor, 'tenants/demo/timeOff/t1'))));
await check('read demo product', assertSucceeds(getDoc(doc(visitor, 'tenants/demo/products/p1'))));
await check('read demo public meeting', assertSucceeds(getDoc(doc(visitor, 'tenants/demo/meetings/m1'))));

// ── 2. Visitor WRITES on demo: denied ────────────────────
console.log('\n[2] visitor writes on demo — must DENY');
await check('create demo client', assertFails(setDoc(doc(visitor, 'tenants/demo/clients/cNew'), { name: 'x' })));
await check('update demo client', assertFails(updateDoc(doc(visitor, 'tenants/demo/clients/c1'), { name: 'x' })));
await check('delete demo client', assertFails(deleteDoc(doc(visitor, 'tenants/demo/clients/c1'))));
await check('create demo appointment', assertFails(setDoc(doc(visitor, 'tenants/demo/appointments/aNew'), { date: 'x' })));
await check('update demo appointment', assertFails(updateDoc(doc(visitor, 'tenants/demo/appointments/a1'), { date: 'x' })));
await check('create demo receipt', assertFails(setDoc(doc(visitor, 'tenants/demo/receipts/rNew'), { total: 1 })));
await check('update demo product stock', assertFails(updateDoc(doc(visitor, 'tenants/demo/products/p1'), { stock: 0 })));
await check('write demo timeOff', assertFails(setDoc(doc(visitor, 'tenants/demo/timeOff/tNew'), { tech: 'x' })));
await check('write demo settings', assertFails(setDoc(doc(visitor, 'tenants/demo/data/settings'), { timeoutMin: 1 })));

// ── 3. PII surfaces stay closed to visitors ──────────────
console.log('\n[3] visitor reads on demo PII surfaces — must DENY');
await check('read demo data/users', assertFails(getDoc(doc(visitor, 'tenants/demo/data/users'))));
await check('read demo data/usersFull', assertFails(getDoc(doc(visitor, 'tenants/demo/data/usersFull'))));
await check('read demo logs', assertFails(getDoc(doc(visitor, 'tenants/demo/logs/log1'))));
await check('read demo expenses', assertFails(getDoc(doc(visitor, 'tenants/demo/expenses/e1'))));
await check('read demo attendance', assertFails(getDoc(doc(visitor, 'tenants/demo/attendance/2026-07-23'))));
await check('read demo private meeting', assertFails(getDoc(doc(visitor, 'tenants/demo/meetings/m2'))));
await check('read demo employee contact', assertFails(getDoc(doc(visitor, 'tenants/demo/employees/emp1/contact/main'))));

// ── 4. Cross-tenant isolation ────────────────────────────
console.log('\n[4] visitor reads on OTHER tenant — must DENY');
await check('read other client', assertFails(getDoc(doc(visitor, `tenants/${OTHER}/clients/c1`))));
await check('read other appointment', assertFails(getDoc(doc(visitor, `tenants/${OTHER}/appointments/a1`))));
await check('read other receipt', assertFails(getDoc(doc(visitor, `tenants/${OTHER}/receipts/r1`))));
await check('read other settings', assertFails(getDoc(doc(visitor, `tenants/${OTHER}/data/settings`))));
console.log('\n[4b] unauthenticated reads on demo — must DENY');
await check('anon read demo client', assertFails(getDoc(doc(anon, 'tenants/demo/clients/c1'))));
await check('anon read demo receipt', assertFails(getDoc(doc(anon, 'tenants/demo/receipts/r1'))));

// ── 5. Demo carve-outs on public write vectors ───────────
console.log('\n[5] public write vectors — demo DENIED, real tenant unchanged');
await check('waitlist create demo (visitor)', assertFails(setDoc(doc(visitor, 'tenants/demo/waitlist/w1'), { clientName: 'x' })));
await check('waitlist create demo (anon)', assertFails(setDoc(doc(anon, 'tenants/demo/waitlist/w1'), { clientName: 'x' })));
await check('waitlist create other (anon) still works', assertSucceeds(setDoc(doc(anon, `tenants/${OTHER}/waitlist/w1`), { clientName: 'x' })));
await check('checkedInAt flap demo (anon)', assertFails(updateDoc(doc(anon, 'tenants/demo/appointments/a1'), { checkedInAt: '2026-07-23T10:00:00Z' })));
await check('checkedInAt other (anon) still works', assertSucceeds(updateDoc(doc(anon, `tenants/${OTHER}/appointments/a1`), { checkedInAt: '2026-07-23T10:00:00Z' })));
await check('portal chat create demo (own email)', assertFails(setDoc(doc(visitor, 'tenants/demo/chats/ch1'), { clientEmail: 'visitor@example.com', messages: [] })));
await check('portal chat create other (own email) still works', assertSucceeds(setDoc(doc(visitor, `tenants/${OTHER}/chats/ch1`), { clientEmail: 'visitor@example.com', messages: [] })));

// ── 6. Real demo membership unchanged ────────────────────
console.log('\n[6] real demo staff/admin — unchanged');
await check('staff reads demo client', assertSucceeds(getDoc(doc(demoStaff, 'tenants/demo/clients/c1'))));
await check('staff writes demo client', assertSucceeds(updateDoc(doc(demoStaff, 'tenants/demo/clients/c1'), { name: 'Renamed' })));
await check('staff reads demo data/users', assertSucceeds(getDoc(doc(demoStaff, 'tenants/demo/data/users'))));
await check('admin reads demo logs', assertSucceeds(getDoc(doc(demoAdmin, 'tenants/demo/logs/log1'))));
await check('admin writes demo settings', assertSucceeds(setDoc(doc(demoAdmin, 'tenants/demo/data/settings'), { timeoutMin: 10 })));

await env.cleanup();

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.error('FAILED:', failures.join(' | '));
  process.exit(1);
}
