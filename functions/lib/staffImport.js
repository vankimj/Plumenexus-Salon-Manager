// Pure helpers for the screenshot → staff import. The vision call lives in the
// importStaffFromScreenshots callable; parsing/normalizing/deduping the model's
// JSON output lives here so it's unit-testable without the Anthropic SDK.

function normName(s) { return String(s || '').trim().replace(/\s+/g, ' ').toLowerCase(); }

// Normalize one extracted person to our staff shape; returns null if unusable
// (no name). Trims + length-caps every field so a hallucinated blob can't bloat
// a Firestore doc.
function normStaff(p) {
  if (!p || typeof p !== 'object') return null;
  const name = String(p.name || '').trim().replace(/\s+/g, ' ').slice(0, 80);
  if (!name) return null;
  const email = String(p.email || '').trim().slice(0, 120);
  return {
    name,
    role:      String(p.role || '').trim().slice(0, 60),
    email:     /.+@.+\..+/.test(email) ? email : '',        // drop non-emails
    phone:     String(p.phone || '').replace(/[^0-9+()\-.\s]/g, '').trim().slice(0, 32),
    instagram: String(p.instagram || '').trim().replace(/^@/, '').slice(0, 40),
  };
}

// Parse the model's raw text into a clean, deduped staff array. Tolerates a code
// fence and a { "staff": [...] } or bare-array shape. Caps at 200 people.
function parseStaffResponse(rawText) {
  let data;
  try {
    const raw = String(rawText || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    data = JSON.parse(raw);
  } catch { return []; }
  const list = Array.isArray(data) ? data : Array.isArray(data?.staff) ? data.staff : [];
  const seen = new Set();
  const out = [];
  for (const p of list) {
    const s = normStaff(p);
    if (!s) continue;
    const key = normName(s.name);
    if (seen.has(key)) continue;      // dedupe people repeated across screenshots
    seen.add(key);
    out.push(s);
    if (out.length >= 200) break;
  }
  return out;
}

module.exports = { parseStaffResponse, normStaff, normName };
