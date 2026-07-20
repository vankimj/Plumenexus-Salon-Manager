import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { useTheme, useThemedStyles } from '../theme/ThemeContext';
import { requestPhoneOtp, verifyPhoneOtp, unlinkPhoneSignin, getPhoneSigninStatus } from '../lib/firestore';

// Profile section: link / unlink a phone number for SMS sign-in. Linking is a
// two-step verify (send code → enter code) so the number is proven before it
// can be used to sign in. The token minted at sign-in is for THIS account's uid,
// so no new authorization is granted — it's just an alternate credential.
export default function PhoneSigninSetting() {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [status, setStatus]   = useState(null);   // { linked, last4 } | null while loading
  const [open,   setOpen]     = useState(false);
  const [phone,  setPhone]    = useState('');
  const [code,   setCode]     = useState('');
  const [sent,   setSent]     = useState(false);
  const [busy,   setBusy]     = useState(false);

  async function refresh() {
    try { const r = await getPhoneSigninStatus(); setStatus(r?.ok ? r : { linked: false }); }
    catch { setStatus({ linked: false }); }
  }
  useEffect(() => { refresh(); }, []);

  function reset() { setOpen(false); setSent(false); setPhone(''); setCode(''); }

  async function send() {
    if (phone.replace(/\D/g, '').length < 10) { Alert.alert('Phone sign-in', 'Enter your mobile number.'); return; }
    setBusy(true);
    try {
      const r = await requestPhoneOtp(phone.trim());
      if (r?.ok) setSent(true);
      else Alert.alert('Phone sign-in', "Couldn't send a code. Try again.");
    } catch (e) {
      Alert.alert('Phone sign-in', e?.message?.replace(/^.*?:\s*/, '') || "Couldn't send a code.");
    } finally { setBusy(false); }
  }

  async function verify() {
    if (code.replace(/\D/g, '').length !== 6) { Alert.alert('Phone sign-in', 'Enter the 6-digit code.'); return; }
    setBusy(true);
    try {
      const r = await verifyPhoneOtp(phone.trim(), code.replace(/\D/g, ''));
      if (r?.ok && r.linked) { reset(); await refresh(); Alert.alert('Phone sign-in enabled', 'You can now sign in with this number.'); }
      else Alert.alert('Phone sign-in', 'That code didn\'t work. Request a new one.');
    } catch (e) {
      Alert.alert('Phone sign-in', e?.message?.replace(/^.*?:\s*/, '') || 'That code didn\'t work.');
    } finally { setBusy(false); }
  }

  function confirmUnlink() {
    Alert.alert('Remove phone sign-in?', 'You\'ll no longer be able to sign in with this number.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        setBusy(true);
        try { await unlinkPhoneSignin(); await refresh(); }
        catch (e) { Alert.alert('Phone sign-in', e?.message || 'Try again.'); }
        finally { setBusy(false); }
      } },
    ]);
  }

  if (status === null) return null; // brief; avoids a flash of the wrong state

  return (
    <View style={{ marginTop: 18 }}>
      <Text style={styles.sectionLabel}>Phone sign-in</Text>

      {status.linked ? (
        <View style={styles.row}>
          <Text style={styles.rowText}>Enabled · •••• {status.last4}</Text>
          <TouchableOpacity onPress={confirmUnlink} disabled={busy}>
            <Text style={styles.remove}>{busy ? '…' : 'Remove'}</Text>
          </TouchableOpacity>
        </View>
      ) : !open ? (
        <TouchableOpacity style={styles.row} onPress={() => setOpen(true)}>
          <Text style={styles.rowText}>Add phone sign-in</Text>
          <Text style={styles.add}>Set up</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.form}>
          {!sent ? (
            <>
              <TextInput style={styles.input} placeholder="Mobile number" placeholderTextColor={theme.textFaint}
                value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" onSubmitEditing={send} />
              <TouchableOpacity style={[styles.btn, busy && { opacity: 0.6 }]} onPress={send} disabled={busy}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Send code</Text>}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TextInput style={styles.input} placeholder="6-digit code" placeholderTextColor={theme.textFaint}
                value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="sms-otp" textContentType="oneTimeCode" maxLength={6} onSubmitEditing={verify} />
              <TouchableOpacity style={[styles.btn, busy && { opacity: 0.6 }]} onPress={verify} disabled={busy}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Verify & enable</Text>}
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity style={{ paddingVertical: 8, alignItems: 'center' }} onPress={reset} disabled={busy}>
            <Text style={styles.cancel}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const makeStyles = (t) => StyleSheet.create({
  sectionLabel: { fontSize: 13, fontWeight: '700', color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: t.surface, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, borderWidth: 1, borderColor: t.border },
  rowText: { fontSize: 15, color: t.text },
  add: { fontSize: 15, fontWeight: '600', color: t.blue },
  remove: { fontSize: 15, fontWeight: '600', color: t.danger },
  form: { backgroundColor: t.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: t.border },
  input: { backgroundColor: t.bg, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14, fontSize: 16, color: t.text, borderWidth: 1, borderColor: t.border, marginBottom: 10 },
  btn: { backgroundColor: t.green, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancel: { color: t.textMuted, fontSize: 14 },
});
