'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSession } from '@/actions/auth';
import { MOCK_ROOMS, MOCK_DEPARTMENTS, MOCK_EMPLOYEES } from '@/lib/mock-data';
import { getStoreBookings, getStoreRooms, addMockBooking, cancelMockBooking, addMockAuditLog, getStoreDepartments, getStoreEmployees, getStoreInvitees, addMockInvitees, getBookingIdsForInvitee, getInviteesForBooking } from '@/lib/mock-store';
import { Room, Department, Booking, Employee } from '@/lib/types';
import { sortRoomsByCapacityAndName, sortEmployeesByHierarchy } from '@/lib/sorting';
import { format, addDays, addWeeks, addMonths, differenceInDays } from 'date-fns';
import { revalidatePath } from 'next/cache';
import { createIstIsoString, toIstDate, getIstDateStr, getIstTimeStr } from '@/lib/timezone';
import { sendNotificationEmail } from '@/actions/smtp';
import { getBookingConfirmedEmailHtml, getBookingCancelledEmailHtml } from '@/lib/email-templates';
import { AdminBookingItem } from '@/actions/admin';

export interface BookingResult {
  success?: boolean;
  error?: string;
  bookedCount?: number;
  skippedDates?: string[];
  message?: string;
}

export interface MyBookingItem extends Booking {
  room_name: string;
  room_floor: string;
  department_name: string;
  /** True when the current user was invited to this booking (not the organizer) */
  is_invite?: boolean;
  /** Name of the organizer (populated when is_invite is true) */
  organizer_name?: string;
  /** Number of invitees on this booking */
  invitee_count?: number;
}

export interface InviteeSuggestion {
  type: 'employee' | 'department';
  id: string;
  label: string;
  subLabel: string;
  department_id?: string;
  employee_code?: string;
}

export interface EmployeeSearchItem {
  id: string;
  employee_id: string;
  name: string;
  department_id: string | null;
  department_name: string;
}

/**
 * Server action to create a meeting room booking (supports one-off and recurring with conflict handling).
 */
