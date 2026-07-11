'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSession } from '@/actions/auth';
import { MOCK_DEPARTMENTS, MOCK_EMPLOYEES } from '@/lib/mock-data';
import { getStoreBookings, getStoreRooms, getStoreAmenities, addMockRoom, updateMockRoom, deleteMockRoom, addMockAmenity, deleteMockAmenity, getStoreDepartments, getStoreEmployees, addMockEmployee, addMockEmployeesBatch, updateMockEmployee, deleteMockEmployee, addMockDepartment, deleteMockDepartment, addMockAuditLog, addMockResetToken, getBookingIdsForInvitee } from '@/lib/mock-store';
import { Room, Department, Booking, Employee, Amenity, UsageStat, CleanupJobLog } from '@/lib/types';
import { sortRoomsByCapacityAndName, sortEmployeesByHierarchy } from '@/lib/sorting';
import { format, isToday } from 'date-fns';
import { revalidatePath } from 'next/cache';
import { sendNotificationEmail } from '@/actions/smtp';
import { getNewEmployeeEmailHtml, getPasswordResetLinkEmailHtml, getBulkImportCompletedEmailHtml, getAccountLockedEmailHtml } from '@/lib/email-templates';
import { getCleanupReportsDataAction } from '@/actions/cleanup';

export interface AdminBookingItem extends Booking {
  room_name: string;
  room_floor: string;
  department_name: string;
  booker_name: string;
  booker_code: string;
  /** True when the current user was invited to this booking (not the organizer) */
  is_invite?: boolean;
  /** Name of the organizer (populated when is_invite is true) */
  organizer_name?: string;
  /** Number of invitees on this booking */
  invitee_count?: number;
  /** True when agenda is masked due to privacy rules */
  is_masked?: boolean;
}

export interface DeptDistribution {
  deptName: string;
  count: number;
  percentage: number;
}

export interface AdminMetrics {
  totalRooms: number;
  totalBookings: number;
  todayBookings: number;
  mostBookedRoomName: string;
  deptDistribution: DeptDistribution[];
}

export interface AdminDashboardData {
  rooms: Room[];
  departments: Department[];
  bookings: AdminBookingItem[];
  amenities: Amenity[];
  metrics: AdminMetrics;
  currentUserId: string;
  /** Booking IDs where the logged-in admin is an invitee (not organizer) — used for "My Meetings" filter */
  currentUserInvitedBookingIds: string[];
  employees: Employee[];
  usageStats: UsageStat[];
  cleanupJobLogs: CleanupJobLog[];
}

/**
 * Server action to fetch all data needed for the Master Admin Portal.
 */
