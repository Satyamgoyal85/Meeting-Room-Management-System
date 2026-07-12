import { Booking, Room, Amenity, AuditLog, Employee, Department, BookingInvitee, SmtpSettings, EmailLogEntry, UsageStat, CleanupJobLog } from '@/lib/types';
import { MOCK_ROOMS, MOCK_EMPLOYEES, MOCK_DEPARTMENTS } from '@/lib/mock-data';
import { getIstDateStr } from './timezone';

// Use globalThis to persist mock bookings & rooms across Next.js dev server hot reloads
declare global {
  var __MOCK_BOOKINGS__: Booking[] | undefined;
  var __MOCK_ROOMS_STORE__: Room[] | undefined;
  var __MOCK_AMENITIES_STORE__: Amenity[] | undefined;
  var __MOCK_AUDIT_LOGS__: AuditLog[] | undefined;
  var __MOCK_EMPLOYEES_STORE__: Employee[] | undefined;
  var __MOCK_DEPARTMENTS_STORE__: Department[] | undefined;
  var __MOCK_INVITEES__: BookingInvitee[] | undefined;
  var __MOCK_RESET_TOKENS__: PasswordResetToken[] | undefined;
  var __MOCK_SMTP_SETTINGS__: SmtpSettings | undefined;
  var __MOCK_EMAIL_LOGS__: EmailLogEntry[] | undefined;
  var __MOCK_USAGE_STATS__: UsageStat[] | undefined;
  var __MOCK_CLEANUP_LOGS__: CleanupJobLog[] | undefined;
  var __STORE_WRITE_LOCK__: boolean | undefined;
}

/**
 * Concurrency protection for Local Dev Mode store operations.
 * Prevents overlapping store updates and cache compaction collisions with exponential backoff.
 */
export async function acquireStoreLock(maxRetries = 15, baseBackoffMs = 40): Promise<void> {
  if (!globalThis.__STORE_WRITE_LOCK__) {
    globalThis.__STORE_WRITE_LOCK__ = true;
    return;
  }
  return new Promise((resolve) => {
    let retries = 0;
    const checkLock = () => {
      if (!globalThis.__STORE_WRITE_LOCK__) {
        globalThis.__STORE_WRITE_LOCK__ = true;
        resolve();
      } else if (retries < maxRetries) {
        retries++;
        // Backoff with slight jitter to prevent thundering herd collisions
        const backoff = baseBackoffMs * Math.pow(1.2, retries) + Math.random() * 20;
        setTimeout(checkLock, Math.min(backoff, 500));
      } else {
        // Safe timeout release after backoff exhausted to prevent deadlocks
        globalThis.__STORE_WRITE_LOCK__ = true;
        resolve();
      }
    };
    checkLock();
  });
}

export function releaseStoreLock(): void {
  globalThis.__STORE_WRITE_LOCK__ = false;
}

function getInitialMockAmenities(): Amenity[] {
  return [
    { id: '55555555-5555-5555-5555-555555555501', name: 'Projector', icon: 'Projector' },
    { id: '55555555-5555-5555-5555-555555555502', name: 'Video Conferencing', icon: 'Video' },
    { id: '55555555-5555-5555-5555-555555555503', name: 'Whiteboard', icon: 'Edit3' },
    { id: '55555555-5555-5555-5555-555555555504', name: 'AC', icon: 'Wind' },
    { id: '55555555-5555-5555-5555-555555555505', name: 'TV Screen', icon: 'Tv' },
    { id: '55555555-5555-5555-5555-555555555506', name: 'Executive Seating', icon: 'Armchair' },
    { id: '55555555-5555-5555-5555-555555555507', name: 'Sound System', icon: 'Volume2' },
    { id: '55555555-5555-5555-5555-555555555508', name: 'Wifi', icon: 'Wifi' },
    { id: '55555555-5555-5555-5555-555555555509', name: 'Coffee Machine', icon: 'Coffee' },
  ];
}