export async function createBookingAction(formData: FormData): Promise<BookingResult> {
  const session = await getSession();
  if (!session) {
    return { error: 'You must be logged in to book a room.' };
  }

  const roomId = formData.get('roomId') as string;
  const dateStr = formData.get('dateStr') as string;
  const startTime = formData.get('startTime') as string; // "10:00"
  const endTime = formData.get('endTime') as string;     // "11:30"
  const agenda = (formData.get('agenda') as string)?.trim() || 'General';
  const attendeesCount = Number(formData.get('attendeesCount') || 1);
  const isRecurring = formData.get('isRecurring') === 'true';
  const recurringFreq = (formData.get('recurringFreq') as string) || 'weekly';
  const recurringCount = Number(formData.get('recurringCount') || 1);
  const conflictStrategy = (formData.get('conflictStrategy') as string) || 'skip';

  const bookForEmployeeId = formData.get('bookForEmployeeId') as string;
  const bookForDepartmentId = formData.get('bookForDepartmentId') as string;
  // Invitee employee IDs (already resolved from dept expansion in client, but we re-expand depts server-side)
  const inviteeIdsRaw = formData.get('inviteeIds') as string;
  const inviteeEmployeeIds: string[] = inviteeIdsRaw ? JSON.parse(inviteeIdsRaw) : [];
  // Excluded employee IDs (removed from a dept invite)
  const excludedIdsRaw = formData.get('excludedInviteeIds') as string;
  const excludedIds: string[] = excludedIdsRaw ? JSON.parse(excludedIdsRaw) : [];
  // Selected department IDs for expansion
  const inviteeDeptIdsRaw = formData.get('inviteeDeptIds') as string;
  const inviteeDeptIds: string[] = inviteeDeptIdsRaw ? JSON.parse(inviteeDeptIdsRaw) : [];

  let targetEmployeeId = session.id;
  let targetDepartmentId = session.department_id || '11111111-1111-1111-1111-111111111101';

  if (session.role === 'admin' && bookForEmployeeId && bookForDepartmentId) {
    targetEmployeeId = bookForEmployeeId;
    targetDepartmentId = bookForDepartmentId;
  }

  if (!roomId || !dateStr || !startTime || !endTime) {
    return { error: 'Please fill in all mandatory fields.' };
  }

  if (startTime >= endTime) {
    return { error: 'End time must be after start time.' };
  }

  const isPlaceholderUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('placeholder') || !process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabase = !isPlaceholderUrl ? createAdminClient() : await createClient();

  // 1. Validate Room & Restrictions
  let room: Room | undefined;
  let departments: Department[] = getStoreDepartments();

  if (!isPlaceholderUrl) {
    const { data: rData } = await (supabase.from('rooms') as any).select('*').eq('id', roomId).single();
    if (rData) room = rData as Room;
    const { data: dData } = await (supabase.from('departments') as any).select('*');
    if (dData) departments = dData as Department[];
  } else {
    room = getStoreRooms().find(r => r.id === roomId);
  }

  if (!room || !room.is_active) {
    return { error: 'The selected room is inactive or does not exist.' };
  }

  // Check Department restriction
  if (room.restricted_to_department_id !== null && session.role !== 'admin') {
    if (session.department_id !== room.restricted_to_department_id) {
      const restrictedDept = departments.find(d => d.id === room.restricted_to_department_id);
      return { error: `Access Denied: ${room.name} is restricted exclusively to ${restrictedDept?.name || 'designated'} department personnel.` };
    }
  }

  // Check capacity
  if (attendeesCount > room.capacity) {
    return { error: `Attendee count (${attendeesCount}) exceeds maximum capacity of ${room.name} (${room.capacity} seats).` };
  }

  // 2. Generate target dates array (up to 3 months max per rules)
  const baseDate = new Date(dateStr);
  const targetDates: Date[] = [baseDate];

  if (isRecurring && recurringCount > 1) {
    const maxCount = Math.min(recurringCount, 24); // Cap at 24 occurrences
    for (let i = 1; i < maxCount; i++) {
      let nextDate: Date;
      if (recurringFreq === 'daily') {
        nextDate = addDays(baseDate, i);
      } else if (recurringFreq === 'monthly') {
        nextDate = addMonths(baseDate, i);
      } else {
        nextDate = addWeeks(baseDate, i);
      }

      // Check 3-month / 90-day limit rule
      if (differenceInDays(nextDate, baseDate) > 90) {
        break;
      }
      targetDates.push(nextDate);
    }
  }

  // 3. Check existing bookings for conflicts
  let existingBookings: Booking[] = [];
  if (!isPlaceholderUrl) {
    const { data: bData } = await supabase
      .from('bookings')
      .select('*')
      .eq('room_id', roomId)
      .eq('status', 'confirmed');
    if (bData) existingBookings = bData as Booking[];
  } else {
    existingBookings = getStoreBookings().filter(b => b.room_id === roomId && b.status === 'confirmed');
  }

  const bookedCountList: Booking[] = [];
  const skippedDatesList: string[] = [];
  const seriesId = (isRecurring && targetDates.length > 1) ? crypto.randomUUID() : null;

  for (const dateObj of targetDates) {
    const dIso = format(dateObj, 'yyyy-MM-dd');
    const startIso = createIstIsoString(dIso, startTime);
    const endIso = createIstIsoString(dIso, endTime);
    const startMs = new Date(startIso).getTime();
    const endMs = new Date(endIso).getTime();

    // Enforce server-side check against actual current time
    if (startMs < Date.now()) {
      return { error: 'You cannot book a time slot that has already passed.' };
    }

    // Check overlap: existingStart < newEnd && existingEnd > newStart
    const conflict = existingBookings.find(b => {
      const eStart = new Date(b.start_time).getTime();
      const eEnd = new Date(b.end_time).getTime();
      return eStart < endMs && eEnd > startMs;
    });

    if (conflict) {
      const conflictFormatted = format(toIstDate(conflict.start_time), 'MMM d (HH:mm') + '-' + format(toIstDate(conflict.end_time), 'HH:mm)');
      const dept = departments.find(d => d.id === conflict.department_id);
      const conflictMsg = `${format(dateObj, 'MMM d, yyyy')} — Conflicted with ${dept ? dept.name : 'Another Dept'} (${conflictFormatted})`;

      if (conflictStrategy === 'fail') {
        return { 
          error: `Double-booking conflict detected on ${format(dateObj, 'MMM d, yyyy')}. Since you selected "Fail entire series on conflict", zero sessions were booked.` 
        };
      } else {
        skippedDatesList.push(conflictMsg);
        continue;
      }
    }

    // No conflict, prepare booking
    const newBooking: Booking = {
      id: crypto.randomUUID(),
      room_id: roomId,
      employee_id: targetEmployeeId,
      department_id: targetDepartmentId,
      agenda,
      start_time: startIso,
      end_time: endIso,
      status: 'confirmed',
      cancelled_by: null,
      cancel_reason: null,
      series_id: seriesId,
      is_recurring: Boolean(seriesId),
      created_at: new Date().toISOString(),
    };

    bookedCountList.push(newBooking);
  }

  if (bookedCountList.length === 0) {
    return { error: 'All requested dates had existing booking conflicts. No sessions were reserved.' };
  }

  // ── Resolve final invitee employee IDs ──────────────────────────────────────
  let allEmployees: Employee[] = [];
  if (!isPlaceholderUrl) {
    const { data: empData } = await (supabase.from('employees') as any).select('*').eq('is_active', true);
    allEmployees = (empData || []) as Employee[];
  } else {
    allEmployees = getStoreEmployees().filter(e => e.is_active);
  }

  const deptExpanded = allEmployees
    .filter(e => inviteeDeptIds.includes(e.department_id || ''))
    .map(e => e.id);
  const finalInviteeIds = Array.from(new Set([
    ...inviteeEmployeeIds,
    ...deptExpanded,
  ])).filter(id => !excludedIds.includes(id) && id !== targetEmployeeId);

  // 4. Save Bookings
  if (!isPlaceholderUrl) {
    const { error: insertError } = await (supabase.from('bookings') as any).insert(bookedCountList);
    if (insertError) {
      return { error: `Database error: ${insertError.message}` };
    }

    // Insert invitees (booking_invitees table) if any
    if (finalInviteeIds.length > 0) {
      const inviteeRows = bookedCountList.flatMap(b =>
        finalInviteeIds.map(empId => ({
          id: crypto.randomUUID(),
          booking_id: b.id,
          employee_id: empId,
          status: 'invited',
          created_at: new Date().toISOString(),
        }))
      );
      // NOTE: Run this SQL in Supabase to create the table:
      // CREATE TABLE booking_invitees (
      //   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      //   booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
      //   employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
      //   status TEXT DEFAULT 'invited',
      //   created_at TIMESTAMPTZ DEFAULT now()
      // );
      await (supabase.from('booking_invitees') as any).insert(inviteeRows);
    }

    try {
      const auditLogs = bookedCountList.map(b => ({
        id: crypto.randomUUID(),
        action_type: 'create_booking' as const,
        performed_by: session.id,
        target_id: b.id,
        details: {
          room_id: b.room_id,
          room_name: room?.name || 'Meeting Room',
          booked_for_employee_id: b.employee_id,
          booked_for_department_id: b.department_id,
          is_on_behalf: b.employee_id !== session.id,
          admin_name: session.name || 'Admin',
          agenda: b.agenda,
          start_time: b.start_time,
          end_time: b.end_time,
          invitee_count: finalInviteeIds.length,
        },
        created_at: new Date().toISOString(),
      }));
      await (supabase.from('audit_log') as any).insert(auditLogs);
    } catch (auditErr) {
      console.error('Failed to log audit entry:', auditErr);
    }
  } else {
    for (const b of bookedCountList) {
      addMockBooking(b);
      addMockAuditLog({
        id: crypto.randomUUID(),
        action_type: 'create_booking',
        performed_by: session.id,
        target_id: b.id,
        details: {
          room_id: b.room_id,
          room_name: room?.name || 'Meeting Room',
          booked_for_employee_id: b.employee_id,
          booked_for_department_id: b.department_id,
          is_on_behalf: b.employee_id !== session.id,
          admin_name: session.name || 'Admin',
          agenda: b.agenda,
          start_time: b.start_time,
          end_time: b.end_time,
          invitee_count: finalInviteeIds.length,
        },
        created_at: new Date().toISOString(),
      });
    }
    // Save invitees to mock store
    if (finalInviteeIds.length > 0) {
      const inviteeRows = bookedCountList.flatMap(b =>
        finalInviteeIds.map(empId => ({
          id: crypto.randomUUID(),
          booking_id: b.id,
          employee_id: empId,
          status: 'invited' as const,
          created_at: new Date().toISOString(),
        }))
      );
      addMockInvitees(inviteeRows);
    }
  }

  // Send email confirmations non-blockingly (to organizer + invitees)
  try {
    const organizer = allEmployees.find(e => e.id === bookedCountList[0]?.employee_id);
    const organizerEmail = organizer?.email || 'notifications@dhanuka.com';
    const inviteeEmails = finalInviteeIds.map(id => allEmployees.find(e => e.id === id)?.email).filter(Boolean) as string[];
    const allRecipients = Array.from(new Set([organizerEmail, ...inviteeEmails].filter(Boolean) as string[]));

    for (const b of bookedCountList) {
      const startMs = new Date(b.start_time).getTime();
      const endMs = new Date(b.end_time).getTime();
      const dateStr = getIstDateStr(startMs);
      const timeStr = `${getIstTimeStr(startMs)} – ${getIstTimeStr(endMs)}`;
      for (const recipientEmail of allRecipients) {
        sendNotificationEmail({
          to: recipientEmail,
          subject: `[Dhanuka Meeting Rooms] Booking Confirmed — ${room.name}, ${dateStr}, ${timeStr}`,
          html: getBookingConfirmedEmailHtml({
            bookerName: organizer?.name || session.name || 'Employee',
            roomName: room.name,
            dateStr,
            timeStr,
            purpose: b.agenda,
          }),
          eventType: 'booking_confirmed',
        }).catch(err => console.error('[SMTP Trigger Error - booking_confirmed]:', err));
      }
    }
  } catch (emailErr) {
    console.error('[SMTP Trigger Error - booking_confirmed batch]:', emailErr);
  }

  revalidatePath('/dashboard', 'layout');
  revalidatePath('/admin', 'layout');

  const totalRequested = targetDates.length;
  let msg = `Successfully reserved ${room.name} for ${bookedCountList.length} session(s)!`;
  if (skippedDatesList.length > 0) {
    msg = `Booked ${bookedCountList.length} of ${totalRequested} sessions. Skipped ${skippedDatesList.length} conflicting date(s).`;
  }

  return {
    success: true,
    bookedCount: bookedCountList.length,
    skippedDates: skippedDatesList,
    message: msg,
  };
}

