import { View, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import Constants from 'expo-constants';
import { auth } from '../lib/firebase';
import useMyTenants from '../hooks/useMyTenants';
import { hasStoredTenant, clearCurrentTenant } from '../lib/currentTenant';
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
  const verdict = gateState({
    hasStored: hasStoredTenant(),
    isAnonymous: !!user?.isAnonymous,
    dev: isExpoGo,
    loading, tenants, error,
  });

  if (verdict === 'pass') return children;

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

  return <AccessPendingScreen user={user} error={error} onRetry={reload} />;
}
