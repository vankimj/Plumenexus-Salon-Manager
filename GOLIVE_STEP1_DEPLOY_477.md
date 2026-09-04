# Go-Live Step 1 — Deploy the per-tenant sandbox gate (PR #477)

**What this does:** puts the sandbox-gate code (+ the `setTenantSandboxMode` admin
function) into prod. **It does NOT flip anything live** — every tenant is
sandboxed and the gate is fail-closed, so after this deploy everything is still
TEST. This just installs the safety switch you'll use at the real cutover.

**Run everything from THIS worktree** (clean origin/main, env + predeploy hook
staged): `/Users/jonathanvankim/Downloads/pn-golive`

**Pre-flight (already true, listed for sanity):**
- HEAD = `b0b5312` (merged #477 on main) — NOT a feature branch.
- `functions/.env` present; root `.env` = `pk_test`; Secret Manager `STRIPE_SECRET_KEY` latest = v6 = `sk_test`. No live keys touched in this step.

---

## 1. Deploy the rules (server-only collections + gate)
```
cd /Users/jonathanvankim/Downloads/pn-golive
firebase deploy --only firestore:rules
```

## 2. Deploy the targeted functions (money paths + the new admin setter)
Targeted (not all ~150) to dodge the maxed us-central1 Cloud Run CPU quota.
Note the repeated `functions:` per name — `functions:a,b,c` silently deploys
only `a`.
```
cd /Users/jonathanvankim/Downloads/pn-golive
firebase deploy --only functions:createPaymentIntent,functions:chargeBookingDeposit,functions:chargeStoredCard,functions:createGiftCardPurchaseIntent,functions:createMembershipCheckout,functions:setTenantSandboxMode,functions:getTenantMetadata,functions:markOnboardingPhase,functions:provisionTenantSMS
```

## 3. Verify (nothing should be live)
```
# a) functions actually updated just now (updateTime within the last few min)
gcloud functions describe createPaymentIntent --region=us-central1 --gen2 --project=plumenexus-prod --format="value(updateTime)"

# b) no tenant is set live — every tenant should be sandboxed
#    (expect: no output, or only tenants with sandboxMode:false — there should be NONE)
```
Then in the platform-admin UI, open a tenant → confirm the sandbox toggles
render (that's the new `setTenantSandboxMode` wired end-to-end).

---

## If the deploy fails
- **Predeploy hook blocks it** (`scripts/check-prod-deploy-safety.cjs`): read the
  message — it guards against stale-branch / smoke failures. Do NOT bypass; fix
  the cause.
- **CPU quota error**: deploy the functions in two smaller batches (split the
  list above) — same repeated-`functions:` syntax.
- **Never** add a live Stripe key in this step. Live keys are Step 2 (separate
  runbook), swapped all-together from origin/main.

## This is Step 1 of the cutover. Step 2 (later, deliberate):
enable `sk_live` (from parked Secret Manager v5) + `pk_live` + 3 live price IDs +
live webhook secret — TOGETHER — then redeploy functions AND hosting. Meraki is
decoupled (delete + rebuild + its own KYC before Meraki itself goes live).