/**
 * Server action to cancel an existing booking with mandatory cancellation reason.
 */
export async function cancelBookingAction(formData: FormData): Promise<{ success?: boolean; error?: string }> {
  const session = await getSession();
  if (!session) {
    return { error: 'You must be logged in to cancel a booking.' };
  }

  const bookingId = formData.get('bookingId') as string;
  const cancelReason = (formData.get('cancelReason') as string)?.trim();

  if (!bookingId) {
    return { error: 'Missing booking ID.' };
  }

  if (!cancelReason || cancelReason.length < 3) {
    return { error: 'A mandatory cancellation reason is required per Dhanuka audit policy.' };
  }

  const isPlaceholderUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('placeholder') || !process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabase = !isPlaceholderUrl ? createAdminClient() : await createClient();

  let booking: Booking | null = null;
  if (!isPlaceholderUrl) {
    const { data: bookingData } = await (supabase.from('bookings') as any).select('*').eq('id', bookingId).single();
    booking = bookingData as Booking | null;
  } else {
    booking = getStoreBookings().find(b => b.id === bookingId) || null;
  }

  if (!booking) return { error: 'Booking not found.' };

  if (booking.employee_id !== session.id && session.role !== 'admin') {
    return { error: 'Access Denied: You can only cancel your own bookings.' };
  }

  if (!isPlaceholderUrl) {
    const { error: updateError } = await (supabase.from('bookings') as any)
      .update({
        status: 'cancelled',
        cancelled_by: session.id,
        cancel_reason: cancelReason,
      })
      .eq('id', bookingId);

    if (updateError) {
      return { error: `Failed to cancel booking: ${updateError.message}` };
    }
  } else {
    const success = cancelMockBooking(bookingId, session.id, cancelReason);
    if (!success) {
      return { error: 'Booking not found in local store.' };
    }
  }

  // Send cancellation email notification non-blockingly
  try {
    if (booking) {
      let roomName = 'Meeting Room';
      let organizerEmail = 'notifications@dhanuka.com';
      let inviteeEmails: string[] = [];

      if (!isPlaceholderUrl) {
        const { data: rData } = await (supabase.from('rooms') as any).select('name').eq('id', booking.room_id).single();
        if (rData?.name) roomName = rData.name;
        const { data: eData } = await (supabase.from('employees') as any).select('email').eq('id', booking.employee_id).single();
        if (eData?.email) organizerEmail = eData.email;
        const { data: invData } = await (supabase.from('booking_invitees') as any).select('employee_id').eq('booking_id', bookingId);
        if (invData && invData.length > 0) {
          const invEmpIds = invData.map((i: any) => i.employee_id);
          const { data: invEmps } = await (supabase.from('employees') as any).select('email').in('id', invEmpIds);
          if (invEmps) inviteeEmails = invEmps.map((e: any) => e.email).filter(Boolean);
        }
      } else {
        const allEmployees = getStoreEmployees();
        const allRooms = getStoreRooms();
        const r = allRooms.find(rm => rm.id === booking.room_id);
        if (r) roomName = r.name;
        const e = allEmployees.find(emp => emp.id === booking.employee_id);
        if (e?.email) organizerEmail = e.email;
        const invs = getInviteesForBooking(bookingId);
        inviteeEmails = invs.map(inv => allEmployees.find(emp => emp.id === inv.employee_id)?.email || '').filter(Boolean);
      }

      const startMs = new Date(booking.start_time).getTime();
      const endMs = new Date(booking.end_time).getTime();
      const dateStr = getIstDateStr(startMs);
      const allRecipients = Array.from(new Set([organizerEmail, ...inviteeEmails].filter(Boolean) as string[]));
      const timeStr = `${getIstTimeStr(startMs)} – ${getIstTimeStr(endMs)}`;
      const cancelledByAdminName = session.role === 'admin' && booking.employee_id !== session.id ? (session.name || 'Admin') : undefined;

      for (const recipientEmail of allRecipients) {
        sendNotificationEmail({
          to: recipientEmail,
          subject: `[Dhanuka Meeting Rooms] Booking Cancelled — ${roomName}, ${dateStr}, ${timeStr}`,
          html: getBookingCancelledEmailHtml({
            bookerName: session.name || 'Employee',
            roomName,
            dateStr,
            timeStr,
            cancelledByAdminName,
            reason: cancelReason,
          }),
          eventType: 'booking_cancelled',
        }).catch(err => console.error('[SMTP Trigger Error - booking_cancelled]:', err));
      }
    }
  } catch (emailErr) {
    console.error('[SMTP Trigger Error - booking_cancelled batch]:', emailErr);
  }

  revalidatePath('/dashboard', 'layout');
  revalidatePath('/admin', 'layout');

  return { success: true };
}