export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    throw new Error('Unauthorized: Admin access required.');
  }

  const isPlaceholderUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('placeholder') || !process.env.NEXT_PUBLIC_SUPABASE_URL;

  let rooms: Room[] = [];
  let departments: Department[] = [];
  let allBookings: Booking[] = [];
  let employees: Employee[] = [];
  let amenities: Amenity[] = [];

  if (!isPlaceholderUrl) {
    const supabase = createAdminClient();
    const { data: rData, error: rErr } = await (supabase.from('rooms') as any).select('*').order('capacity').order('name');
    if (rErr) {
      console.warn('[Supabase fallback] Query error [rooms]:', rErr.message || rErr);
      rooms = sortRoomsByCapacityAndName(getStoreRooms());
    } else if (rData) {
      rooms = sortRoomsByCapacityAndName(rData as Room[]);
    } else {
      rooms = sortRoomsByCapacityAndName(getStoreRooms());
    }
    
    const { data: dData, error: dErr } = await (supabase.from('departments') as any).select('*').order('name');
    if (dErr) {
      console.warn('[Supabase fallback] Query error [departments]:', dErr.message || dErr);
      departments = getStoreDepartments();
    } else if (dData) {
      departments = dData as Department[];
    } else {
      departments = getStoreDepartments();
    }

    const { data: bData, error: bErr } = await (supabase.from('bookings') as any)
      .select('*')
      .order('start_time', { ascending: false });
    if (bErr) {
      console.warn('[Supabase fallback] Query error [bookings]:', bErr.message || bErr);
      allBookings = [...getStoreBookings()].sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
    } else if (bData) {
      allBookings = bData as Booking[];
    } else {
      allBookings = [...getStoreBookings()].sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
    }

    const { data: eData, error: eErr } = await (supabase.from('employees') as any).select('*');
    if (eErr) {
      console.warn('[Supabase fallback] Query error [employees]:', eErr.message || eErr);
      employees = getStoreEmployees();
    } else if (eData) {
      employees = eData as Employee[];
    } else {
      employees = getStoreEmployees();
    }

    const { data: aData, error: aErr } = await (supabase.from('amenities') as any).select('*').order('name');
    if (aErr) {
      console.warn('[Supabase fallback] Query error [amenities]:', aErr.message || aErr);
      amenities = getStoreAmenities();
    } else if (aData) {
      amenities = aData as Amenity[];
    } else {
      amenities = getStoreAmenities();
    }
  } else {
    rooms = sortRoomsByCapacityAndName(getStoreRooms());
    departments = getStoreDepartments();
    allBookings = [...getStoreBookings()].sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
    employees = getStoreEmployees();
    amenities = getStoreAmenities();
  }

  // Enrich bookings with room, dept, and employee details
  const enrichedBookings: AdminBookingItem[] = allBookings.map(b => {
    const room = rooms.find(r => r.id === b.room_id);
    const dept = departments.find(d => d.id === b.department_id);
    const emp = employees.find(e => e.id === b.employee_id);

    return {
      ...b,
      room_name: room ? room.name : 'Deleted Room',
      room_floor: room ? room.floor : 'GHO Branch',
      department_name: dept ? dept.name : 'Department',
      booker_name: emp ? emp.name : 'Employee',
      booker_code: emp ? emp.employee_id : 'ECN-XXXX',
    };
  });

  // Calculate KPI metrics
  const activeRoomsCount = rooms.filter(r => r.is_active).length;
  const confirmedBookings = enrichedBookings.filter(b => b.status === 'confirmed');
  const todayBookingsCount = confirmedBookings.filter(b => isToday(new Date(b.start_time))).length;

  // Fetch historical usage stats and cleanup job logs
  const cleanupReports = await getCleanupReportsDataAction().catch(() => ({
    usageStats: [],
    recentBookings: [],
    jobLogs: [],
  }));
  const { usageStats, jobLogs: cleanupJobLogs } = cleanupReports;

  // Most booked room across both historical usage stats and recent live bookings
  const roomCounts: Record<string, number> = {};
  for (const stat of usageStats) {
    if (stat.period_type === 'weekly') {
      const r = rooms.find(rm => rm.id === stat.room_id);
      const rName = r ? r.name : 'Deleted Room';
      roomCounts[rName] = (roomCounts[rName] || 0) + stat.booking_count;
    }
  }
  for (const b of confirmedBookings) {
    roomCounts[b.room_name] = (roomCounts[b.room_name] || 0) + 1;
  }
  let mostBookedRoomName = 'None';
  let maxCount = 0;
  for (const [rName, count] of Object.entries(roomCounts)) {
    if (count > maxCount) {
      maxCount = count;
      mostBookedRoomName = rName;
    }
  }

  // Department distribution across both historical usage stats and recent live bookings
  const deptCounts: Record<string, number> = {};
  for (const stat of usageStats) {
    if (stat.period_type === 'weekly') {
      const d = departments.find(dep => dep.id === stat.department_id);
      const dName = d ? d.name : 'Unknown Dept';
      deptCounts[dName] = (deptCounts[dName] || 0) + stat.booking_count;
    }
  }
  for (const b of confirmedBookings) {
    deptCounts[b.department_name] = (deptCounts[b.department_name] || 0) + 1;
  }
  const totalCombinedCount = Object.values(deptCounts).reduce((sum, c) => sum + c, 0) || 1;
  const deptDistribution: DeptDistribution[] = departments.map(d => {
    const c = deptCounts[d.name] || 0;
    return {
      deptName: d.name,
      count: c,
      percentage: Math.round((c / totalCombinedCount) * 100),
    };
  }).sort((a, b) => b.count - a.count);

  // Compute invited booking IDs for the logged-in admin (for "My Meetings" filter in the calendar)
  const currentUserInvitedBookingIds: string[] = getBookingIdsForInvitee(session.id);

  return {
    rooms,
    departments,
    bookings: enrichedBookings,
    amenities,
    metrics: {
      totalRooms: activeRoomsCount,
      totalBookings: confirmedBookings.length,
      todayBookings: todayBookingsCount,
      mostBookedRoomName,
      deptDistribution,
    },
    currentUserId: session.id,
    currentUserInvitedBookingIds,
    employees: sortEmployeesByHierarchy(employees, departments),
    usageStats,
    cleanupJobLogs,
  };
}

/**
 * Server action to create a new meeting room.
 */
export async function createRoomAction(formData: FormData): Promise<{ success?: boolean; error?: string; message?: string }> {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return { error: 'Unauthorized: Admin privileges required.' };
  }

  const name = (formData.get('name') as string)?.trim();
  const capacity = Number(formData.get('capacity') || 4);
  const floor = (formData.get('floor') as string) || 'Ground Floor';
  const amenitiesStr = (formData.get('amenities') as string) || '';
  const restrictedDeptId = formData.get('restrictedDeptId') as string;

  if (!name || capacity < 1) {
    return { error: 'Please provide a valid Room Name and seating capacity.' };
  }

  const isPlaceholderUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('placeholder') || !process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabase = !isPlaceholderUrl ? createAdminClient() : await createClient();

  const amenities = amenitiesStr
    .split(',')
    .map(a => a.trim())
    .filter(a => a.length > 0);

  // Validate against master amenities list
  let validNames: Set<string>;
  if (!isPlaceholderUrl) {
    const { data: aData } = await (supabase.from('amenities') as any).select('name');
    validNames = new Set((aData || []).map((a: any) => a.name));
  } else {
    validNames = new Set(getStoreAmenities().map(a => a.name));
  }
  const validatedAmenities = amenities.filter(a => validNames.has(a));

  const restrictedId = (restrictedDeptId && restrictedDeptId !== 'none') ? restrictedDeptId : null;

  const newRoom: Room = {
    id: crypto.randomUUID(),
    name,
    capacity,
    floor,
    amenities: validatedAmenities,
    is_active: true,
    restricted_to_department_id: restrictedId,
    created_at: new Date().toISOString(),
  };

  if (!isPlaceholderUrl) {
    const { error: insertError } = await (supabase.from('rooms') as any).insert([newRoom]);
    if (insertError) {
      return { error: `Failed to create room: ${insertError.message}` };
    }
  } else {
    addMockRoom(newRoom);
  }

  revalidatePath('/admin');
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/my-bookings');
  revalidatePath('/dashboard/calendar');

  return { success: true, message: `Successfully added ${name} (${capacity} seats) to the GHO Branch!` };
}

