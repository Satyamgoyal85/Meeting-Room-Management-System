'use client';

import React from 'react';
import { format, isSameDay, isToday, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns';
import { AdminBookingItem } from '@/actions/admin';
import { Room } from '@/lib/types';
import { toIstDate } from '@/lib/timezone';

// ─── Shared constants ──────────────────────────────────────────────────────────

const DAY_START_HOUR = 7;   // 7 AM
const DAY_END_HOUR   = 22;  // 10 PM
const DAY_TOTAL_HOURS = DAY_END_HOUR - DAY_START_HOUR; // 15

/** Fixed pixel width per hour column in Day view — wide enough for comfortable horizontal scroll */
const HOUR_COL_W = 88; // px
const ROOM_COL_W = 160; // px — sticky left column

// ─── Color helpers ─────────────────────────────────────────────────────────────

interface ColorSet {
  bg: string; text: string; border: string; solid: string;
}

function getDeptColor(id: string): ColorSet {
  const palette: ColorSet[] = [
    { bg: 'bg-blue-100 dark:bg-blue-900/50',      text: 'text-blue-800 dark:text-blue-200',      border: 'border-blue-300 dark:border-blue-700',    solid: 'bg-blue-500' },
    { bg: 'bg-emerald-100 dark:bg-emerald-900/50', text: 'text-emerald-800 dark:text-emerald-200', border: 'border-emerald-300 dark:border-emerald-700',solid: 'bg-emerald-500' },
    { bg: 'bg-amber-100 dark:bg-amber-900/50',     text: 'text-amber-800 dark:text-amber-200',     border: 'border-amber-300 dark:border-amber-700',   solid: 'bg-amber-500' },
    { bg: 'bg-rose-100 dark:bg-rose-900/50',       text: 'text-rose-800 dark:text-rose-200',       border: 'border-rose-300 dark:border-rose-700',     solid: 'bg-rose-500' },
    { bg: 'bg-purple-100 dark:bg-purple-900/50',   text: 'text-purple-800 dark:text-purple-200',   border: 'border-purple-300 dark:border-purple-700', solid: 'bg-purple-500' },
    { bg: 'bg-cyan-100 dark:bg-cyan-900/50',       text: 'text-cyan-800 dark:text-cyan-200',       border: 'border-cyan-300 dark:border-cyan-700',     solid: 'bg-cyan-500' },
    { bg: 'bg-indigo-100 dark:bg-indigo-900/50',   text: 'text-indigo-800 dark:text-indigo-200',   border: 'border-indigo-300 dark:border-indigo-700', solid: 'bg-indigo-500' },
    { bg: 'bg-pink-100 dark:bg-pink-900/50',       text: 'text-pink-800 dark:text-pink-200',       border: 'border-pink-300 dark:border-pink-700',     solid: 'bg-pink-500' },
    { bg: 'bg-teal-100 dark:bg-teal-900/50',       text: 'text-teal-800 dark:text-teal-200',       border: 'border-teal-300 dark:border-teal-700',     solid: 'bg-teal-500' },
    { bg: 'bg-orange-100 dark:bg-orange-900/50',   text: 'text-orange-800 dark:text-orange-200',   border: 'border-orange-300 dark:border-orange-700', solid: 'bg-orange-500' },
  ];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
}

function hourLabel(h: number) {
  if (h === 0 || h === 24) return '12 AM';
  if (h === 12) return '12 PM';
  return h > 12 ? `${h - 12} PM` : `${h} AM`;
}

// ─── Shared prop types ─────────────────────────────────────────────────────────

interface ResourceViewProps {
  viewType: 'day' | 'week';
  currentDate: Date;
  rooms: Room[];
  bookings: AdminBookingItem[];
  onBookingClick: (booking: AdminBookingItem) => void;
  onBookingHover?: (data: { booking: AdminBookingItem; rect: DOMRect } | null) => void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DAY VIEW — rooms × hours grid with sticky headers and dual scroll
// ═══════════════════════════════════════════════════════════════════════════════

const HOURS = Array.from({ length: DAY_TOTAL_HOURS + 1 }, (_, i) => DAY_START_HOUR + i);
const DAY_ROW_H = 46; // px per room row
const HEADER_H = 32;  // px for time header row

function DayView({ day, rooms, bookings, onBookingClick, onBookingHover }: {
  day: Date;
  rooms: Room[];
  bookings: AdminBookingItem[];
  onBookingClick: (b: AdminBookingItem) => void;
  onBookingHover?: (d: { booking: AdminBookingItem; rect: DOMRect } | null) => void;
}) {
  const isTodayDate = isToday(day);

  // Current time indicator position (only shown for today)
  const nowLinePct = (() => {
    if (!isTodayDate) return null;
    const now = toIstDate(new Date());
    const mins = (now.getHours() - DAY_START_HOUR) * 60 + now.getMinutes();
    const pct = (mins / (DAY_TOTAL_HOURS * 60)) * 100;
    return pct >= 0 && pct <= 100 ? pct : null;
  })();

  const totalContentW = ROOM_COL_W + DAY_TOTAL_HOURS * HOUR_COL_W;

  return (
    /*
     * Single scrollable container — overflow:auto gives BOTH x and y scroll.
     * Sticky positioning works because the scroll ancestor is this element.
     */
    <div className="overflow-auto flex-1 custom-scrollbar" style={{ height: '100%' }}>
      <table
        style={{ width: totalContentW, minWidth: totalContentW, tableLayout: 'fixed', borderCollapse: 'collapse' }}
        className="text-left"
      >
        <colgroup>
          {/* Room name column */}
          <col style={{ width: ROOM_COL_W }} />
          {/* One col per hour segment */}
          {Array.from({ length: DAY_TOTAL_HOURS }, (_, i) => (
            <col key={i} style={{ width: HOUR_COL_W }} />
          ))}
        </colgroup>

        {/* ── STICKY TIME HEADER ── */}
        <thead>
          <tr style={{ height: HEADER_H }}>
            {/* Corner cell — sticky top + sticky left */}
            <th
              className="bg-slate-100 dark:bg-slate-800 border-b border-r border-slate-200 dark:border-slate-700"
              style={{ position: 'sticky', top: 0, left: 0, zIndex: 40, width: ROOM_COL_W }}
            >
              <span className="px-3 text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 block truncate">
                Room
              </span>
            </th>

            {/* Hour labels — sticky top */}
            {Array.from({ length: DAY_TOTAL_HOURS }, (_, i) => {
              const h = DAY_START_HOUR + i;
              const isCurrent = isTodayDate && new Date().getHours() === h;
              return (
                <th
                  key={h}
                  className={`border-b border-l border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/80 text-left`}
                  style={{ position: 'sticky', top: 0, zIndex: 30, width: HOUR_COL_W }}
                >
                  <span className={`pl-1.5 text-[10px] font-bold whitespace-nowrap ${
                    isCurrent ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400 dark:text-slate-500'
                  }`}>
                    {hourLabel(h)}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>

        {/* ── ROOM ROWS ── */}
        <tbody>
          {rooms.map((room, idx) => {
            const roomBookings = bookings.filter(
              b => b.room_id === room.id &&
                   b.status === 'confirmed' &&
                   isSameDay(toIstDate(b.start_time), day)
            );
            const isRestricted = !!room.restricted_to_department_id;
            const rowBg = idx % 2 === 0
              ? 'bg-white dark:bg-slate-900'
              : 'bg-slate-50/60 dark:bg-slate-900/40';

            return (
              <tr key={room.id} style={{ height: DAY_ROW_H }} className="group/row">
                {/* Room label — sticky left */}
                <td
                  className={`border-b border-r border-slate-100 dark:border-slate-800/70 ${rowBg} group-hover/row:bg-slate-50 dark:group-hover/row:bg-slate-800/30 transition-colors`}
                  style={{ position: 'sticky', left: 0, zIndex: 20, width: ROOM_COL_W }}
                >
                  <div className="px-3 min-w-0">
                    <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200 truncate leading-tight">
                      {room.name}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-[9px] font-semibold text-slate-400 dark:text-slate-500 truncate">
                        {room.floor} · {room.capacity} pax
                      </span>
                      {isRestricted && (
                        <span className="text-[7px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/30 px-1 rounded shrink-0">
                          RSTR
                        </span>
                      )}
                    </div>
                  </div>
                </td>

                {/* Hour cells — one per hour, all merged via a single relative td spanning all hour cols */}
                <td
                  colSpan={DAY_TOTAL_HOURS}
                  className={`border-b border-slate-100 dark:border-slate-800/70 relative p-0 ${rowBg} group-hover/row:bg-slate-50 dark:group-hover/row:bg-slate-800/20 transition-colors`}
                  style={{ width: DAY_TOTAL_HOURS * HOUR_COL_W }}
                >
                  {/* Vertical hour grid lines */}
                  <div className="absolute inset-0 flex pointer-events-none" aria-hidden>
                    {Array.from({ length: DAY_TOTAL_HOURS }, (_, i) => (
                      <div
                        key={i}
                        className="h-full border-l border-slate-100 dark:border-slate-800/40 shrink-0"
                        style={{ width: HOUR_COL_W }}
                      />
                    ))}
                  </div>

                  {/* Current time indicator */}
                  {nowLinePct !== null && (
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-purple-500/80 z-10 pointer-events-none"
                      style={{ left: `${nowLinePct}%` }}
                      aria-hidden
                    />
                  )}

                  {/* Booking blocks */}
                  {roomBookings.map(b => {
                    const start = toIstDate(b.start_time);
                    const end   = toIstDate(b.end_time);
                    const startMins = (start.getHours() - DAY_START_HOUR) * 60 + start.getMinutes();
                    const durationMins = (end.getHours() - start.getHours()) * 60 + (end.getMinutes() - start.getMinutes());
                    const totalMins = DAY_TOTAL_HOURS * 60;
                    const leftPct  = Math.max(0, (startMins / totalMins) * 100);
                    const widthPct = Math.max(0.8, (durationMins / totalMins) * 100);
                    const color = getDeptColor(b.department_id);
                    const showText = durationMins >= 25;
                    const isEmployeeView = b.is_invite !== undefined;
                    const borderStyle = isEmployeeView
                      ? (b.is_invite ? 'border-2 border-dashed border-purple-500/80 dark:border-purple-400/80' : 'border-2 border-solid border-emerald-500/80 dark:border-emerald-400/80')
                      : color.border;
                    const bgStyle = isEmployeeView && b.is_invite ? 'bg-purple-100/90 dark:bg-purple-950/80 text-purple-900 dark:text-purple-100' : `${color.bg} ${color.text}`;

                    return (
                      <div
                        key={b.id}
                        onClick={() => onBookingClick(b)}
                        onPointerEnter={e => onBookingHover?.({ booking: b, rect: e.currentTarget.getBoundingClientRect() })}
                        onPointerLeave={() => onBookingHover?.(null)}
                        className={`absolute top-1 bottom-1 rounded border cursor-pointer transition-all
                          hover:brightness-95 hover:shadow-md z-10
                          ${bgStyle} ${borderStyle}`}
                        style={{
                          left: `calc(${leftPct}% + 2px)`,
                          width: `calc(${widthPct}% - 4px)`,
                          minWidth: 20,
                        }}
                      >
                        {showText && (
                          <div className="px-1.5 h-full flex items-center overflow-hidden space-x-1">
                            {isEmployeeView && (
                              <span className={`text-[8px] font-extrabold px-1 py-0.5 rounded uppercase tracking-tighter shrink-0 ${
                                b.is_invite ? 'bg-purple-200 dark:bg-purple-900 text-purple-800 dark:text-purple-200' : 'bg-emerald-200 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200'
                              }`}>
                                {b.is_invite ? 'Invited' : 'My Mtg'}
                              </span>
                            )}
                            <span className="text-[10px] font-semibold truncate whitespace-nowrap">
                              <span className="font-bold opacity-70 mr-1">
                                {format(start, 'HH:mm')}
                              </span>
                              {b.booker_name}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// WEEK VIEW — rooms × days compact overview grid (no time axis)
// ═══════════════════════════════════════════════════════════════════════════════

function WeekView({ weekStart, rooms, bookings, onBookingClick, onBookingHover }: {
  weekStart: Date;
  rooms: Room[];
  bookings: AdminBookingItem[];
  onBookingClick: (b: AdminBookingItem) => void;
  onBookingHover?: (d: { booking: AdminBookingItem; rect: DOMRect } | null) => void;
}) {
  const days = eachDayOfInterval({
    start: weekStart,
    end: endOfWeek(weekStart, { weekStartsOn: 1 }),
  });

  return (
    /*
     * Week view: sticky top (day header) + sticky left (room column) + vertical scroll.
     * No horizontal scroll needed — 7 day columns fit comfortably.
     */
    <div className="overflow-auto flex-1 custom-scrollbar" style={{ height: '100%' }}>
      <table
        className="w-full text-left"
        style={{ tableLayout: 'fixed', borderCollapse: 'collapse', minWidth: ROOM_COL_W + 7 * 110 }}
      >
        <colgroup>
          <col style={{ width: ROOM_COL_W }} />
          {days.map((_, i) => <col key={i} />)}
        </colgroup>

        {/* ── STICKY DAY HEADER ── */}
        <thead>
          <tr style={{ height: 44 }}>
            <th
              className="bg-slate-100 dark:bg-slate-800 border-b border-r border-slate-200 dark:border-slate-700"
              style={{ position: 'sticky', top: 0, left: 0, zIndex: 40 }}
            >
              <span className="px-3 text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 block">
                Room
              </span>
            </th>
            {days.map(day => {
              const isTodayDate = isToday(day);
              return (
                <th
                  key={day.toISOString()}
                  className={`border-b border-l border-slate-200 dark:border-slate-700 text-center ${
                    isTodayDate
                      ? 'bg-purple-50 dark:bg-purple-950/40'
                      : 'bg-slate-50 dark:bg-slate-900/80'
                  }`}
                  style={{ position: 'sticky', top: 0, zIndex: 30 }}
                >
                  <div className="py-1">
                    <div className={`text-[9px] font-bold uppercase tracking-wider ${
                      isTodayDate ? 'text-purple-500' : 'text-slate-400 dark:text-slate-500'
                    }`}>
                      {format(day, 'EEE')}
                    </div>
                    <div className={`text-base font-extrabold ${
                      isTodayDate ? 'text-purple-700 dark:text-purple-300' : 'text-slate-700 dark:text-slate-300'
                    }`}>
                      {format(day, 'd')}
                    </div>
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>

        {/* ── ROOM ROWS ── */}
        <tbody>
          {rooms.map((room, idx) => {
            const rowBg = idx % 2 === 0
              ? 'bg-white dark:bg-slate-900'
              : 'bg-slate-50/60 dark:bg-slate-900/40';
            const isRestricted = !!room.restricted_to_department_id;

            return (
              <tr key={room.id} className="group/row">
                {/* Room label — sticky left */}
                <td
                  className={`border-b border-r border-slate-100 dark:border-slate-800/70 ${rowBg} group-hover/row:bg-slate-50 dark:group-hover/row:bg-slate-800/30 transition-colors`}
                  style={{ position: 'sticky', left: 0, zIndex: 20, minHeight: 60 }}
                >
                  <div className="px-3 py-2 min-w-0">
                    <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200 truncate leading-tight">
                      {room.name}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-[9px] font-semibold text-slate-400 dark:text-slate-500">
                        {room.capacity} pax
                      </span>
                      {isRestricted && (
                        <span className="text-[7px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/30 px-1 rounded shrink-0">
                          RSTR
                        </span>
                      )}
                    </div>
                  </div>
                </td>

                {/* Day cells */}
                {days.map(day => {
                  const isTodayDate = isToday(day);
                  const dayRoomBookings = bookings.filter(
                    b => b.room_id === room.id &&
                         b.status === 'confirmed' &&
                         isSameDay(toIstDate(b.start_time), day)
                  ).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

                  return (
                    <td
                      key={day.toISOString()}
                      className={`border-b border-l border-slate-100 dark:border-slate-800/70 align-top p-1 ${
                        isTodayDate
                          ? 'bg-purple-50/40 dark:bg-purple-950/10'
                          : rowBg
                      } group-hover/row:brightness-[0.97] dark:group-hover/row:brightness-110 transition-colors`}
                    >
                      {dayRoomBookings.length === 0 ? (
                        /* Empty cell — subtle dot to show it's a valid slot */
                        <div className="h-6 flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity">
                          <div className="w-1 h-1 rounded-full bg-slate-200 dark:bg-slate-700" />
                        </div>
                      ) : (
                        <div className="space-y-0.5 min-h-[28px]">
                          {dayRoomBookings.map(b => {
                            const color = getDeptColor(b.department_id);
                            const isEmployeeView = b.is_invite !== undefined;
                            const borderStyle = isEmployeeView
                              ? (b.is_invite ? 'border-dashed border-purple-500/80 dark:border-purple-400/80' : 'border-solid border-emerald-500/80 dark:border-emerald-400/80')
                              : color.border;
                            const bgStyle = isEmployeeView && b.is_invite ? 'bg-purple-100/90 dark:bg-purple-950/80 text-purple-900 dark:text-purple-100' : `${color.bg} ${color.text}`;

                            return (
                              <button
                                key={b.id}
                                onClick={() => onBookingClick(b)}
                                onPointerEnter={e => onBookingHover?.({ booking: b, rect: e.currentTarget.getBoundingClientRect() })}
                                onPointerLeave={() => onBookingHover?.(null)}
                                className={`w-full text-left px-1.5 py-0.5 rounded border text-[9px] font-semibold truncate transition-all
                                  hover:brightness-95 hover:shadow-sm cursor-pointer flex items-center justify-between
                                  ${bgStyle} ${borderStyle}`}
                              >
                                <span className="truncate">
                                  {format(toIstDate(b.start_time), 'HH:mm')}–{format(toIstDate(b.end_time), 'HH:mm')}
                                </span>
                                {isEmployeeView && (
                                  <span className={`text-[7px] font-extrabold px-1 py-0.2 rounded uppercase ml-1 shrink-0 ${
                                    b.is_invite ? 'bg-purple-200 dark:bg-purple-900 text-purple-800 dark:text-purple-200' : 'bg-emerald-200 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200'
                                  }`}>
                                    {b.is_invite ? 'INV' : 'MY'}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT EXPORT — routes to DayView or WeekView
// ═══════════════════════════════════════════════════════════════════════════════

export default function ResourceView({
  viewType,
  currentDate,
  rooms,
  bookings,
  onBookingClick,
  onBookingHover,
}: ResourceViewProps) {
  if (viewType === 'day') {
    return (
      <DayView
        day={currentDate}
        rooms={rooms}
        bookings={bookings}
        onBookingClick={onBookingClick}
        onBookingHover={onBookingHover}
      />
    );
  }

  // Week view
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  return (
    <WeekView
      weekStart={weekStart}
      rooms={rooms}
      bookings={bookings}
      onBookingClick={onBookingClick}
      onBookingHover={onBookingHover}
    />
  );
}