function getInitialMockBookings(): Booking[] {
  const today = getIstDateStr();
  const tomorrow = getIstDateStr(Date.now() + 86400000);

  return [
    {
      id: '44444444-4444-4444-4444-444444444401',
      room_id: '22222222-2222-2222-2222-222222222205', // Room 5 - Falcon (Cap 8)
      employee_id: '33333333-3333-3333-3333-333333333302', // Ananya Verma (IT)
      department_id: '11111111-1111-1111-1111-111111111101', // IT
      agenda: 'Q3 IT Infrastructure Upgrade Discussion',
      start_time: `${today}T10:00:00+05:30`,
      end_time: `${today}T11:30:00+05:30`,
      status: 'confirmed',
      cancelled_by: null,
      cancel_reason: null,
      created_at: new Date().toISOString(),
    },
    {
      id: '44444444-4444-4444-4444-444444444402',
      room_id: '22222222-2222-2222-2222-222222222208', // Room 8 - Pinnacle (Cap 10)
      employee_id: '33333333-3333-3333-3333-333333333304', // Priya Patel (Marketing)
      department_id: '11111111-1111-1111-1111-111111111103', // Marketing
      agenda: 'Agri-Tech Kharif Campaign Review',
      start_time: `${today}T14:00:00+05:30`,
      end_time: `${today}T15:30:00+05:30`,
      status: 'confirmed',
      cancelled_by: null,
      cancel_reason: null,
      created_at: new Date().toISOString(),
    },
    {
      id: '44444444-4444-4444-4444-444444444404',
      room_id: '22222222-2222-2222-2222-222222222211', // Room 11 - Innovation Lab (Cap 15)
      employee_id: '33333333-3333-3333-3333-333333333303', // Vikram Singh (R&D)
      department_id: '11111111-1111-1111-1111-111111111102', // R&D
      agenda: 'New Bio-Pesticide Formulation Sprint',
      start_time: `${today}T13:00:00+05:30`,
      end_time: `${today}T16:00:00+05:30`,
      status: 'confirmed',
      cancelled_by: null,
      cancel_reason: null,
      created_at: new Date().toISOString(),
    },
    {
      id: '44444444-4444-4444-4444-444444444403',
      room_id: '22222222-2222-2222-2222-222222222213', // Room 13 - Board Room (Cap 20)
      employee_id: '33333333-3333-3333-3333-333333333305', // Suresh Kumar (Board)
      department_id: '11111111-1111-1111-1111-111111111104', // Board
      agenda: 'Annual Board Meeting & Strategy Alignment',
      start_time: `${tomorrow}T11:00:00+05:30`,
      end_time: `${tomorrow}T13:00:00+05:30`,
      status: 'confirmed',
      cancelled_by: null,
      cancel_reason: null,
      created_at: new Date().toISOString(),
    },
  ];
}

export function getStoreBookings(): Booking[] {
  if (!globalThis.__MOCK_BOOKINGS__ || globalThis.__MOCK_BOOKINGS__.some(b => b.employee_id.startsWith('DAL-'))) {
    globalThis.__MOCK_BOOKINGS__ = getInitialMockBookings();
  }
  return globalThis.__MOCK_BOOKINGS__;
}

export function addMockBooking(booking: Booking): void {
  const store = getStoreBookings();
  store.push(booking);
}

export function cancelMockBooking(bookingId: string, cancelledBy: string, reason: string): boolean {
  const store = getStoreBookings();
  const index = store.findIndex(b => b.id === bookingId);
  if (index !== -1) {
    store[index] = {
      ...store[index],
      status: 'cancelled',
      cancelled_by: cancelledBy,
      cancel_reason: reason,
    };
    return true;
  }
  return false;
}

// Room Store Functions for Admin CRUD in Local Dev Mode
export function getStoreRooms(): Room[] {
  if (!globalThis.__MOCK_ROOMS_STORE__ || globalThis.__MOCK_ROOMS_STORE__.length === 0) {
    globalThis.__MOCK_ROOMS_STORE__ = [...MOCK_ROOMS];
  }
  return globalThis.__MOCK_ROOMS_STORE__;
}

export function addMockRoom(room: Room): void {
  const store = getStoreRooms();
  store.push(room);
}

export function updateMockRoom(updatedRoom: Room): boolean {
  const store = getStoreRooms();
  const index = store.findIndex(r => r.id === updatedRoom.id);
  if (index !== -1) {
    store[index] = updatedRoom;
    return true;
  }
  return false;
}

export function getStoreAmenities(): Amenity[] {
  if (!globalThis.__MOCK_AMENITIES_STORE__) {
    globalThis.__MOCK_AMENITIES_STORE__ = getInitialMockAmenities();
  }
  return globalThis.__MOCK_AMENITIES_STORE__;
}

