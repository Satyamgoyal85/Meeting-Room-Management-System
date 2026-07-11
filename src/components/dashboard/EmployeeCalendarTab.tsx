'use client';

import React, { useState, useMemo } from 'react';
import {
  format,
  addDays,
  subDays,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  startOfWeek,
  isSameMonth,
  isSameWeek,
  isSameDay,
} from 'date-fns';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  User,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  Users,
  CalendarDays,
  CheckCircle2,
  Sparkles,
  Filter,
} from 'lucide-react';
import { AdminBookingItem } from '@/actions/admin';
import { Room, Department } from '@/lib/types';
import { toIstDate } from '@/lib/timezone';
import MiniCalendar from '@/components/admin/calendar/MiniCalendar';
import ResourceView from '@/components/admin/calendar/ResourceView';
import MonthView from '@/components/admin/calendar/MonthView';

export type CalendarViewType = 'day' | 'week' | 'month';
export type MeetingFilterType = 'all' | 'my' | 'invited';

interface EmployeeCalendarTabProps {
  bookings: AdminBookingItem[];
  rooms: Room[];
  departments: Department[];
  currentUserId: string;
}

export default function EmployeeCalendarTab({
  bookings,
  rooms,
  departments,
  currentUserId,
}: EmployeeCalendarTabProps) {
  // ── Navigation ──────────────────────────────────────────────────────────────
  const [currentDate, setCurrentDate] = useState<Date>(toIstDate(new Date()));
  const [viewType, setViewType] = useState<CalendarViewType>('day');

  // ── Sidebar & Filter ────────────────────────────────────────────────────────
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [meetingFilter, setMeetingFilter] = useState<MeetingFilterType>('all');

  // ── Hover/click booking state ────────────────────────────────────────────────
  const [hoveredBooking, setHoveredBooking] = useState<{ booking: AdminBookingItem; rect: DOMRect } | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<AdminBookingItem | null>(null);

  // ── Computed values ──────────────────────────────────────────────────────────
  const filteredBookings = useMemo(() => {
    return bookings.filter(b => {
      if (meetingFilter === 'my') return !b.is_invite;
      if (meetingFilter === 'invited') return !!b.is_invite;
      return true;
    });
  }, [bookings, meetingFilter]);

  const currentViewBookings = useMemo(() => {
    return bookings.filter(b => {
      if (b.status !== 'confirmed') return false;
      const bDate = toIstDate(b.start_time);
      if (viewType === 'day') {
        return isSameDay(bDate, currentDate);
      } else if (viewType === 'week') {
        return isSameWeek(bDate, currentDate, { weekStartsOn: 1 });
      } else if (viewType === 'month') {
        return isSameMonth(bDate, currentDate);
      }
      return true;
    });
  }, [bookings, currentDate, viewType]);

  const stats = useMemo(() => {
    const total = currentViewBookings.length;
    const myCount = currentViewBookings.filter(b => !b.is_invite).length;
    const invitedCount = currentViewBookings.filter(b => !!b.is_invite).length;
    return { total, myCount, invitedCount };
  }, [currentViewBookings]);

  // ── Navigation handlers ──────────────────────────────────────────────────────
  const handlePrevious = () => {
    if (viewType === 'day') setCurrentDate(prev => subDays(prev, 1));
    else if (viewType === 'week') setCurrentDate(prev => subWeeks(prev, 1));
    else if (viewType === 'month') setCurrentDate(prev => subMonths(prev, 1));
  };

  const handleNext = () => {
    if (viewType === 'day') setCurrentDate(prev => addDays(prev, 1));
    else if (viewType === 'week') setCurrentDate(prev => addWeeks(prev, 1));
    else if (viewType === 'month') setCurrentDate(prev => addMonths(prev, 1));
  };

  const handleToday = () => setCurrentDate(toIstDate(new Date()));

  const getHeaderTitle = () => {
    if (viewType === 'day') return format(currentDate, 'EEEE, MMMM d, yyyy');
    if (viewType === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      const end = addDays(start, 6);
      if (isSameMonth(start, end)) return `${format(start, 'MMM d')} – ${format(end, 'd, yyyy')}`;
      return `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`;
    }
    return format(currentDate, 'MMMM yyyy');
  };

  return (
    <div className="flex flex-col animate-in fade-in duration-300" style={{ height: 'calc(100vh - 9rem)' }}>
      {/* ── TOP TOOLBAR ─────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm px-4 py-3 flex flex-wrap items-center gap-3 mb-4 shrink-0">
        {/* Sidebar toggle */}
        <button
          type="button"
          onClick={() => setIsSidebarOpen(prev => !prev)}
          title={isSidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
          className="p-2 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          {isSidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
        </button>

        {/* Jump to Today button */}
        <button
          type="button"
          onClick={handleToday}
          title="Jump to Today"
          className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors flex items-center space-x-1.5 shadow-sm"
        >
          <CalendarDays className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>Today</span>
        </button>

        {/* Prev / Next arrows */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
          <button type="button" onClick={handlePrevious} title="Previous" className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button type="button" onClick={handleNext} title="Next" className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Date title */}
        <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex-1 min-w-[160px]">
          {getHeaderTitle()}
        </h2>

        {/* View toggles */}
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl ml-auto">
          {(['day', 'week', 'month'] as const).map(view => (
            <button
              key={view}
              type="button"
              onClick={() => setViewType(view)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
                viewType === view
                  ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {view}
            </button>
          ))}
        </div>
      </div>

      {/* ── MAIN BODY (sidebar + calendar grid) ─────────────────────────────── */}
      <div className="flex flex-1 gap-4 min-h-0">
        {/* ── SIDEBAR ────────────────────────────────────────────────────────── */}
        {isSidebarOpen && (
          <aside
            className="w-64 shrink-0 flex flex-col gap-4 overflow-y-auto custom-scrollbar"
            style={{ maxHeight: '100%' }}
          >
            {/* Mini calendar */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 shadow-sm">
              <MiniCalendar
                selectedDate={currentDate}
                onDateSelect={date => {
                  setCurrentDate(date);
                  if (viewType === 'month') setViewType('day');
                }}
              />
            </div>

            {/* My Meetings Filter / Toggle */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <span className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center space-x-2">
                  <Filter className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Meeting Scope</span>
                </span>
                <span className="text-[10px] font-bold text-slate-400">
                  {stats.total} Total
                </span>
              </div>

              <div className="space-y-1.5">
                <button
                  onClick={() => setMeetingFilter('all')}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition-all ${
                    meetingFilter === 'all'
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="flex items-center space-x-2">
                    <CalendarDays className="w-4 h-4 text-emerald-600" />
                    <span>All My Meetings</span>
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    {stats.total}
                  </span>
                </button>

                <button
                  onClick={() => setMeetingFilter('my')}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition-all ${
                    meetingFilter === 'my'
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Organized by Me</span>
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200">
                    {stats.myCount}
                  </span>
                </button>

                <button
                  onClick={() => setMeetingFilter('invited')}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition-all ${
                    meetingFilter === 'invited'
                      ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="flex items-center space-x-2">
                    <Users className="w-4 h-4 text-purple-600" />
                    <span>Invited Meetings</span>
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200">
                    {stats.invitedCount}
                  </span>
                </button>
              </div>

              {/* Legend */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                  Visual Legend
                </span>
                <div className="flex items-center space-x-2 text-xs text-slate-600 dark:text-slate-300">
                  <div className="w-3 h-3 rounded border-2 border-solid border-emerald-500 bg-emerald-100 dark:bg-emerald-900" />
                  <span className="text-[11px] font-medium">Organized by you</span>
                </div>
                <div className="flex items-center space-x-2 text-xs text-slate-600 dark:text-slate-300">
                  <div className="w-3 h-3 rounded border-2 border-dashed border-purple-500 bg-purple-100 dark:bg-purple-900" />
                  <span className="text-[11px] font-medium">Invited attendee</span>
                </div>
              </div>
            </div>
          </aside>
        )}

        {/* ── CALENDAR GRID ──────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 min-h-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          {viewType === 'month' ? (
            <MonthView
              currentDate={currentDate}
              bookings={filteredBookings}
              rooms={rooms}
              departments={departments}
              onBookingClick={setSelectedBooking}
              onBookingHover={setHoveredBooking}
              onMoreClick={date => { setCurrentDate(date); setViewType('day'); }}
            />
          ) : (
            <ResourceView
              viewType={viewType}
              currentDate={currentDate}
              rooms={rooms}
              bookings={filteredBookings}
              onBookingClick={setSelectedBooking}
              onBookingHover={setHoveredBooking}
            />
          )}
        </div>
      </div>

      {/* ── HOVER TOOLTIP ──────────────────────────────────────────────────────── */}
      {hoveredBooking && (
        <div
          className="fixed z-[90] bg-slate-900 dark:bg-slate-800 text-white p-3 rounded-xl shadow-2xl border border-slate-700/50 pointer-events-none animate-in fade-in zoom-in-95 duration-150 max-w-xs"
          style={{
            top: hoveredBooking.rect.top > window.innerHeight / 2
              ? `${hoveredBooking.rect.top - 12}px`
              : `${hoveredBooking.rect.bottom + 12}px`,
            left: `${hoveredBooking.rect.left + hoveredBooking.rect.width / 2}px`,
            transform: hoveredBooking.rect.top > window.innerHeight / 2
              ? 'translate(-50%, -100%)'
              : 'translate(-50%, 0)',
          }}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="font-bold text-sm leading-tight">{hoveredBooking.booking.room_name}</span>
            <span className={`text-[8px] font-extrabold px-1 py-0.5 rounded uppercase tracking-tighter ml-2 ${
              hoveredBooking.booking.is_invite ? 'bg-purple-500/30 text-purple-200' : 'bg-emerald-500/30 text-emerald-200'
            }`}>
              {hoveredBooking.booking.is_invite ? 'Invited' : 'My Mtg'}
            </span>
          </div>
          <p className="text-xs text-slate-300 mt-0.5">{hoveredBooking.booking.department_name}</p>
          <p className="text-xs text-slate-300 mt-0.5">
            {hoveredBooking.booking.is_invite ? `Organizer: ${hoveredBooking.booking.organizer_name}` : 'Organized by You'}
          </p>
          <div className="mt-2 text-xs font-mono bg-slate-800 dark:bg-slate-900/80 px-2 py-1 rounded text-slate-200">
            {format(toIstDate(hoveredBooking.booking.start_time), 'hh:mm a')} – {format(toIstDate(hoveredBooking.booking.end_time), 'hh:mm a')}
          </div>
        </div>
      )}

      {/* ── BOOKING DETAIL MODAL ───────────────────────────────────────────────── */}
      {selectedBooking && (
        <div
          className="fixed inset-0 z-[100] bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedBooking(null)}
        >
          <div
            className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 space-y-5 animate-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">Meeting Details</h2>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    selectedBooking.is_invite
                      ? 'bg-purple-50 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                      : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                  }`}>
                    {selectedBooking.is_invite ? 'Invited Meeting' : 'Organized by You'}
                  </span>
                </div>
                <span className={`mt-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  selectedBooking.status === 'confirmed'
                    ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                    : 'bg-rose-50 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                }`}>
                  {selectedBooking.status}
                </span>
              </div>
              <button
                onClick={() => setSelectedBooking(null)}
                className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Details */}
            <div className="space-y-3">
              <div className="flex items-center bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl">
                <MapPin className="w-5 h-5 text-emerald-600 mr-3 shrink-0" />
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Location</span>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    {selectedBooking.room_name} · {selectedBooking.room_floor}
                  </span>
                </div>
              </div>

              <div className="flex items-center bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl">
                <Clock className="w-5 h-5 text-emerald-600 mr-3 shrink-0" />
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Time</span>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    {format(toIstDate(selectedBooking.start_time), 'MMM d, yyyy · hh:mm a')} — {format(toIstDate(selectedBooking.end_time), 'hh:mm a')}
                  </span>
                </div>
              </div>

              <div className="flex items-center bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl">
                <User className="w-5 h-5 text-sky-600 mr-3 shrink-0" />
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Organizer</span>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    {selectedBooking.is_invite ? `${selectedBooking.organizer_name} (${selectedBooking.booker_code})` : `You (${selectedBooking.booker_name})`} · {selectedBooking.department_name}
                  </span>
                </div>
              </div>

              {selectedBooking.invitee_count !== undefined && selectedBooking.invitee_count > 0 && (
                <div className="flex items-center bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl">
                  <Users className="w-5 h-5 text-purple-600 mr-3 shrink-0" />
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Attendees</span>
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      {selectedBooking.invitee_count} Invited Attendee(s)
                    </span>
                  </div>
                </div>
              )}

              {selectedBooking.agenda && (
                <div className="pt-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                    Meeting Agenda
                  </span>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                    &quot;{selectedBooking.agenda}&quot;
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedBooking(null)}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
