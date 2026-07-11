# iOS account cutover — JVK Consulting LLC → Plume Nexus LLC + first App Store publish

> ⚠️ **DO NOT MERGE this branch to `main` until cutover day.** It flips the iOS
> `bundleIdentifier` to `com.plumenexus.app`. Merging early breaks the *current*
> production TestFlight builds + OTA (which run `app.plumenexus.pro`).

## Why a recreate, not a transfer
The app is **TestFlight-only, never released to the App Store**. Apple's App
Transfer requires ≥1 released version, so the app cannot be transferred — it is
**recreated** on the new Plume Nexus LLC org account. Backend/data does NOT move
(Firestore/Functions live in `plumenexus-prod`, tied to Google Cloud, not Apple).

## Already handled in `main` (no work needed)
- ✅ Sign in with Apple — fully wired in `mobile/src/screens/AuthScreen.jsx`
  (`AppleAuthentication.signInAsync` + Firebase `OAuthProvider('apple.com')`),
  `usesAppleSignIn: true`, `expo-apple-authentication` installed. Satisfies
  Guideline 4.8 (required because the app also offers Google sign-in).
- ✅ Export-compliance — `ITSAppUsesNonExemptEncryption: false` in `app.json`.
- ✅ Bundle-ID swap → `com.plumenexus.app` (this branch).

## Blocked until the org account is APPROVED (Enrollment ID ZS25VJQQ2H)
Everything below needs the new **Apple Team ID** and/or new-account consoles.

### Account (once approved)
- [ ] Accept the **Free Apps agreement** — App Store Connect → Business →
      Agreements. (App is free on the store; billing is Stripe, not Apple IAP →
      no banking/tax setup needed.)

### New credentials + services (keyed to new Team ID / bundle ID)
- [ ] **Google iOS OAuth client** — create a new iOS client in the
      `plumenexus-prod` Google Cloud console for bundle `com.plumenexus.app`.
      Then replace the reversed-client-ID URL scheme in `mobile/app.json`
      (`ios.infoPlist.CFBundleURLTypes[0].CFBundleURLSchemes[0]`, currently
      `com.googleusercontent.apps.563347750501-…`) with the new one.
      **Google sign-in on the new build is broken until this is updated.**
- [ ] **Firebase iOS app** — add an iOS app (bundle `com.plumenexus.app`) to
      `plumenexus-prod` → download the new `GoogleService-Info.plist` into
      `mobile/` → upload a new **APNs auth key** in Firebase Cloud Messaging.
      (Old push tokens die; testers re-register on reinstall.)
- [ ] **Firebase Apple provider** — in Firebase Auth → Sign-in method → Apple,
      configure the Services ID + Apple private key for the new App ID so
      `OAuthProvider('apple.com')` keeps working.
- [ ] **Universal Links (AASA)** — update the hosted `apple-app-site-association`
      with the new `<TeamID>.com.plumenexus.app` app ID and redeploy.
- [ ] **EAS credentials** — new App Store Connect **API key** (.p8) on the new
      account → add to EAS; let EAS auto-generate the distribution cert +
      provisioning profile. Set the new `ascAppId` in `mobile/eas.json`.

### App Store Connect listing (required to submit)
- [ ] Create the app record (bundle `com.plumenexus.app`, name
      "Plume Nexus Salon Manager").
- [ ] **Privacy Policy URL** + **App Privacy** data-collection questionnaire.
- [ ] **Screenshots** — 6.9"/6.5" iPhone **and iPad** (app is iPad-first),
      description, keywords, category, support URL, age rating.

### Build → submit → release
- [ ] `eas build --platform ios --profile production` (new creds).
- [ ] `eas submit --platform ios` → attach build to the App Store version.
- [ ] Answer export compliance (exempt), pick release type, **Submit for Review**.
- [ ] On approval → **Release**. First submission = full App Review (hours–~2 days).

### Guideline watch-outs
- **3.1.1** — keep the iOS UI free of any in-app "buy/subscribe" flow; SaaS is
  billed via Stripe *outside* the app (allowed for B2B business tooling).
- **4.8** — already satisfied (Sign in with Apple shipped).

### After cutover
- [ ] Keep JVK's TestFlight alive until the new build reaches testers, then retire
      the JVK Consulting LLC developer account.
- [ ] Re-request **Tap to Pay on iPhone** entitlement on the new account when POS
      is back in scope (skipped this round).
