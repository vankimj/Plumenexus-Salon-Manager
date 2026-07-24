import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { auth } from '../lib/firebase';
import { clearPushTokenForUser } from '../hooks/usePushRegistration';
import { clearCurrentTenant } from '../lib/currentTenant';
import { useThemedStyles } from '../theme/ThemeContext';

// Shown by TenantGate when a signed-in account has no salon membership (fresh
// Sign in with Apple / Google users — the App-Review 2.1a dead end), or when
// the membership check itself failed. Deliberately touches NO tenant data.
export default function AccessPendingScreen({ user, error, onRetry, onTourDemo }) {
  const styles = useThemedStyles(makeStyles);
  const [busy, setBusy] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);
  const [demoErr, setDemoErr] = useState(null);

  async function handleSignOut() {
    setBusy(true);
    // Canonical sign-out triple (mirrors ProfileScreen.handleSignOut).
    try { await clearPushTokenForUser(user?.uid); } catch {}
    try { await clearCurrentTenant(); } catch {}
    try { await auth.signOut(); } catch {}
  }

  async function handleTourDemo() {
    setDemoBusy(true);
    setDemoErr(null);
    try {
      await onTourDemo();
    } catch (e) {
      // Rate-limited / demo disabled / offline — the tour is optional, so a
      // friendly inline line beats an alert.
      setDemoErr(e?.message || 'The demo salon isn’t available right now.');
      setDemoBusy(false);
    }
  }

  const who = user?.email || 'your Apple ID';

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.brand}>Plume Nexus</Text>
        <Text style={styles.sub}>SALON MANAGER</Text>

        <Text style={styles.headline}>
          {error ? "Couldn't check your access" : 'Almost there'}
        </Text>
        <Text style={styles.body}>
          {error
            ? 'We hit a problem verifying which salon your account belongs to. Check your connection and try again.'
            : `You're signed in as ${who}, but this account isn't linked to a salon yet. This app is for salon staff — ask your salon owner to add you (Staff → open your profile → Permissions), then check again. In the meantime, you can look around a demo salon.`}
        </Text>

        <TouchableOpacity style={styles.primaryBtn} onPress={onRetry} disabled={busy || demoBusy} activeOpacity={0.85}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Check again</Text>}
        </TouchableOpacity>
        {!!onTourDemo && (
          <TouchableOpacity style={styles.secondaryBtn} onPress={handleTourDemo} disabled={busy || demoBusy} activeOpacity={0.85}>
            {demoBusy
              ? <ActivityIndicator color={styles.secondaryBtnText.color} />
              : <Text style={styles.secondaryBtnText}>Explore the demo salon</Text>}
          </TouchableOpacity>
        )}
        {!!demoErr && <Text style={styles.demoErr}>{demoErr}</Text>}
        <TouchableOpacity style={styles.linkBtn} onPress={handleSignOut} disabled={busy || demoBusy}>
          <Text style={styles.linkBtnText}>Sign out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const makeStyles = (t) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card:      { width: '100%', maxWidth: 340, alignItems: 'center', gap: 8 },
  brand:     { fontSize: 40, fontWeight: '400', color: t.text, letterSpacing: 2 },
  sub:       { fontSize: 12, fontWeight: '700', color: t.teal, letterSpacing: 5, marginBottom: 28 },
  headline:  { fontSize: 19, fontWeight: '700', color: t.text, marginBottom: 6, textAlign: 'center' },
  body:      { fontSize: 14, color: t.textMuted, lineHeight: 21, textAlign: 'center', marginBottom: 24 },
  primaryBtn: { width: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: t.teal, borderRadius: 12, paddingVertical: 13 },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  secondaryBtn: { width: '100%', alignItems: 'center', justifyContent: 'center', borderRadius: 12, paddingVertical: 13, marginTop: 10, borderWidth: 1.5, borderColor: t.teal },
  secondaryBtnText: { color: t.teal, fontSize: 15, fontWeight: '700' },
  demoErr: { fontSize: 12.5, color: '#c0605f', textAlign: 'center', marginTop: 8 },
  linkBtn:   { paddingVertical: 14, alignItems: 'center' },
  linkBtnText: { color: t.textMuted, fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' },
});