export function addMockAmenity(amenity: Amenity): void {
  const store = getStoreAmenities();
  store.push(amenity);
}

export function deleteMockAmenity(id: string): boolean {
  const store = getStoreAmenities();
  const index = store.findIndex(a => a.id === id);
  if (index !== -1) {
    const deletedName = store[index].name;
    store.splice(index, 1);
    // Unassign from all rooms in store
    const rooms = getStoreRooms();
    rooms.forEach(room => {
      if (room.amenities.includes(deletedName)) {
        room.amenities = room.amenities.filter(a => a !== deletedName);
      }
    });
    return true;
  }
  return false;
}

export function getStoreAuditLogs(): AuditLog[] {
  if (!globalThis.__MOCK_AUDIT_LOGS__) {
    globalThis.__MOCK_AUDIT_LOGS__ = [];
  }
  return globalThis.__MOCK_AUDIT_LOGS__;
}

export function addMockAuditLog(log: AuditLog): void {
  const store = getStoreAuditLogs();
  store.unshift(log);
}

export function pruneStoreAuditLogs(cutoffIsoStr: string): number {
  const store = getStoreAuditLogs();
  const initialLen = store.length;
  globalThis.__MOCK_AUDIT_LOGS__ = store.filter(log => log.created_at >= cutoffIsoStr);
  return initialLen - (globalThis.__MOCK_AUDIT_LOGS__?.length || 0);
}

export function deleteMockRoom(id: string): boolean {
  const store = getStoreRooms();
  const index = store.findIndex(r => r.id === id);
  if (index !== -1) {
    store.splice(index, 1);
    return true;
  }
  return false;
}

export function getStoreEmployees(): Employee[] {
  // Reinit if store is empty, uses old ID format, or is missing new security fields
  if (
    !globalThis.__MOCK_EMPLOYEES_STORE__ ||
    globalThis.__MOCK_EMPLOYEES_STORE__.some(
      (e) => e.employee_id.startsWith('DAL-') || !e.initial_password || e.must_reset_password === undefined || e.is_locked === undefined
    )
  ) {
    globalThis.__MOCK_EMPLOYEES_STORE__ = MOCK_EMPLOYEES.map(e => ({
      ...e,
      is_locked: e.is_locked ?? ((e.failed_login_attempts ?? 0) >= 5),
    }));
  }
  // Ensure any existing record in memory (including Rahul Yadav / Rahul Nair / Ramesh Yadav) has is_locked synced with reality!
  globalThis.__MOCK_EMPLOYEES_STORE__.forEach((e) => {
    if (e.is_locked === undefined) {
      e.is_locked = (e.failed_login_attempts ?? 0) >= 5;
    }
    if ((e.failed_login_attempts ?? 0) >= 5) {
      e.is_locked = true;
    }
    // Specifically check Rahul Yadav / Rahul Nair / Ramesh Yadav if stuck in a locked state during testing
    if ((e.name.toLowerCase().includes('rahul') || e.name.toLowerCase().includes('yadav')) && (e.is_locked || (e.failed_login_attempts ?? 0) >= 5)) {
      e.is_locked = true;
      if ((e.failed_login_attempts ?? 0) < 5) {
        e.failed_login_attempts = 5;
      }
    }
  });
  // Ensure any newly added seed accounts from MOCK_EMPLOYEES (such as ECN-9000 Reception Desk) exist inside memory store
  MOCK_EMPLOYEES.forEach((baselineEmp) => {
    if (!globalThis.__MOCK_EMPLOYEES_STORE__!.some(e => e.employee_id.toUpperCase() === baselineEmp.employee_id.toUpperCase())) {
      globalThis.__MOCK_EMPLOYEES_STORE__!.push({
        ...baselineEmp,
        is_locked: baselineEmp.is_locked ?? ((baselineEmp.failed_login_attempts ?? 0) >= 5),
      });
    }
  });
  return globalThis.__MOCK_EMPLOYEES_STORE__;
}

export function addMockEmployee(emp: Employee): void {
  const store = getStoreEmployees();
  store.push(emp);
}

export function addMockEmployeesBatch(emps: Employee[]): void {
  const store = getStoreEmployees();
  store.push(...emps);
}

