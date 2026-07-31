# Tap to Pay on iPhone — entitlement request + production submission

**Status (2026-07-30):** All app code is built + on `main` (checkout card path, Tap-to-Pay setup/education, merchant onboarding, backend CFs deployed). The blocker is the Apple **managed entitlement**, which is **not on the current team** — verified: App ID `com.plumenexus.salon` (team WX8JJUUYSR / Plume Nexus LLC) has only Sign in with Apple + IAP + Push. The prior grant was on the retired account and does not carry over. It **cannot be enabled by any API** (confirmed — `com.apple.developer.proximity-reader.payment.acceptance` is a managed entitlement, not exposed to the App Store Connect / Developer API). It must be requested by the **Account Holder** via the web portal.

The entitlement is staged one-line on branch **`dev/ttp-relaunch`** (`mobile/app.json` → `ios.entitlements`). Keep `main` WITHOUT it so `--profile production` builds keep succeeding until the *production* grant lands.

Key facts to reuse in every form:
- **App ID / bundle:** `com.plumenexus.salon`
- **Team:** WX8JJUUYSR (Plume Nexus LLC — Organization account)
- **Payment Service Provider (PSP):** **Stripe** (Stripe Terminal → Tap to Pay on iPhone)
- **Entitlement:** `com.apple.developer.proximity-reader.payment.acceptance`
- **Min device/OS:** iPhone XS or later, iOS 16.7+

---

## Step 1 — Request the DEVELOPMENT entitlement (Account Holder, ~1–2 business days)

**Tap to Pay is NOT requested via a portal capability tab** (it won't appear under Capabilities OR Capability Requests). Apple routes it through a dedicated **contact-request form**; the capability only shows up under the App ID's **"Additional Capabilities"** tab AFTER Apple grants it.

1. Sign in as the **Account Holder** (organization account required).
2. Open the request form: **https://developer.apple.com/contact/request/tap-to-pay-on-iphone/**
3. Fill it (answers below), confirm your app meets the criteria, submit.
4. Apple reviews against fixed criteria → adds it as a managed capability (~1–2 business days for development). You'll get a **confirmation email** — save it; the distribution request (Step 4) is a reply to it.

Reference: [Apple — Setting up the entitlement](https://developer.apple.com/documentation/ProximityReader/setting-up-the-entitlement-for-tap-to-pay-on-iPhone) (the doc's "request form" link is the URL above). Platforms must also accept Stripe's [Apple Acceptance Platform Terms](https://stripe.com/legal/apple-acceptance-platform).

**Form answers (copy/paste):**
- **What does your app do / use case:** "Plume Nexus Salon Manager is a point-of-sale and business-management app for salons. Staff check clients out at the front desk and in the chair. Tap to Pay on iPhone lets them accept in-person contactless card and Apple Pay payments on the iPhone with no extra hardware."
- **Payment Service Provider:** **Stripe** (Stripe Terminal). We do not build our own payment processing.
- **Regions:** United States.
- **Are you the merchant or a platform:** Platform / software provider whose merchants (salons) accept payments through their own Stripe Connect accounts.

> The development entitlement is auto-approved in most regions in ~1–2 business days. You'll get a **confirmation email** — keep it; the production request is a reply to it (Step 4).

---

## Step 2 — Stripe: enable Tap to Pay + create a Terminal Location

1. In the [Stripe Dashboard](https://dashboard.stripe.com/) confirm the account is enabled for **Tap to Pay on iPhone** (Terminal → Settings). If not offered, request it via Stripe support.
2. Create a **Terminal Location** (Terminal → Locations → Add) with the salon's address. Copy its **`tml_…`** id.
3. In the app: **Admin → Settings → "Stripe Terminal Location ID"** → paste the `tml_…`.
4. Test in **Stripe TEST mode** first (test card taps) before going live.

---

## Step 3 — On-device DEV test (once Step 1 is granted)

Register a test iPhone and build the entitlement branch:
```
cd mobile
eas device:create                 # register your test iPhone (XS+/iOS 16.7+), once
git checkout dev/ttp-relaunch
eas build -p ios --profile development
```
Install on the device, open **Check out → Tap to Pay on iPhone**, and run a real tap in Stripe test mode. (The dev entitlement works only on registered devices; `--profile production` will still fail until Step 4 is granted — that's expected for managed entitlements.)

---

## Step 4 — Request PRODUCTION distribution validation (the App Store gate)

Reply to the entitlement **confirmation email** from Step 1 and ask the provisioning team for **production distribution review / validation**. They send the requirements; you must submit:

**A. App Review Requirements Checklist** (they provide the doc). Confirm each item — the key ones:
- Tap to Pay is presented with its **full name** "Tap to Pay on iPhone" everywhere (no shortening). ✅ already done in code.
- The Apple **Marketing Toolkit** splash/education assets are used (custom art is not allowed). → get the toolkit (below).
- Graceful handling when the device/OS doesn't support it. ✅ `osVersionNotSupported` handled in checkout.
- A merchant onboarding path exists. ✅ `MerchantOnboardingScreen`.

**B. Apple Marketing Toolkit assets.** Request the Tap to Pay Marketing Toolkit (emailed to the Account Holder; see [partners.marketingtools.apple.com](https://partners.marketingtools.apple.com)). Drop the approved splash PNG into `mobile/assets/ttp/splash.png` (no code change).

**C. Three screen-recording videos** (device recordings):
1. **New User Flow** — first-time setup: enable Tap to Pay in the app → Apple T&C acceptance → ready to accept.
2. **Existing User Flow** — returning user opens checkout → taps a card → completes a sale.
3. **Checkout Flow** — the full checkout with Tap to Pay from the customer's perspective (this one needs a **second camera** to film the phone accepting the tap).

See `mobile/TAP_TO_PAY_VIDEO_SCRIPTS.md` for the shot-by-shot scripts.

> Timeline: Apple's production review is typically **1–2 weeks** after you submit A+B+C.

---

## Step 5 — Ship it (after production grant)

1. Verify a fresh provisioning profile actually contains the entitlement:
   `security cms -D -i profile.mobileprovision | grep proximity` → should be non-empty.
2. Merge `dev/ttp-relaunch` (the `ios.entitlements` line) into `main`.
3. `eas build -p ios --profile production` (now succeeds with the entitlement) → upload to TestFlight → submit for review.

---

## What can't be automated (and why)

- **The entitlement request itself** — a managed entitlement, requested via the Account-Holder-only portal form; not in any API (verified against the App Store Connect capability API). Only the Account Holder can submit it.
- **The three videos** — real device recordings, one needing a second camera; and the production review is Apple's manual sign-off.

Everything else (code, backend, entitlement staging, Stripe wiring, this checklist) is done or scriptable.
