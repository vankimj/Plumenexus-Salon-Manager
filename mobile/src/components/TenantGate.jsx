import { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets, SafeAreaInsetsContext } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { auth, callFn } from '../lib/firebase';
import useMyTenants from '../hooks/useMyTenants';
import { hasStoredTenant, clearCurrentTenant, setCurrentTenant } from '../lib/currentTenant';
import { clearPushTokenForUser } from '../hooks/usePushRegistration';
import { gateState } from '../lib/tenantGate';
import AccessPendingScreen from '../screens/AccessPendingScreen';

const isExpoGo = Constants.appOwnership === 'expo';

// Root membership gate — sits between sign-in and RootNav (after the kiosk
// branches, which are custom-token identities that must never hit it).
// Fresh sign-ins wait for the getMyTenants answer; no membership → a real
// AccessPendingScreen instead of the hollow fallback-tenant shell App Review
// hit (2.1a, 2026-07-23). Existing users pass instantly on their persisted
// tenant (zero added latency); useMyTenants still refreshes + self-corrects
// a revoked selection in the background. Decision table: lib/tenantGate.js.
export default function TenantGate({ user, children }) {
  const { tenants, loading, error, reload } = useMyTenants();
  const insets = useSafeAreaInsets();
  // Explicit "Explore the demo salon" from AccessPendingScreen: registers the
  // visitor (joinDemoAsVisitor), scopes queries to 'demo', and bypasses the
  // pending verdict. UI-level override only — the pure gateState table stays
  // untouched, and the rules/CF enforce what a visitor can actually read.
  const [demoTour, setDemoTour] = useState(false);

  const startDemoTour = async () => {
    await callFn('joinDemoAsVisitor')({});
    await setCurrentTenant('demo');
    setDemoTour(true);
  };

  // Leave the tour the moment a real membership shows up (ribbon "check
  // again" → reload → useMyTenants auto-selects the real tenant).
  useEffect(() => {
    if (demoTour && Array.isArray(tenants) && tenants.some(t => t.id !== 'demo')) {
      setDemoTour(false);
    }
  }, [demoTour, tenants]);

  const verdict = gateState({
    hasStored: hasStoredTenant(),
    isAnonymous: !!user?.isAnonymous,
    dev: isExpoGo,
    loading, tenants, error,
  });

  const demoOnly = Array.isArray(tenants) && tenants.length === 1 &&
    tenants[0]?.id === 'demo' && tenants[0]?.role === 'visitor';

  if (demoTour || verdict === 'pass') {
    // Zero-membership user auto-placed in the shared demo salon (visitor
    // pseudo-role from getMyTenants, behind tenants/demo.visitorMode). Show
    // a persistent ribbon so the tour is never mistaken for a real salon;
    // "Check again" re-asks getMyTenants — once an admin grants access the
    // real tenant replaces demo automatically.
    if (demoTour || demoOnly) {
      // Top banner (consumes the status-bar inset), then children with the top
      // inset zeroed so the nav headers below don't double-pad.
      return (
        <View style={{ flex: 1 }}>
          <View style={{ backgroundColor: '#2D7A5F', paddingTop: insets.top, paddingBottom: 8, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
            <Text style={{ color: '#fff', fontSize: 12.5, textAlign: 'center' }}>
              <Text style={{ fontWeight: '700' }}>Demo tour</Text> — read-only sample salon
            </Text>
            <TouchableOpacity onPress={reload} style={{ borderWidth: 1, borderColor: 'rgba(255,255,255,.45)', borderRadius: 8, paddingVertical: 4, paddingHorizontal: 10, backgroundColor: 'rgba(255,255,255,.16)' }}>
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>I got access — check again</Text>
            </TouchableOpacity>
          </View>
          <SafeAreaInsetsContext.Provider value={{ ...insets, top: 0 }}>
            <View style={{ flex: 1 }}>{children}</View>
          </SafeAreaInsetsContext.Provider>
        </View>
      );
    }
    return children;
  }

  if (verdict === 'spinner') {
    // Escape hatch: the membership CF has a 30s server timeout — never trap
    // the user on a spinner with no way out.
    const signOut = async () => {
      try { await clearPushTokenForUser(user?.uid); } catch {}
      try { await clearCurrentTenant(); } catch {}
      try { await auth.signOut(); } catch {}
    };
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f1923', gap: 24 }}>
        <ActivityIndicator color="#3D9E8A" size="large" />
        <TouchableOpacity onPress={signOut}>
          <Text style={{ color: '#8aa0ad', fontSize: 13, textDecorationLine: 'underline' }}>Sign out</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return <AccessPendingScreen user={user} error={error} onRetry={reload} onTourDemo={startDemoTour} />;
}
