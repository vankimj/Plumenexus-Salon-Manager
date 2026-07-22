import { useApp } from '../context/AppContext';

// Single source of truth for the admin "Preview as…" role picker — used by both
// ModuleShell and HomeScreen (they previously each hardcoded the list, which is
// how Tech went missing whenever no user record had role:'tech' + a linked
// techName). The list is ALWAYS the complete role set: every built-in role
// (Manager, Tech, Scheduler, Read-only, Kiosk) plus each named tech user and
// every custom role.

export function previewLabel(va, customRoles) {
  if (!va) return '';
  if (va.role === 'tech') return va.techName || 'Tech';
  if (va.role === 'scheduler') return 'Front desk';
  if (va.role === 'manager') return 'Manager';
  if (va.role === 'kiosk') return 'Kiosk';
  if (String(va.role || '').startsWith('custom_')) {
    return (customRoles?.roles || []).find(r => r.key === va.role)?.label || 'Custom role';
  }
  return 'View only';
}

export function parsePreview(val) {
  if (!val) return null;
  if (val === 'scheduler') return { role: 'scheduler' };
  if (val === 'readonly') return { role: 'readonly' };
  if (val === 'manager') return { role: 'manager' };
  if (val === 'kiosk') return { role: 'kiosk' };
  // Generic tech preview — no techName anchor; role gating still applies.
  if (val === 'tech') return { role: 'tech', techName: null };
  if (val.startsWith('tech:')) return { role: 'tech', techName: val.slice(5) };
  if (val.startsWith('custom:')) return { role: val.slice(7) };
  return null;
}

export default function PreviewAsSelect() {
  const { users, customRoles, realIsAdmin, viewAs, setViewAs } = useApp();
  if (!realIsAdmin || viewAs) return null;
  const techUsers = (users || []).filter(u => u.role === 'tech' && u.techName);
  return (
    <select value="" onChange={e => { const v = parsePreview(e.target.value); if (v) setViewAs(v); }}
      className="ms-preview-select"
      style={{ height: 40, borderRadius: 20, border: '1px solid var(--pn-border)', background: 'var(--pn-bg)', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--pn-text-muted)', fontFamily: 'inherit', padding: '0 12px', outline: 'none' }}>
      <option value="">👤 Preview as…</option>
      <option value="manager">🧑‍💼 Manager</option>
      <option value="tech">👩‍💼 Tech</option>
      {techUsers.map(u => (
        <option key={u.email} value={`tech:${u.techName}`}>👩‍💼 Tech · {u.techName}</option>
      ))}
      <option value="scheduler">📅 Scheduler</option>
      <option value="readonly">👁 Read-only</option>
      <option value="kiosk">🔒 Kiosk</option>
      {(customRoles?.roles || []).map(r => (
        <option key={r.key} value={`custom:${r.key}`}>⭐ {r.label}</option>
      ))}
    </select>
  );
}