/**
 * Server action to get all bookings for the current user.
 */
export async function getMyBookingsAction(): Promise<{
  upcoming: MyBookingItem[];
  past: MyBookingItem[];
  currentUserId: string;
  currentUserRole: string;
}> {
  const session = await getSession();
  const currentUserId = session ? session.id : '33333333-3333-3333-3333-333333333302';
  const currentUserRole = session ? session.role : 'employee';

  const supabase = await createClient();
  const isPlaceholderUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('placeholder') || !process.env.NEXT_PUBLIC_SUPABASE_URL;

  let allBookings: Booking[] = [];
  let rooms: Room[] = getStoreRooms();
  let departments: Department[] = getStoreDepartments();
  let employees: Employee[] = getStoreEmployees();

  if (!isPlaceholderUrl) {
    try {
      const { data: rData, error: rErr } = await (supabase.from('rooms') as any).select('*');
      if (!rErr && rData) rooms = rData as Room[]; else rooms = getStoreRooms();
      const { data: dData, error: dErr } = await (supabase.from('departments') as any).select('*');
      if (!dErr && dData) departments = dData as Department[]; else departments = getStoreDepartments();
      const { data: eData, error: eErr } = await (supabase.from('employees') as any).select('*');
      if (!eErr && eData) employees = eData as Employee[]; else employees = getStoreEmployees();

      const { data: bData, error: bErr } = await supabase
        .from('bookings')
        .select('*')
        .eq('employee_id', currentUserId)
        .order('start_time', { ascending: false });
      if (!bErr && bData) {
        allBookings = bData as Booking[];
      } else {
        if (bErr) console.warn('[Supabase fallback] Error loading cloud bookings:', bErr.message || bErr);
        allBookings = getStoreBookings()
          .filter(b => b.employee_id === currentUserId)
          .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
      }
    } catch (e: any) {
      console.warn('[Supabase fallback] Exception loading cloud bookings, using mock:', e?.message || e);
      allBookings = getStoreBookings()
        .filter(b => b.employee_id === currentUserId)
        .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
    }
  } else {
    allBookings = getStoreBookings()
      .filter(b => b.employee_id === currentUserId)
      .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
  }

  const nowMs = Date.now();
  const upcoming: MyBookingItem[] = [];
  const past: MyBookingItem[] = [];

  // Helper to build a MyBookingItem
  function buildItem(b: Booking, opts?: { is_invite?: boolean; organizer_name?: string }): MyBookingItem {
    const room = rooms.find(r => r.id === b.room_id);
    const dept = departments.find(d => d.id === b.department_id);
    const invitees = isPlaceholderUrl ? getInviteesForBooking(b.id) : [];
    return {
      ...b,
      room_name: room ? room.name : 'Unknown Room',
      room_floor: room ? room.floor : 'GHO Branch',
      department_name: dept ? dept.name : 'Department',
      is_invite: opts?.is_invite,
      organizer_name: opts?.organizer_name,
      invitee_count: invitees.length,
    };
  }

  // 1. Own bookings
  for (const b of allBookings) {
    const item = buildItem(b);
    if (b.status === 'confirmed' && new Date(b.end_time).getTime() >= nowMs) {
      upcoming.push(item);
    } else {
      past.push(item);
    }
  }

  // 2. Invited bookings (where user appears as an invitee but is NOT the organizer)
  const invitedBookingIds = isPlaceholderUrl
    ? getBookingIdsForInvitee(currentUserId)
    : []; // TODO: Supabase query when DB is connected

  const allStoreBookings = isPlaceholderUrl ? getStoreBookings() : [];
  const invitedBookings = allStoreBookings.filter(
    b => invitedBookingIds.includes(b.id) && b.employee_id !== currentUserId && b.status === 'confirmed'
  );

  for (const b of invitedBookings) {
    const organizer = employees.find(e => e.id === b.employee_id);
    const item = buildItem(b, {
      is_invite: true,
      organizer_name: organizer?.name || 'Unknown',
    });
    if (new Date(b.end_time).getTime() >= nowMs) {
      upcoming.push(item);
    } else {
      past.push(item);
    }
  }

  // Sort both lists chronologically
  upcoming.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  past.sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());

  return {
    upcoming,
    past,
    currentUserId,
    currentUserRole,
  };
}

