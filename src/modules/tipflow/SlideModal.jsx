import { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { clean, normURL, resizeImg } from '../../utils/helpers';
import { logActivity } from '../../lib/logger';
import { fetchEmployees } from '../../lib/firestore';

export default function SlideModal({ editIndex, onClose }) {
  const { slides, addSlide, updateSlide, showToast } = useApp();
  const editing = editIndex >= 0;
  const slide   = editing ? slides[editIndex] : null;

  const [name,       setName]       = useState(slide?.name || '');
  const [venmo,      setVenmo]      = useState(slide?.vu   || '');
  const [ig,         setIg]         = useState(slide?.iu   || '');
  const [fb,         setFb]         = useState(slide?.fu   || '');
  const [url,        setUrl]        = useState(slide?.hu   || '');
  const [imgData,    setImgData]    = useState(slide?.img  || null);
  const [saving,     setSaving]     = useState(false);
  const [employees,  setEmployees]  = useState([]);
  const [pickEmp,    setPickEmp]    = useState('');
  const fileRef = useRef();

  useEffect(() => {
    document.getElementById('slide-modal-sheet').style.transform = 'translateY(0)';
    fetchEmployees()
      .then(emps => setEmployees(emps.filter(e => e.active !== false)))
      .catch(() => {});
  }, []);

  async function importEmployee() {
    const emp = employees.find(e => e.id === pickEmp);
    if (!emp) return;
    const strip = v => (v || '').replace(/^@/, '');
    if (emp.name)      setName(emp.name);
    if (emp.venmo)     setVenmo(strip(emp.venmo));
    if (emp.instagram) setIg(strip(emp.instagram));
    if (emp.facebook)  setFb(strip(emp.facebook));
    if (emp.homepage)  setUrl(emp.homepage || '');
    if (emp.photo) {
      const isExtUrl = emp.photo.startsWith('http://') || emp.photo.startsWith('https://');
      if (isExtUrl) {
        setImgData(emp.photo);
      } else {
        try {
          setImgData(await resizeImg(emp.photo, 400, 500, 0.75));
        } catch {
          setImgData(emp.photo);
        }
      }
    }
    const filled = [emp.name, emp.venmo, emp.instagram, emp.facebook, emp.homepage, emp.photo].filter(Boolean).length;
    showToast(filled <= 1 ? `Imported ${emp.name} — add a photo and social handles in their staff profile` : `Imported from ${emp.name}`);
  }

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    try { setImgData(await resizeImg(file, 400, 500, 0.6)); }
    catch { showToast('Could not process photo', 3000); }
  }

  async function handleSave() {
    const vu = clean(venmo), iu = clean(ig), fu = clean(fb), hu = normURL(url);
    const nm = name.trim();
    if (!nm && !vu && !iu && !fu && !hu) { showToast('Enter a name or at least one link'); return; }
    setSaving(true);
    const data = { img: imgData || null, name: nm || null, vu: vu || null, iu: iu || null, fu: fu || null, hu: hu || null };
    try {
      if (editing) { await updateSlide(editIndex, data); logActivity('slide_edited', nm || 'unnamed'); showToast('Slide updated'); }
      else         { await addSlide(data);               logActivity('slide_added',  nm || 'unnamed'); showToast('Slide added'); }
      onClose();
    } catch { setSaving(false); }
  }

  function closeModal() {
    document.getElementById('slide-modal-sheet').style.transform = 'translateY(100%)';
    setTimeout(onClose, 360);
  }

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'flex-end', zIndex: 10 }}
         onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
      <div id="slide-modal-sheet" style={{ width: '100%', background: '#fff', borderTop: '1px solid #e8e8e8', padding: '18px 18px 22px', maxHeight: '90%', overflowY: 'auto', transform: 'translateY(100%)', transition: 'transform .35s cubic-bezier(.25,.46,.45,.94)', borderRadius: '16px 16px 0 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>{editing ? 'Edit slide' : 'New slide'}</span>
          <button onClick={closeModal} style={{ width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #d0d0d0', background: '#fff', fontSize: 17, cursor: 'pointer' }}>×</button>
        </div>

        {/* Import from employee */}
        {employees.length > 0 && (
          <div style={{ background: '#f0f7ff', border: '1px solid #c7dff7', borderRadius: 10, padding: '10px 12px', marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#1a5f8a', marginBottom: 6 }}>↓ Import from staff member</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <select value={pickEmp} onChange={e => setPickEmp(e.target.value)}
                style={{ flex: 1, fontFamily: 'inherit', border: '1px solid #c7dff7', borderRadius: 8, padding: '7px 10px', fontSize: 13, color: '#333', outline: 'none', background: '#fff' }}>
                <option value="">Pick staff member…</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
              <button onClick={importEmployee} disabled={!pickEmp}
                style={{ fontSize: 12, padding: '7px 14px', borderRadius: 8, border: '1px solid #3D95CE', background: pickEmp ? '#3D95CE' : '#e8e8e8', color: pickEmp ? '#fff' : '#aaa', cursor: pickEmp ? 'pointer' : 'default', fontFamily: 'inherit', fontWeight: 500, flexShrink: 0 }}>
                Import
              </button>
            </div>
            <div style={{ fontSize: 10, color: '#5a8fba', marginTop: 5 }}>
              Fills name, photo, Venmo, Instagram, Facebook, homepage from staff record.
            </div>
          </div>
        )}

        <Field label="Person's name">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Jane Smith" style={{ fontFamily: 'Georgia,serif', ...inputStyle }} />
        </Field>

        <Field label="Headshot">
          <div onClick={() => fileRef.current.click()} style={{ height: 90, border: '1px dashed #ccc', borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer', overflow: 'hidden', position: 'relative', background: '#fafafa' }}>
            {imgData
              ? <img src={imgData} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
              : <>
                  <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#bbb" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                  <span style={{ fontSize: 11, color: '#bbb' }}>Click to upload photo</span>
                </>
            }
          </div>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" style={{ display: 'none' }} onChange={handleFile} />
        </Field>

        <Field label={<><Dot color="#3D95CE" /> Venmo username</>}>
          <UsernameInput value={venmo} onChange={setVenmo} placeholder="username" />
        </Field>
        <Field label={<><Dot color="#E1306C" /> Instagram username</>}>
          <UsernameInput value={ig} onChange={setIg} placeholder="username" />
        </Field>
        <Field label={<><Dot color="#1877F2" /> Facebook username</>}>
          <UsernameInput value={fb} onChange={setFb} placeholder="username" />
        </Field>
        <Field label={<><Dot color="#0D9488" /> Homepage URL</>} last>
          <input value={url} onChange={e => setUrl(e.target.value)} placeholder="example.com" style={inputStyle} />
        </Field>

        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button onClick={closeModal} style={{ flex: 1, ...btnStyle }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 2, ...btnStyle, background: '#3D95CE', color: '#fff', borderColor: '#3D95CE', opacity: saving ? .6 : 1 }}>
            {saving ? 'Saving…' : (editing ? 'Save changes ✓' : 'Add slide →')}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputStyle = { fontFamily: 'inherit', width: '100%', border: '1px solid #d8d8d8', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#333', outline: 'none', background: '#fafafa', boxSizing: 'border-box' };
const btnStyle   = { fontFamily: 'inherit', fontSize: 13, fontWeight: 500, cursor: 'pointer', background: '#fff', border: '1px solid #d0d0d0', borderRadius: 8, padding: '6px 14px', color: '#333' };

function Dot({ color }) { return <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: color, verticalAlign: 'middle', marginRight: 5 }} />; }
function Field({ label, children, last }) {
  return <div style={{ marginBottom: last ? 16 : 12 }}><label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 5 }}>{label}</label>{children}</div>;
}
function UsernameInput({ value, onChange, placeholder }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #d8d8d8', borderRadius: 8, background: '#fafafa', overflow: 'hidden' }}>
      <span style={{ padding: '8px 0 8px 12px', fontSize: 14, fontWeight: 500, color: '#aaa', userSelect: 'none' }}>@</span>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} autoComplete="off" spellCheck={false}
        style={{ flex: 1, border: 'none', background: 'transparent', padding: '8px 12px 8px 3px', fontSize: 13, color: '#333', outline: 'none', fontFamily: 'inherit' }} />
    </div>
  );
}
