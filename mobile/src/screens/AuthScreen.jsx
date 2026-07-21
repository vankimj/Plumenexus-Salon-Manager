import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { GoogleAuthProvider, OAuthProvider, signInWithCredential, signInWithEmailAndPassword, signInWithCustomToken, signInAnonymously } from 'firebase/auth';
import Constants from 'expo-constants';
import Svg, { Path } from 'react-native-svg';
import { auth, ALLOWED_EMAILS } from '../lib/firebase';
import { requestPhoneOtp, verifyPhoneOtp } from '../lib/firestore';
import { useThemedStyles } from '../theme/ThemeContext';

// Official Google "G" mark (4-color) for the Sign in with Google button.
function GoogleG({ size = 18 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18">
      <Path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" />
      <Path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" />
      <Path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" />
      <Path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" />
    </Svg>
  );
}

// Apple requires a one-time nonce: send SHA256(rawNonce) to Apple, pass rawNonce
// to Firebase so it can verify the returned id_token wasn't replayed.
function randomNonce(len = 32) {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-._';
  const bytes = Crypto.getRandomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += chars[bytes[i] % chars.length];
  return out;
}

// EAS Dev Client / production native build: real Google Sign-In via the
// native SDK. We pass BOTH the iOS-specific client ID (matches bundle id
// app.plumenexus.pro) AND the Web client ID. The Web client ID is what
// Firebase Auth expects for `GoogleAuthProvider.credential(idToken)` —
// it's the audience the returned id_token is signed for. Both clients
// live in the plumenexus-prod project (number 563347750501); the old
// 721171829996 clients were from the pre-migration project and rejected
// id_tokens as invalid_audience.
const WEB_CLIENT_ID = '563347750501-jlmqatcbesk7r9ltou2sl928sgmtk606.apps.googleusercontent.com';
// iOS client is bundle-id-bound: this one belongs to com.plumenexus.salon
// (Plume Nexus LLC team). The old n1pe3i700s… client was bound to the retired
// app.plumenexus.pro bundle under JVK.
const IOS_CLIENT_ID = '563347750501-7pk04kolq41bgbfkhjo8c5dkmu233p1n.apps.googleusercontent.com';

// In Expo Go the native module isn't available — guard the configure
// call so the screen still renders (with the dev-anonymous fallback).
const isExpoGo = Constants.appOwnership === 'expo';
if (!isExpoGo) {
  GoogleSignin.configure({
    webClientId: WEB_CLIENT_ID,
    iosClientId: IOS_CLIENT_ID,
    offlineAccess: false,
  });
}