/**
 * Server action to update an existing meeting room.
 */
export async function updateRoomAction(formData: FormData): Promise<{ success?: boolean; error?: string; message?: string }> {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return { error: 'Unauthorized: Admin privileges required.' };
  }

  const roomId = formData.get('roomId') as string;
  const name = (formData.get('name') as string)?.trim();
  const capacity = Number(formData.get('capacity') || 4);
  const floor = (formData.get('floor') as string) || 'Ground Floor';
  const amenitiesStr = (formData.get('amenities') as string) || '';
  const restrictedDeptId = formData.get('restrictedDeptId') as string;
  const isActive = formData.get('isActive') === 'true';

  if (!roomId || !name || capacity < 1) {
    return { error: 'Invalid room update parameters.' };
  }

  const isPlaceholderUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('placeholder') || !process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabase = !isPlaceholderUrl ? createAdminClient() : await createClient();

  const amenities = amenitiesStr
    .split(',')
    .map(a => a.trim())
    .filter(a => a.length > 0);

  // Validate against master amenities list
  let validNames: Set<string>;
  if (!isPlaceholderUrl) {
    const { data: aData } = await (supabase.from('amenities') as any).select('name');
    validNames = new Set((aData || []).map((a: any) => a.name));
  } else {
    validNames = new Set(getStoreAmenities().map(a => a.name));
  }
  const validatedAmenities = amenities.filter(a => validNames.has(a));

  const restrictedId = (restrictedDeptId && restrictedDeptId !== 'none') ? restrictedDeptId : null;

  const updatedRoom: Room = {
    id: roomId,
    name,
    capacity,
    floor,
    amenities: validatedAmenities,
    is_active: isActive,
    restricted_to_department_id: restrictedId,
    created_at: new Date().toISOString(),
  };

  if (!isPlaceholderUrl) {
    const { error: updateError } = await (supabase.from('rooms') as any)
      .update({
        name,
        capacity,
        floor,
        amenities: updatedRoom.amenities,
        is_active: isActive,
        restricted_to_department_id: restrictedId,
      })
      .eq('id', roomId);

    if (updateError) {
      return { error: `Failed to update room: ${updateError.message}` };
    }
  } else {
    const success = updateMockRoom(updatedRoom);
    if (!success) {
      return { error: 'Room not found in local store.' };
    }
  }

  revalidatePath('/admin');
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/my-bookings');
  revalidatePath('/dashboard/calendar');

  return { success: true, message: `Successfully updated ${name} settings!` };
}

/**
 * Server action to create a new amenity in the master list.
 */
export async function createAmenityAction(formData: FormData): Promise<{ success?: boolean; error?: string; message?: string }> {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return { error: 'Unauthorized: Admin privileges required.' };
  }

  const name = (formData.get('name') as string)?.trim();
  const icon = (formData.get('icon') as string)?.trim() || 'Sparkles';

  if (!name) {
    return { error: 'Please enter a valid Amenity Name.' };
  }

  const newAmenity: Amenity = {
    id: crypto.randomUUID(),
    name,
    icon,
    created_at: new Date().toISOString(),
  };

  const isPlaceholderUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('placeholder') || !process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabase = !isPlaceholderUrl ? createAdminClient() : await createClient();

  if (!isPlaceholderUrl) {
    const { error: insertError } = await (supabase.from('amenities') as any).insert([newAmenity]);
    if (insertError) {
      return { error: `Failed to add amenity: ${insertError.message}` };
    }
  } else {
    const store = getStoreAmenities();
    if (store.some(a => a.name.toLowerCase() === name.toLowerCase())) {
      return { error: `An amenity named "${name}" already exists.` };
    }
    addMockAmenity(newAmenity);
  }

  revalidatePath('/admin');
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/calendar');

  return { success: true, message: `Added "${name}" to the master amenities list!` };
}

/**
 * Server action to delete an amenity from the master list and unassign it from all rooms.
 */
export async function deleteAmenityAction(amenityId: string): Promise<{ success?: boolean; error?: string; message?: string }> {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return { error: 'Unauthorized: Admin privileges required.' };
  }

  if (!amenityId) {
    return { error: 'Invalid amenity ID.' };
  }

  const isPlaceholderUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('placeholder') || !process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabase = !isPlaceholderUrl ? createAdminClient() : await createClient();

  if (!isPlaceholderUrl) {
    // 1. Get the amenity name
    const { data: amenityData, error: aErr } = await (supabase.from('amenities') as any).select('name').eq('id', amenityId).single();
    if (aErr || !amenityData) {
      return { error: 'Amenity not found.' };
    }
    const amenityName = amenityData.name;

    // 2. Find all rooms having this amenity and update them
    const { data: roomsData } = await (supabase.from('rooms') as any).select('*');
    if (roomsData) {
      for (const r of (roomsData as Room[])) {
        if (r.amenities && r.amenities.includes(amenityName)) {
          const newAm = r.amenities.filter(a => a !== amenityName);
          await (supabase.from('rooms') as any).update({ amenities: newAm }).eq('id', r.id);
        }
      }
    }

    // 3. Delete amenity
    const { error: delErr } = await (supabase.from('amenities') as any).delete().eq('id', amenityId);
    if (delErr) {
      return { error: `Failed to delete amenity: ${delErr.message}` };
    }
  } else {
    const success = deleteMockAmenity(amenityId);
    if (!success) {
      return { error: 'Amenity not found in local store.' };
    }
  }

  revalidatePath('/admin');
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/calendar');

  return { success: true, message: 'Amenity removed and unassigned from all meeting rooms.' };
}

