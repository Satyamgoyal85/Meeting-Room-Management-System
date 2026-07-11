'use client';

import React from 'react';
import { Room, Department, Booking } from '@/lib/types';
import { 
  Users, 
  MapPin, 
  Clock, 
  Lock, 
  Calendar, 
  CheckCircle2, 
  XCircle, 
  Sparkles, 
  ArrowRight,
  ShieldAlert,
  Building2,
  Tv,
  Wifi,
  Coffee
} from 'lucide-react';
import { format } from 'date-fns';
import { toIstDate } from '@/lib/timezone';

interface RoomCardProps {
  room: Room;
  departments: Department[];
  bookings: Booking[];
  currentUserId: string;
  currentUserRole: string;
  currentUserDeptId: string | null;
  isRightNow: boolean;
  selectedDateStr: string;
  onViewSchedule: (room: Room) => void;
  onBookRoom: (room: Room) => void;
}

export default function RoomCard({
  room,
  departments,
  bookings,
  currentUserId,
  currentUserRole,
  currentUserDeptId,
  isRightNow,
  selectedDateStr,
  onViewSchedule,
  onBookRoom,
}: RoomCardProps) {

  // 1. Determine restriction status
  const isRestricted = room.restricted_to_department_id !== null;
  const restrictedDept = isRestricted 
    ? departments.find(d => d.id === room.restricted_to_department_id) 
    : null;
  
  const isAuthorizedForRestricted = 
    currentUserRole === 'admin' || 
    (currentUserDeptId !== null && currentUserDeptId === room.restricted_to_department_id);

  // 2. Determine Live Status (Available vs Occupied)
  // Check all confirmed bookings for this room today/selected date
  const roomBookings = bookings.filter(b => b.room_id === room.id && b.status === 'confirmed');
  
  let isAvailable = true;
  let statusText = isRightNow ? 'Available now' : 'Available at selected slot';
  let occupiedUntilText = '';
  let occupyingDeptName = '';

  const now = new Date();
  const nowIso = now.toISOString();

  if (isRightNow) {
    // Find if any booking is currently ongoing (start_time <= now <= end_time)
    const activeBooking = roomBookings.find(b => {
      return new Date(b.start_time) <= now && new Date(b.end_time) >= now;
    });

    if (activeBooking) {
      isAvailable = false;
      const endTimeFormatted = format(toIstDate(activeBooking.end_time), 'HH:mm');
      statusText = `Occupied until ${endTimeFormatted}`;
      occupiedUntilText = endTimeFormatted;
      
      const dept = departments.find(d => d.id === activeBooking.department_id);
      occupyingDeptName = dept ? dept.name : 'Another Dept';
    } else {
      // Check when the NEXT booking is today
      const futureBookingsToday = roomBookings
        .filter(b => new Date(b.start_time) > now)
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
      
      if (futureBookingsToday.length > 0) {
        const nextStartFormatted = format(toIstDate(futureBookingsToday[0].start_time), 'HH:mm');
        statusText = `Available (Next: ${nextStartFormatted})`;
      }
    }
  } else {
    // If checking a specific future time or date, check if there's any booking for that day
    if (roomBookings.length > 0) {
      isAvailable = false;
      statusText = `${roomBookings.length} booking(s) on ${selectedDateStr}`;
    }
  }

  return (
    <div className={`group relative bg-white dark:bg-slate-900 rounded-3xl p-6 border transition-all duration-300 flex flex-col justify-between shadow-sm hover:shadow-xl ${
      !isAvailable 
        ? 'border-rose-200/80 dark:border-rose-900/40 hover:border-rose-400 dark:hover:border-rose-700' 
        : isRestricted 
          ? 'border-amber-200/80 dark:border-amber-900/40 hover:border-amber-400 dark:hover:border-amber-700'
          : 'border-slate-200 dark:border-slate-800 hover:border-emerald-500/80 dark:hover:border-emerald-500/80'
    }`}>
      
      {/* Top Section: Badges & Title */}
      <div>
        <div className="flex items-start justify-between gap-2 mb-3">
          
          {/* Live Status Badge */}
          <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold tracking-tight shadow-sm transition-all ${
            isAvailable
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80'
              : 'bg-rose-50 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-200 dark:border-rose-800/80 animate-pulse'
          }`}>
            <span className={`w-2 h-2 rounded-full mr-2 ${isAvailable ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            <span>{statusText}</span>
          </div>

          {/* Floor Tag */}
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
            {room.floor}
          </span>
        </div>

        {/* Room Name */}
        <h3 className="text-lg font-extrabold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
          {room.name}
        </h3>

        {/* Capacity Info */}
        <div className="flex items-center space-x-2 text-xs font-semibold text-slate-600 dark:text-slate-300 mt-1.5">
          <Users className="w-4 h-4 text-sky-500" />
          <span>Capacity: <strong className="text-slate-900 dark:text-white font-mono">{room.capacity} seats</strong></span>
        </div>

        {/* Restriction Alert Banner (if restricted) */}
        {isRestricted && (
          <div className={`mt-3 p-2.5 rounded-xl border text-xs flex items-center space-x-2 ${
            isAuthorizedForRestricted
              ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800/60'
              : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/60'
          }`}>
            <Lock className="w-4 h-4 flex-shrink-0" />
            <div className="leading-tight font-medium">
              <span>Restricted: <strong className="font-bold">{restrictedDept ? restrictedDept.name : 'Dept'} Only</strong></span>
              {!isAuthorizedForRestricted && (
                <span className="block text-[10px] opacity-80 mt-0.5">You cannot book this executive room.</span>
              )}
            </div>
          </div>
        )}

        {/* Occupied By Details (if currently ongoing) */}
        {!isAvailable && occupyingDeptName && (
          <div className="mt-3 p-2.5 rounded-xl bg-rose-50/60 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/40 text-xs text-rose-800 dark:text-rose-300 flex items-center justify-between">
            <span className="font-medium">In use by: <strong className="font-bold">{occupyingDeptName}</strong></span>
            <span className="text-[10px] font-mono bg-rose-200/60 dark:bg-rose-900/60 px-1.5 py-0.5 rounded">
              Until {occupiedUntilText}
            </span>
          </div>
        )}

        {/* Amenities Pill List */}
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/60">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
            Available Amenities
          </div>
          <div className="flex flex-wrap gap-1">
            {room.amenities.map((amenity, idx) => (
              <span
                key={idx}
                className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60"
              >
                {amenity}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Section: Action Buttons */}
      <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-2">
        
        {/* View Schedule / Day Timeline Button */}
        <button
          type="button"
          onClick={() => onViewSchedule(room)}
          className="flex-1 py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center justify-center space-x-1.5 transition-all shadow-sm"
        >
          <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>View Schedule</span>
        </button>

        {/* Book Room Button */}
        <button
          type="button"
          onClick={() => onBookRoom(room)}
          disabled={isRestricted && !isAuthorizedForRestricted}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-all shadow-md ${
            isRestricted && !isAuthorizedForRestricted
              ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed opacity-60'
              : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-emerald-500/20 active:scale-95'
          }`}
        >
          {isRestricted && !isAuthorizedForRestricted ? (
            <>
              <Lock className="w-3.5 h-3.5" />
              <span>Restricted</span>
            </>
          ) : (
            <>
              <span>Book Room</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </>
          )}
        </button>

      </div>

    </div>
  );
}
