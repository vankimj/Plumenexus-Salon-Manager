import { useEffect } from 'react';
import { tokenProvider } from '../lib/terminal';
import useTenantAccess from '../hooks/useTenantAccess';

// The native Terminal module is only present AFTER a rebuild that includes
// @stripe/stripe-terminal-react-native. We require it lazily so the current
// (pre-rebuild) JS bundle never throws: if the module is absent this provider
// is a transparent pass-through and the checkout Card button stays disabled
// (isTerminalAvailable() === false).
let SDK = null;
try { SDK = require('@stripe/stripe-terminal-react-native'); } catch { SDK = null; }

// The RN Terminal SDK must be initialize()'d ONCE, from inside the provider,
// before discoverReaders/connectReader — otherwise every action throws
// "first initialize the Stripe Terminal SDK". The StripeTerminalProvider sets
// up context but does NOT auto-initialize; this child does it on mount.
function TerminalInit() {
  const { initialize } = SDK.useStripeTerminal();
  const { isVisitor } = useTenantAccess();
  useEffect(() => {
    // A read-only demo visitor never runs checkout, so initializing Terminal
    // would only fire the staff-gated connection-token callable and fail
    // ("Not a staff member of this tenant"). Skip init for visitors.
    if (isVisitor) return;
    let alive = true;
    (async () => {
      try { const r = await initialize?.(); if (alive && r?.error) console.warn('[terminal] init:', r.error?.message); }
      catch (e) { if (alive) console.warn('[terminal] init threw:', e?.message); }
    })();
    return () => { alive = false; };
  }, [initialize, isVisitor]);
  return null;
}

export default function TerminalProvider({ children }) {
  if (!SDK || !SDK.StripeTerminalProvider) return children;
  const { StripeTerminalProvider } = SDK;
  return (
    <StripeTerminalProvider logLevel="error" tokenProvider={tokenProvider}>
      <TerminalInit />
      {children}
    </StripeTerminalProvider>
  );
}