/**
 * Server action to delete or deactivate a meeting room with safety checks.
 */
export async function deleteRoomAction(roomId: string, confirmCancelUpcoming?: boolean) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return { error: 'Unauthorized: Admin privileges required.' };
  }
  if (!roomId) return { error: 'Invalid room ID.' };

  const isPlaceholderUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('placeholder') || !process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabase = !isPlaceholderUrl ? createAdminClient() : await createClient();

  let allBookingsForRoom: Booking[] = [];
  let roomName = 'Room';

  if (!isPlaceholderUrl) {
    const { data: rData } = await (supabase.from('rooms') as any).select('name').eq('id', roomId).single();
    if (rData) roomName = rData.name;
    const { data: bData } = await (supabase.from('bookings') as any).select('*').eq('room_id', roomId);
    if (bData) allBookingsForRoom = bData as Booking[];
  } else {
    const r = getStoreRooms().find(r => r.id === roomId);
    if (r) roomName = r.name;
    allBookingsForRoom = getStoreBookings().filter(b => b.room_id === roomId);
  }

  const totalBookingsCount = allBookingsForRoom.length;
  const nowMs = Date.now();
  const upcomingConfirmed = allBookingsForRoom.filter(b => {
    return b.status === 'confirmed' && new Date(b.start_time).getTime() >= nowMs;
  });

  if (totalBookingsCount === 0) {
    // True Hard Delete
    if (!isPlaceholderUrl) {
      const { error: delErr } = await (supabase.from('rooms') as any).delete().eq('id', roomId);
      if (delErr) return { error: `Database hard delete failed: ${delErr.message}` };
    } else {
      deleteMockRoom(roomId);
    }
    
    // Audit Log
    addMockAuditLog({
      id: crypto.randomUUID(),
      action_type: 'room_change',
      performed_by: session.id,
      target_id: roomId,
      details: { action: 'hard_delete', room_name: roomName },
      created_at: new Date().toISOString(),
    });

    revalidatePath('/admin');
    revalidatePath('/dashboard');
    revalidatePath('/dashboard/calendar');
    return { success: true, isHardDelete: true, message: `Room "${roomName}" was permanently hard-deleted (zero bookings ever).` };
  }

  // If there are upcoming confirmed bookings and admin hasn't confirmed cancelling them
  if (upcomingConfirmed.length > 0 && !confirmCancelUpcoming) {
    return { 
      error: 'upcoming_conflict', 
      upcomingCount: upcomingConfirmed.length,
      message: `This room has ${upcomingConfirmed.length} upcoming booking(s). Deleting it will cancel these meetings.`
    };
  }

  // Cancel upcoming meetings if any
  if (upcomingConfirmed.length > 0) {
    if (!isPlaceholderUrl) {
      for (const ub of upcomingConfirmed) {
        await (supabase.from('bookings') as any).update({
          status: 'cancelled',
          cancelled_by: session.id,
          cancel_reason: 'Room deleted by administrator'
        }).eq('id', ub.id);
      }
    } else {
      for (const ub of upcomingConfirmed) {
        const store = getStoreBookings();
        const idx = store.findIndex(b => b.id === ub.id);
        if (idx !== -1) {
          store[idx].status = 'cancelled';
          store[idx].cancelled_by = session.id;
          store[idx].cancel_reason = 'Room deleted by administrator';
        }
      }
    }
  }

  // Perform Soft Delete (Deactivate)
  if (!isPlaceholderUrl) {
    const { error: updErr } = await (supabase.from('rooms') as any).update({ is_active: false }).eq('id', roomId);
    if (updErr) return { error: `Soft delete failed: ${updErr.message}` };
  } else {
    const store = getStoreRooms();
    const idx = store.findIndex(r => r.id === roomId);
    if (idx !== -1) {
      store[idx].is_active = false;
    }
  }

  addMockAuditLog({
    id: crypto.randomUUID(),
    action_type: 'room_change',
    performed_by: session.id,
    target_id: roomId,
    details: { action: 'soft_delete', room_name: roomName, cancelled_upcoming: upcomingConfirmed.length },
    created_at: new Date().toISOString(),
  });

  revalidatePath('/admin');
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/calendar');
  return { 
    success: true, 
    isSoftDelete: true, 
    message: `Room "${roomName}" was soft-deleted (deactivated) to preserve historical reports. ${upcomingConfirmed.length > 0 ? `Cancelled ${upcomingConfirmed.length} upcoming booking(s).` : ''}`
  };
}

/**
 * Server action to create a new employee account.
 */
