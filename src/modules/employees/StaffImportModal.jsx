import { useState } from 'react';
import { importStaffFromScreenshots, createEmployee } from '../../lib/firestore';
import { resizeImg } from '../../utils/helpers';
import { useApp } from '../../context/AppContext';
import { logActivity } from '../../lib/logger';

const norm = (s) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();

// Screenshot → staff import. Upload screenshots of the old system's staff list;
// Claude vision (server-side) extracts the people; the admin reviews/edits an
// editable table, then creates the ones they keep. Nothing is created until the
// admin confirms, and rows that match an existing staff name are flagged + off
// by default so we never duplicate.
export default function StaffImportModal({ existingNames = [], nextSortOrder = 0, onClose, onCreated }) {
  const { showToast } = useApp();
  const existing = new Set(existingNames.map(norm));
  const [step, setStep] = useState('pick');   // pick | review | creating
  const [files, setFiles] = useState([]);      // File[]
  const [rows, setRows] = useState([]);        // {name, role, email, phone, instagram, include, dupe}
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function extract() {
    if (!files.length) { setErr('Add at least one screenshot.'); return; }
    setBusy(true); setErr('');
    try {
      const images = [];
      for (const f of files) {
        const dataUrl = await resizeImg(f, 1600, 1600, 0.85);   // JPEG data URL
        images.push({ imageData: dataUrl.split(',')[1], mediaType: 'image/jpeg' });
      }
      const { staff } = await importStaffFromScreenshots(images);
      const mapped = (staff || []).map(s => {
        const dupe = existing.has(norm(s.name));
        return { ...s, dupe, include: !dupe };   // pre-uncheck existing people
      });
      if (!mapped.length) { setErr("Couldn't read any staff — try clearer or closer screenshots."); setBusy(false); return; }
      setRows(mapped);
      setStep('review');
    } catch (e) {
      setErr(e?.message?.replace(/^.*?:\s*/, '') || 'Extraction failed. Try again.');
    } finally { setBusy(false); }
  }

  function setField(i, k, v) { setRows(rs => rs.map((r, j) => j === i ? { ...r, [k]: v } : r)); }

  async function create() {
    const keep = rows.filter(r => r.include && r.name.trim());
    if (!keep.length) { setErr('Select at least one person to import.'); return; }
    setStep('creating'); setBusy(true); setErr('');
    let made = 0;
    try {
      for (let i = 0; i < keep.length; i++) {
        const r = keep[i];
        await createEmployee({
          name: r.name.trim(),
          email: r.email.trim(),
          phone: r.phone.trim(),
          instagram: r.instagram.trim(),
          notes: r.role.trim() ? `Role: ${r.role.trim()}` : '',
          active: true,
          sortOrder: nextSortOrder + i,
        });
        made++;
      }
      logActivity('staff_import', { count: made, source: 'screenshots' }).catch(() => {});
      showToast?.(`✓ Imported ${made} staff member${made === 1 ? '' : 's'}`);
      onCreated?.();
    } catch (e) {
      setErr(`Imported ${made} before an error: ${e?.message || 'try again'}`);
      setStep('review'); setBusy(false);
    }
  }

  const keepCount = rows.filter(r => r.include && r.name.trim()).length;

  return (
    <div style={overlay} onClick={busy ? undefined : onClose}>
      <div style={sheet} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 16, fontWeight: 700 }}>Import staff from screenshots</span>
          <button onClick={onClose} disabled={busy} style={xBtn}>✕</button>
        </div>

        {step === 'pick' && (
          <div>
            <p style={muted}>
              GlossGenius has no staff export — so upload screenshots of your current staff / team list
              and we'll read the people off them. You'll review everything before anything is created.
            </p>
            <input
              type="file" accept="image/png,image/jpeg,image/webp" multiple
              onChange={e => { setFiles(Array.from(e.target.files || [])); setErr(''); }}
              style={{ margin: '10px 0' }}
            />
            {files.length > 0 && <div style={muted}>{files.length} screenshot{files.length === 1 ? '' : 's'} selected (up to 8).</div>}
            {err && <div style={errBox}>{err}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
              <button onClick={onClose} disabled={busy} style={ghostBtn}>Cancel</button>
              <button onClick={extract} disabled={busy || !files.length} style={primaryBtn}>
                {busy ? 'Reading…' : 'Extract staff'}
              </button>
            </div>
          </div>
        )}

        {step === 'review' && (
          <div>
            <p style={muted}>
              Found <strong>{rows.length}</strong>. Edit anything that's off, uncheck who you don't want.
              Rows marked <em>already exists</em> match a current staff name and are off by default.
            </p>
            <div style={{ maxHeight: '48vh', overflow: 'auto', border: '1px solid var(--pn-border)', borderRadius: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ position: 'sticky', top: 0, background: 'var(--pn-surface)' }}>
                    {['', 'Name', 'Role', 'Email', 'Phone', 'Instagram'].map(h => (
                      <th key={h} style={th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} style={{ opacity: r.include ? 1 : 0.5 }}>
                      <td style={td}>
                        <input type="checkbox" checked={r.include} onChange={e => setField(i, 'include', e.target.checked)} />
                      </td>
                      <td style={td}>
                        <input value={r.name} onChange={e => setField(i, 'name', e.target.value)} style={cell} />
                        {r.dupe && <div style={{ fontSize: 10, color: 'var(--pn-warning)' }}>already exists</div>}
                      </td>
                      <td style={td}><input value={r.role} onChange={e => setField(i, 'role', e.target.value)} style={cell} /></td>
                      <td style={td}><input value={r.email} onChange={e => setField(i, 'email', e.target.value)} style={cell} /></td>
                      <td style={td}><input value={r.phone} onChange={e => setField(i, 'phone', e.target.value)} style={cell} /></td>
                      <td style={td}><input value={r.instagram} onChange={e => setField(i, 'instagram', e.target.value)} style={cell} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {err && <div style={errBox}>{err}</div>}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
              <button onClick={() => { setStep('pick'); setRows([]); }} disabled={busy} style={ghostBtn}>← Back</button>
              <button onClick={create} disabled={busy || !keepCount} style={primaryBtn}>
                Import {keepCount} staff member{keepCount === 1 ? '' : 's'}
              </button>
            </div>
          </div>
        )}

        {step === 'creating' && <div style={{ padding: '30px 0', textAlign: 'center', ...muted }}>Creating staff…</div>}
      </div>
    </div>
  );
}

const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16 };
const sheet = { background: 'var(--pn-surface)', color: 'var(--pn-text)', borderRadius: 12, padding: 20, width: 'min(760px, 96vw)', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' };
const muted = { fontSize: 13, color: 'var(--pn-text-muted)', lineHeight: 1.5, margin: 0 };
const th = { textAlign: 'left', padding: '8px 8px', fontSize: 11, color: 'var(--pn-text-muted)', borderBottom: '1px solid var(--pn-border)', fontWeight: 600 };
const td = { padding: '4px 8px', borderBottom: '1px solid var(--pn-border)', verticalAlign: 'top' };
const cell = { width: '100%', padding: '5px 6px', border: '1px solid var(--pn-border)', borderRadius: 5, background: 'var(--pn-bg)', color: 'var(--pn-text)', fontSize: 13, fontFamily: 'inherit' };
const primaryBtn = { padding: '9px 16px', borderRadius: 8, border: 'none', background: 'var(--pn-green)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' };
const ghostBtn = { padding: '9px 16px', borderRadius: 8, border: '1px solid var(--pn-border-strong)', background: 'transparent', color: 'var(--pn-text)', cursor: 'pointer', fontFamily: 'inherit' };
const xBtn = { border: 'none', background: 'transparent', fontSize: 18, color: 'var(--pn-text-muted)', cursor: 'pointer' };
const errBox = { marginTop: 10, fontSize: 12, color: 'var(--pn-danger)', background: 'var(--pn-danger-bg, rgba(192,57,43,0.08))', padding: '8px 10px', borderRadius: 6 };