/**
 * Server action to get calendar data for the logged-in employee (strictly scoped to own & invited meetings).
 */
export async function getEmployeeCalendarDataAction(): Promise<{
  bookings: AdminBookingItem[];
  rooms: Room[];
  departments: Department[];
  currentUserId: string;
}> {
  const session = await getSession();
  const currentUserId = session ? session.id : '33333333-3333-3333-3333-333333333302';

  const supabase = await createClient();
  const isPlaceholderUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('placeholder') || !process.env.NEXT_PUBLIC_SUPABASE_URL;

  let rooms: Room[] = getStoreRooms();
  let departments: Department[] = getStoreDepartments();
  let employees: Employee[] = getStoreEmployees();
  let ownBookings: Booking[] = [];
  let invitedBookings: Booking[] = [];

  if (!isPlaceholderUrl) {
    try {
      const { data: rData, error: rErr } = await (supabase.from('rooms') as any).select('*');
      if (!rErr && rData) rooms = rData as Room[]; else rooms = getStoreRooms();
      const { data: dData, error: dErr } = await (supabase.from('departments') as any).select('*');
      if (!dErr && dData) departments = dData as Department[]; else departments = getStoreDepartments();
      const { data: eData, error: eErr } = await (supabase.from('employees') as any).select('*');
      if (!eErr && eData) employees = eData as Employee[]; else employees = getStoreEmployees();

      // Fetch own bookings
      const { data: bData, error: bErr } = await supabase
        .from('bookings')
        .select('*')
        .eq('employee_id', currentUserId);
      if (!bErr && bData) {
        ownBookings = bData as Booking[];
      } else {
        if (bErr) console.warn('[Supabase fallback] Error loading cloud own bookings:', bErr.message || bErr);
        ownBookings = getStoreBookings().filter(b => b.employee_id === currentUserId);
      }

      // Fetch invited bookings
      const { data: invData, error: invErr } = await (supabase.from('booking_invitees') as any)
        .select('booking_id')
        .eq('employee_id', currentUserId);
      
      if (!invErr && invData && invData.length > 0) {
        const invIds = invData.map((i: any) => i.booking_id);
        const { data: invBData, error: invBErr } = await supabase
          .from('bookings')
          .select('*')
          .in('id', invIds)
          .neq('employee_id', currentUserId);
        if (!invBErr && invBData) {
          invitedBookings = invBData as Booking[];
        } else {
          const invitedBookingIds = getBookingIdsForInvitee(currentUserId);
          invitedBookings = getStoreBookings().filter(
            b => invitedBookingIds.includes(b.id) && b.employee_id !== currentUserId
          );
        }
      } else if (invErr) {
        console.warn('[Supabase fallback] Error loading cloud invited bookings:', invErr.message || invErr);
        const invitedBookingIds = getBookingIdsForInvitee(currentUserId);
        invitedBookings = getStoreBookings().filter(
          b => invitedBookingIds.includes(b.id) && b.employee_id !== currentUserId
        );
      }
    } catch (e: any) {
      console.warn('[Supabase fallback] Exception loading cloud calendar bookings, using mock:', e?.message || e);
      const allStoreBookings = getStoreBookings();
      ownBookings = allStoreBookings.filter(b => b.employee_id === currentUserId);
      const invitedBookingIds = getBookingIdsForInvitee(currentUserId);
      invitedBookings = allStoreBookings.filter(
        b => invitedBookingIds.includes(b.id) && b.employee_id !== currentUserId
      );
    }
  } else {
    const allStoreBookings = getStoreBookings();
    ownBookings = allStoreBookings.filter(b => b.employee_id === currentUserId);
    
    const invitedBookingIds = getBookingIdsForInvitee(currentUserId);
    invitedBookings = allStoreBookings.filter(
      b => invitedBookingIds.includes(b.id) && b.employee_id !== currentUserId
    );
  }

  const enrichedBookings: AdminBookingItem[] = [];

  // Helper to build AdminBookingItem
  function buildAdminItem(b: Booking, isInvite: boolean): AdminBookingItem {
    const room = rooms.find(r => r.id === b.room_id);
    const dept = departments.find(d => d.id === b.department_id);
    const booker = employees.find(e => e.id === b.employee_id);
    const invitees = isPlaceholderUrl ? getInviteesForBooking(b.id) : [];

    return {
      ...b,
      room_name: room ? room.name : 'Unknown Room',
      room_floor: room ? room.floor : 'GHO Branch',
      department_name: dept ? dept.name : 'Department',
      booker_name: booker ? booker.name : 'Unknown Employee',
      booker_code: booker ? booker.employee_id : 'ECN-0000',
      is_invite: isInvite,
      organizer_name: booker ? booker.name : 'Unknown',
      invitee_count: invitees.length,
    };
  }

  for (const b of ownBookings) {
    enrichedBookings.push(buildAdminItem(b, false));
  }

  for (const b of invitedBookings) {
    enrichedBookings.push(buildAdminItem(b, true));
  }

  // Sort chronologically by start_time
  enrichedBookings.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

  return {
    bookings: enrichedBookings,
    rooms: sortRoomsByCapacityAndName(rooms),
    departments,
    currentUserId,
  };
}

