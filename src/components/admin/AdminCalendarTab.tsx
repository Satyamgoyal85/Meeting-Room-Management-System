'use client';

import React, { useState, useMemo, useCallback } from 'react';
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
  Filter,
  Clock,
  MapPin,
  User,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  CalendarDays,
} from 'lucide-react';
import { AdminBookingItem } from '@/actions/admin';
import { Room, Department } from '@/lib/types';
import { toIstDate } from '@/lib/timezone';
import MiniCalendar from './calendar/MiniCalendar';
import RoomChecklist from './calendar/RoomChecklist';
import ResourceView from './calendar/ResourceView';
import MonthView from './calendar/MonthView';

export type CalendarViewType = 'day' | 'week' | 'month';
export type MeetingScope = 'all' | 'my';

interface AdminCalendarTabProps {
  bookings: AdminBookingItem[];
  rooms: Room[];
  departments: Department[];
  currentUserId: string;
  currentUserInvitedBookingIds: string[];
}

export default function AdminCalendarTab({ bookings, rooms, departments, currentUserId, currentUserInvitedBookingIds }: AdminCalendarTabProps) {
  // ── Navigation ──────────────────────────────────────────────────────────────
  const [currentDate, setCurrentDate] = useState<Date>(toIstDate(new Date()));
  const [viewType, setViewType] = useState<CalendarViewType>('day');

  // ── Meeting scope filter ─────────────────────────────────────────────────────
  const [meetingScope, setMeetingScope] = useState<MeetingScope>('all');

  // ── Sidebar ──────────────────────────────────────────────────────────────────
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // ── Active Rooms Only for Calendar Checklist ────────────────────────────────
  const activeRooms = useMemo(() => rooms.filter(r => r.is_active !== false), [rooms]);

  // ── Room visibility (sidebar checklist) ────────────────────────────────────
  const [visibleRoomIds, setVisibleRoomIds] = useState<Set<string>>(
    () => new Set(rooms.filter(r => r.is_active !== false).map(r => r.id))
  );

  const handleToggleRoom = useCallback((roomId: string) => {
    setVisibleRoomIds(prev => {
      const next = new Set(prev);
      if (next.has(roomId)) { next.delete(roomId); } else { next.add(roomId); }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setVisibleRoomIds(new Set(activeRooms.map(r => r.id)));
  }, [activeRooms]);

  const handleDeselectAll = useCallback(() => {
    setVisibleRoomIds(new Set());
  }, []);

  // ── Department filter (top bar) ──────────────────────────────────────────────
  const [selectedDeptId, setSelectedDeptId] = useState<string>('all');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // ── Hover/click booking state ────────────────────────────────────────────────
  const [hoveredBooking, setHoveredBooking] = useState<{ booking: AdminBookingItem; rect: DOMRect } | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<AdminBookingItem | null>(null);

  // ── Computed values ──────────────────────────────────────────────────────────
  const visibleRooms = useMemo(
    () => activeRooms.filter(r => visibleRoomIds.has(r.id)),
    [activeRooms, visibleRoomIds]
  );

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

  const allMeetingsCount = currentViewBookings.length;
  const myMeetingsCount = useMemo(() => {
    return currentViewBookings.filter(b => b.employee_id === currentUserId || currentUserInvitedBookingIds.includes(b.id)).length;
  }, [currentViewBookings, currentUserId, currentUserInvitedBookingIds]);

  const filteredBookings = useMemo(() => {
    return bookings.filter(b => {
      // Meeting scope filter
      if (meetingScope === 'my') {
        const isOrganizer = b.employee_id === currentUserId;
        const isInvited = currentUserInvitedBookingIds.includes(b.id);
        if (!isOrganizer && !isInvited) return false;
      }
      // Department filter
      if (selectedDeptId !== 'all' && b.department_id !== selectedDeptId) return false;
      return true;
    });
  }, [bookings, selectedDeptId, meetingScope, currentUserId, currentUserInvitedBookingIds]);

  // ── Navigation handlers ──────────────────────────────────────────────────────
  const handlePrevious = () => {
    if (viewType === 'day')   setCurrentDate(prev => subDays(prev, 1));
    else if (viewType === 'week')  setCurrentDate(prev => subWeeks(prev, 1));
    else if (viewType === 'month') setCurrentDate(prev => subMonths(prev, 1));
  };

  const handleNext = () => {
    if (viewType === 'day')   setCurrentDate(prev => addDays(prev, 1));
    else if (viewType === 'week')  setCurrentDate(prev => addWeeks(prev, 1));
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
          {isSidebarOpen
            ? <PanelLeftClose className="w-4 h-4" />
            : <PanelLeftOpen className="w-4 h-4" />
          }
        </button>

        {/* Jump to Today button */}
        <button
          type="button"
          onClick={handleToday}
          title="Jump to Today"
          className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors flex items-center space-x-1.5 shadow-sm"
        >
          <CalendarDays className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
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

        {/* All Meetings / My Meetings toggle */}
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setMeetingScope('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
              meetingScope === 'all'
                ? 'bg-white dark:bg-slate-700 text-purple-700 dark:text-purple-300 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>All Meetings</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-200">
              {allMeetingsCount}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setMeetingScope('my')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
              meetingScope === 'my'
                ? 'bg-white dark:bg-slate-700 text-purple-700 dark:text-purple-300 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>My Meetings</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
              meetingScope === 'my'
                ? 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-200'
                : 'bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-200'
            }`}>
              {myMeetingsCount}
            </span>
          </button>
        </div>

        {/* View toggles */}
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl ml-auto">
          {(['day', 'week', 'month'] as const).map(view => (
            <button
              key={view}
              type="button"
              onClick={() => setViewType(view)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
                viewType === view
                  ? 'bg-white dark:bg-slate-700 text-purple-700 dark:text-purple-300 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {view}
            </button>
          ))}
        </div>

        {/* Department filter */}
        <div className="relative">
          <button
            onClick={() => setIsFilterOpen(prev => !prev)}
            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all border ${
              selectedDeptId !== 'all'
                ? 'bg-purple-50 dark:bg-purple-900/40 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Department{selectedDeptId !== 'all' ? ' (Active)' : ''}</span>
          </button>

          {isFilterOpen && (
            <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-900 dark:text-white">Filter by Department</span>
                <button onClick={() => setIsFilterOpen(false)}>
                  <X className="w-3.5 h-3.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200" />
                </button>
              </div>
              <select
                value={selectedDeptId}
                onChange={e => { setSelectedDeptId(e.target.value); setIsFilterOpen(false); }}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white outline-none focus:border-purple-500"
              >
                <option value="all">All Departments</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              {selectedDeptId !== 'all' && (
                <button
                  onClick={() => { setSelectedDeptId('all'); setIsFilterOpen(false); }}
                  className="mt-2 text-[10px] font-bold text-purple-600 dark:text-purple-400 hover:underline"
                >
                  Clear filter
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── MAIN BODY (sidebar + calendar grid) ─────────────────────────────── */}
      <div className="flex flex-1 gap-4 min-h-0">

        {/* ── SIDEBAR ────────────────────────────────────────────────────────── */}
        {isSidebarOpen && (
          <aside
            className="w-56 shrink-0 flex flex-col gap-4 overflow-y-auto custom-scrollbar"
            style={{ maxHeight: '100%' }}
          >
            {/* Mini calendar */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 shadow-sm">
              <MiniCalendar
                selectedDate={currentDate}
                onDateSelect={date => {
                  setCurrentDate(date);
                  // Jump to day view when a date is clicked in the mini-calendar
                  if (viewType === 'month') setViewType('day');
                }}
              />
            </div>

            {/* Room checklist */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 shadow-sm flex-1">
              <RoomChecklist
                rooms={activeRooms}
                visibleRoomIds={visibleRoomIds}
                onToggleRoom={handleToggleRoom}
                onSelectAll={handleSelectAll}
                onDeselectAll={handleDeselectAll}
              />
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
            visibleRooms.length === 0 ? (
              <div className="flex flex-col items-center justify-center flex-1 text-slate-400 dark:text-slate-500 py-16 space-y-2">
                <span className="text-4xl">📭</span>
                <p className="text-sm font-semibold">No rooms selected</p>
                <p className="text-xs">Use the sidebar checklist to show rooms.</p>
              </div>
            ) : (
              <ResourceView
                viewType={viewType}
                currentDate={currentDate}
                rooms={visibleRooms}
                bookings={filteredBookings}
                onBookingClick={setSelectedBooking}
                onBookingHover={setHoveredBooking}
              />
            )
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
          <p className="font-bold text-sm leading-tight">{hoveredBooking.booking.room_name}</p>
          <p className="text-xs text-slate-300 mt-0.5">{hoveredBooking.booking.department_name}</p>
          <p className="text-xs text-slate-300 mt-0.5">{hoveredBooking.booking.booker_name}</p>
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
                <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">Meeting Details</h2>
                {(() => {
                  const isConfirmed = selectedBooking.status === 'confirmed';
                  const isCompleted = isConfirmed && toIstDate(selectedBooking.end_time).getTime() < Date.now();
                  return (
                    <span className={`mt-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      isCompleted
                        ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                        : isConfirmed
                        ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                        : 'bg-rose-50 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                    }`}>
                      {isCompleted ? 'completed' : selectedBooking.status}
                    </span>
                  );
                })()}
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
                <MapPin className="w-5 h-5 text-purple-600 mr-3 shrink-0" />
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
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Booker</span>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    {selectedBooking.booker_name} ({selectedBooking.booker_code}) · {selectedBooking.department_name}
                  </span>
                </div>
              </div>

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
                className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-lg shadow-purple-500/20 transition-all"
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
