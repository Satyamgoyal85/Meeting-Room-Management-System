'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSession } from '@/actions/auth';
import { MOCK_ROOMS, MOCK_DEPARTMENTS } from '@/lib/mock-data';
import { getStoreBookings, getStoreRooms, getStoreAmenities, getStoreDepartments, getBookingIdsForInvitee } from '@/lib/mock-store';
import { Room, Department, Booking, Amenity } from '@/lib/types';
import { getIstDateStr, getStartOfDayIstIso, getEndOfDayIstIso } from '@/lib/timezone';
import { sortRoomsByCapacityAndName } from '@/lib/sorting';

export interface DashboardData {
  rooms: Room[];
  departments: Department[];
  bookings: Booking[];
  amenities: Amenity[];
  currentUserId: string;
  currentUserRole: string;
  currentUserDeptId: string | null;
  isMock: boolean;
}

/**
 * Server action to fetch dashboard rooms, departments, and bookings for a specific date.
 */
export async function getDashboardData(dateStr?: string): Promise<DashboardData> {
  const session = await getSession();
  
  const currentUserId = session ? session.id : '33333333-3333-3333-3333-333333333302'; // default Ananya
  const currentUserRole = session ? session.role : 'employee';
  const currentUserDeptId = session ? session.department_id : '11111111-1111-1111-1111-111111111101';

  const targetDateStr = dateStr || getIstDateStr();
  const startOfDayIso = getStartOfDayIstIso(targetDateStr);
  const endOfDayIso = getEndOfDayIstIso(targetDateStr);

  const isPlaceholderUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('placeholder') || !process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!isPlaceholderUrl) {
    const supabase = createAdminClient();
    // Fetch all 4 tables in parallel (rooms, departments, amenities, and bookings for date range)
    const [
      { data: roomsData, error: roomsError },
      { data: deptData, error: deptError },
      { data: amenitiesData, error: aError },
      { data: bookingsData, error: bError }
    ] = await Promise.all([
      supabase.from('rooms').select('*').eq('is_active', true).order('name'),
      supabase.from('departments').select('*').order('name'),
      (supabase.from('amenities') as any).select('*').order('name'),
      supabase.from('v_bookings_public').select('*').eq('status', 'confirmed').gte('end_time', startOfDayIso).lte('start_time', endOfDayIso)
    ]);

    if (roomsError) console.warn('[Supabase fallback] Query error [rooms in getDashboardData]:', roomsError.message || roomsError);
    if (deptError) console.warn('[Supabase fallback] Query error [departments in getDashboardData]:', deptError.message || deptError);
    if (aError) console.warn('[Supabase fallback] Query error [amenities in getDashboardData]:', aError.message || aError);
    if (bError) console.warn('[Supabase fallback] Query error [bookings in getDashboardData]:', bError.message || bError);

    const hasQueryErrors = Boolean(roomsError || deptError || aError || bError || !roomsData || !deptData || !amenitiesData || !bookingsData);

    if (hasQueryErrors) {
      console.warn('[Supabase fallback] One or more queries failed in getDashboardData. Falling back to local mock store.');
      return {
        rooms: sortRoomsByCapacityAndName(getStoreRooms().filter(r => r.is_active)),
        departments: getStoreDepartments(),
        bookings: getStoreBookings().filter(b => b.status === 'confirmed' && new Date(b.end_time).getTime() >= new Date(startOfDayIso).getTime() && new Date(b.start_time).getTime() <= new Date(endOfDayIso).getTime()),
        amenities: getStoreAmenities(),
        currentUserId,
        currentUserRole,
        currentUserDeptId,
        isMock: true,
      };
    }

    return {
      rooms: sortRoomsByCapacityAndName((roomsData || []) as Room[]),
      departments: (deptData || []) as Department[],
      bookings: (bookingsData || []) as Booking[],
      amenities: (amenitiesData || []) as Amenity[],
      currentUserId,
      currentUserRole,
      currentUserDeptId,
      isMock: false,
    };
  }

  // Fallback to Local Dev Mock Mode (using persistent in-memory store)
  const mockBookings = getStoreBookings().filter(b => {
    return b.status === 'confirmed' && b.end_time >= startOfDayIso && b.start_time <= endOfDayIso;
  });

  // Apply agenda masking rule in mock mode for non-admins
  const invitedIds = getBookingIdsForInvitee(currentUserId);
  const maskedBookings = mockBookings.map(b => {
    const isOwner = b.employee_id === currentUserId;
    const isAdmin = currentUserRole === 'admin';
    const isInvitee = invitedIds.includes(b.id);
    return {
      ...b,
      agenda: (isOwner || isAdmin || isInvitee) ? b.agenda : 'Private Meeting',
    };
  });

  return {
    rooms: sortRoomsByCapacityAndName(getStoreRooms().filter(r => r.is_active)),
    departments: getStoreDepartments(),
    bookings: maskedBookings,
    amenities: getStoreAmenities(),
    currentUserId,
    currentUserRole,
    currentUserDeptId,
    isMock: true,
  };
}
