# Tap to Pay on iPhone — App Review video scripts

Apple's production distribution review requires three videos. Record on a real iPhone (XS+/iOS 16.7+) with the `dev/ttp-relaunch` development build, in **Stripe TEST mode**. Keep each ≤ ~2 min, show the full name "Tap to Pay on iPhone", and no cuts within a flow.

Prep once: signed in as an admin; a Stripe **Terminal Location** set (Admin → Settings → Terminal Location ID); at least one service on a client's tab.

---

## Video 1 — New User Flow (first-time setup)
Goal: show a merchant enabling Tap to Pay for the first time, including Apple's Terms.

1. Fresh state: Manage grid → tap **Payments** (merchant onboarding) → show Stripe Connect status "ready" (or complete onboarding if not).
2. Manage grid → **Tap to Pay** → the setup/education splash appears. Read the "Tap to Pay on iPhone" heading on screen.
3. Tap **Enable Tap to Pay on iPhone** → the **Apple Terms & Conditions** sheet appears → accept it. (This is the money shot Apple wants: the T&C acceptance.)
4. Show the success/ready state ("Tap to Pay on iPhone is ready").

## Video 2 — Existing User Flow (returning merchant takes a payment)
Goal: an already-set-up merchant runs a sale end-to-end.

1. Schedule tab → open a client with items on their tab → **Check out**.
2. On the checkout screen, show the payment options with **Tap to Pay on iPhone at the top**.
3. Tap **Tap to Pay on iPhone** → "Preparing Tap to Pay on iPhone…" → the system tap prompt appears.
4. Tap a **test card** to the top of the phone → approval → the receipt/complete screen.
5. Briefly show the sale recorded (Reports or the receipt) to prove completion.

## Video 3 — Checkout Flow (customer's perspective, second camera)
Goal: film the physical tap. Needs a **second camera** (a laptop/webcam or a second phone) pointing at the merchant iPhone.

1. Camera A (screen recording on the iPhone) + Camera B (external, filming the phone).
2. Start at the checkout screen → tap **Tap to Pay on iPhone** → system prompt "Hold Here to Pay".
3. On camera B, show a card (or a second Apple Pay device) physically tapping the top of the iPhone.
4. Show the approval animation on the phone and the completed sale.

---

**After recording:** upload the three videos + the completed App Review Requirements Checklist as the reply to Apple's provisioning-team email (Step 4 in `TAP_TO_PAY_SUBMISSION.md`).
