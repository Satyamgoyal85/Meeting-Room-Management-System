'use client';

import React from 'react';
import { Room, Department, Booking } from '@/lib/types';
import { 
  X, 
  Calendar, 
  Clock, 
  Users, 
  MapPin, 
  Lock, 
  CheckCircle2, 
  ShieldAlert, 
  User, 
  Sparkles, 
  ArrowRight,
  AlertCircle,
  Building2
} from 'lucide-react';
import { format } from 'date-fns';
import { toIstDate } from '@/lib/timezone';

interface RoomTimelineModalProps {
  room: Room | null;
  selectedDateStr: string;
  departments: Department[];
  bookings: Booking[];
  currentUserId: string;
  currentUserRole: string;
  onClose: () => void;
  onProceedToBook: (room: Room) => void;
}

export default function RoomTimelineModal({
  room,
  selectedDateStr,
  departments,
  bookings,
  currentUserId,
  currentUserRole,
  onClose,
  onProceedToBook,
}: RoomTimelineModalProps) {
  if (!room) return null;

  // Filter confirmed bookings for this room on this date
  const roomBookings = bookings
    .filter(b => b.room_id === room.id && b.status === 'confirmed')
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

  const formattedDate = format(toIstDate(selectedDateStr), 'EEEE, MMMM d, yyyy');

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white p-6 relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-6 right-6 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 mb-3">
            <Calendar className="w-3.5 h-3.5 mr-1.5" />
            Day Timeline • {formattedDate}
          </div>

          <h2 className="text-2xl font-extrabold tracking-tight">
            {room.name}
          </h2>

          <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-slate-300 font-medium">
            <span className="flex items-center">
              <MapPin className="w-3.5 h-3.5 mr-1 text-emerald-400" />
              {room.floor}
            </span>
            <span>•</span>
            <span className="flex items-center font-mono font-bold text-white">
              <Users className="w-3.5 h-3.5 mr-1 text-sky-400" />
              {room.capacity} seats
            </span>
            <span>•</span>
            <span className="text-emerald-300">
              {roomBookings.length} confirmed slot(s) today
            </span>
          </div>
        </div>

        {/* Modal Body: Timeline List */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Chronological Bookings
            </span>
            <span className="text-[11px] text-slate-400">
              08:00 AM — 08:00 PM Operating Hours
            </span>
          </div>

          {roomBookings.length === 0 ? (
            <div className="py-12 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-800 dark:text-slate-200 text-base">
                No Bookings Today
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                This meeting room is completely open for reservations on {formattedDate}.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {roomBookings.map((booking) => {
                const startTimeFormatted = format(toIstDate(booking.start_time), 'hh:mm a');
                const endTimeFormatted = format(toIstDate(booking.end_time), 'hh:mm a');
                const dept = departments.find(d => d.id === booking.department_id);
                
                // Security rule: Only show agenda if current user is owner OR admin
                const isOwner = booking.employee_id === currentUserId;
                const isAdmin = currentUserRole === 'admin';
                const canViewAgenda = isOwner || isAdmin;

                return (
                  <div
                    key={booking.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      isOwner
                        ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800'
                        : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/80'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                      <div className="flex items-center space-x-2">
                        <div className="px-2.5 py-1 rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-mono font-bold text-xs flex items-center shadow-sm">
                          <Clock className="w-3 h-3 mr-1.5 text-emerald-400 dark:text-emerald-600" />
                          <span>{startTimeFormatted} — {endTimeFormatted}</span>
                        </div>
                        
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300">
                          {dept ? dept.name : 'Department'}
                        </span>
                      </div>

                      <div className="flex items-center space-x-1.5">
                        {isOwner && (
                          <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 px-2 py-0.5 rounded-full">
                            Your Booking
                          </span>
                        )}
                        {isAdmin && !isOwner && (
                          <span className="text-[10px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-300 px-2 py-0.5 rounded-full flex items-center">
                            <ShieldAlert className="w-3 h-3 mr-1" />
                            Admin Oversight
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Agenda Display vs Masking */}
                    <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-start space-x-2">
                      {canViewAgenda ? (
                        <div className="text-xs">
                          <span className="font-semibold text-slate-500 dark:text-slate-400 block text-[10px] uppercase tracking-wider mb-0.5">
                            Meeting Agenda:
                          </span>
                          <p className="text-slate-800 dark:text-slate-200 font-medium">
                            &quot;{booking.agenda}&quot;
                          </p>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400 italic py-1">
                          <Lock className="w-4 h-4 text-amber-500 flex-shrink-0" />
                          <span>Private Meeting • Agenda & booker name masked for confidentiality.</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Agenda Rule Notice */}
          <div className="p-3 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex items-center space-x-2.5">
            <Lock className="w-4 h-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
            <span>
              <strong>Security Rule Enforced:</strong> Per Dhanuka policy, meeting agendas are only visible to the booking employee and system administrators.
            </span>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 dark:bg-slate-800/80 p-6 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 transition-all shadow-sm"
          >
            Close Timeline
          </button>

          <button
            type="button"
            onClick={() => onProceedToBook(room)}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 flex items-center space-x-2 transition-all active:scale-95"
          >
            <span>Reserve {room.name}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );
}