export function updateMockEmployee(emp: Employee): boolean {
  const store = getStoreEmployees();
  const index = store.findIndex(e => e.id === emp.id);
  if (index !== -1) {
    store[index] = emp;
    return true;
  }
  return false;
}

/**
 * Updates only the password and clears the must_reset_password flag after a successful first-login reset.
 * The new password is stored as initial_password in mock mode (plain text, in-memory only, never persisted to disk).
 */
export function updateMockEmployeePassword(id: string, newPassword: string): boolean {
  const store = getStoreEmployees();
  const index = store.findIndex(e => e.id === id);
  if (index !== -1) {
    store[index].initial_password = newPassword;
    store[index].must_reset_password = false;
    store[index].failed_login_attempts = 0;
    store[index].is_locked = false;
    return true;
  }
  return false;
}

/** Increments failed login counter. Returns the new count. */
export function incrementFailedLoginAttempts(id: string): number {
  const store = getStoreEmployees();
  const index = store.findIndex(e => e.id === id);
  if (index !== -1) {
    store[index].failed_login_attempts = (store[index].failed_login_attempts ?? 0) + 1;
    if (store[index].failed_login_attempts >= 5) {
      store[index].is_locked = true;
    }
    return store[index].failed_login_attempts;
  }
  return 0;
}

/** Resets failed login counter to 0 on successful login. */
export function resetFailedLoginAttempts(id: string): void {
  const store = getStoreEmployees();
  const index = store.findIndex(e => e.id === id);
  if (index !== -1) {
    store[index].failed_login_attempts = 0;
    store[index].is_locked = false;
  }
}

export function deleteMockEmployee(id: string): boolean {
  const store = getStoreEmployees();
  const index = store.findIndex(e => e.id === id);
  if (index !== -1) {
    store.splice(index, 1);
    return true;
  }
  return false;
}

export function getStoreDepartments(): Department[] {
  if (!globalThis.__MOCK_DEPARTMENTS_STORE__ || globalThis.__MOCK_DEPARTMENTS_STORE__.length === 0) {
    globalThis.__MOCK_DEPARTMENTS_STORE__ = [...MOCK_DEPARTMENTS];
  }
  return globalThis.__MOCK_DEPARTMENTS_STORE__;
}

export function addMockDepartment(dept: Department): void {
  const store = getStoreDepartments();
  store.push(dept);
}

export function deleteMockDepartment(id: string): boolean {
  const store = getStoreDepartments();
  const index = store.findIndex(d => d.id === id);
  if (index !== -1) {
    store.splice(index, 1);
    return true;
  }
  return false;
}

// ── Booking Invitees Store ────────────────────────────────────────────────────

export function getStoreInvitees(): BookingInvitee[] {
  if (!globalThis.__MOCK_INVITEES__) {
    globalThis.__MOCK_INVITEES__ = [];
  }
  return globalThis.__MOCK_INVITEES__;
}

export function addMockInvitees(invitees: BookingInvitee[]): void {
  const store = getStoreInvitees();
  store.push(...invitees);
}

export function getInviteesForBooking(bookingId: string): BookingInvitee[] {
  return getStoreInvitees().filter(inv => inv.booking_id === bookingId);
}

export function getBookingIdsForInvitee(employeeId: string): string[] {
  return getStoreInvitees()
    .filter(inv => inv.employee_id === employeeId)
    .map(inv => inv.booking_id);
}

// ── Password Reset Token Store ─────────────────────────────────────────────
// Tokens are stored as SHA-256 hashes — the raw token is only ever shown once
// to the admin and never persisted. We compare hashes on lookup.

export interface PasswordResetToken {
  /** SHA-256 hash of the raw 64-char hex token */
  tokenHash: string;
  /** Internal employee UUID */
  employeeId: string;
  /** ISO timestamp — token invalid after this point */
  expiresAt: string;
  /** Prevents reuse: flipped to true immediately after the password is updated */
  used: boolean;
  /** Creation timestamp for audit/display purposes */
  createdAt: string;
}

export function getStoreResetTokens(): PasswordResetToken[] {
  if (!globalThis.__MOCK_RESET_TOKENS__) {
    globalThis.__MOCK_RESET_TOKENS__ = [];
  }
  return globalThis.__MOCK_RESET_TOKENS__;
}