export async function createEmployeeAction(formData: FormData) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return { error: 'Unauthorized: Admin privileges required.' };
  }

  const name = formData.get('name')?.toString().trim();
  const email = formData.get('email')?.toString().trim().toLowerCase();
  const employeeId = formData.get('employeeId')?.toString().trim().toUpperCase();
  const departmentId = formData.get('departmentId')?.toString();
  const role = (formData.get('role')?.toString() || 'employee') as 'employee' | 'admin';

  if (!name || !email || !employeeId || !departmentId) {
    return { error: 'Name, Email, Employee ID, and Department are required.' };
  }

  if (!email.endsWith('@dhanuka.com')) {
    return { error: 'Invalid email domain. Must end in @dhanuka.com' };
  }

  if (!/^ECN-\d+$/.test(employeeId)) {
    return { error: 'Employee ID must be in the format ECN-XXXX (e.g., ECN-1025).' };
  }

  const isPlaceholderUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('placeholder') || !process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabase = !isPlaceholderUrl ? createAdminClient() : await createClient();

  // Check unique ID and email
  if (!isPlaceholderUrl) {
    const { data: existId } = await (supabase.from('employees') as any).select('id').ilike('employee_id', employeeId).single();
    if (existId) return { error: `Employee ID "${employeeId}" is already registered.` };
    const { data: existEmail } = await (supabase.from('employees') as any).select('id').ilike('email', email).single();
    if (existEmail) return { error: `Email "${email}" is already registered.` };
  } else {
    const existId = getStoreEmployees().some(e => e.employee_id.toUpperCase() === employeeId);
    if (existId) return { error: `Employee ID "${employeeId}" is already registered.` };
    const existEmail = getStoreEmployees().some(e => e.email?.toLowerCase() === email);
    if (existEmail) return { error: `Email "${email}" is already registered.` };
  }

  // Generate initial password: first 4 letters of username + numeric employee code
  const usernamePart = email.split('@')[0].toLowerCase();
  const beforeSymbol = usernamePart.split(/[\.\-_]/)[0];
  let letters = beforeSymbol.replace(/[^a-z]/g, '');
  if (letters.length === 0) {
    letters = usernamePart.replace(/[^a-z]/g, '');
  }
  const prefix = letters.slice(0, 4);
  const numericCode = employeeId.replace(/^ECN-/, '');
  const initialPassword = prefix + numericCode;

  const newEmp: Employee = {
    id: crypto.randomUUID(),
    auth_user_id: null,
    employee_id: employeeId,
    name,
    email,
    initial_password: initialPassword,
    department_id: departmentId,
    role,
    is_active: true,
    is_locked: false,
    must_reset_password: true,  // Force first-login password reset
    failed_login_attempts: 0,
    created_at: new Date().toISOString(),
  };

  if (!isPlaceholderUrl) {
    const { error: insErr } = await (supabase.from('employees') as any).insert([newEmp]);
    if (insErr) return { error: `Database error: ${insErr.message}` };
  } else {
    addMockEmployee(newEmp);
  }

  addMockAuditLog({
    id: crypto.randomUUID(),
    action_type: 'employee_change',
    performed_by: session.id,
    target_id: newEmp.id,
    details: { action: 'create', employee_id: employeeId, email, name, role },
    created_at: new Date().toISOString(),
  });

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null) ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    'http://localhost:3000';
  sendNotificationEmail({
    to: email,
    subject: '[Dhanuka Meeting Rooms] Welcome to Dhanuka Meeting Portal',
    html: getNewEmployeeEmailHtml(name, employeeId, `${appUrl}/login`),
    eventType: 'new_employee_created',
  }).catch((err) => console.error('[SMTP Trigger Error - new_employee]:', err));

  revalidatePath('/admin');
  return { 
    success: true, 
    message: `Employee "${name}" (${employeeId}) added successfully.`,
    initialPassword,
    email 
  };
}

export interface BulkImportEmployeeInput {
  name: string;
  numericId: string;
  username: string;
  departmentId: string;
  role: 'employee' | 'admin';
}

export interface BulkImportResultItem {
  name: string;
  employee_id: string;
  email: string;
  initial_password: string;
  department_id: string;
  role: string;
}

/**
 * Server action to bulk import employees efficiently in a single batch.
 */
