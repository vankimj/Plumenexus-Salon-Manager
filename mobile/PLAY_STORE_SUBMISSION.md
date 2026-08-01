# Google Play Store — submission package (Plume Nexus Salon Manager)

Android build config is done (package `app.plumenexus.pro`, FCM `google-services.json`, adaptive icon, v1.0.1). The **AAB is built by EAS** (`eas build -p android --profile production`). `eas.json` has an `android` submit block ready — drop the Play service-account JSON at `~/.config/plumenexus/play-service-account.json` and `eas submit -p android` uploads automatically.

**The one hard human gate:** a **Google Play Developer account** ($25 one-time + identity verification). Google requires the account owner's real identity/payment — it can't be created programmatically or by anyone but you.

---

## Store listing — paste-ready

**App name** (≤30):
```
Plume Nexus Salon Manager
```

**Short description** (≤80):
```
Scheduling, walk-in rotation, checkout, and earnings for salon teams.
```

**Full description** (≤4000):
```
Plume Nexus Salon Manager is the staff app for salons that run on Plume Nexus — the all-in-one salon management platform. Your schedule, clients, checkout, and earnings, live on your phone and always in sync with the front desk.

FOR EVERY TECH AND STYLIST
• Your day, week, and month at a glance — with working hours and time off built in
• See new bookings the moment they land, with push notifications
• Client profiles with visit history, notes, allergy flags, and photos
• Your earnings — services, tips, and totals for today, this week, this month
• Set your own hours, request time off, and manage your profile

FOR FRONT DESK AND OWNERS
• Walk-in queue with fair turn rotation — who's up next is never an argument
• Full checkout: services, retail, discounts, gift cards, tips, and receipts by text or email
• Appointment booking with per-tech services, durations, and prices
• Two-way client messaging — texts and emails in one thread
• Reports, activity logs, staff management, and salon settings

BUILT FOR TEAMS
• Every change syncs instantly between the app, the front-desk kiosk, and the web
• Role-based access — owners, managers, techs, and schedulers each see what they need
• Works across multiple salons if you work at more than one

Plume Nexus Salon Manager is for salon staff. Your salon sets up your account — sign in with Google, the email login your salon gives you, or your phone number. Learn more at plumenexus.com.
```

- **App category:** Business · **Tags:** business, productivity
- **Contact email:** jvankim@gmail.com
- **Privacy policy:** https://plumenexus.com/privacy

**Graphics needed:**
- App icon **512×512** PNG (reuse `mobile/assets/icon.png`, resized).
- Feature graphic **1024×500** PNG (Play-only, required) — brand banner.
- Phone screenshots (2–8, min 320px, 16:9 or 9:16). Generate from an Android emulator on the appreview demo account: Schedule → Walk-in rotation → Checkout → Earnings → Client profile → Manage grid. (I can produce these from the emulator once the account exists.)

---

## App content declarations (Play Console → "App content")

- **App access:** All/some functionality is restricted → provide the reviewer login: sign in with **email** `appreview@plumenexus.test` (password out-of-band). Notes: "B2B salon-staff app; accounts are provisioned per-salon, no public self-signup. This email login opens a fully populated demo salon."
- **Ads:** No ads.
- **Content rating:** complete the questionnaire → category **Business/Utility**, no violence/sexual/gambling/drugs → results in **Everyone / PEGI 3**.
- **Target audience:** 18+ (business tool) → avoids child-safety requirements.
- **Government app:** No.
- **Financial features:** it facilitates in-person card payments via Stripe (not a standalone financial product); if asked, "The app is a POS for salons; payments are processed by Stripe. Not a lending/banking/crypto app."
- **Health:** stores client allergy notes only; not a health/medical app.

### Data safety form (maps from the iOS privacy label)
Data **is collected**, **encrypted in transit**, and users **can request deletion** (Profile → Delete account). **No data shared with third parties for their own use.** **Not used for tracking/ads.** For every type below: *Collected = Yes, Shared = No, Purpose = App functionality (+ Account management), Optional = No.*

- **Personal info:** Name, Email address, Phone number, User IDs, Other (social handles, birthdays)
- **Financial info:** Payment info (card-present via Stripe; brand/last4 on receipts), Purchase history, Other (payroll/tips/store credit)
- **Location:** Approximate/Precise location (required by Stripe Terminal during a card tap)
- **Messages:** Other in-app messages (two-way client messaging)
- **Photos and videos:** Photos (profile/display/refund photos)
- **App activity:** App interactions (in-app audit log — no analytics SDK)
- **Health & fitness:** none (allergy notes are stored as client notes, not Health data)
- **Everything else** (contacts, calendar, browsing, search history, installed apps, device IDs for ads): **Not collected.**

---

## Step-by-step (what's mine vs yours)

1. **YOU — create the Play Developer account:** https://play.google.com/console/signup ($25, identity verification; org accounts may need a D-U-N-S number — allow a day or two).
2. **YOU — create the app:** Play Console → **Create app** → name `Plume Nexus Salon Manager`, default language `English (United States)`, type **App**, **Free**, accept the declarations.
3. **ME — the AAB** is already built by EAS ([latest Android build](https://expo.dev/accounts/jvankim/projects/meraki-mobile/builds)). Two upload paths:
   - **Automated (preferred):** you create a Google Cloud **service account** with Play API access (Play Console → Setup → API access → link a GCP project → create service account → grant "Release apps to testing tracks" → download JSON), save it to `~/.config/plumenexus/play-service-account.json`, and I run `eas submit -p android` (uploads to the Internal testing track).
   - **Manual:** I hand you the AAB download link and you drag it into Play Console → Testing → Internal testing → Create release.
4. **ME — store listing:** paste the copy above; I generate the icon/feature-graphic/screenshots from the emulator.
5. **YOU — App content:** fill the declarations + data-safety above (mostly checkboxes; answers provided).
6. **Release to Internal testing** first (no review wait) → add your testers → verify on a device → then promote to **Production** (Play review ~1–3 days for a new app).

The account (Step 1) is the only thing that strictly needs you. Everything else I can do or drive once it exists.
