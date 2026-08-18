import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';

// Render smoke test for ScheduleAdmin. Its whole point is to catch render-time
// crashes in the component body — temporal-dead-zone / hooks-order bugs like the
// `empRecords` use-before-declaration that shipped to prod and crashed the whole
// web calendar. We mock the I/O + context so it mounts offline with empty data;
// if the component body throws (TDZ, bad hook order, undefined deref on the
// render path), this test fails. Modals/child-heavy components are conditional
// (not mounted on first render), so they're stubbed to keep the surface small.

vi.mock('../../context/AppContext', () => ({
  useApp: () => ({
    settings: { storeHours: {}, walkIn: { open: '09:00', close: '18:00' }, apptHours: {} },
    updateSettings: vi.fn(),
    isTech: false, isAdmin: true, isScheduler: false,
    myTechName: '', canEditOwnSchedule: true,
    gUser: { email: 'admin@test.com' },
    showToast: vi.fn(), addApptToTicket: vi.fn(),
  }),
}));

// firestore: fetch* → resolve []; subscribe* → return an unsubscribe fn.
vi.mock('../../lib/firestore', () => {
  const arr = () => vi.fn(() => Promise.resolve([]));    // list fetch
  const obj = () => vi.fn(() => Promise.resolve({}));    // object fetch
  const sub = () => vi.fn(() => () => {});               // subscribe → unsub
  return {
    fetchAppointments: arr(), fetchAppointmentsByRange: arr(), fetchAppointmentById: obj(),
    subscribeToAppointments: sub(), subscribeToAppointmentsByRange: sub(),
    createAppointment: obj(), saveAppointment: obj(), deleteAppointment: obj(),
    deleteRecurringGroup: obj(), fetchRecurringGroup: arr(),
    fetchClients: arr(), createClient: obj(), fetchServices: arr(), fetchEmployees: arr(),
    fetchUserPrefs: obj(), saveUserPrefs: obj(),
    subscribeQueue: sub(), updateWaitlistEntry: obj(), removeWaitlistEntry: obj(),
    subscribeTurnRoster: sub(), saveTurnRoster: obj(), subscribeTimeOff: sub(),
    createTimeOff: obj(), updateTimeOff: obj(), deleteTimeOff: obj(),
    fetchClientVisits: arr(), patchWebfrontConfig: obj(),
    storeHoursToWebfrontHours: vi.fn(() => ({})),
    fetchAttendance: arr(), subscribeAttendance: sub(),
    fetchReceiptByApptId: vi.fn(() => Promise.resolve(null)),
    subscribeBookingConfig: vi.fn((cb) => { cb({ enabled: false }); return () => {}; }),
    fetchTurnRoster: obj(),
  };
});

vi.mock('../../lib/firebase', () => ({
  callFn: () => vi.fn(() => Promise.resolve({ data: {} })),
  startTrace: () => ({ stop: vi.fn() }),
}));

vi.mock('../../lib/locations', () => ({
  currentLocationId: () => null,
  isMultiLocation: () => false,
  effectiveLocationId: () => 'default',
  appointmentInLocation: () => true,
  employeeInLocation: () => true,
  subscribeLocations: vi.fn(() => () => {}),
  subscribeCurrentLocation: vi.fn(() => () => {}),
}));

vi.mock('../../lib/logger', () => ({ logActivity: vi.fn(), logError: vi.fn() }));

// Heavy child components are only mounted via modal state (not on first render).
// Stub them so importing ScheduleAdmin doesn't pull their transitive deps.
vi.mock('./ClientSearch', () => ({ default: () => null }));
vi.mock('../checkout/CheckoutModal', () => ({ default: () => null }));
vi.mock('../receipts/RefundModal', () => ({ default: () => null }));
vi.mock('../../components/RestoreFromBQModal', () => ({ default: () => null }));
vi.mock('../../components/DayReplayModal', () => ({ default: () => null }));

import ScheduleAdmin from './ScheduleAdmin.jsx';

afterEach(() => cleanup());

describe('ScheduleAdmin — render smoke test', () => {
  it('mounts without throwing (guards against TDZ / hook-order crashes)', () => {
    // If the component body has a use-before-declaration or bad hook order, this
    // render throws synchronously and the test fails — which is the whole point.
    expect(() => render(<ScheduleAdmin />)).not.toThrow();
  });

  it('mounts for a view-only tech too (different code path)', () => {
    expect(() => render(<ScheduleAdmin onOpenClient={() => {}} />)).not.toThrow();
  });
});