export async function bulkImportEmployeesAction(
  rows: BulkImportEmployeeInput[]
): Promise<{
  success?: boolean;
  error?: string;
  importedEmployees?: BulkImportResultItem[];
  message?: string;
}> {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return { error: 'Unauthorized: Admin privileges required.' };
  }

  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    return { error: 'No employee records provided for import.' };
  }

  if (rows.length > 500) {
    return { error: 'Exceeded maximum batch limit of 500 records per import.' };
  }

  const isPlaceholderUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('placeholder') || !process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabase = !isPlaceholderUrl ? createAdminClient() : await createClient();

  const existingEmps = isPlaceholderUrl ? getStoreEmployees() : ((await (supabase.from('employees') as any).select('id, employee_id, email')).data || getStoreEmployees());

  const existingIds = new Set(existingEmps.map((e: any) => e.employee_id.toUpperCase()));
  const existingEmails = new Set(existingEmps.map((e: any) => e.email ? e.email.toLowerCase() : ''));

  const newEmps: Employee[] = [];
  const resultItems: BulkImportResultItem[] = [];

  for (const row of rows) {
    const name = row.name.trim();
    const numericId = row.numericId.trim().replace(/^ECN-/i, '');
    const employeeId = `ECN-${numericId.toUpperCase()}`;
    const username = row.username.trim().split('@')[0].toLowerCase();
    const email = `${username}@dhanuka.com`;
    const departmentId = row.departmentId;
    const role = row.role === 'admin' ? 'admin' : 'employee';

    if (existingIds.has(employeeId)) {
      continue;
    }
    if (existingEmails.has(email)) {
      continue;
    }

    existingIds.add(employeeId);
    existingEmails.add(email);

    // Generate initial password: first 4 letters of username + numeric employee code
    const beforeSymbol = username.split(/[\.\-_]/)[0];
    let letters = beforeSymbol.replace(/[^a-z]/g, '');
    if (letters.length === 0) {
      letters = username.replace(/[^a-z]/g, '');
    }
    const prefix = letters.slice(0, 4);
    const initialPassword = prefix + numericId;

    const newEmp: Employee = {
      id: crypto.randomUUID(),
      auth_user_id: null,
      employee_id: employeeId,
      name,
      email,
      initial_password: initialPassword,
      department_id: departmentId,
      role,
      is_active: true,
      is_locked: false,
      must_reset_password: true,
      failed_login_attempts: 0,
      created_at: new Date().toISOString(),
    };

    newEmps.push(newEmp);
    resultItems.push({
      name,
      employee_id: employeeId,
      email,
      initial_password: initialPassword,
      department_id: departmentId,
      role,
    });
  }

  if (newEmps.length === 0) {
    return { error: 'No valid unique employee records could be imported.' };
  }

  if (!isPlaceholderUrl) {
    const { error: insErr } = await (supabase.from('employees') as any).insert(newEmps);
    if (insErr) {
      return { error: `Database error during bulk insert: ${insErr.message}` };
    }
  } else {
    addMockEmployeesBatch(newEmps);
  }

  addMockAuditLog({
    id: crypto.randomUUID(),
    action_type: 'bulk_import_employees',
    performed_by: session.id,
    target_id: null,
    details: {
      action: 'bulk_import',
      imported_count: newEmps.length,
      performed_by_name: session.name,
      timestamp: new Date().toISOString(),
    },
    created_at: new Date().toISOString(),
  });

  const adminEmp = getStoreEmployees().find(e => e.id === session.id);
  const adminEmail = adminEmp?.email || 'notifications@dhanuka.com';
  const skippedCount = rows.length - newEmps.length;
  sendNotificationEmail({
    to: adminEmail,
    subject: '[Dhanuka Meeting Rooms] Bulk Employee Import Completed',
    html: getBulkImportCompletedEmailHtml({
      adminName: session.name || 'Administrator',
      successCount: newEmps.length,
      skippedCount: skippedCount > 0 ? skippedCount : 0,
    }),
    eventType: 'bulk_import_completed',
  }).catch((err) => console.error('[SMTP Trigger Error - bulk_import]:', err));

  revalidatePath('/admin');
  return {
    success: true,
    message: `${newEmps.length} employees imported successfully in a single batch operation.`,
    importedEmployees: resultItems,
  };
}

/**
 * Server action to update existing employee details (Name, Department, Role, Email).
 * Employee ID is non-editable.
 */
export async function updateEmployeeAction(formData: FormData): Promise<{ success?: boolean; error?: string; message?: string }> {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return { error: 'Unauthorized: Admin privileges required.' };
  }

  const id = formData.get('id')?.toString();
  const name = formData.get('name')?.toString().trim();
  const email = formData.get('email')?.toString().trim().toLowerCase();
  const departmentId = formData.get('departmentId')?.toString();
  const role = (formData.get('role')?.toString() || 'employee') as 'employee' | 'admin';

  if (!id || !name || !email || !departmentId) {
    return { error: 'Employee ID, Name, Email, and Department are required.' };
  }

  if (!email.endsWith('@dhanuka.com')) {
    return { error: 'Invalid email domain. Must end in @dhanuka.com' };
  }

  const isPlaceholderUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('placeholder') || !process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabase = !isPlaceholderUrl ? createAdminClient() : await createClient();

  // Check unique email (if changed to an email already taken by another account)
  if (!isPlaceholderUrl) {
    const { data: existEmail } = await (supabase.from('employees') as any)
      .select('id')
      .ilike('email', email)
      .neq('id', id)
      .single();
    if (existEmail) return { error: `Email "${email}" is already registered to another account.` };
  } else {
    const existEmail = getStoreEmployees().some(e => e.id !== id && e.email?.toLowerCase() === email);
    if (existEmail) return { error: `Email "${email}" is already registered to another account.` };
  }

  // Get current employee to log diff in audit trail
  let currentEmp: Employee | undefined;
  if (!isPlaceholderUrl) {
    const { data } = await (supabase.from('employees') as any).select('*').eq('id', id).single();
    if (data) currentEmp = data as Employee;
  } else {
    currentEmp = getStoreEmployees().find(e => e.id === id);
  }

  if (!currentEmp) {
    return { error: 'Employee not found.' };
  }

  const changes: Record<string, { old: any; new: any }> = {};
  if (currentEmp.name !== name) changes.name = { old: currentEmp.name, new: name };
  if (currentEmp.email !== email) changes.email = { old: currentEmp.email, new: email };
  if (currentEmp.department_id !== departmentId) changes.department_id = { old: currentEmp.department_id, new: departmentId };
  if (currentEmp.role !== role) changes.role = { old: currentEmp.role, new: role };

  const updatedEmp: Employee = {
    ...currentEmp,
    name,
    email,
    department_id: departmentId,
    role,
  };

  if (!isPlaceholderUrl) {
    const { error: updErr } = await (supabase.from('employees') as any)
      .update({
        name,
        email,
        department_id: departmentId,
        role,
      })
      .eq('id', id);
    if (updErr) return { error: `Database update failed: ${updErr.message}` };
  } else {
    updateMockEmployee(updatedEmp);
  }

  addMockAuditLog({
    id: crypto.randomUUID(),
    action_type: 'employee_change',
    performed_by: session.id,
    target_id: id,
    details: { 
      action: 'update', 
      employee_id: currentEmp.employee_id,
      changes 
    },
    created_at: new Date().toISOString(),
  });

  revalidatePath('/admin');
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/calendar');
  return { success: true, message: `Employee "${name}" (${currentEmp.employee_id}) updated successfully.` };
}

