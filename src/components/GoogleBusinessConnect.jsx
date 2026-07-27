import { useState, useEffect } from 'react';
import {
  subscribeGoogleBusinessAuth, startGoogleBusinessAuth,
  syncGoogleBusinessReviews, disconnectGoogleBusiness,
} from '../lib/firestore';

// Guided "connect your Google reviews" wizard, shown at the top of the Reviews
// report. Walks a salon owner through the one-time Google Business Profile OAuth,
// then flips to a connected status card with sync/disconnect. (Moved here from
// Admin → Settings so the connection lives where the reviews live.)
const GREEN = '#2D7A5F';
const GOOGLE = '#4285f4';

const STEPS = [
  { n: 1, title: 'Make sure you manage the listing', body: 'You need to be an owner or manager of your salon’s Google Business Profile — the account you use to reply to reviews on Google.' },
  { n: 2, title: 'Sign in with Google', body: 'Click Connect below, sign in with that Google account, and approve read access to your reviews. We never post or change anything.' },
  { n: 3, title: 'We pull in every review', body: 'All of your reviews sync here (not just the 5 Google shows publicly) and refresh automatically every night. You can also sync on demand.' },
];

export default function GoogleBusinessConnect() {
  const [auth,       setAuth]       = useState(undefined); // undefined = loading, null = not connected
  const [connecting, setConnecting] = useState(false);
  const [syncing,    setSyncing]    = useState(false);
  const [msg,        setMsg]        = useState(null);

  useEffect(() => subscribeGoogleBusinessAuth(setAuth), []);

  // The OAuth callback page posts back into the opener when it finishes.
  useEffect(() => {
    function onMessage(e) {
      if (e.data?.type === 'google-business-auth') {
        setConnecting(false);
        setMsg(e.data.ok
          ? { ok: true, text: '✓ Connected — pulling in your reviews…' }
          : { ok: false, text: '✗ Connection didn’t complete. Please try again.' });
        if (e.data.ok) handleSync();   // first sync immediately on connect
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleConnect() {
    setMsg(null); setConnecting(true);
    try {
      const { authUrl } = await startGoogleBusinessAuth();
      const w = window.open(authUrl, 'gbp-auth', 'width=540,height=720');
      if (!w) { setMsg({ ok: false, text: '✗ Popup blocked — allow popups for this site and try again.' }); setConnecting(false); }
    } catch (e) {
      setMsg({ ok: false, text: '✗ ' + (e?.message || 'Could not start the connection.') });
      setConnecting(false);
    }
  }
  async function handleSync() {
    setMsg(null); setSyncing(true);
    try {
      const r = await syncGoogleBusinessReviews();
      setMsg({ ok: true, text: `✓ Synced ${r?.written ?? r?.total ?? 0} reviews from Google.` });
    } catch (e) {
      setMsg({ ok: false, text: '✗ ' + (e?.message || 'Sync failed.') });
    }
    setSyncing(false);
  }
  async function handleDisconnect() {
    if (!window.confirm('Disconnect Google Business Profile? Reviews already synced stay in your reports.')) return;
    setMsg(null);
    try { await disconnectGoogleBusiness(); setMsg({ ok: true, text: '✓ Disconnected.' }); }
    catch (e) { setMsg({ ok: false, text: '✗ ' + (e?.message || 'Disconnect failed.') }); }
  }

  const card = { background: 'var(--pn-surface)', border: '1px solid var(--pn-border)', borderRadius: 14, padding: '20px 22px', marginBottom: 20 };
  if (auth === undefined) return null; // don't flash the wizard before we know the state

  // ── Connected: compact status + controls ──────────────────────────────
  if (auth) {
    return (
      <div style={{ ...card, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--pn-success-bg)', color: 'var(--pn-success)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>✓</div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--pn-text)' }}>
            Google reviews connected{(auth.locationTitle || auth.locationName) ? ` · ${auth.locationTitle || auth.locationName}` : ''}
          </div>
          <div style={{ fontSize: 12, color: 'var(--pn-text-faint)', marginTop: 2 }}>
            {auth.lastSyncAt
              ? `Last synced ${new Date(auth.lastSyncAt).toLocaleString()} · ${auth.lastSyncCount ?? 0} reviews`
              : 'Not synced yet — click “Sync now”.'}
          </div>
          {auth.lastSyncError && <div style={{ fontSize: 12, color: 'var(--pn-danger)', marginTop: 3 }}>Last sync error: {auth.lastSyncError}</div>}
          {msg && <div style={{ fontSize: 12, color: msg.ok ? GREEN : 'var(--pn-danger)', marginTop: 4, fontWeight: 500 }}>{msg.text}</div>}
        </div>
        <button onClick={handleSync} disabled={syncing}
          style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: syncing ? '#aaa' : GREEN, color: '#fff', fontSize: 13, fontWeight: 600, cursor: syncing ? 'default' : 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
          {syncing ? 'Syncing…' : '↻ Sync now'}
        </button>
        <button onClick={handleDisconnect}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--pn-border)', background: 'transparent', color: 'var(--pn-text-faint)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
          Disconnect
        </button>
      </div>
    );
  }

  // ── Not connected: the guided wizard ──────────────────────────────────
  return (
    <div style={{ ...card, padding: '26px 24px', background: 'linear-gradient(180deg, var(--pn-surface) 0%, var(--pn-surface-alt) 100%)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <span style={{ fontSize: 20 }}>⭐</span>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--pn-text)' }}>Show your Google reviews here</h3>
      </div>
      <p style={{ margin: '0 0 20px', fontSize: 13.5, color: 'var(--pn-text-muted)', lineHeight: 1.55, maxWidth: 560 }}>
        Connect your Google Business Profile once and every review flows into this report — with a per‑tech breakdown — and onto your booking site. Takes about a minute.
      </p>

      <div style={{ display: 'grid', gap: 12, marginBottom: 22 }}>
        {STEPS.map(s => (
          <div key={s.n} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--pn-surface)', border: `1.5px solid ${GREEN}`, color: GREEN, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>{s.n}</div>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--pn-text)' }}>{s.title}</div>
              <div style={{ fontSize: 12.5, color: 'var(--pn-text-muted)', lineHeight: 1.5, marginTop: 2 }}>{s.body}</div>
            </div>
          </div>
        ))}
      </div>

      <button onClick={handleConnect} disabled={connecting}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '11px 20px', borderRadius: 9, border: 'none', background: connecting ? '#9db8e8' : GOOGLE, color: '#fff', fontSize: 14, fontWeight: 600, cursor: connecting ? 'default' : 'pointer', fontFamily: 'inherit' }}>
        <span style={{ fontSize: 15 }}>🔗</span>
        {connecting ? 'Opening Google…' : 'Connect Google Business Profile'}
      </button>
      <div style={{ fontSize: 11.5, color: 'var(--pn-text-faint)', marginTop: 10 }}>
        Read‑only access to your reviews. We never post, reply, or change anything on your Google listing.
      </div>
      {msg && <div style={{ fontSize: 12.5, color: msg.ok ? GREEN : 'var(--pn-danger)', marginTop: 10, fontWeight: 500 }}>{msg.text}</div>}
    </div>
  );
}
