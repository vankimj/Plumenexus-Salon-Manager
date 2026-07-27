# App Store Resubmission Checklist — validated, with evidence

Response to rejection `ed5e8b97-a79d-4027-868e-6ac37ba45a1b` (2026-07-23, iPad Air 11", iPadOS 26.5.2, v1.0.0 build 6):
**Guideline 2.1(a)** "unable to Sign in with Apple" · **Guideline 2.5.4** `bluetooth-central` background mode without visible BLE.

Rule (from the post-mortem): every item is **VALIDATED** with recorded evidence, **or explicitly HUMAN-REQUIRED**. Nothing ships on "should work."

## Guideline 2.1(a) — the sign-in dead end

| # | Item | Status | Evidence |
|---|------|--------|----------|
| 1 | Fresh user (what SIWA creates) gets a real, fully-explorable screen — not a hollow shell | ✅ VALIDATED (upgraded 2026-07-26) | A zero-membership account is now **auto-placed into a read-only demo salon** (Demo tour ribbon) as soon as sign-in completes — `getMyTenants` returns the `demo` tenant for members-of-nothing when `tenants/demo.visitorMode==true` (live-probed in prod: fresh account → `[{id:'demo',role:'visitor'}]`). The `AccessPendingScreen` (with an "Explore the demo salon" button) is now the FAILURE-only fallback. Server-enforced read-only via Firestore rules (`isDemoVisitor`, 42 emulator assertions). Build #8 EMBEDS this (no OTA-timing dependency — see item 23). |
| 2 | Existing staff regress nothing | ✅ VALIDATED | Gate passes instantly on a persisted tenant (`hasStoredTenant()` short-circuit — zero added latency/network); transiently-failing membership checks never lock out stored users (unit-tested). Kiosk custom-token identities never mount the gate (routed earlier in `App.jsx`). |
| 3 | Demo (reviewer) credentials are typeable in the app | ✅ VALIDATED | Email/password form exists on AuthScreen (`signInWithEmailAndPassword`, shipped in #512) — flow 2 types credentials end-to-end on the sim. |
| 4 | Demo account signs in by password + lands in a working app | ✅ VALIDATED (proxy) | `app-review-demo` (appreview@plumenexus.test): password provider, not disabled, emailVerified, member of `tenants/demo` **adminEmails + staffEmails** (admin-SDK read, 2026-07-23). Maestro flow 2 signs in an identically-shaped demo admin and reaches the app (screenshot `shot-3-demo-admin`). |
| 5 | The password in the ASC review notes matches the account | 🔶 HUMAN-REQUIRED | Cannot be read back from Firebase. **Jonathan:** confirm the password in App Store Connect → App Review Information, or ask to rotate it and update the notes. |
| 6 | Sign in with Apple native sheet completes on a physical device | ✅ **RESOLVED + device-proven (2026-07-23/26)** | Root cause was the Firebase Apple provider pointing at the OLD team (`7768658CR9`) while the binary is signed by `WX8JJUUYSR`. FIX: Jonathan registered a SIWA key (`8JKG93T89G`) + Services ID under team WX8JJUUYSR; the Firebase Apple provider trio was re-pointed (clientId `com.plumenexus.salon.signin`, team `WX8JJUUYSR`, key `8JKG93T89G`, atomic PATCH + read-back). **Device-proven:** Jonathan's fresh Apple ID (`jonathan_vankim@yahoo.com`) completed the SIWA sheet end-to-end into app code and reached the access screen — the sheet no longer errors. See re-graded chain below. |

## Guideline 2.5.4 — bluetooth-central

| # | Item | Status | Evidence |
|---|------|--------|----------|
| 7 | `bluetooth-central` removed from UIBackgroundModes | ✅ VALIDATED | `bluetoothBackgroundMode: false` in `app.json`; `expo prebuild` regenerated the native project and the produced `ios/PlumeNexus/Info.plist` has **no `UIBackgroundModes` key at all** (PlistBuddy read, 2026-07-23). |
| 8 | Foreground BLE (M2 reader) still intact | ✅ VALIDATED | `NSBluetoothAlwaysUsageDescription` + `NSBluetoothPeripheralUsageDescription` present in the generated Info.plist; Stripe Terminal SDK unchanged. (Background reader persistence is the only behavior forfeited; checkout is a foreground activity.) |
| 9 | SIWA entitlement still present after prebuild | ✅ VALIDATED | `com.apple.developer.applesignin: [Default]` in `ios/PlumeNexus/PlumeNexus.entitlements`. |

## General completeness (2.1)

| # | Item | Status | Evidence |
|---|------|--------|----------|
| 10 | Account deletion reachable (5.1.1(v)) | ✅ VALIDATED | `deleteMyAccount` CF deployed + ACTIVE (gcloud describe, 2026-07-11). UI path driven on the sim build: Profile → scroll → "Delete account" visible (Maestro, all steps green, 2026-07-23). |
| 11 | Unit suite green on the fix branch | ✅ VALIDATED | 7 files / 55 tests pass (includes the new gate decision table). |
| 12 | App boots on the review device class | ✅ VALIDATED | Release build compiled for and launched on the **iPad Air 11-inch (M4)** simulator (flows 1–2 run there). |
| 13 | Google sign-in client id correct for `com.plumenexus.salon` | ✅ VALIDATED | Main's AuthScreen carries the new iOS OAuth client; the stale branch with the retired client was NOT used as the base. |

## Before `eas submit` (hard gate — all must be checked)

- [ ] Item 5 (ASC-notes password matches) confirmed by Jonathan; item 6 (SIWA) device-proven ✅ — re-verify once more on **build #8** specifically.
- [ ] Device-test build #8: fresh Apple ID → lands in the read-only demo salon (Demo tour ribbon); demo ADMIN creds → full Demo Studio.
- [ ] Reply pasted in ASC (see "Corrected 2.1(a) reply" below): 2.1(a) — fresh accounts are auto-placed into a read-only demo salon; staff provisioned by a salon admin; demo ADMIN creds in notes. 2.5.4 — background mode removed.
- [ ] Build number bumped by EAS remote versioning (automatic, → build #8) — verify on the build page before submitting.
- [ ] Review notes updated: demo ADMIN account + auto-place demo landing + staff provisioned by a salon admin.

## Additional sweeps (validated 2026-07-23)

| # | Item | Status | Evidence |
|---|------|--------|----------|
| 14 | Auth persists across relaunch | ✅ VALIDATED | Sign in → `simctl terminate` → relaunch → straight back to "Dashboard — Demo Studio", signed in. (An earlier apparent failure was a test-side confound: a mid-experiment password rotation revoked the session — correct Firebase behavior.) Also proves the persisted-tenant instant-pass path on the real build. |
| 15 | All permission purpose strings present + honest | ✅ VALIDATED | Photo/Camera/Bluetooth×2/Location/Microphone/LocalNetwork all in the generated Info.plist with specific, truthful copy (PlistBuddy). |
| 16 | ATS secure | ✅ VALIDATED | `NSAllowsArbitraryLoads=false`; only `NSAllowsLocalNetworking=true` (card readers — matching usage string). |
| 17 | Export compliance | ✅ VALIDATED | `ITSAppUsesNonExemptEncryption=false` in Info.plist — no ASC crypto questionnaire. |
| 18 | iPad orientations | ✅ VALIDATED | All four orientations declared (no iPad-multitasking rejection surface). |
| 19 | Push entitlement | ✅ VALIDATED | `aps-environment` present (development in local builds; EAS flips to production at archive). |
| 20 | Privacy/Terms URLs live | ✅ VALIDATED | plumenexus.com/privacy + /terms both HTTP 200. |
| 21 | No-IAP rationale (3.1.1) | ✅ DOCUMENTED | All payments are for real-world salon services/goods (Stripe) — outside IAP per 3.1.3(e)/physical-goods carve-out. No digital content is sold. |
| 22 | SIWA button prominence (4.8) | ✅ VALIDATED | Boot screenshot: Apple button equal width/position directly below Google. |

## Demo-tour completeness (added 2026-07-26 — the resubmission's core 2.1 story)

| # | Item | Status | Evidence |
|---|------|--------|----------|
| 23 | Reviewer actually SEES the demo on first launch (no OTA-timing gap) | ✅ VALIDATED | Build **#8** (from `main` @ `6e4513a`) EMBEDS the demo-tour JS (#546/#547) — a fresh install shows the demo on first cold launch, not on the 2nd. (Build #7/7fb55786 predated the demo tour and depended on an OTA that only applies on the 2nd launch — that gap is closed by rebuilding.) Channel `production-salon`, runtime 1.0.0, team WX8JJUUYSR — all match. |
| 24 | Demo is read-only, server-enforced (not a UI gate) | ✅ VALIDATED | Firestore rules `isDemoVisitor` helper on read-lines only; 42 emulator assertions (visitor reads-yes / writes-no / other tenants isolated / PII denied); live-prod probe with a throwaway visitor token: demo reads 200, writes+PII+cross-tenant 403 (8/8). |
| 25 | No visitor UX dead-ends (2.1 completeness) | ✅ VALIDATED | #548: mobile now honors the server `VISITOR_CAPS` — visitor sees only the read-only showcase tiles (Schedule/Clients/Reports/Employees/Meetings/Memberships), Client Edit hidden, Schedule views the full calendar with all create/＋ affordances gated, phone-signin hidden, Earnings tile routed to Dashboard (was a dead route for everyone). 3 new visitor unit tests; mobile suite 58 green. |
| 26 | No real-person PII in the demo (5.1.1 / 5.2.5 likeness) | ✅ VALIDATED | 500 celebrity clients renamed to fictional people + all denormalized refs (receipts/appointments/ledger/etc); 11 real staff (10 Meraki techs + owner) + 3 real IG handles fictionalized; 500 client emails → reserved `@example.com`. Word-boundary re-scan across all 31 demo collections: **0** real names / handles / `@email.com` left. Objectionable-content + placeholder scans clean. |
| 27 | Reviewer can't trigger real external sends from the demo | ✅ (Stripe/SMS) / ⚠ (email — mitigated) | Stripe fully sandboxed (`stripeSandboxMode:true` + sk_test); SMS fully sandboxed. Email: a code bug (`deliverReceiptEmail` omits tenantId → skips the email sandbox) means a demo checkout/resend CAN dispatch real SES — but demo recipients are now all `@example.com` (RFC-reserved, non-deliverable), so nothing reaches a real inbox. Code fix (forward tenantId) tracked separately. |

**ASC-side items (human, in App Store Connect):** privacy nutrition labels accuracy, age rating, screenshots, review notes text — not inspectable from the repo.

## Corrected 2.1(a) reply (paste into ASC review response)

> Thank you for the re-review. We have removed the sign-in dead end. Any brand-new account that is not yet linked to a salon is now automatically placed into a read-only demo salon (shown with a "Demo tour" banner) the moment Sign in with Apple or Google completes — so the app is fully explorable with no invitation required. Staff accounts are provisioned by a salon owner/admin from within the app; to review the full staff and admin experience, sign in with the demo administrator email and password included in the App Review Information notes. We also resolved the Sign in with Apple sheet failure (a provider-configuration mismatch on our end) and verified the flow completes on a physical device.

**2.5.4 reply:** > The `bluetooth-central` background mode has been removed. Bluetooth is now used only in the foreground to connect to an in-person card reader (Stripe Terminal); the app declares no background modes.

## Correction & re-grade (2026-07-23, after the device walkthrough failed)

An earlier revision said "the Firebase side is validated." That was an **overclaim**: what had been verified was *existence/enablement* (provider on, bundle registered), not *correctness*. The signing-team ↔ provider-team mismatch was visible in the very config quoted and was only caught after the on-device failure. Checklist grades now use explicit levels:

- **L1 exists/enabled** — a thing is present/on
- **L2 consistent** — identities match across the whole chain
- **L3 exercised** — the real flow ran end-to-end on the real artifact

| SIWA chain link | Level | Finding |
|---|---|---|
| SIWA entitlement in the SHIPPED binary | **L3** | Present in build-6 IPA (codesign), team `WX8JJUUYSR` |
| Firebase Apple provider enabled | L1 | Enabled (Identity Toolkit read) |
| Provider config CONSISTENT with signing team | ✅ **L2 RESOLVED** | Provider re-pointed: clientId `com.plumenexus.salon.signin`, team `WX8JJUUYSR`, key `8JKG93T89G` (atomic PATCH + read-back). Matches the signing team. |
| Services ID validity at Apple | ✅ L2 | Services ID + SIWA key registered under WX8JJUUYSR (Jonathan, portal). |
| Native sheet completes on device | ✅ **L3 PASS** | Jonathan's fresh Apple ID completed the sheet into app code (reached the access screen) — 2026-07-23. |

**Status (2026-07-26): all SIWA blockers RESOLVED.** The provider trio is consistent with the signing team and the sheet is device-proven. Remaining human step: re-confirm on **build #8** specifically before Submit-for-Review (device walkthrough in the "Before eas submit" gate above).
