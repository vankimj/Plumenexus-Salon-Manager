import { useState, useEffect } from 'react';
import { linkWithPopup, OAuthProvider } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useApp } from '../context/AppContext';
import { requestPhoneOtp, verifyPhoneOtp, unlinkPhoneSignin, getPhoneSigninStatus } from '../lib/firestore';

// UserMenu section: one account, many sign-in methods. Shows what's linked
// (Google / Apple from providerData; phone from the server-side phone index)
// and lets the signed-in user add Apple (linkWithPopup — after which Apple
// sign-in matches by Apple user id, so even Hide-My-Email resolves here) or
// link/unlink a phone number (same OTP callables as mobile; when called
// authenticated the verify step LINKS instead of minting a token).
export default function LinkedSignIns() {
  const { gUser, showToast } = useApp();
  const [phoneStatus, setPhoneStatus] = useState(null); // { linked, last4 } | null loading
  const [expanded,    setExpanded]    = useState(false);
  const [phone,       setPhone]       = useState('');
  const [code,        setCode]        = useState('');
  const [sent,        setSent]        = useState(false);
  const [busy,        setBusy]        = useState(false);
  const [err,         setErr]         = useState('');

  const providers = (gUser?.providerData || []).map(p => p.providerId);
  const hasGoogle = providers.includes('google.com');
  const hasApple  = providers.includes('apple.com');

  async function refresh() {
    try { const r = await getPhoneSigninStatus(); setPhoneStatus(r?.ok ? r : { linked: false }); }
    catch { setPhoneStatus({ linked: false }); }
  }
  useEffect(() => { refresh(); }, []); // eslint-disable-line

  async function addApple() {
    setErr('');
    setBusy(true);
    try {
      const provider = new OAuthProvider('apple.com');
      provider.addScope('email');
      await linkWithPopup(auth.currentUser, provider);
      showToast('Apple sign-in added — works even with Hide My Email.');
    } catch (e) {
      if (e.code === 'auth/credential-already-in-use') setErr('That Apple ID is attached to another account. Contact your admin to sort it out.');
      else if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') setErr((e.message || 'Could not link Apple.').replace(/^Firebase: /, ''));
    } finally { setBusy(false); }
  }

  async function sendCode() {
    if (phone.replace(/\D/g, '').length < 10) { setErr('Enter your 10-digit mobile number.'); return; }
    setErr('');
    setBusy(true);
    try {
      const r = await requestPhoneOtp(phone.trim());
      if (r?.ok) setSent(true); else setErr("Couldn't send a code. Try again.");
    } catch (e) { setErr((e.message || "Couldn't send a code.").replace(/^.*?:\s*/, '')); }
    finally { setBusy(false); }
  }

  async function verifyLink() {
    if (code.replace(/\D/g, '').length !== 6) { setErr('Enter the 6-digit code.'); return; }
    setErr('');
    setBusy(true);
    try {
      const r = await verifyPhoneOtp(phone.trim(), code.replace(/\D/g, ''));
      if (r?.ok && r.linked) {
        setExpanded(false); setSent(false); setPhone(''); setCode('');
        await refresh();
        showToast('Phone sign-in enabled.');
      } else setErr("That code didn't work. Request a new one.");
    } catch (e) { setErr((e.message || "That code didn't work.").replace(/^.*?:\s*/, '')); }
    finally { setBusy(false); }
  }

  async function removePhone() {
    if (!window.confirm("Remove phone sign-in? You'll no longer be able to sign in with this number.")) return;
    setBusy(true);
    try { await unlinkPhoneSignin(); await refresh(); }
    catch (e) { setErr(e.message || 'Try again.'); }
    finally { setBusy(false); }
  }

  const row  = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: 'var(--pn-text)', padding: '4px 0' };
  const link = { border: 'none', background: 'none', fontSize: 12, fontWeight: 600, color: '#3D95CE', cursor: 'pointer', fontFamily: 'inherit', padding: 0 };
  const inp  = { width: '100%', fontFamily: 'inherit', border: '1px solid var(--pn-border)', borderRadius: 8, padding: '7px 10px', fontSize: 12, outline: 'none', background: 'var(--pn-bg)', color: 'var(--pn-text)', boxSizing: 'border-box', marginBottom: 6 };
  const btn  = (dis) => ({ width: '100%', padding: 8, borderRadius: 8, border: 'none', background: dis ? '#d0d0d0' : '#2D7A5F', color: '#fff', fontSize: 12, fontWeight: 600, cursor: dis ? 'default' : 'pointer', fontFamily: 'inherit' });

  return (
    <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--pn-border)' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--pn-text-faint)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 7 }}>Sign-in methods</div>

      <div style={row}><span>Google</span><span style={{ color: hasGoogle ? '#16a34a' : 'var(--pn-text-faint)', fontWeight: 600 }}>{hasGoogle ? 'Linked ✓' : '—'}</span></div>
      <div style={row}>
        <span>Apple</span>
        {hasApple
          ? <span style={{ color: '#16a34a', fontWeight: 600 }}>Linked ✓</span>
          : <button onClick={addApple} disabled={busy} style={link}>Add</button>}
      </div>
      <div style={row}>
        <span>Phone</span>
        {phoneStatus === null ? <span style={{ color: 'var(--pn-text-faint)' }}>…</span>
          : phoneStatus.linked
            ? <span style={{ color: '#16a34a', fontWeight: 600 }}>•••• {phoneStatus.last4} <button onClick={removePhone} disabled={busy} style={{ ...link, color: '#ef4444', marginLeft: 6 }}>Remove</button></span>
            : <button onClick={() => { setExpanded(x => !x); setErr(''); }} disabled={busy} style={link}>Set up</button>}
      </div>

      {expanded && !phoneStatus?.linked && (
        <div style={{ marginTop: 6 }}>
          {!sent ? (
            <>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendCode()}
                placeholder="Mobile number" autoComplete="tel" style={inp} />
              <button onClick={sendCode} disabled={busy} style={btn(busy)}>{busy ? 'Sending…' : 'Send code'}</button>
            </>
          ) : (
            <>
              <input type="text" inputMode="numeric" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={e => e.key === 'Enter' && verifyLink()} placeholder="6-digit code" autoComplete="one-time-code" style={{ ...inp, textAlign: 'center', letterSpacing: 3 }} />
              <button onClick={verifyLink} disabled={busy} style={btn(busy)}>{busy ? 'Verifying…' : 'Verify & enable'}</button>
            </>
          )}
        </div>
      )}

      {err && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 6, lineHeight: 1.4 }}>{err}</div>}
    </div>
  );
}
