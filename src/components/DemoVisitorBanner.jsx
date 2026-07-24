import { useApp } from '../context/AppContext';

// Fixed bottom ribbon shown to demo-tenant visitors (role 'visitor' from
// getMyTenantRole). Explains the read-only tour and offers the way back:
// once a salon admin grants their access request, "Check again" drops the
// demo override and reloads under the tenant they originally hit.
export default function DemoVisitorBanner() {
  const { isVisitor } = useApp();
  if (!isVisitor) return null;

  const origin = (() => {
    try { return sessionStorage.getItem('plumenexus_demo_origin') || ''; } catch { return ''; }
  })();

  const checkAgain = () => {
    try {
      sessionStorage.removeItem('plumenexus_tenant_override');
      sessionStorage.removeItem('plumenexus_demo_origin');
    } catch {}
    location.reload();
  };

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9500,
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      background: '#2D7A5F', color: '#fff',
      boxShadow: '0 -2px 10px rgba(0,0,0,.25)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexWrap: 'wrap', gap: '6px 14px', padding: '8px 14px',
        fontSize: 13, lineHeight: 1.35, textAlign: 'center',
      }}>
        <span>
          <strong>Demo tour</strong> — you&rsquo;re viewing a sample salon with read-only demo data.
          {origin && origin !== 'demo' ? ` Waiting on access to ${origin}?` : ''}
        </span>
        <button
          onClick={checkAgain}
          style={{
            background: 'rgba(255,255,255,.16)', color: '#fff',
            border: '1px solid rgba(255,255,255,.45)', borderRadius: 8,
            padding: '4px 12px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
          }}
        >
          I got access — check again
        </button>
      </div>
    </div>
  );
}
