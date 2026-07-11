# App Store Listing Package — Plume Nexus Salons v1.0.0

Everything paste-ready for [App Store Connect](https://appstoreconnect.apple.com) (app 6777297979).
Prepared 2026-06-18 on `feat/appstore-v1-submission`. Submitting under **JVK Consulting LLC**
(transfer to Plume Nexus LLC post-launch via App Transfer — board #428).

---

## 1. App Information

| Field | Value |
|---|---|
| **Name** | `Plume Nexus Salons` (plain "Plume Nexus" is taken) |
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
salon,nail,scheduling,booking,POS,walk-in,stylist,barber,spa,payroll,tips,appointment
```

## 4. Description

```
Plume Nexus Salons is the staff app for salons that run on Plume Nexus — the
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
Welcome to Plume Nexus Salons — scheduling, walk-in rotation, checkout,
earnings, and client management for salon teams.
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

## 9. Remaining click-path (in order)

1. **Review + merge [PR #512](https://github.com/vankimj/Plumenexus-Salon-Manager/pull/512)**, then deploy the account-deletion CF (required before Apple reviews):
   `firebase deploy --project plumenexus-prod --only functions:deleteMyAccount`
2. **Upload build #21 to TestFlight:** `cd mobile && npx eas-cli submit -p ios --latest`
3. In [App Store Connect](https://appstoreconnect.apple.com): create version 1.0.0 → paste sections 1–6 above → complete App Privacy (section 7) → upload screenshots (section 8) → select build 21 → answer export compliance (already declared exempt via `ITSAppUsesNonExemptEncryption`) → **Submit for Review**.
4. Review typically returns in ~24–48h. If rejected, the notes in section 6 address the most likely questions (B2B login, Bluetooth, payments).
