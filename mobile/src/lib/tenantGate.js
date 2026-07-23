// Pure decision logic for the root membership gate (TenantGate). Kept free of
// react-native/firebase imports so it unit-tests in plain node.
//
// The gate exists because Sign in with Apple (and any fresh sign-in) creates a
// user with no tenant membership; before it, RootNav rendered a hollow shell
// scoped to the fallback tenant — the exact dead end App Review hit (2.1a,
// 2026-07-23).
//
// States: 'pass' | 'spinner' | 'pending'
//   - hasStored: a tenant selection persisted from a previous session →
//     existing users pass IMMEDIATELY (zero added latency / network wait);
//     useMyTenants still refreshes in the background and self-corrects a
//     revoked selection.
//   - dev anonymous sign-in (Expo Go) has no email → the membership CF would
//     always throw; pass it through like today.
//   - fresh users wait on the membership answer: 0 tenants OR a CF error
//     (including permission-denied "No email on token" for hidden-email Apple
//     IDs) → 'pending' screen, which offers Check again + Sign out.
export function gateState({ hasStored, isAnonymous, dev, loading, tenants, error }) {
  if (dev && isAnonymous) return 'pass';
  if (hasStored) return 'pass';
  if (loading) return 'spinner';
  if (error) return 'pending';
  return (tenants || []).length >= 1 ? 'pass' : 'pending';
}
