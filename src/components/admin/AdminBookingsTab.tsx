'use client';

import React, { useState, useTransition } from 'react';
import { AdminBookingItem } from '@/actions/admin';
import { cancelBookingAction } from '@/actions/bookings';
import { Department } from '@/lib/types';
import { 
  ShieldAlert, 
  Search, 
  Filter, 
  Calendar, 
  Clock, 
  Building2, 
  User, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  X, 
  Loader2, 
  ArrowRight,
  FileText
} from 'lucide-react';
import { format } from 'date-fns';
import { toIstDate } from '@/lib/timezone';

interface AdminBookingsTabProps {
  bookings: AdminBookingItem[];
  departments: Department[];
  currentUserId: string;
  userRole?: string;
}

export default function AdminBookingsTab({
  bookings,
  departments,
  currentUserId,
  userRole = 'admin',
}: AdminBookingsTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'confirmed' | 'cancelled'>('all');
  const [deptFilter, setDeptFilter] = useState<string>('all');

  const [overridingBooking, setOverridingBooking] = useState<AdminBookingItem | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleOverrideSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!overridingBooking) return;
    if (!cancelReason || cancelReason.trim().length < 3) {
      setError('Please provide an override reason per Dhanuka audit policy.');
      return;
    }

    const formData = new FormData();
    formData.append('bookingId', overridingBooking.id);
    formData.append('cancelReason', `[ADMIN OVERRIDE]: ${cancelReason}`);

    startTransition(async () => {
      const res = await cancelBookingAction(formData);
      if (res && res.error) {
        setError(res.error);
      } else {
        setOverridingBooking(null);
        setCancelReason('');
        window.location.reload();
      }
    });
  };

  // Filter bookings
  const filteredBookings = bookings.filter(b => {
    if (statusFilter !== 'all' && b.status !== statusFilter) return false;
    if (deptFilter !== 'all' && b.department_id !== deptFilter) return false;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchRoom = b.room_name.toLowerCase().includes(q);
      const matchBooker = b.booker_name.toLowerCase().includes(q);
      const matchCode = b.booker_code.toLowerCase().includes(q);
      const matchAgenda = b.agenda.toLowerCase().includes(q);
      if (!matchRoom && !matchBooker && !matchCode && !matchAgenda) return false;
    }

    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Filter Bar */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search booker, room, or agenda..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-purple-500 transition-all"
          />
        </div>

        {/* Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300"
          >
            <option value="all">All Statuses ({bookings.length})</option>
            <option value="confirmed">Confirmed Only</option>
            <option value="cancelled">Cancelled Only</option>
          </select>

          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300"
          >
            <option value="all">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Bookings Table / Cards */}
      {filteredBookings.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-slate-200 dark:border-slate-800 shadow-sm">
          <ShieldAlert className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h3 className="font-bold text-slate-800 dark:text-slate-200 text-lg">No Matching Bookings Found</h3>
          <p className="text-xs text-slate-500 mt-1">Try adjusting your search criteria or department filter.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredBookings.map((booking) => {
            const startDate = toIstDate(booking.start_time);
            const endDate = toIstDate(booking.end_time);
            const isConfirmed = booking.status === 'confirmed';

            return (
              <div
                key={booking.id}
                className={`bg-white dark:bg-slate-900 rounded-2xl p-5 border transition-all shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                  !isConfirmed 
                    ? 'border-rose-200/60 dark:border-rose-900/40 opacity-75 bg-slate-50/50 dark:bg-slate-950/40' 
                    : 'border-slate-200 dark:border-slate-800 hover:border-purple-500/60'
                }`}
              >
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Status Badge */}
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                      isConfirmed
                        ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                        : 'bg-rose-50 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                    }`}>
                      {isConfirmed ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
                      {booking.status}
                    </span>

                    {/* Room Tag */}
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold">
                      <Building2 className="w-3 h-3 mr-1.5 text-purple-600" />
                      {booking.room_name} ({booking.room_floor})
                    </span>

                    {/* Booker Tag */}
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg bg-sky-50 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 text-xs font-semibold">
                      <User className="w-3 h-3 mr-1 text-sky-600" />
                      {booking.booker_name} ({booking.booker_code}) • {booking.department_name}
                    </span>
                  </div>

                  {/* Date & Time */}
                  <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-slate-600 dark:text-slate-400">
                    <span className="flex items-center font-bold text-slate-900 dark:text-white">
                      <Calendar className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                      {format(startDate, 'MMM d, yyyy')}
                    </span>
                    <span>•</span>
                    <span className="flex items-center">
                      <Clock className="w-3.5 h-3.5 mr-1.5 text-sky-600" />
                      {format(startDate, 'hh:mm a')} — {format(endDate, 'hh:mm a')}
                    </span>
                  </div>

                  {/* Unmasked Meeting Agenda */}
                  <div className="pt-1 text-xs">
                    <span className="font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider text-[10px] mr-1.5">
                      {userRole === 'receptionist' ? '[Receptionist Agenda]:' : '[Admin Oversight Agenda]:'}
                    </span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      &quot;{booking.agenda}&quot;
                    </span>
                  </div>

                  {/* Cancellation Reason if cancelled */}
                  {!isConfirmed && booking.cancel_reason && (
                    <div className="p-2 rounded-lg bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/40 text-[11px] text-rose-800 dark:text-rose-300">
                      <strong>Cancellation Reason:</strong> &quot;{booking.cancel_reason}&quot;
                    </div>
                  )}
                </div>

                {/* Admin / Receptionist Cancellation Action */}
                {isConfirmed && (
                  (userRole === 'receptionist' && booking.employee_id !== currentUserId) ? (
                    <span 
                      title="Receptionists cannot cancel bookings owned by other employees"
                      className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 text-[11px] font-semibold border border-slate-200 dark:border-slate-700 cursor-not-allowed whitespace-nowrap"
                    >
                      Cannot Cancel
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setOverridingBooking(booking);
                        setCancelReason('');
                        setError(null);
                      }}
                      className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-bold flex items-center space-x-1.5 transition-all shadow-sm whitespace-nowrap"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>{userRole === 'receptionist' ? 'Cancel Booking' : 'Override / Cancel'}</span>
                    </button>
                  )
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Admin Override Modal */}
      {overridingBooking && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-6">
            <button
              type="button"
              onClick={() => setOverridingBooking(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-14 h-14 rounded-2xl bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 flex items-center justify-center mx-auto shadow-md">
              <ShieldAlert className="w-7 h-7" />
            </div>

            <div className="text-center">
              <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
                {userRole === 'receptionist' ? 'Cancel Booking' : 'Admin Override Cancellation'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {userRole === 'receptionist' ? (
                  <>You are cancelling <strong className="text-slate-800 dark:text-slate-200">{overridingBooking.booker_name}</strong>&apos;s booking for <strong className="text-blue-600 dark:text-blue-400">{overridingBooking.room_name}</strong>.</>
                ) : (
                  <>You are exercising System Administrator authority to cancel <strong className="text-slate-800 dark:text-slate-200">{overridingBooking.booker_name}</strong>&apos;s booking for <strong className="text-purple-600 dark:text-purple-400">{overridingBooking.room_name}</strong>.</>
                )}
              </p>
            </div>

            <form onSubmit={handleOverrideSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 rounded-xl text-xs text-rose-700 dark:text-rose-300">
                  {error}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Mandatory Admin Reason (Required)
                </label>
                <textarea
                  rows={3}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g., Emergency executive board meeting priority / Urgent room repair required..."
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setOverridingBooking(null)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition-all"
                >
                  Abort
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-lg shadow-purple-500/20 flex items-center justify-center space-x-1.5 transition-all disabled:opacity-50"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Overriding...</span>
                    </>
                  ) : (
                    <>
                      <span>Confirm Override</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