/**
 * Server action to toggle employee active/inactive status (soft delete).
 */
export async function toggleEmployeeStatusAction(employeeId: string, isActive: boolean) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return { error: 'Unauthorized: Admin privileges required.' };
  }

  const isPlaceholderUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('placeholder') || !process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabase = !isPlaceholderUrl ? createAdminClient() : await createClient();

  if (!isPlaceholderUrl) {
    const { error: updErr } = await (supabase.from('employees') as any).update({ is_active: isActive }).eq('id', employeeId);
    if (updErr) return { error: `Database update failed: ${updErr.message}` };
  } else {
    const store = getStoreEmployees();
    const idx = store.findIndex(e => e.id === employeeId);
    if (idx !== -1) {
      store[idx].is_active = isActive;
    }
  }

  addMockAuditLog({
    id: crypto.randomUUID(),
    action_type: 'employee_change',
    performed_by: session.id,
    target_id: employeeId,
    details: { action: isActive ? 'reactivate' : 'deactivate' },
    created_at: new Date().toISOString(),
  });

  revalidatePath('/admin');
  return { success: true, message: `Employee account ${isActive ? 'reactivated' : 'deactivated (soft-deleted)'}.` };
}

/**
 * Server action to hard-delete an employee if zero bookings exist.
 */
export async function deleteEmployeeAction(employeeId: string) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return { error: 'Unauthorized: Admin privileges required.' };
  }

  const isPlaceholderUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('placeholder') || !process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabase = !isPlaceholderUrl ? createAdminClient() : await createClient();

  let hasBookings = false;
  if (!isPlaceholderUrl) {
    const { data: bData } = await (supabase.from('bookings') as any).select('id').eq('employee_id', employeeId).limit(1);
    if (bData && bData.length > 0) hasBookings = true;
  } else {
    hasBookings = getStoreBookings().some(b => b.employee_id === employeeId);
  }

  if (hasBookings) {
    return { 
      error: 'has_bookings', 
      message: 'Cannot Hard Delete: This employee has historical or active bookings. To preserve audit logs and reporting integrity, please Deactivate their account instead.' 
    };
  }

  if (!isPlaceholderUrl) {
    const { error: delErr } = await (supabase.from('employees') as any).delete().eq('id', employeeId);
    if (delErr) return { error: `Database hard delete failed: ${delErr.message}` };
  } else {
    deleteMockEmployee(employeeId);
  }

  addMockAuditLog({
    id: crypto.randomUUID(),
    action_type: 'employee_change',
    performed_by: session.id,
    target_id: employeeId,
    details: { action: 'hard_delete' },
    created_at: new Date().toISOString(),
  });

  revalidatePath('/admin');
  return { success: true, message: 'Employee record permanently hard-deleted (zero bookings ever).' };
}

/**
 * Server action to create a new department.
 */
export async function createDepartmentAction(formData: FormData) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return { error: 'Unauthorized: Admin privileges required.' };
  }

  const name = formData.get('name')?.toString().trim();
  if (!name) return { error: 'Department name is required.' };
  const isPlaceholderUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('placeholder') || !process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabase = !isPlaceholderUrl ? createAdminClient() : await createClient();

  if (!isPlaceholderUrl) {
    const { data: exist } = await (supabase.from('departments') as any).select('id').ilike('name', name).single();
    if (exist) return { error: `Department "${name}" already exists.` };
  } else {
    const exist = getStoreDepartments().some(d => d.name.toLowerCase() === name.toLowerCase());
    if (exist) return { error: `Department "${name}" already exists.` };
  }

  const newDept: Department = {
    id: crypto.randomUUID(),
    name,
    is_restricted_default: false,
    created_at: new Date().toISOString(),
  };

  if (!isPlaceholderUrl) {
    const { error: insErr } = await (supabase.from('departments') as any).insert([newDept]);
    if (insErr) return { error: `Database error: ${insErr.message}` };
  } else {
    addMockDepartment(newDept);
  }

  addMockAuditLog({
    id: crypto.randomUUID(),
    action_type: 'department_change',
    performed_by: session.id,
    target_id: newDept.id,
    details: { action: 'create', name },
    created_at: new Date().toISOString(),
  });

  revalidatePath('/admin');
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/calendar');
  return { success: true, message: `Department "${name}" created and immediately available.` };
}

/**
 * Server action to delete a department with link checking.
 */