/**
 * Server action to get the actual server time in IST (to prevent client device clock manipulation).
 */
export async function getActualServerIstTimeAction(): Promise<{
  serverTimeMs: number;
  istDateStr: string;
  istTimeStr: string;
}> {
  const now = Date.now();
  return {
    serverTimeMs: now,
    istDateStr: getIstDateStr(now),
    istTimeStr: getIstTimeStr(now),
  };
}

/**
 * Server action to fetch searchable employee list for Admin "Book For" feature.
 */
export async function getEmployeesForBookingAction(): Promise<EmployeeSearchItem[]> {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return [];
  }

  const isPlaceholderUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('placeholder') || !process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabase = !isPlaceholderUrl ? createAdminClient() : await createClient();

  let employees: Employee[] = getStoreEmployees().filter(e => e.is_active);
  let departments: Department[] = getStoreDepartments();

  if (!isPlaceholderUrl) {
    try {
      const { data: eData, error: eErr } = await (supabase.from('employees') as any).select('*').eq('is_active', true);
      if (!eErr && eData) employees = eData as Employee[]; else if (eErr) console.warn('[Supabase fallback] Error fetching employees for booking:', eErr.message || eErr);
      const { data: dData, error: dErr } = await (supabase.from('departments') as any).select('*');
      if (!dErr && dData) departments = dData as Department[]; else if (dErr) console.warn('[Supabase fallback] Error fetching departments for booking:', dErr.message || dErr);
    } catch (e: any) {
      console.warn('[Supabase fallback] Exception fetching employees for booking:', e?.message || e);
    }
  }

  return sortEmployeesByHierarchy(employees, departments).map(emp => {
    const dept = departments.find(d => d.id === emp.department_id);
    return {
      id: emp.id,
      employee_id: emp.employee_id,
      name: emp.name,
      department_id: emp.department_id || '11111111-1111-1111-1111-111111111101',
      department_name: dept ? dept.name : 'Unknown Department',
    };
  });
}

