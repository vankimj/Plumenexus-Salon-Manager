// In-app App Store rating prompt, fired at a genuine "good moment" (a completed
// checkout). Apple's StoreReview.requestReview() is itself throttled by iOS
// (~3 dialogs/year, and none in TestFlight/dev), but we add our own gate so we
// never even ask until the user has had a few successful checkouts and never
// more than once per cooldown window. All decision logic is pure + tested; the
// native call is isolated in maybeAsk() so tests don't need the native module.

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  count:      'reviewPrompt:completedCheckouts', // successful checkouts since last ask
  lastAskedAt:'reviewPrompt:lastAskedAt',        // ISO timestamp of last requestReview
};

export const MIN_CHECKOUTS = 3;      // don't ask a brand-new user
export const COOLDOWN_DAYS  = 120;   // ~3/yr ceiling, matches iOS throttle

// Pure decision: given the persisted state and "now", should we ask?
export function shouldPrompt({ count = 0, lastAskedAt = null } = {}, now = Date.now()) {
  if (count < MIN_CHECKOUTS) return false;
  if (!lastAskedAt) return true;
  const last = new Date(lastAskedAt).getTime();
  if (Number.isNaN(last)) return true;
  const days = (now - last) / 86400000;
  return days >= COOLDOWN_DAYS;
}

async function readState() {
  try {
    const [c, l] = await Promise.all([
      AsyncStorage.getItem(KEYS.count),
      AsyncStorage.getItem(KEYS.lastAskedAt),
    ]);
    return { count: Number(c) || 0, lastAskedAt: l || null };
  } catch (_) {
    return { count: 0, lastAskedAt: null };
  }
}

// Call after every successful, non-queued checkout. Increments the counter and,
// when the gate opens, requests the native review dialog. Fully self-contained
// and never throws — a rating prompt must not affect the checkout flow.
export async function recordCheckoutAndMaybeAsk() {
  try {
    const state = await readState();
    const count = state.count + 1;

    if (!shouldPrompt({ ...state, count })) {
      await AsyncStorage.setItem(KEYS.count, String(count));
      return { asked: false };
    }

    const StoreReview = require('expo-store-review');
    const available = await StoreReview.isAvailableAsync().catch(() => false);
    if (!available) {
      // Keep counting; we'll try again next completed checkout.
      await AsyncStorage.setItem(KEYS.count, String(count));
      return { asked: false, reason: 'unavailable' };
    }

    await StoreReview.requestReview();
    await Promise.all([
      AsyncStorage.setItem(KEYS.lastAskedAt, new Date().toISOString()),
      AsyncStorage.setItem(KEYS.count, '0'),
    ]);
    return { asked: true };
  } catch (_) {
    return { asked: false, reason: 'error' };
  }
}