export default function AuthScreen() {
  const [loading, setLoading] = useState(false);
  // Only show the Apple button when the native module is actually present (true
  // on iOS 13+ builds that include expo-apple-authentication). Keeps this safe to
  // ship to a build that predates the native rebuild — the button just hides.
  const [appleAvailable, setAppleAvailable] = useState(false);
  // Email/password path — staff whose salon provisioned a password login
  // (no Google/Apple account needed) and App Review demo credentials.
  const [showEmail, setShowEmail] = useState(false);
  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  // Phone sign-in — staff who linked their number in Profile. Two steps:
  // enter phone → receive code → enter code → custom-token sign-in.
  const [showPhone, setShowPhone] = useState(false);
  const [phone,     setPhone]     = useState('');
  const [otpCode,   setOtpCode]   = useState('');
  const [otpSent,   setOtpSent]   = useState(false);
  useEffect(() => {
    AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => setAppleAvailable(false));
  }, []);
  const styles = useThemedStyles(makeStyles);

  async function handleEmailSignIn() {
    const em = email.trim().toLowerCase();
    if (!em || !password) { Alert.alert('Sign in', 'Enter your email and password.'); return; }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, em, password);
    } catch (err) {
      // One generic message — never confirm whether the account exists.
      Alert.alert('Sign-in failed', 'Incorrect email or password.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSendOtp() {
    const p = phone.trim();
    if (p.replace(/\D/g, '').length < 10) { Alert.alert('Phone sign-in', 'Enter your mobile number.'); return; }
    setLoading(true);
    try {
      const r = await requestPhoneOtp(p);
      if (r?.ok) { setOtpSent(true); }
      else { Alert.alert('Phone sign-in', "Couldn't send a code. Check the number and try again."); }
    } catch (err) {
      // resource-exhausted → throttled; anything else → generic.
      const msg = /resource-exhausted|too many|wait/i.test(err?.message || '') ? err.message : "Couldn't send a code. Try again in a moment.";
      Alert.alert('Phone sign-in', msg);
    } finally { setLoading(false); }
  }

  async function handleVerifyOtp() {
    const code = otpCode.replace(/\D/g, '');
    if (code.length !== 6) { Alert.alert('Phone sign-in', 'Enter the 6-digit code.'); return; }
    setLoading(true);
    try {
      const r = await verifyPhoneOtp(phone.trim(), code);
      if (r?.ok && r.token) { await signInWithCustomToken(auth, r.token); }
      else { Alert.alert('Phone sign-in', 'That code didn\'t work. Request a new one.'); }
    } catch (err) {
      // permission-denied carries a helpful message (attempts left / expired).
      Alert.alert('Phone sign-in', err?.message?.replace(/^.*?:\s*/, '') || 'That code didn\'t work.');
    } finally { setLoading(false); }
  }

  async function handleGoogleSignIn() {
    if (isExpoGo) {
      Alert.alert(
        'Expo Go limitation',
        'Real Google Sign-In requires an EAS Dev Client build. For now use the dev button below.',
      );
      return;
    }
    setLoading(true);
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const result = await GoogleSignin.signIn();
      // v13+ returns { type, data: { idToken, user } }; older returns flat.
      const idToken = result?.data?.idToken || result?.idToken;
      if (!idToken) throw new Error('No idToken returned by Google.');

      const credential = GoogleAuthProvider.credential(idToken);
      const fbResult = await signInWithCredential(auth, credential);
      const email = (fbResult.user.email || '').toLowerCase();

      if (!ALLOWED_EMAILS.includes(email)) {
        // Bootstrap admins get through immediately; others rely on
        // Firestore rules to gate data. The web app calls
        // getMyTenantRole here for a friendlier denied screen — we'll
        // mirror that in Phase 4.
        console.log('[auth] non-bootstrap signed in:', email);
      }
    } catch (err) {
      if (err?.code === statusCodes?.SIGN_IN_CANCELLED) return;
      Alert.alert('Sign-in failed', err?.message || 'Could not sign in.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAppleSignIn() {
    setLoading(true);
    try {
      const rawNonce = randomNonce();
      const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
      const cred = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });
      if (!cred.identityToken) throw new Error('No identity token returned by Apple.');
      const provider = new OAuthProvider('apple.com');
      const firebaseCred = provider.credential({ idToken: cred.identityToken, rawNonce });
      await signInWithCredential(auth, firebaseCred);
    } catch (err) {
      if (err?.code === 'ERR_REQUEST_CANCELED') return;
      Alert.alert('Apple sign-in failed', err?.message || 'Could not sign in.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.brand}>Plume Nexus</Text>
        <Text style={styles.sub}>SALON MANAGER</Text>

        <TouchableOpacity
          style={[styles.googleBtn, loading && { opacity: 0.6 }]}
          onPress={handleGoogleSignIn}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color="#3c4043" />
            : <>
                <GoogleG size={18} />
                <Text style={styles.googleBtnText}>Sign in with Google</Text>
              </>
          }
        </TouchableOpacity>

        {appleAvailable && !isExpoGo && (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE_OUTLINE}
            cornerRadius={12}
            style={styles.appleBtn}
            onPress={handleAppleSignIn}
          />
        )}

        {/* Email/password — for staff whose salon set up a password login
            (no Google or Apple account required). Also the typed-credential
            path App Review uses with the demo account. */}
        {!showEmail ? (
          <TouchableOpacity style={styles.emailLink} onPress={() => setShowEmail(true)} disabled={loading}>
            <Text style={styles.emailLinkText}>Sign in with email</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.emailForm}>
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={styles._muted.color}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="username"
              autoComplete="email"
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={styles._muted.color}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textContentType="password"
              autoComplete="password"
              onSubmitEditing={handleEmailSignIn}
            />
            <TouchableOpacity
              style={[styles.emailBtn, loading && { opacity: 0.6 }]}
              onPress={handleEmailSignIn}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.emailBtnText}>Sign in</Text>}
            </TouchableOpacity>
          </View>
        )}

        {/* Phone sign-in — staff who linked their number in Profile. */}
        {!showPhone ? (
          <TouchableOpacity style={styles.emailLink} onPress={() => setShowPhone(true)} disabled={loading}>
            <Text style={styles.emailLinkText}>Sign in with phone</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.emailForm}>
            {!otpSent ? (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Mobile number"
                  placeholderTextColor={styles._muted.color}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  textContentType="telephoneNumber"
                  autoComplete="tel"
                  onSubmitEditing={handleSendOtp}
                />
                <TouchableOpacity style={[styles.emailBtn, loading && { opacity: 0.6 }]} onPress={handleSendOtp} disabled={loading} activeOpacity={0.85}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.emailBtnText}>Send code</Text>}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="6-digit code"
                  placeholderTextColor={styles._muted.color}
                  value={otpCode}
                  onChangeText={setOtpCode}
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  autoComplete="sms-otp"
                  maxLength={6}
                  onSubmitEditing={handleVerifyOtp}
                />
                <TouchableOpacity style={[styles.emailBtn, loading && { opacity: 0.6 }]} onPress={handleVerifyOtp} disabled={loading} activeOpacity={0.85}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.emailBtnText}>Verify & sign in</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={{ paddingVertical: 10, alignItems: 'center' }} onPress={() => { setOtpSent(false); setOtpCode(''); }} disabled={loading}>
                  <Text style={styles._muted}>Use a different number</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* Dev-only escape hatch for testing UI inside Expo Go where
            the native Google SDK isn't available. Remove before App Store. */}
        {isExpoGo && (
          <TouchableOpacity
            style={styles.devBtn}
            onPress={async () => {
              setLoading(true);
              try {
                await signInAnonymously(auth);
              } catch (e) {
                Alert.alert(
                  'Anonymous sign-in disabled',
                  'Enable Anonymous in Firebase Console → Authentication → Sign-in method.',
                );
              } finally {
                setLoading(false);
              }
            }}
            disabled={loading}
          >
            <Text style={styles.devBtnText}>Dev: continue without sign-in</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const makeStyles = (t) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card:      { width: '100%', maxWidth: 320, alignItems: 'center', gap: 8 },
  brand:     { fontSize: 52, fontWeight: '400', color: t.text, letterSpacing: 2 },
  sub:       { fontSize: 14, fontWeight: '700', color: t.teal, letterSpacing: 6 },
  tagline:   { fontSize: 12, color: t.textMuted, letterSpacing: 3, marginBottom: 40, textTransform: 'uppercase' },
  googleBtn: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dadce0', borderRadius: 12, paddingVertical: 13 },
  googleBtnText: { color: '#3c4043', fontSize: 15, fontWeight: '600' },
  appleBtn:  { width: '100%', height: 48, marginTop: 12 },
  emailLink: { paddingVertical: 14, alignItems: 'center' },
  emailLinkText: { color: t.textMuted, fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' },
  emailForm: { width: '100%', marginTop: 14, gap: 10 },
  input:     { width: '100%', borderWidth: 1, borderColor: t.border, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, fontSize: 15, color: t.text, backgroundColor: t.surface },
  emailBtn:  { width: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: t.teal, borderRadius: 12, paddingVertical: 13 },
  emailBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  // Placeholder color needs a resolved value, not a style — stashed here so
  // the component can read it via styles._muted.color.
  _muted:    { color: t.placeholder },
  devBtn:    { width: '100%', paddingVertical: 12, alignItems: 'center', marginTop: 14, borderRadius: 12, borderWidth: 1, borderColor: t.border, borderStyle: 'dashed' },
  devBtnText:{ color: t.textMuted, fontSize: 12, fontWeight: '500', letterSpacing: 0.4 },
});
