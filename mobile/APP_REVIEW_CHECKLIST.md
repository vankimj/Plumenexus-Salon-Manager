# App Store Resubmission Checklist — validated, with evidence

Response to rejection `ed5e8b97-a79d-4027-868e-6ac37ba45a1b` (2026-07-23, iPad Air 11", iPadOS 26.5.2, v1.0.0 build 6):
**Guideline 2.1(a)** "unable to Sign in with Apple" · **Guideline 2.5.4** `bluetooth-central` background mode without visible BLE.

Rule (from the post-mortem): every item is **VALIDATED** with recorded evidence, **or explicitly HUMAN-REQUIRED**. Nothing ships on "should work."

## Guideline 2.1(a) — the sign-in dead end

| # | Item | Status | Evidence |
|---|------|--------|----------|
| 1 | Fresh user (what SIWA creates) gets a real screen, not a hollow shell | ✅ VALIDATED | `TenantGate` + `AccessPendingScreen` added at the root (after kiosk branches). Decision table unit-tested: `src/lib/tenantGate.test.js` — mobile suite green. Maestro flow 1 drives the full UI path on the iPad Air sim: email sign-in with a zero-membership account → "Almost there / isn't linked to a salon yet" screen → Sign out returns to AuthScreen (screenshots `shot-1-pending`, `shot-2-signedout`). |
| 2 | Existing staff regress nothing | ✅ VALIDATED | Gate passes instantly on a persisted tenant (`hasStoredTenant()` short-circuit — zero added latency/network); transiently-failing membership checks never lock out stored users (unit-tested). Kiosk custom-token identities never mount the gate (routed earlier in `App.jsx`). |
| 3 | Demo (reviewer) credentials are typeable in the app | ✅ VALIDATED | Email/password form exists on AuthScreen (`signInWithEmailAndPassword`, shipped in #512) — flow 2 types credentials end-to-end on the sim. |
| 4 | Demo account signs in by password + lands in a working app | ✅ VALIDATED (proxy) | `app-review-demo` (appreview@plumenexus.test): password provider, not disabled, emailVerified, member of `tenants/demo` **adminEmails + staffEmails** (admin-SDK read, 2026-07-23). Maestro flow 2 signs in an identically-shaped demo admin and reaches the app (screenshot `shot-3-demo-admin`). |
| 5 | The password in the ASC review notes matches the account | 🔶 HUMAN-REQUIRED | Cannot be read back from Firebase. **Jonathan:** confirm the password in App Store Connect → App Review Information, or ask to rotate it and update the notes. |
| 6 | Sign in with Apple native sheet completes on a physical device | 🔶 HUMAN-REQUIRED | The Apple sheet requires a real device + real Apple ID. **Jonathan:** on a device build, sign in with a fresh Apple ID (Hide My Email on) → expect the Access-pending screen; that is the correct, functional outcome for an unlinked account. The Firebase side is validated (provider enabled with Services ID `app.plumenexus.signin`; `com.plumenexus.salon` registered in the project — Identity Toolkit + `apps:list`, 2026-07-23). |

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

- [ ] Items 5 + 6 executed by Jonathan on a physical device (fresh Apple ID + exact ASC-notes creds).
- [ ] Reply drafted in ASC to both guideline items: 2.1(a) — fresh accounts now land on an access screen; demo creds path re-verified. 2.5.4 — background mode removed.
- [ ] Build number bumped by EAS remote versioning (automatic) — verify in the build page before submitting.
- [ ] Review notes updated: demo account + note that staff accounts are provisioned by a salon admin.

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

**ASC-side items (human, in App Store Connect):** privacy nutrition labels accuracy, age rating, screenshots, review notes text — not inspectable from the repo.