export async function deleteDepartmentAction(departmentId: string) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return { error: 'Unauthorized: Admin privileges required.' };
  }

  const isPlaceholderUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('placeholder') || !process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabase = !isPlaceholderUrl ? createAdminClient() : await createClient();

  let empCount = 0;
  let roomCount = 0;

  if (!isPlaceholderUrl) {
    const { data: eData } = await (supabase.from('employees') as any).select('id').eq('department_id', departmentId);
    if (eData) empCount = eData.length;
    const { data: rData } = await (supabase.from('rooms') as any).select('id').eq('restricted_to_department_id', departmentId);
    if (rData) roomCount = rData.length;
  } else {
    empCount = getStoreEmployees().filter(e => e.department_id === departmentId).length;
    roomCount = getStoreRooms().filter(r => r.restricted_to_department_id === departmentId).length;
  }

  if (empCount > 0 || roomCount > 0) {
    return {
      error: 'is_linked',
      message: `Cannot remove: ${empCount} employee(s) and ${roomCount} room(s) are assigned to this department. Reassign them before removing.`
    };
  }

  if (!isPlaceholderUrl) {
    const { error: delErr } = await (supabase.from('departments') as any).delete().eq('id', departmentId);
    if (delErr) return { error: `Database delete failed: ${delErr.message}` };
  } else {
    deleteMockDepartment(departmentId);
  }

  addMockAuditLog({
    id: crypto.randomUUID(),
    action_type: 'department_change',
    performed_by: session.id,
    target_id: departmentId,
    details: { action: 'delete' },
    created_at: new Date().toISOString(),
  });

  revalidatePath('/admin');
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/calendar');
  return { success: true, message: 'Department permanently removed.' };
}

/**
 * Server action: Admin initiates a password reset for any employee.
 * Generates a secure, single-use 24-hour reset link, sends it via SMTP,
 * and sets must_reset_password flag on the employee record.
 */
export async function adminResetPasswordAction(employeeInternalIdOrFormData: string | FormData): Promise<{
  success?: boolean;
  error?: string;
  message?: string;
  resetUrl?: string;
  resetLink?: string;
  employeeName?: string;
}> {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return { error: 'Unauthorized: Admin privileges required.' };
  }

  const employeeInternalId = typeof employeeInternalIdOrFormData === 'string'
    ? employeeInternalIdOrFormData
    : employeeInternalIdOrFormData.get('employeeId')?.toString() || '';
  if (!employeeInternalId) {
    return { error: 'Invalid employee reference.' };
  }

  const isPlaceholderUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('placeholder') || !process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabase = !isPlaceholderUrl ? createAdminClient() : await createClient();

  // Look up the target employee
  let targetEmp: Employee | undefined;
  if (!isPlaceholderUrl) {
    const { data } = await (supabase.from('employees') as any)
      .select('*')
      .eq('id', employeeInternalId)
      .single();
    targetEmp = data as Employee | undefined;
  } else {
    targetEmp = getStoreEmployees().find((e) => e.id === employeeInternalId);
  }

  if (!targetEmp) {
    return { error: 'Employee not found.' };
  }

  // ── Generate raw token (64-char hex, 256-bit entropy) ────────────────────
  const { createHash, randomBytes } = await import('crypto');
  const rawToken = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

  // ── Store the hashed token ───────────────────────────────────────────────
  if (!isPlaceholderUrl) {
    await (supabase.from('password_reset_tokens') as any).insert([{
      id: crypto.randomUUID(),
      employee_id: employeeInternalId,
      token_hash: tokenHash,
      expires_at: expiresAt.toISOString(),
      used: false,
      created_at: now.toISOString(),
    }]);

    await (supabase.from('employees') as any)
      .update({ must_reset_password: true, failed_login_attempts: 0, is_locked: false })
      .eq('id', employeeInternalId);
  } else {
    addMockResetToken({
      tokenHash,
      employeeId: employeeInternalId,
      expiresAt: expiresAt.toISOString(),
      used: false,
      createdAt: now.toISOString(),
    });

    const store = getStoreEmployees();
    const idx = store.findIndex((e) => e.id === employeeInternalId);
    if (idx !== -1) {
      store[idx].must_reset_password = true;
      store[idx].failed_login_attempts = 0; // unlock if was locked
      store[idx].is_locked = false;
    }
  }

  // ── Audit log — no token, no password, only metadata ────────────────────
  addMockAuditLog({
    id: crypto.randomUUID(),
    action_type: 'password_reset',
    performed_by: session.id,
    target_id: employeeInternalId,
    details: {
      action: 'admin_reset_link_generated',
      admin_id: session.employee_id,
      target_employee_id: targetEmp.employee_id,
      target_name: targetEmp.name,
      expires_at: expiresAt.toISOString(),
      // raw token is NEVER included here
    },
    created_at: now.toISOString(),
  });

  // ── Build the reset URL (contains the raw token — valid for 24 hours) ───
  const appBaseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null) ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3000');
  const resetUrl = `${appBaseUrl}/reset-password/token/${rawToken}`;

  const empEmail = targetEmp.email || `${targetEmp.employee_id.toLowerCase()}@dhanuka.com`;
  sendNotificationEmail({
    to: empEmail,
    subject: '[Dhanuka Meeting Rooms] Secure Password Reset Request',
    html: getPasswordResetLinkEmailHtml(targetEmp.name, resetUrl),
    eventType: 'password_reset_link',
  }).catch((err) => console.error('[SMTP Trigger Error - password_reset]:', err));

  revalidatePath('/admin');
  return {
    success: true,
    resetUrl,
    resetLink: resetUrl,
    employeeName: targetEmp.name,
  };
}