/** Stores a new reset token (already hashed by the caller). */
export function addMockResetToken(token: PasswordResetToken): void {
  // Invalidate any prior unused tokens for this employee before adding a new one
  const store = getStoreResetTokens();
  store.forEach((t) => {
    if (t.employeeId === token.employeeId && !t.used) {
      t.used = true; // old link is now dead
    }
  });
  store.push(token);
}

/**
 * Looks up a token by its SHA-256 hash.
 * Returns null if the token doesn't exist, is already used, or has expired.
 */
export function findValidResetToken(tokenHash: string): PasswordResetToken | null {
  const store = getStoreResetTokens();
  const record = store.find((t) => t.tokenHash === tokenHash);
  if (!record) return null;
  if (record.used) return null;
  if (new Date() > new Date(record.expiresAt)) return null;
  return record;
}

/** Marks a token as used (single-use enforcement). */
export function consumeMockResetToken(tokenHash: string): boolean {
  const store = getStoreResetTokens();
  const index = store.findIndex((t) => t.tokenHash === tokenHash);
  if (index !== -1) {
    store[index].used = true;
    return true;
  }
  return false;
}

export function getStoreSmtpSettings(): SmtpSettings {
  if (!globalThis.__MOCK_SMTP_SETTINGS__) {
    globalThis.__MOCK_SMTP_SETTINGS__ = {
      server_address: '',
      port: 587,
      username: '',
      password_encrypted: '',
      password_required: true,
      sender_email: 'notifications@dhanuka.com',
      sender_name: 'Dhanuka Meeting Room System',
      is_configured: false,
    };
  }
  return globalThis.__MOCK_SMTP_SETTINGS__;
}

export function saveStoreSmtpSettings(settings: SmtpSettings): void {
  globalThis.__MOCK_SMTP_SETTINGS__ = settings;
}

export function getStoreEmailLogs(): EmailLogEntry[] {
  if (!globalThis.__MOCK_EMAIL_LOGS__) {
    globalThis.__MOCK_EMAIL_LOGS__ = [];
  }
  return globalThis.__MOCK_EMAIL_LOGS__;
}

export function addMockEmailLog(entry: EmailLogEntry): void {
  const store = getStoreEmailLogs();
  store.unshift(entry);
  if (store.length > 200) store.length = 200;
}

export function getStoreUsageStats(): UsageStat[] {
  if (!globalThis.__MOCK_USAGE_STATS__) {
    globalThis.__MOCK_USAGE_STATS__ = [];
  }
  return globalThis.__MOCK_USAGE_STATS__;
}

export function upsertStoreUsageStat(stat: Omit<UsageStat, 'id' | 'updated_at'>): void {
  const store = getStoreUsageStats();
  const existing = store.find(
    s => s.room_id === stat.room_id &&
         s.department_id === stat.department_id &&
         s.period_start === stat.period_start &&
         s.period_type === stat.period_type
  );
  if (existing) {
    existing.booking_count += stat.booking_count;
    existing.total_hours_booked = Number((existing.total_hours_booked + stat.total_hours_booked).toFixed(2));
    existing.updated_at = new Date().toISOString();
  } else {
    store.push({
      ...stat,
      id: crypto.randomUUID(),
      total_hours_booked: Number(stat.total_hours_booked.toFixed(2)),
      updated_at: new Date().toISOString(),
    });
  }
}

export function pruneStoreUsageStats(cutoffDateStr: string): number {
  const store = getStoreUsageStats();
  const initialLen = store.length;
  globalThis.__MOCK_USAGE_STATS__ = store.filter(s => s.period_start >= cutoffDateStr);
  return initialLen - (globalThis.__MOCK_USAGE_STATS__?.length || 0);
}

export function getStoreCleanupLogs(): CleanupJobLog[] {
  if (!globalThis.__MOCK_CLEANUP_LOGS__) {
    globalThis.__MOCK_CLEANUP_LOGS__ = [];
  }
  return globalThis.__MOCK_CLEANUP_LOGS__;
}

export function addStoreCleanupLog(log: CleanupJobLog): void {
  const store = getStoreCleanupLogs();
  store.unshift(log);
  if (store.length > 100) store.length = 100;
}

export function updateStoreCleanupLog(id: string, updates: Partial<CleanupJobLog>): void {
  const store = getStoreCleanupLogs();
  const log = store.find(l => l.id === id);
  if (log) {
    Object.assign(log, updates);
  }
}
