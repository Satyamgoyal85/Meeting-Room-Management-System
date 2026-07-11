'use client';

import React, { useState, useTransition } from 'react';
import { MyBookingItem, cancelBookingAction } from '@/actions/bookings';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  XCircle, 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  Loader2, 
  X, 
  ArrowRight,
  ShieldAlert,
  Building2,
  Users,
  UserCheck
} from 'lucide-react';
import { format } from 'date-fns';
import { toIstDate } from '@/lib/timezone';

interface MyBookingsListProps {
  initialUpcoming: MyBookingItem[];
  initialPast: MyBookingItem[];
  currentUserId: string;
}

export default function MyBookingsList({
  initialUpcoming,
  initialPast,
  currentUserId,
}: MyBookingsListProps) {
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const [cancellingBooking, setCancellingBooking] = useState<MyBookingItem | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleCancelSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!cancellingBooking) return;
    if (!cancelReason || cancelReason.trim().length < 3) {
      setError('Please provide a mandatory cancellation reason per audit guidelines.');
      return;
    }

    const formData = new FormData();
    formData.append('bookingId', cancellingBooking.id);
    formData.append('cancelReason', cancelReason);

    startTransition(async () => {
      const res = await cancelBookingAction(formData);
      if (res && res.error) {
        setError(res.error);
      } else {
        setCancellingBooking(null);
        setCancelReason('');
        // Page revalidates via server action
        window.location.reload();
      }
    });
  };

  const displayedList = activeTab === 'upcoming' ? initialUpcoming : initialPast;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* Header & Tab Switcher */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
          My Bookings
        </h1>

        {/* Tab Switcher */}
        <div className="bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center space-x-1 self-stretch sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('upcoming')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'upcoming'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-white/5'
            }`}
          >
            Upcoming ({initialUpcoming.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('past')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'past'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-white/5'
            }`}
          >
            Past & Cancelled ({initialPast.length})
          </button>
        </div>
      </div>

      {/* Bookings List */}
      {displayedList.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
            No {activeTab === 'upcoming' ? 'Upcoming' : 'Past'} Reservations Found
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            {activeTab === 'upcoming' 
              ? 'You do not have any active upcoming room bookings scheduled. Head over to the Room Dashboard to reserve a space!' 
              : 'You have no past or cancelled meeting room records.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {displayedList.map((booking) => {
            const startDate = toIstDate(booking.start_time);
            const endDate = toIstDate(booking.end_time);
            const isConfirmed = booking.status === 'confirmed';

            return (
              <div
                key={booking.id}
                className={`bg-white dark:bg-slate-900 rounded-3xl p-6 border transition-all shadow-sm flex flex-col justify-between ${
                  !isConfirmed 
                    ? 'border-rose-200/60 dark:border-rose-900/40 opacity-80' 
                    : 'border-slate-200 dark:border-slate-800 hover:border-emerald-500/60'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold">
                      <Building2 className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                      {booking.room_name} ({booking.room_floor})
                    </span>

                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      {booking.is_invite ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-sky-50 text-sky-700 dark:bg-sky-950/80 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                          <Users className="w-3 h-3 mr-1 text-sky-500" />
                          Invited by {booking.organizer_name || 'Colleague'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          <UserCheck className="w-3 h-3 mr-1 text-emerald-500" />
                          Organized by you {booking.invitee_count ? `(+${booking.invitee_count} invited)` : ''}
                        </span>
                      )}

                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                        isConfirmed
                          ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                          : 'bg-rose-50 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                      }`}>
                        {isConfirmed ? <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" /> : <XCircle className="w-3.5 h-3.5 mr-1 text-rose-600" />}
                        {booking.status}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5 font-mono text-xs">
                    <div className="flex items-center text-slate-800 dark:text-slate-200 font-bold">
                      <Calendar className="w-4 h-4 mr-2 text-emerald-600" />
                      <span>{format(startDate, 'EEEE, MMMM d, yyyy')}</span>
                    </div>
                    <div className="flex items-center text-slate-600 dark:text-slate-400">
                      <Clock className="w-4 h-4 mr-2 text-sky-600" />
                      <span>{format(startDate, 'hh:mm a')} — {format(endDate, 'hh:mm a')}</span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                      Meeting Agenda:
                    </span>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      &quot;{booking.agenda}&quot;
                    </p>
                  </div>

                  {/* Cancellation Reason details if cancelled */}
                  {!isConfirmed && booking.cancel_reason && (
                    <div className="mt-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-800 dark:text-rose-300 space-y-1">
                      <div className="font-bold flex items-center">
                        <AlertTriangle className="w-3.5 h-3.5 mr-1 text-rose-600" />
                        <span>Cancellation Record:</span>
                      </div>
                      <p className="italic">&quot;{booking.cancel_reason}&quot;</p>
                      <span className="block text-[10px] opacity-70 font-mono">
                        Cancelled by: {booking.cancelled_by === currentUserId ? 'You' : 'Admin'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Action Button: Cancel for upcoming confirmed bookings (only if organizer) */}
                {activeTab === 'upcoming' && isConfirmed && !booking.is_invite && (
                  <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setCancellingBooking(booking);
                        setCancelReason('');
                        setError(null);
                      }}
                      className="px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/80 text-xs font-bold flex items-center space-x-1.5 transition-all shadow-sm"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Cancel Reservation</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Mandatory Cancellation Modal */}
      {cancellingBooking && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-6">
            <button
              type="button"
              onClick={() => setCancellingBooking(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-14 h-14 rounded-2xl bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div className="text-center">
              <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
                Cancel Reservation
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                You are about to cancel your booking for <strong className="text-slate-800 dark:text-slate-200">{cancellingBooking.room_name}</strong> on <strong className="text-rose-600 dark:text-rose-400">{format(toIstDate(cancellingBooking.start_time), 'MMM d, yyyy')}</strong>.
              </p>
            </div>

            <form onSubmit={handleCancelSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center space-x-2">
                  <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center justify-between">
                  <span>Mandatory Cancellation Reason</span>
                  <span className="text-[10px] text-rose-600 bg-rose-100 dark:bg-rose-950/80 px-1.5 py-0.5 rounded">Required</span>
                </label>
                <textarea
                  rows={3}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g., Meeting rescheduled to next week / Moved to virtual call..."
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
                <span className="block text-[11px] text-slate-400">
                  Per Dhanuka Agritech audit guidelines, this reason will be permanently stored in the system audit log.
                </span>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCancellingBooking(null)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition-all"
                >
                  Keep Booking
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-lg shadow-rose-500/20 flex items-center justify-center space-x-1.5 transition-all disabled:opacity-50"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Cancelling...</span>
                    </>
                  ) : (
                    <>
                      <span>Confirm Cancellation</span>
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
