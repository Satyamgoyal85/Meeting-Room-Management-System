'use client';

import React, { useState, useEffect } from 'react';
import { 
  format, 
  isSameMonth, 
  isSameDay, 
  isToday,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval
} from 'date-fns';
import { 
  Clock, 
  MapPin, 
  User, 
  X, 
  CalendarDays,
  CheckCircle2,
  Users
} from 'lucide-react';
import { AdminBookingItem } from '@/actions/admin';
import { Room, Department } from '@/lib/types';
import { toIstDate } from '@/lib/timezone';

interface MonthViewProps {
  currentDate: Date;
  bookings: AdminBookingItem[];
  rooms: Room[];
  departments: Department[];
  onBookingClick: (booking: AdminBookingItem) => void;
  onMoreClick: (date: Date) => void;
  onBookingHover?: (data: { booking: AdminBookingItem; rect: DOMRect } | null) => void;
}

// Function to generate a stable color based on string ID
function getColorClass(id: string) {
  const colors = [
    'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800',
    'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800',
    'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800',
    'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/40 dark:text-rose-300 dark:border-rose-800',
    'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-800',
    'bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-900/40 dark:text-cyan-300 dark:border-cyan-800',
    'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-800',
  ];
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export default function MonthView({ 
  currentDate, 
  bookings, 
  rooms, 
  departments, 
  onBookingClick,
  onMoreClick,
  onBookingHover
}: MonthViewProps) {
  const [hoveredDay, setHoveredDay] = useState<{ date: Date; bookings: AdminBookingItem[]; rect: DOMRect } | null>(null);
  const [selectedDay, setSelectedDay] = useState<{ date: Date; bookings: AdminBookingItem[] } | null>(null);
  
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const getBookingsForDate = (date: Date) => {
    return bookings.filter(b => b.status === 'confirmed' && isSameDay(toIstDate(b.start_time), date))
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  };

  // Keep selectedDay updated if bookings prop changes (e.g. user toggles All/My meetings while day popup is open)
  useEffect(() => {
    if (selectedDay) {
      const updated = getBookingsForDate(selectedDay.date);
      setSelectedDay({ date: selectedDay.date, bookings: updated });
    }
  }, [bookings]);

  return (
    <div className="flex flex-col h-full overflow-hidden relative">
      {/* Days of week header */}
      <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
          <div key={day} className="py-3 text-center text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 grid grid-cols-7 grid-rows-5 sm:grid-rows-auto overflow-y-auto bg-slate-100 dark:bg-slate-800/50 gap-[1px]">
        {days.map((day, i) => {
          const isCurrentMonth = isSameMonth(day, monthStart);
          const isTodayDate = isToday(day);
          const dayBookings = getBookingsForDate(day);
          const visibleBookings = dayBookings.slice(0, 3); // Max 3 visible preview strips to prevent cramming
          const hiddenCount = dayBookings.length - 3;

          return (
            <div 
              key={i} 
              onClick={() => {
                setSelectedDay({ date: day, bookings: dayBookings });
              }}
              onPointerEnter={(e) => {
                if (dayBookings.length > 0) {
                  setHoveredDay({ date: day, bookings: dayBookings, rect: e.currentTarget.getBoundingClientRect() });
                }
              }}
              onPointerLeave={() => setHoveredDay(null)}
              className={`min-h-[120px] bg-white dark:bg-slate-900 p-2 flex flex-col transition-colors cursor-pointer ${
                !isCurrentMonth ? 'opacity-50 bg-slate-50 dark:bg-slate-950' : ''
              } hover:bg-purple-50/40 dark:hover:bg-slate-800/80`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold ${
                  isTodayDate 
                    ? 'bg-purple-600 text-white shadow-md' 
                    : 'text-slate-700 dark:text-slate-300'
                }`}>
                  {format(day, 'd')}
                </span>
                {dayBookings.length > 0 && (
                  <span className="text-[10px] font-extrabold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/40 px-1.5 py-0.5 rounded-full border border-purple-200 dark:border-purple-800">
                    {dayBookings.length} {dayBookings.length === 1 ? 'mtg' : 'mtgs'}
                  </span>
                )}
              </div>

              <div className="flex-1 overflow-y-auto space-y-1 pr-1 custom-scrollbar pointer-events-auto">
                {visibleBookings.map(booking => {
                  const colorClass = getColorClass(booking.department_id);
                  const isEmployeeView = booking.is_invite !== undefined;
                  const borderClass = isEmployeeView
                    ? (booking.is_invite ? 'border-dashed border-purple-500/80 dark:border-purple-400/80' : 'border-solid border-emerald-500/80 dark:border-emerald-400/80')
                    : '';
                  const bgClass = isEmployeeView && booking.is_invite ? 'bg-purple-100/90 dark:bg-purple-950/80 text-purple-900 dark:text-purple-100' : colorClass;
                  
                  return (
                    <button
                      key={booking.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onBookingClick(booking);
                      }}
                      className={`w-full text-left px-1.5 py-0.5 rounded-[4px] text-[10px] font-medium truncate border transition-all hover:brightness-95 cursor-pointer ${bgClass} ${borderClass}`}
                    >
                      <div className="flex items-center justify-between truncate">
                        <span className="truncate">
                          <span className="font-bold opacity-75 mr-1">{format(toIstDate(booking.start_time), 'HH:mm')}</span>
                          {booking.room_name}
                        </span>
                        {isEmployeeView && (
                          <span className={`text-[7px] font-extrabold px-1 py-0.2 rounded uppercase ml-1 shrink-0 ${
                            booking.is_invite ? 'bg-purple-200 dark:bg-purple-900 text-purple-800 dark:text-purple-200' : 'bg-emerald-200 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200'
                          }`}>
                            {booking.is_invite ? 'INV' : 'MY'}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
                
                {hiddenCount > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedDay({ date: day, bookings: dayBookings });
                    }}
                    className="w-full text-center py-1 text-[10px] font-extrabold text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/40 rounded transition-colors"
                  >
                    + {hiddenCount} more meetings
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── HOVER DAY SUMMARY POPOVER ────────────────────────────────────────── */}
      {hoveredDay && !selectedDay && (
        <div
          className="fixed z-[90] bg-slate-900/95 dark:bg-slate-800/95 text-white p-3.5 rounded-2xl shadow-2xl border border-slate-700/60 pointer-events-none animate-in fade-in zoom-in-95 duration-150 max-w-xs w-72 backdrop-blur-md"
          style={{
            top: hoveredDay.rect.top > window.innerHeight / 2
              ? `${hoveredDay.rect.top - 12}px`
              : `${hoveredDay.rect.bottom + 12}px`,
            left: `${Math.max(16, Math.min(window.innerWidth - 304, hoveredDay.rect.left + hoveredDay.rect.width / 2 - 144))}px`,
            transform: hoveredDay.rect.top > window.innerHeight / 2
              ? 'translateY(-100%)'
              : 'translateY(0)',
          }}
        >
          <div className="border-b border-slate-700/80 pb-2 mb-2 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CalendarDays className="w-4 h-4 text-purple-400 shrink-0" />
              <span className="font-extrabold text-xs text-slate-100">{format(hoveredDay.date, 'EEEE, MMM d')}</span>
            </div>
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
              {hoveredDay.bookings.length} {hoveredDay.bookings.length === 1 ? 'meeting' : 'meetings'}
            </span>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
            {hoveredDay.bookings.map(b => (
              <div key={b.id} className="text-xs flex items-center justify-between gap-2.5 py-1 border-b border-slate-800/80 last:border-0">
                <div className="truncate flex-1 min-w-0">
                  <span className="font-bold text-slate-200 block truncate">{b.room_name}</span>
                  {b.department_name && <span className="text-[10px] text-slate-400 block truncate">{b.department_name}</span>}
                </div>
                <span className="font-mono text-[11px] font-semibold text-slate-300 shrink-0 bg-slate-800/80 px-1.5 py-0.5 rounded">
                  {format(toIstDate(b.start_time), 'HH:mm')} – {format(toIstDate(b.end_time), 'HH:mm')}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-2.5 pt-1.5 border-t border-slate-800 text-[10px] text-slate-400 text-center font-medium">
            Click day cell to view all & details
          </div>
        </div>
      )}

      {/* ── SELECTED DAY DETAILED MODAL / CARD ───────────────────────────────── */}
      {selectedDay && (
        <div
          className="fixed inset-0 z-[95] bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setSelectedDay(null)}
        >
          <div
            className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-7 flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-11 h-11 rounded-2xl bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 flex items-center justify-center font-extrabold text-lg shadow-sm">
                  {format(selectedDay.date, 'd')}
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                    {format(selectedDay.date, 'EEEE, MMMM d, yyyy')}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                    {selectedDay.bookings.length} {selectedDay.bookings.length === 1 ? 'meeting scheduled' : 'meetings scheduled'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDay(null)}
                className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Meetings List */}
            <div className="mt-4 flex-1 overflow-y-auto space-y-2.5 pr-1 custom-scrollbar min-h-[120px]">
              {selectedDay.bookings.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 space-y-2">
                  <CalendarDays className="w-10 h-10 stroke-[1.5] opacity-50" />
                  <p className="text-sm font-semibold">No meetings on this date</p>
                </div>
              ) : (
                selectedDay.bookings.map(booking => {
                  const isEmployeeView = booking.is_invite !== undefined;
                  return (
                    <button
                      key={booking.id}
                      type="button"
                      onClick={() => {
                        onBookingClick(booking);
                      }}
                      className="w-full text-left p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-purple-300 dark:hover:border-purple-700 bg-slate-50 dark:bg-slate-800/60 hover:bg-white dark:hover:bg-slate-800 transition-all flex items-start justify-between gap-3 shadow-sm group cursor-pointer"
                    >
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-extrabold text-sm text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors truncate">
                            {booking.room_name}
                          </span>
                          {booking.room_floor && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 shrink-0">
                              {booking.room_floor}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center text-xs text-slate-600 dark:text-slate-300 space-x-2">
                          <Clock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="font-mono font-bold">
                            {format(toIstDate(booking.start_time), 'hh:mm a')} – {format(toIstDate(booking.end_time), 'hh:mm a')}
                          </span>
                        </div>
                        <div className="flex items-center text-xs text-slate-500 dark:text-slate-400 space-x-1.5">
                          <span className="font-medium text-slate-700 dark:text-slate-300 truncate">
                            Dept: {booking.department_name || 'N/A'}
                          </span>
                          <span>·</span>
                          <span className="truncate">Booker: {booking.booker_name}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end shrink-0 space-y-1">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                          booking.status === 'confirmed'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200'
                        }`}>
                          {booking.status}
                        </span>
                        {isEmployeeView && (
                          <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase ${
                            booking.is_invite
                              ? 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200'
                              : 'bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200'
                          }`}>
                            {booking.is_invite ? 'Invited' : 'Organizer'}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer / Jump action to Day view */}
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center shrink-0">
              <span className="text-xs text-slate-400 font-medium">Click any meeting card to inspect full details</span>
              <button
                type="button"
                onClick={() => {
                  const dayToView = selectedDay.date;
                  setSelectedDay(null);
                  onMoreClick(dayToView);
                }}
                className="px-3.5 py-2 text-xs font-bold rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors shadow-sm"
              >
                Go to Day View →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