/**
 * Server action to search employees and departments for the Invite Attendees feature.
 * Accessible by any logged-in user (not admin-only).
 * Returns up to 8 employees + 5 departments matching the query (min 2 chars).
 */
export async function getInviteeSuggestionsAction(query: string): Promise<InviteeSuggestion[]> {
  const session = await getSession();
  if (!session) return [];

  if (!query || query.trim().length < 2) return [];

  const q = query.toLowerCase().trim();

  const isPlaceholderUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('placeholder') || !process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabase = !isPlaceholderUrl ? createAdminClient() : await createClient();

  let employees: Employee[] = getStoreEmployees().filter(e => e.is_active);
  let departments: Department[] = getStoreDepartments();

  if (!isPlaceholderUrl) {
    try {
      const { data: eData, error: eErr } = await (supabase.from('employees') as any).select('*').eq('is_active', true);
      if (!eErr && eData) employees = eData as Employee[]; else if (eErr) console.warn('[Supabase fallback] Error fetching invitee suggestions:', eErr.message || eErr);
      const { data: dData, error: dErr } = await (supabase.from('departments') as any).select('*');
      if (!dErr && dData) departments = dData as Department[]; else if (dErr) console.warn('[Supabase fallback] Error fetching departments for invitees:', dErr.message || dErr);
    } catch (e: any) {
      console.warn('[Supabase fallback] Exception fetching invitee suggestions:', e?.message || e);
    }
  }

  const results: InviteeSuggestion[] = [];

  // Matching employees (exclude the session user themselves), sorted by hierarchy priority
  const matchedEmployees = sortEmployeesByHierarchy(employees, departments)
    .filter(e => e.id !== session.id && (
      e.name.toLowerCase().includes(q) ||
      e.employee_id.toLowerCase().includes(q)
    ))
    .slice(0, 8);

  for (const emp of matchedEmployees) {
    const dept = departments.find(d => d.id === emp.department_id);
    results.push({
      type: 'employee',
      id: emp.id,
      label: emp.name,
      subLabel: dept?.name || 'Unknown Dept',
      department_id: emp.department_id || undefined,
      employee_code: emp.employee_id,
    });
  }

  // Matching departments
  const matchedDepts = departments
    .filter(d => d.name.toLowerCase().includes(q))
    .slice(0, 5);

  for (const dept of matchedDepts) {
    const memberCount = employees.filter(e => e.department_id === dept.id).length;
    results.push({
      type: 'department',
      id: dept.id,
      label: dept.name,
      subLabel: `${memberCount} member${memberCount !== 1 ? 's' : ''}`,
      department_id: dept.id,
    });
  }

  return results;
}

