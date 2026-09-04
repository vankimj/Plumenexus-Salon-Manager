# Go-Live Step 2 — Live-key swap (THE money step)

⚠️ This is the deliberate, real-money step. The #1 rule from the 2026-06-26
incident: **swap EVERY live value together, then redeploy once. Never half-swap.**
Do all of section B before any deploy in section C.

Run everything from the clean origin/main worktree:
`/Users/jonathanvankim/Downloads/pn-golive` (rebase it to latest main first —
`git fetch origin main && git checkout --detach origin/main` — and re-copy the
gitignored `functions/.env` + `scripts/`).

---

## A. Prerequisites (must ALL be true before starting)
- [ ] Step 1 deployed (sandbox gate live) — ✅ done 2026-07-20.
- [ ] A **real live tenant to charge** exists with a LIVE Stripe Connect account
      whose `charges_enabled == true` (KYC complete). Since Meraki is being
      rebuilt, this is the rebuilt Meraki or another salon. Verify with a LIVE
      key: `stripe.accounts.retrieve('<acct_live_id>')` → charges_enabled true.
- [ ] `planEntitlements.js` prices match the live prices ($19/$49/$149) — ✅ already aligned.

## B. Stage ALL live values (NO deploy yet)

### B1. Secret Manager — sk_live (parked, disabled, in version 5)
```
# v5 is disabled; enable it so we can read it, copy its value into a NEW
# enabled version (becomes 'latest'), then re-disable v5.
gcloud secrets versions enable 5 --secret=STRIPE_SECRET_KEY --project=plumenexus-prod
gcloud secrets versions access 5 --secret=STRIPE_SECRET_KEY --project=plumenexus-prod \
  | tr -d '\n' | gcloud secrets versions add STRIPE_SECRET_KEY --project=plumenexus-prod --data-file=-
gcloud secrets versions disable 5 --secret=STRIPE_SECRET_KEY --project=plumenexus-prod
# Confirm the new latest version starts sk_live (mode only):
gcloud secrets versions access latest --secret=STRIPE_SECRET_KEY --project=plumenexus-prod | sed -E 's/^(sk_(live|test)).*/\1/'
```

### B2. Secret Manager — live webhook secret
1. Stripe Dashboard (LIVE mode) → Developers → Webhooks → **Add endpoint**:
   `https://us-central1-plumenexus-prod.cloudfunctions.net/stripeWebhook`
   Select the same events the test endpoint uses (account.updated,
   payment_intent.*, checkout.session.completed, invoice.*, etc.). Copy its
   signing secret `whsec_…`.
2. Add it as a new version:
```
printf '%s' 'whsec_LIVE_VALUE_HERE' | gcloud secrets versions add STRIPE_WEBHOOK_SECRET --project=plumenexus-prod --data-file=-
```

### B3. functions/.env — 3 live price IDs (created 2026-06-27)
```
STRIPE_STARTER_PRICE_ID=price_1TmofOHUT1APR56UdfhfLMa9   # Solo $19
STRIPE_STUDIO_PRICE_ID=price_1TmofPHUT1APR56UET74sZmm    # Studio $49
STRIPE_PRO_PRICE_ID=price_1TmofPHUT1APR56UvU5gwaEU       # Salon Pro $149
```
(Leave `STRIPE_CONNECT_CLIENT_ID` as-is — it's the Standard-OAuth `ca_`, now
UNUSED since onboarding is Express-only. No `ca_live` needed.)

### B4. root .env AND .env.production — live publishable key (build-time)
```
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_51TRaMCHUT1APR56UlSdph1rq1M535MzZrbdybADsltFl1ucyaf7Nqo1CaY1i6YIBBC7POh26TUWuRGaV6eDp38IW00rere63b6
```

## C. Deploy ALL AT ONCE (from origin/main worktree)
```
cd /Users/jonathanvankim/Downloads/pn-golive

# 1. Functions — must redeploy so they bind the NEW latest secret versions
#    (sk_live + live whsec) and read the new prices. gen2 pins secret version at
#    deploy, so a redeploy is REQUIRED. Deploy all Stripe-binding functions; if
#    the us-central1 CPU quota blocks a full deploy, split into batches.
firebase deploy --only functions

# 2. Hosting — rebuild embeds pk_live, then push
npm run build
firebase deploy --only hosting
```

## D. Flip ONE tenant live (only after C succeeds)
Via platform-admin UI (setTenantSandboxMode) or directly:
```
# set ONLY the target tenant's stripeSandboxMode:false. Everyone else stays sandboxed.
# (do this in platform-admin, or a one-off admin-SDK script scoped to that tenantId)
```

## E. Verify live + safe
```
# Stripe now reports livemode true (mode-only check, key never printed):
#   node -e "…stripe(latest sk).balance.retrieve()…" → livemode: true
# The flipped tenant: stripeSandboxMode:false. ALL OTHERS: still sandboxed.
# Then run ONE small real charge end-to-end ($1 test on a real card) and refund it.
```

## Rollback (if anything looks wrong)
- Re-add the TEST key as a new latest version (copy from v6):
  `gcloud secrets versions access 6 --secret=STRIPE_SECRET_KEY | gcloud secrets versions add STRIPE_SECRET_KEY --data-file=-`
- Revert `.env`/`.env.production` to `pk_test`, revert functions/.env prices to test,
  set the tenant `stripeSandboxMode:true`, redeploy functions + hosting.
- The gate fail-closes, so setting the tenant back to sandbox stops real charges
  immediately even before the redeploy completes.

## Hard rules (from the June incident)
- Deploy ONLY from origin/main — never a feature branch (a stale branch reverted
  RBAC/billing in prod on 2026-06-26).
- Secret Manager `latest` = highest version NUMBER, not highest *enabled* — after
  adding sk_live, confirm `latest` is the enabled sk_live version.
- Never leave Stripe half-swapped (live secret + test pk/prices/webhook = every
  Stripe path errors). All of B before any of C.
