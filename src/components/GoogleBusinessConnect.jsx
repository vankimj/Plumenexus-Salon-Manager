import { useState, useEffect } from 'react';
import {
  subscribeGoogleBusinessAuth, startGoogleBusinessAuth,
  syncGoogleBusinessReviews, disconnectGoogleBusiness, updateGoogleBusinessLocation,
} from '../lib/firestore';
import { subscribeLocations, activeLocations, isMultiLocation } from '../lib/locations';

// Guided "connect your Google reviews" wizard, shown at the top of the Reviews
// report. Walks a salon owner through the one-time Google Business Profile OAuth,
// then flips to a connected status card with sync/disconnect. A single Google
// login can manage several listings — when more than one location is connected
// (or the salon itself is multi-location), this shows a per-location list where
// each Google listing is mapped to an app location, synced, or removed.
const GREEN = '#2D7A5F';
const GOOGLE = '#4285f4';

const STEPS = [
  { n: 1, title: 'Make sure you manage the listing', body: 'You need to be an owner or manager of your salon’s Google Business Profile — the account you use to reply to reviews on Google.' },
  { n: 2, title: 'Sign in with Google', body: 'Click Connect below, sign in with that Google account, and approve read access to your reviews. We never post or change anything.' },
  { n: 3, title: 'We pull in every review', body: 'All reviews from every location you manage sync here (not just the 5 Google shows publicly) and refresh automatically every night. You can also sync on demand.' },
];

// Treat a legacy single-location auth doc (top-level fields, no locations[]) as
// a one-entry list so the UI can render every doc uniformly.
function entriesFromAuth(auth) {
  if (!auth) return [];
  if (Array.isArray(auth.locations) && auth.locations.length) return auth.locations;
  if (auth.locationName) {
    return [{
      accountName:   auth.accountName || '',
      locationName:  auth.locationName,
      locationTitle: auth.locationTitle || '',
      appLocationId: auth.appLocationId ?? null,
      active:        true,
      lastSyncAt:    auth.lastSyncAt ?? null,
      lastSyncCount: auth.lastSyncCount ?? 0,
      lastSyncError: auth.lastSyncError ?? null,
    }];
  }
  return [];
}