/**
 * Server action to fetch all active employees belonging to a specific department.
 * Used when expanding a department selection into individual removable chips.
 */
export async function getDepartmentEmployeesAction(departmentId: string): Promise<InviteeSuggestion[]> {
  const session = await getSession();
  if (!session || !departmentId) return [];

  const isPlaceholderUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('placeholder') || !process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabase = !isPlaceholderUrl ? createAdminClient() : await createClient();

  let employees: Employee[] = getStoreEmployees().filter(e => e.is_active);
  let departments: Department[] = getStoreDepartments();

  if (!isPlaceholderUrl) {
    try {
      const { data: eData, error: eErr } = await (supabase.from('employees') as any).select('*').eq('is_active', true).eq('department_id', departmentId);
      if (!eErr && eData) employees = eData as Employee[]; else if (eErr) console.warn('[Supabase fallback] Error fetching department employees:', eErr.message || eErr);
      const { data: dData, error: dErr } = await (supabase.from('departments') as any).select('*');
      if (!dErr && dData) departments = dData as Department[]; else if (dErr) console.warn('[Supabase fallback] Error fetching departments for department employees:', dErr.message || dErr);
    } catch (e: any) {
      console.warn('[Supabase fallback] Exception fetching department employees:', e?.message || e);
    }
  }

  const dept = departments.find(d => d.id === departmentId);
  const deptEmployees = employees.filter(e => e.department_id === departmentId && e.id !== session.id);

  return sortEmployeesByHierarchy(deptEmployees, departments).map(emp => ({
    type: 'employee',
    id: emp.id,
    label: emp.name,
    subLabel: dept?.name || 'Unknown Dept',
    department_id: emp.department_id || undefined,
    employee_code: emp.employee_id,
  }));
}

