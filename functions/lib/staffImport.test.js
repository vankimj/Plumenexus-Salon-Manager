import { describe, it, expect } from 'vitest';
import { parseStaffResponse, normStaff } from './staffImport.js';

describe('parseStaffResponse', () => {
  it('parses a { staff: [...] } object', () => {
    const raw = JSON.stringify({ staff: [
      { name: 'Yasmin D', role: 'Nail Technician', email: 'yas@x.com', phone: '(614) 555-0100', instagram: '@yasnails' },
    ] });
    expect(parseStaffResponse(raw)).toEqual([
      { name: 'Yasmin D', role: 'Nail Technician', email: 'yas@x.com', phone: '(614) 555-0100', instagram: 'yasnails' },
    ]);
  });

  it('parses a bare array too', () => {
    const raw = JSON.stringify([{ name: 'Alex Rivers' }]);
    expect(parseStaffResponse(raw)).toEqual([
      { name: 'Alex Rivers', role: '', email: '', phone: '', instagram: '' },
    ]);
  });

  it('tolerates a ```json code fence', () => {
    const raw = '```json\n{"staff":[{"name":"Sam T"}]}\n```';
    expect(parseStaffResponse(raw).map(s => s.name)).toEqual(['Sam T']);
  });

  it('dedupes the same person across screenshots (case/space-insensitive)', () => {
    const raw = JSON.stringify({ staff: [
      { name: 'Jamie  Chen' }, { name: 'jamie chen' }, { name: 'Morgan Lee' },
    ] });
    expect(parseStaffResponse(raw).map(s => s.name)).toEqual(['Jamie Chen', 'Morgan Lee']);
  });

  it('drops entries with no name', () => {
    const raw = JSON.stringify({ staff: [{ role: 'Owner' }, { name: '' }, { name: 'Real Person' }] });
    expect(parseStaffResponse(raw).map(s => s.name)).toEqual(['Real Person']);
  });

  it('strips a non-email from the email field but keeps the person', () => {
    const s = normStaff({ name: 'Pat', email: 'not-an-email' });
    expect(s.email).toBe('');
    expect(s.name).toBe('Pat');
  });

  it('strips a leading @ from instagram and sanitizes phone', () => {
    const s = normStaff({ name: 'Q', instagram: '@handle', phone: '614.555.0100 ext' });
    expect(s.instagram).toBe('handle');
    expect(s.phone).toBe('614.555.0100 ext'.replace(/[^0-9+()\-.\s]/g, '').trim());
  });

  it('returns [] on unparseable input', () => {
    expect(parseStaffResponse('sorry, I could not read that')).toEqual([]);
    expect(parseStaffResponse('')).toEqual([]);
    expect(parseStaffResponse(null)).toEqual([]);
  });
});