export default function GoogleBusinessConnect() {
  const [auth,       setAuth]       = useState(undefined); // undefined = loading, null = not connected
  const [locState,   setLocState]   = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [busy,       setBusy]       = useState('');        // '' | 'all' | a locationName currently syncing
  const [msg,        setMsg]        = useState(null);

  useEffect(() => subscribeGoogleBusinessAuth(setAuth), []);
  useEffect(() => subscribeLocations(setLocState), []);

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
  async function handleSync(locationName) {
    setMsg(null); setBusy(locationName || 'all');
    try {
      const r = await syncGoogleBusinessReviews(locationName);
      setMsg({ ok: true, text: `✓ Synced ${r?.written ?? r?.total ?? 0} review${(r?.written === 1) ? '' : 's'} from Google.` });
    } catch (e) {
      setMsg({ ok: false, text: '✗ ' + (e?.message || 'Sync failed.') });
    }
    setBusy('');
  }
  async function handleDisconnect() {
    if (!window.confirm('Disconnect Google Business Profile? Reviews already synced stay in your reports.')) return;
    setMsg(null);
    try { await disconnectGoogleBusiness(); setMsg({ ok: true, text: '✓ Disconnected.' }); }
    catch (e) { setMsg({ ok: false, text: '✗ ' + (e?.message || 'Disconnect failed.') }); }
  }
  async function handleRemove(entry) {
    if (!window.confirm(`Remove ${entry.locationTitle || entry.locationName}? Reviews already synced stay in your reports.`)) return;
    setMsg(null);
    try { await updateGoogleBusinessLocation(entry.locationName, { remove: true }); setMsg({ ok: true, text: '✓ Location removed.' }); }
    catch (e) { setMsg({ ok: false, text: '✗ ' + (e?.message || 'Remove failed.') }); }
  }
  async function handleRemap(entry, appLocationId) {
    setMsg(null);
    try { await updateGoogleBusinessLocation(entry.locationName, { appLocationId: appLocationId || null }); }
    catch (e) { setMsg({ ok: false, text: '✗ ' + (e?.message || 'Could not update mapping.') }); }
  }

  const card = { background: 'var(--pn-surface)', border: '1px solid var(--pn-border)', borderRadius: 14, padding: '20px 22px', marginBottom: 20 };
  if (auth === undefined) return null; // don't flash the wizard before we know the state

  const entries = entriesFromAuth(auth);
  const appLocs = activeLocations(locState);
  const multiApp = isMultiLocation(locState);
  const appLocName = (id) => (appLocs.find(l => l.id === id)?.name) || id;

  // ── Connected ─────────────────────────────────────────────────────────
  if (auth && entries.length) {
    const showList = entries.length > 1 || (entries.length === 1 && multiApp);

    // Single Google location + single app location → compact card (unchanged).
    if (!showList) {
      const e = entries[0];
      return (
        <div style={{ ...card, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--pn-success-bg)', color: 'var(--pn-success)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>✓</div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--pn-text)' }}>
              Google reviews connected{(e.locationTitle || e.locationName) ? ` · ${e.locationTitle || e.locationName}` : ''}
            </div>
            <div style={{ fontSize: 12, color: 'var(--pn-text-faint)', marginTop: 2 }}>
              {e.lastSyncAt
                ? `Last synced ${new Date(e.lastSyncAt).toLocaleString()} · ${e.lastSyncCount ?? 0} reviews`
                : 'Not synced yet — click “Sync now”.'}
            </div>
            {e.lastSyncError && <div style={{ fontSize: 12, color: 'var(--pn-danger)', marginTop: 3 }}>Last sync error: {e.lastSyncError}</div>}
            {msg && <div style={{ fontSize: 12, color: msg.ok ? GREEN : 'var(--pn-danger)', marginTop: 4, fontWeight: 500 }}>{msg.text}</div>}
          </div>
          <button onClick={() => handleSync()} disabled={!!busy}
            style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: busy ? '#aaa' : GREEN, color: '#fff', fontSize: 13, fontWeight: 600, cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
            {busy ? 'Syncing…' : '↻ Sync now'}
          </button>
          <button onClick={handleDisconnect}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--pn-border)', background: 'transparent', color: 'var(--pn-text-faint)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
            Disconnect
          </button>
        </div>
      );
    }

    // Multiple Google locations (or a multi-location salon) → per-location list.
    return (
      <div style={{ ...card }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--pn-success-bg)', color: 'var(--pn-success)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>✓</div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--pn-text)' }}>Google reviews · {entries.length} locations</div>
            <div style={{ fontSize: 12, color: 'var(--pn-text-faint)', marginTop: 2 }}>Map each Google listing to a salon location. Reviews sync nightly.</div>
          </div>
          <button onClick={() => handleSync()} disabled={!!busy}
            style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: busy === 'all' ? '#aaa' : GREEN, color: '#fff', fontSize: 13, fontWeight: 600, cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
            {busy === 'all' ? 'Syncing…' : '↻ Sync all'}
          </button>
        </div>

        <div style={{ display: 'grid', gap: 10 }}>
          {entries.map((e) => (
            <div key={e.locationName} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, padding: '12px 14px', border: '1px solid var(--pn-border)', borderRadius: 10, background: 'var(--pn-surface-alt)', opacity: e.active === false ? 0.55 : 1 }}>
              <div style={{ flex: 1, minWidth: 170 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--pn-text)' }}>{e.locationTitle || e.locationName}</div>
                <div style={{ fontSize: 11.5, color: 'var(--pn-text-faint)', marginTop: 2 }}>
                  {e.lastSyncAt ? `Synced ${new Date(e.lastSyncAt).toLocaleDateString()} · ${e.lastSyncCount ?? 0} reviews` : 'Not synced yet'}
                </div>
                {e.lastSyncError && <div style={{ fontSize: 11.5, color: 'var(--pn-danger)', marginTop: 2 }}>{e.lastSyncError}</div>}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11.5, color: 'var(--pn-text-faint)' }}>→</span>
                {multiApp ? (
                  <select value={e.appLocationId || ''} onChange={ev => handleRemap(e, ev.target.value)}
                    style={{ padding: '6px 8px', borderRadius: 7, border: '1px solid var(--pn-border)', background: 'var(--pn-surface)', color: 'var(--pn-text)', fontSize: 12.5, fontFamily: 'inherit', maxWidth: 170 }}>
                    <option value="">Unassigned</option>
                    {appLocs.map(l => <option key={l.id} value={l.id}>{l.name || l.id}</option>)}
                  </select>
                ) : (
                  <span style={{ fontSize: 12.5, color: 'var(--pn-text-muted)' }}>{e.appLocationId ? appLocName(e.appLocationId) : 'Main'}</span>
                )}
              </div>

              <button onClick={() => handleSync(e.locationName)} disabled={!!busy}
                style={{ padding: '7px 12px', borderRadius: 7, border: 'none', background: busy === e.locationName ? '#aaa' : GREEN, color: '#fff', fontSize: 12, fontWeight: 600, cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                {busy === e.locationName ? 'Syncing…' : '↻ Sync'}
              </button>
              <button onClick={() => handleRemove(e)}
                style={{ padding: '7px 10px', borderRadius: 7, border: '1px solid var(--pn-border)', background: 'transparent', color: 'var(--pn-text-faint)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                Remove
              </button>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 14 }}>
          <button onClick={handleConnect} disabled={connecting}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 8, border: `1px solid ${GOOGLE}`, background: 'transparent', color: GOOGLE, fontSize: 12.5, fontWeight: 600, cursor: connecting ? 'default' : 'pointer', fontFamily: 'inherit' }}>
            <span>🔗</span>{connecting ? 'Opening Google…' : 'Connect another Google account'}
          </button>
          {msg && <div style={{ fontSize: 12.5, color: msg.ok ? GREEN : 'var(--pn-danger)', fontWeight: 500 }}>{msg.text}</div>}
        </div>
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
        Connect your Google Business Profile once and every review — from every location you manage — flows into this report with a per‑tech breakdown and onto your booking site. Takes about a minute.
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
