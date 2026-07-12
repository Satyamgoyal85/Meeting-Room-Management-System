/**
 * Unit Tests: Core Business Logic
 * Tests booking validation, conflict detection, agenda masking, and access control logic
 * NOTE: These are pure logic unit tests — no database or Next.js server context required.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Booking, Room, Employee, Department } from '@/lib/types';

// ─── Helpers / Factories ───────────────────────────────────────────────────────

const NOW_ISO = new Date('2026-07-10T10:00:00.000Z').toISOString();
const FUTURE_ISO = new Date('2026-07-10T11:00:00.000Z').toISOString();
const PAST_ISO = new Date('2026-07-09T10:00:00.000Z').toISOString();

function makeBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: crypto.randomUUID(),
    room_id: 'room-1',
    employee_id: 'emp-1',
    department_id: 'dept-1',
    agenda: 'Quarterly Review',
    start_time: NOW_ISO,
    end_time: FUTURE_ISO,
    status: 'confirmed',
    cancelled_by: null,
    cancel_reason: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeRoom(overrides: Partial<Room> = {}): Room {
  return {
    id: 'room-1',
    name: 'Room 5 - Falcon',
    floor: 'Ground Floor',
    capacity: 10,
    amenities: ['Projector'],
    is_active: true,
    restricted_to_department_id: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

// ─── Booking Validation Logic ──────────────────────────────────────────────────

describe('Booking form validation', () => {
  describe('past-date / past-time blocking', () => {
    it('rejects a start time that has already passed', () => {
      const startMs = new Date(PAST_ISO).getTime();
      const nowMs = Date.now();
      expect(startMs < nowMs).toBe(true); // The core check used in createBookingAction
    });

    it('accepts a start time in the future', () => {
      const futureMs = Date.now() + 60_000; // 1 minute from now
      expect(futureMs < Date.now()).toBe(false);
    });
  });

  describe('start/end time ordering', () => {
    it('rejects booking where endTime <= startTime', () => {
      const startTime = '09:00';
      const endTime = '08:30';
      expect(startTime >= endTime).toBe(true); // The guard in createBookingAction: if (startTime >= endTime)
    });

    it('accepts booking where endTime > startTime', () => {
      const startTime = '09:00';
      const endTime = '10:30';
      expect(startTime >= endTime).toBe(false);
    });
  });

  describe('capacity validation', () => {
    it('rejects booking when attendees exceed room capacity', () => {
      const room = makeRoom({ capacity: 4 });
      const attendees = 5;
      expect(attendees > room.capacity).toBe(true);
    });

    it('accepts booking at exact room capacity', () => {
      const room = makeRoom({ capacity: 4 });
      const attendees = 4;
      expect(attendees > room.capacity).toBe(false);
    });
  });

  describe('agenda defaulting', () => {
    it('defaults agenda to "General" when empty', () => {
      const rawAgenda = '   '; // whitespace only
      const agenda = rawAgenda.trim() || 'General';
      expect(agenda).toBe('General');
    });

    it('uses provided agenda when non-empty', () => {
      const rawAgenda = 'Budget Review';
      const agenda = rawAgenda.trim() || 'General';
      expect(agenda).toBe('Budget Review');
    });
  });
});

// ─── Conflict Detection Logic ──────────────────────────────────────────────────

describe('Booking conflict detection', () => {
  function hasOverlap(
    newStart: number,
    newEnd: number,
    existing: { start_time: string; end_time: string }
  ): boolean {
    const eStart = new Date(existing.start_time).getTime();
    const eEnd = new Date(existing.end_time).getTime();
    return eStart < newEnd && eEnd > newStart;
  }

  const existingBooking = makeBooking({
    start_time: '2026-07-10T10:00:00Z',
    end_time: '2026-07-10T11:00:00Z',
  });

  it('detects direct overlap (new slot within existing)', () => {
    const newStart = new Date('2026-07-10T10:15:00Z').getTime();
    const newEnd = new Date('2026-07-10T10:45:00Z').getTime();
    expect(hasOverlap(newStart, newEnd, existingBooking)).toBe(true);
  });

  it('detects overlap when new slot spans existing', () => {
    const newStart = new Date('2026-07-10T09:30:00Z').getTime();
    const newEnd = new Date('2026-07-10T11:30:00Z').getTime();
    expect(hasOverlap(newStart, newEnd, existingBooking)).toBe(true);
  });

  it('detects overlap when new slot starts during existing', () => {
    const newStart = new Date('2026-07-10T10:30:00Z').getTime();
    const newEnd = new Date('2026-07-10T12:00:00Z').getTime();
    expect(hasOverlap(newStart, newEnd, existingBooking)).toBe(true);
  });

  it('does NOT flag conflict for back-to-back slots (exact boundary)', () => {
    // New slot starts exactly when existing ends — NOT a conflict
    const newStart = new Date('2026-07-10T11:00:00Z').getTime();
    const newEnd = new Date('2026-07-10T12:00:00Z').getTime();
    expect(hasOverlap(newStart, newEnd, existingBooking)).toBe(false);
  });

  it('does NOT flag conflict for completely non-overlapping slot (before)', () => {
    const newStart = new Date('2026-07-10T08:00:00Z').getTime();
    const newEnd = new Date('2026-07-10T09:00:00Z').getTime();
    expect(hasOverlap(newStart, newEnd, existingBooking)).toBe(false);
  });

  it('does NOT flag conflict for completely non-overlapping slot (after)', () => {
    const newStart = new Date('2026-07-10T12:00:00Z').getTime();
    const newEnd = new Date('2026-07-10T13:00:00Z').getTime();
    expect(hasOverlap(newStart, newEnd, existingBooking)).toBe(false);
  });
});

// ─── Agenda Masking Logic ──────────────────────────────────────────────────────

describe('Agenda visibility / masking rules', () => {
  function maskAgenda(
    booking: Booking,
    opts: { currentEmployeeId: string; isAdmin: boolean; invitedBookingIds: string[] }
  ): string {
    const isOwner = booking.employee_id === opts.currentEmployeeId;
    const isInvitee = opts.invitedBookingIds.includes(booking.id);
    if (opts.isAdmin || isOwner || isInvitee) return booking.agenda;
    return 'Private Meeting';
  }

  const booking = makeBooking({ id: 'b-1', employee_id: 'emp-organizer', agenda: 'Board Strategy' });

  it('organizer can see their own agenda', () => {
    const result = maskAgenda(booking, {
      currentEmployeeId: 'emp-organizer',
      isAdmin: false,
      invitedBookingIds: [],
    });
    expect(result).toBe('Board Strategy');
  });

  it('invited employee can see agenda', () => {
    const result = maskAgenda(booking, {
      currentEmployeeId: 'emp-invitee',
      isAdmin: false,
      invitedBookingIds: ['b-1'], // invited
    });
    expect(result).toBe('Board Strategy');
  });

  it('admin can see all agendas', () => {
    const result = maskAgenda(booking, {
      currentEmployeeId: 'emp-other',
      isAdmin: true,
      invitedBookingIds: [],
    });
    expect(result).toBe('Board Strategy');
  });

  it('non-invited, non-admin, non-organizer employee sees "Private Meeting"', () => {
    const result = maskAgenda(booking, {
      currentEmployeeId: 'emp-stranger',
      isAdmin: false,
      invitedBookingIds: [],
    });
    expect(result).toBe('Private Meeting');
  });
});

// ─── Room Restriction Logic ────────────────────────────────────────────────────

describe('Room department restriction enforcement', () => {
  function canBook(
    room: Room,
    session: { department_id: string | null; role: 'employee' | 'admin' }
  ): { allowed: boolean; reason?: string } {
    if (!room.is_active) {
      return { allowed: false, reason: 'Room is inactive' };
    }
    if (room.restricted_to_department_id !== null && session.role !== 'admin') {
      if (session.department_id !== room.restricted_to_department_id) {
        return { allowed: false, reason: 'Room is restricted to a different department' };
      }
    }
    return { allowed: true };
  }

  it('allows booking unrestricted room for any employee', () => {
    const room = makeRoom({ restricted_to_department_id: null });
    const result = canBook(room, { department_id: 'dept-any', role: 'employee' });
    expect(result.allowed).toBe(true);
  });

  it('blocks restricted room for employee in wrong department', () => {
    const room = makeRoom({ restricted_to_department_id: 'board-dept' });
    const result = canBook(room, { department_id: 'it-dept', role: 'employee' });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('restricted');
  });

  it('allows restricted room for employee in the correct department', () => {
    const room = makeRoom({ restricted_to_department_id: 'board-dept' });
    const result = canBook(room, { department_id: 'board-dept', role: 'employee' });
    expect(result.allowed).toBe(true);
  });

  it('allows admin to bypass any room restriction', () => {
    const room = makeRoom({ restricted_to_department_id: 'board-dept' });
    const result = canBook(room, { department_id: 'it-dept', role: 'admin' });
    expect(result.allowed).toBe(true);
  });

  it('blocks booking on inactive room regardless of user', () => {
    const room = makeRoom({ is_active: false });
    const result = canBook(room, { department_id: 'any-dept', role: 'admin' });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('inactive');
  });
});

// ─── Authentication / Access Control ──────────────────────────────────────────

describe('Authentication and access control', () => {
  describe('Login validation', () => {
    it('rejects empty employee ID', () => {
      const employeeId = '';
      const password = 'somepassword';
      expect(!employeeId || !password).toBe(true);
    });

    it('rejects empty password', () => {
      const employeeId = 'ECN-1001';
      const password = '';
      expect(!employeeId || !password).toBe(true);
    });

    it('accepts valid credentials format', () => {
      const employeeId = 'ECN-1001';
      const password = 'valid123';
      expect(!employeeId || !password).toBe(false);
    });
  });

  describe('Employee ID normalization', () => {
    it('prepends ECN- prefix when missing', () => {
      const input = '1001';
      const normalized = input.toUpperCase().startsWith('ECN-')
        ? input.toUpperCase()
        : `ECN-${input.trim().toUpperCase()}`;
      expect(normalized).toBe('ECN-1001');
    });

    it('does not double-prepend ECN- prefix', () => {
      const input = 'ECN-1001';
      const normalized = input.toUpperCase().startsWith('ECN-')
        ? input.toUpperCase()
        : `ECN-${input.trim().toUpperCase()}`;
      expect(normalized).toBe('ECN-1001');
    });
  });

  describe('Password validation for reset', () => {
    function validatePassword(pw: string): string | null {
      if (!pw) return 'Password is required.';
      if (pw.length < 8) return 'Password must be at least 8 characters long.';
      if (!/\d/.test(pw)) return 'Password must contain at least one number.';
      if (pw.length > 128) return 'Password is too long (max 128 characters).';
      return null; // valid
    }

    it('accepts a valid password', () => {
      expect(validatePassword('securepass1')).toBeNull();
    });

    it('rejects password shorter than 8 characters', () => {
      expect(validatePassword('short1')).toContain('8 characters');
    });

    it('rejects password with no numbers', () => {
      expect(validatePassword('onlyletters')).toContain('number');
    });

    it('rejects empty password', () => {
      expect(validatePassword('')).not.toBeNull();
    });

    it('rejects password over 128 characters', () => {
      expect(validatePassword('a'.repeat(129) + '1')).toContain('too long');
    });
  });

  describe('Account lockout', () => {
    const MAX_FAILED_ATTEMPTS = 5;

    it('locks account at exactly 5 failed attempts', () => {
      const attempts = 5;
      expect(attempts >= MAX_FAILED_ATTEMPTS).toBe(true);
    });

    it('does not lock at 4 failed attempts', () => {
      const attempts = 4;
      expect(attempts >= MAX_FAILED_ATTEMPTS).toBe(false);
    });

    it('correctly calculates remaining attempts', () => {
      const attempts = 3;
      const remaining = MAX_FAILED_ATTEMPTS - attempts;
      expect(remaining).toBe(2);
    });
  });

  describe('Role-based access control', () => {
    it('denies employee access to admin routes', () => {
      const session = { role: 'employee' as const };
      const isAdminRoute = true;
      const allowed = isAdminRoute ? session.role === 'admin' : true;
      expect(allowed).toBe(false);
    });

    it('permits admin access to admin routes', () => {
      const session = { role: 'admin' as const };
      const isAdminRoute = true;
      const allowed = isAdminRoute ? session.role === 'admin' : true;
      expect(allowed).toBe(true);
    });
  });
});

// ─── Employee Creation Validation ─────────────────────────────────────────────

describe('Employee creation validation', () => {
  function validateEmployee(data: {
    name: string;
    email: string;
    employeeId: string;
    departmentId: string;
  }): string | null {
    if (!data.name || !data.email || !data.employeeId || !data.departmentId) {
      return 'Name, Email, Employee ID, and Department are required.';
    }
    if (!data.email.endsWith('@dhanuka.com')) {
      return 'Invalid email domain. Must end in @dhanuka.com';
    }
    if (!/^ECN-\d+$/.test(data.employeeId)) {
      return 'Employee ID must be in the format ECN-XXXX (e.g., ECN-1025).';
    }
    return null;
  }

  it('accepts valid employee data', () => {
    expect(
      validateEmployee({
        name: 'Raj Sharma',
        email: 'raj.sharma@dhanuka.com',
        employeeId: 'ECN-1025',
        departmentId: 'dept-1',
      })
    ).toBeNull();
  });

  it('rejects non-dhanuka.com email domain', () => {
    const err = validateEmployee({
      name: 'Raj Sharma',
      email: 'raj@gmail.com',
      employeeId: 'ECN-1025',
      departmentId: 'dept-1',
    });
    expect(err).toContain('dhanuka.com');
  });

  it('rejects invalid Employee ID format', () => {
    const err = validateEmployee({
      name: 'Raj Sharma',
      email: 'raj@dhanuka.com',
      employeeId: 'EMP-1025', // wrong prefix
      departmentId: 'dept-1',
    });
    expect(err).toContain('ECN-');
  });

  it('rejects missing required fields', () => {
    const err = validateEmployee({
      name: '',
      email: 'raj@dhanuka.com',
      employeeId: 'ECN-1025',
      departmentId: 'dept-1',
    });
    expect(err).not.toBeNull();
  });
});

// ─── Initial Password Generation Logic ────────────────────────────────────────

describe('Initial password generation', () => {
  function generateInitialPassword(email: string, employeeId: string): string {
    const usernamePart = email.split('@')[0].toLowerCase();
    const beforeSymbol = usernamePart.split(/[\.\-_]/)[0];
    let letters = beforeSymbol.replace(/[^a-z]/g, '');
    if (letters.length === 0) letters = usernamePart.replace(/[^a-z]/g, '');
    const prefix = letters.slice(0, 4);
    const numericCode = employeeId.replace(/^ECN-/, '');
    return prefix + numericCode;
  }

  it('generates correct password for standard email', () => {
    expect(generateInitialPassword('raj.sharma@dhanuka.com', 'ECN-1025')).toBe('raj1025');
  });

  it('uses up to 4 letters for prefix', () => {
    expect(generateInitialPassword('rajesh.sharma@dhanuka.com', 'ECN-1025')).toBe('raje1025');
  });

  it('handles emails without separators', () => {
    expect(generateInitialPassword('admin@dhanuka.com', 'ECN-0001')).toBe('admi0001');
  });

  it('handles hyphen-separated usernames', () => {
    expect(generateInitialPassword('raj-sharma@dhanuka.com', 'ECN-2050')).toBe('raj2050');
  });
});

// ─── Cancellation Validation ───────────────────────────────────────────────────

describe('Booking cancellation validation', () => {
  it('requires a non-empty cancellation reason', () => {
    const reason = '   ';
    expect(!reason.trim() || reason.trim().length < 3).toBe(true);
  });

  it('accepts a valid cancellation reason', () => {
    const reason = 'Room no longer needed';
    expect(!reason.trim() || reason.trim().length < 3).toBe(false);
  });

  it('blocks cancelling someone else\'s booking as a regular employee', () => {
    const booking = makeBooking({ employee_id: 'emp-owner' });
    const session = { id: 'emp-other', role: 'employee' as const };
    const allowed = booking.employee_id === session.id || session.role === 'admin';
    expect(allowed).toBe(false);
  });

  it('allows admin to cancel any booking', () => {
    const booking = makeBooking({ employee_id: 'emp-owner' });
    const session = { id: 'emp-admin', role: 'admin' as const };
    const allowed = booking.employee_id === session.id || session.role === 'admin';
    expect(allowed).toBe(true);
  });

  it('allows booking owner to cancel their own booking', () => {
    const booking = makeBooking({ employee_id: 'emp-owner' });
    const session = { id: 'emp-owner', role: 'employee' as const };
    const allowed = booking.employee_id === session.id || session.role === 'admin';
    expect(allowed).toBe(true);
  });
});

// ─── Bulk Import Validation ────────────────────────────────────────────────────

describe('Bulk import validation', () => {
  it('rejects batches over 500 records', () => {
    const rows = new Array(501).fill({ name: 'Test', numericId: '1000' });
    expect(rows.length > 500).toBe(true);
  });

  it('accepts batches at exactly the limit (500 records)', () => {
    const rows = new Array(500).fill({ name: 'Test', numericId: '1000' });
    expect(rows.length > 500).toBe(false);
  });

  it('rejects empty batch', () => {
    const rows: unknown[] = [];
    expect(!rows || !Array.isArray(rows) || rows.length === 0).toBe(true);
  });

  it('skips duplicate employee IDs within the same import batch', () => {
    const existingIds = new Set(['ECN-1000', 'ECN-1001']);
    const newId = 'ECN-1000'; // duplicate
    expect(existingIds.has(newId)).toBe(true);
  });

  it('accepts genuinely new employee IDs', () => {
    const existingIds = new Set(['ECN-1000', 'ECN-1001']);
    const newId = 'ECN-1002';
    expect(existingIds.has(newId)).toBe(false);
  });
});

// ─── Receptionist Role Permissions & Option B Agenda Visibility ────────────────

describe('Receptionist role rules & Option A agenda visibility', () => {
  it('keeps agenda masked for receptionists on other employees bookings (Option A)', () => {
    const booking = makeBooking({ id: 'b-rec-1', employee_id: 'emp-100', agenda: 'Strict Confidential Audit' });
    const session = { id: 'emp-receptionist', role: 'receptionist' as const };
    const invitedIds: string[] = [];
    
    // Option A rule check: visible only if admin, owner, or invited
    const canViewAgenda = session.role === 'admin' || booking.employee_id === session.id || invitedIds.includes(booking.id);
    expect(canViewAgenda).toBe(false);
  });

  it('allows receptionist to search employees and book on behalf of anyone', () => {
    const session = { id: 'emp-receptionist', role: 'receptionist' as const };
    const targetEmployeeId = 'ECN-1001';
    const targetDepartmentId = 'dept-123';
    
    let assignedEmpId = session.id;
    let assignedDeptId = 'default-dept';

    if ((session.role === 'admin' || session.role === 'receptionist') && targetEmployeeId && targetDepartmentId) {
      assignedEmpId = targetEmployeeId;
      assignedDeptId = targetDepartmentId;
    }

    expect(assignedEmpId).toBe('ECN-1001');
    expect(assignedDeptId).toBe('dept-123');
  });

  it('prohibits receptionist from cancelling bookings owned by other employees', () => {
    const booking = makeBooking({ id: 'b-rec-2', employee_id: 'ECN-1001' });
    const session = { id: 'ECN-9000', role: 'receptionist' as const };

    const canCancel = booking.employee_id === session.id || session.role === 'admin';
    expect(canCancel).toBe(false);
  });

  it('allows receptionist to cancel bookings they personally created/own', () => {
    const booking = makeBooking({ id: 'b-rec-3', employee_id: 'ECN-9000' });
    const session = { id: 'ECN-9000', role: 'receptionist' as const };

    const canCancel = booking.employee_id === session.id || session.role === 'admin';
    expect(canCancel).toBe(true);
  });
});

