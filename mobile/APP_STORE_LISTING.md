# App Store Listing Package — Plume Nexus Salon Manager v1.0.0

Everything paste-ready for [App Store Connect](https://appstoreconnect.apple.com).
Prepared 2026-06-18; **updated 2026-07-16: submitting under the approved Plume Nexus LLC
account** (Team `WX8JJUUYSR`, bundle `com.plumenexus.salon`) — no JVK transfer needed
since v1 was never submitted. Old JVK record/bundle (`app.plumenexus.pro`, ASC 6777297979)
will be retired.

---

## 1. App Information

| Field | Value |
|---|---|
| **Name** | `Plume Nexus Salon Manager` (25/30 chars; matches product branding; avoids the JVK record's "Plume Nexus Salons" name collision) |
| **Subtitle** (≤30) | `Run your salon from your phone` |
| **Primary category** | Business |
| **Secondary category** | Productivity |
| **Copyright** | © 2026 Plume Nexus LLC |
| **Privacy Policy URL** | https://plumenexus.com/privacy |
| **Support URL** | https://plumenexus.com/#contact |
| **Marketing URL** | https://plumenexus.com |
| **Version** | 1.0.0 |
| **Age rating** | Answer **None/No** to every content question → **4+**. ("Unrestricted web access" = No; gambling = No.) |

## 2. Promotional Text (≤170 chars)

```
The all-in-one app for salon teams: scheduling, walk-in rotation, checkout,
earnings, and client management — synced live with your front desk.
```

## 3. Keywords (≤100 chars — 85 used)

```
nail,scheduling,booking,POS,walk-in,stylist,barber,spa,payroll,tips,appointment,beauty
```
("salon" and "manager" removed — words already in the app name are ignored in keywords; "beauty" added with the freed chars.)

## 4. Description

```
Plume Nexus Salon Manager is the staff app for salons that run on Plume Nexus — the
all-in-one salon management platform. Your schedule, clients, checkout, and
earnings, live on your phone and always in sync with the front desk.

FOR EVERY TECH AND STYLIST
• Your day, week, and month at a glance — with working hours and time off built in
• See new bookings the moment they land, with push notifications
• Client profiles with visit history, notes, allergy flags, and photos
• Your earnings — services, tips, and totals for today, this week, this month
• Set your own hours, request time off, and manage your profile

FOR FRONT DESK AND OWNERS
• Walk-in queue with fair turn rotation — who's up next is never an argument
• Full checkout: services, retail, discounts, gift cards, tips, and receipts
  by text or email
• Appointment booking with per-tech services, durations, and prices
• Two-way client messaging — texts and emails in one thread
• Reports, activity logs, staff management, and salon settings

BUILT FOR TEAMS
• Every change syncs instantly between the app, the front-desk kiosk, and the web
• Role-based access — owners, managers, techs, and schedulers each see what
  they need
• Works across multiple salons if you work at more than one

Plume Nexus Salons is for salon staff. Your salon sets up your account —
sign in with Google, Apple, or the email login your salon gives you.
Learn more at plumenexus.com.
```

## 5. What's New (v1.0.0)

```
Welcome to Plume Nexus Salon Manager — scheduling, walk-in rotation,
checkout, earnings, and client management for salon teams.
```

## 6. App Review Information

| Field | Value |
|---|---|
| **Sign-in required** | Yes |
| **Demo account** | `appreview@plumenexus.test` |
| **Demo password** | (delivered out-of-band — not committed to git) |
| **Contact** | Jonathan VanKim · jvankim@gmail.com · (your phone) |

**Notes for the reviewer (paste into the Notes field):**

```
Plume Nexus Salons is a business (B2B) app for salon staff. Accounts are
provisioned by each salon — there is no public self-signup in the app. The
demo account above signs in via "Sign in with email" on the login screen and
opens "Demo Studio," a fully populated demonstration salon (staff, schedule,
clients, and sales history are sample data).

Suggested tour: Schedule (day/week/month) → Clients → Manage → Walk-in kiosk
(turn rotation) → Manage → Checkout a sale (choose Cash — the demo salon has
no card processor connected) → Earnings → Profile.

Notes:
• Account deletion: Profile tab → Delete account (bottom of the screen).
• Bluetooth background mode + location permission: used exclusively to
  connect Stripe Terminal card readers for in-person payments at the salon.
  The demo salon has no Stripe account connected, so card payment options
  will show a configuration message — use Cash to complete a sale.
• In-app purchases: none. The app sells nothing to consumers; it is a
  companion for salons that subscribe to the Plume Nexus platform (services
  are rendered physically, in the salon).
```

## 7. App Privacy (nutrition label) — enter in ASC → App Privacy

Top-level: **Yes**, data is collected. **No**, data is NOT used for tracking (no ads/analytics SDKs, no IDFA — do not add an ATT prompt).

Every row below: **Linked to identity = Yes**, **Tracking = No**, **Purpose = App Functionality**.

| Category → Type | Collected | Why |
|---|---|---|
| Contact Info → Name | ✅ | staff identity; client names staff enter |
| Contact Info → Email | ✅ | sign-in email; client emails; receipts |
| Contact Info → Phone | ✅ | staff + client phones; SMS receipts |
| Contact Info → Other | ✅ | social handles (Instagram/Venmo etc.) |
| Health & Fitness → Health | ✅ | client allergy notes (conservative-but-accurate) |
| Financial → Payment Info | ✅ | card-present via Stripe Terminal; brand/last4 on receipts |
| Financial → Other | ✅ | compensation, payroll, tips, store credit |
| Location → Precise | ✅ | required by Stripe Terminal during card payment |
| User Content → Emails/Texts | ✅ | two-way client messaging threads |
| User Content → Photos/Videos | ✅ | profile/display/refund photos |
| User Content → Customer Support | ✅ | in-app support tickets |
| User Content → Other | ✅ | client + appointment notes; AI-assistant chats |
| Identifiers → User ID | ✅ | Firebase Auth UID |
| Identifiers → Device ID | ✅ | push token; Expo update client id |
| Purchases → Purchase History | ✅ | salon receipts/sales history |
| Usage Data → Product Interaction | ✅ | in-app activity/audit log (no analytics SDK) |
| Other Data | ✅ | client birthdays; clock-in/attendance |
| Everything else (Browsing, Search, Contacts, Diagnostics, Fitness, Audio) | ❌ | not collected — no crash reporter, no contacts access, audio is playback-only |

Optional extra purpose on Name/Email/Phone: "Developer's Advertising or Marketing"
(salon marketing campaigns to opted-in clients). Defensible either way; adding it
is the maximally-accurate choice.

## 8. Screenshots (the one task that needs a human)

**Required: one set at 6.9″ (1320×2868) — or 6.5″ (1284×2778) also accepted.** No iPad set needed (`supportsTablet: false`).

Two capture paths:
1. **Simulator (recommended):** `cd mobile && npx expo start --dev-client`, run the dev client on an **iPhone 16/17 Pro Max** simulator, sign in with the appreview account, **Cmd+S** to save screenshots (exact native resolution).
2. **Your iPhone via TestFlight build #21** — native resolution works directly if it's a Pro Max-class device.

Suggested 6 screens (log into Demo Studio): ① Schedule day view ② Walk-in turn rotation ③ Checkout ④ Earnings ⑤ Client profile ⑥ Manage grid.
Upload at [ASC → App Store tab → iOS Previews and Screenshots](https://appstoreconnect.apple.com).

## 9. Remaining click-path (in order — 2026-07-16, Plume Nexus account)

Already done: ASC API key wired (`~/.config/plumenexus/AuthKey_YN5UHUC8BW.p8`, Key `YN5UHUC8BW`, Issuer `f9d5e228-891d-49bc-b05c-b9065d712f3c`), bundle `com.plumenexus.salon` registered (Team `WX8JJUUYSR`), push capability enabled, Firebase iOS app `1:563347750501:ios:77934f7af148df0e3c908c` registered. `deleteMyAccount` CF deployed + E2E-verified. SIWA capability syncs automatically at first EAS build.

1. **Human — ASC app record** (API can't create apps): [My Apps → New App](https://appstoreconnect.apple.com/apps) → iOS, name `Plume Nexus Salon Manager`, bundle `com.plumenexus.salon`, SKU `plumenexus-salon-1`. Note the record's **Apple ID** (App Information) → goes into `eas.json` `ascAppId`.
2. **Human — Google OAuth iOS client**: [GCP Console → Credentials](https://console.cloud.google.com/apis/credentials?project=plumenexus-prod) → Create credentials → OAuth client ID → iOS → bundle `com.plumenexus.salon`. Paste the client ID back → update `IOS_CLIENT_ID` in [AuthScreen.jsx](src/screens/AuthScreen.jsx) + the reversed-ID URL scheme in [app.json](app.json).
3. **Human — confirm** [Agreements](https://appstoreconnect.apple.com/agreements): Free Apps = Active.
4. **Build under the new team** (new dist cert + APNs auto-created via the ASC key):
   `EXPO_APPLE_TEAM_ID=WX8JJUUYSR EXPO_APPLE_TEAM_TYPE=COMPANY_OR_ORGANIZATION EXPO_ASC_API_KEY_PATH=~/.config/plumenexus/AuthKey_YN5UHUC8BW.p8 EXPO_ASC_KEY_ID=YN5UHUC8BW EXPO_ASC_ISSUER_ID=f9d5e228-891d-49bc-b05c-b9065d712f3c npx eas-cli build -p ios --profile production --non-interactive`
   (build #21 is JVK-signed — a fresh build is required)
5. **Submit to TestFlight** with the same env vars: `npx eas-cli submit -p ios --latest`
6. ASC: version 1.0.0 → paste §1–6 → App Privacy (§7) → screenshots (§8) → attach the new build → Submit for Review (~24–48h).
7. Post-approval cleanup: delete the old JVK app record + (later) re-request Tap to Pay under Plume Nexus.
