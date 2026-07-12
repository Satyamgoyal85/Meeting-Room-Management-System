'use client';

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AdminDashboardData } from '@/actions/admin';
import AdminCalendarTab from '@/components/admin/AdminCalendarTab';
import AdminBookingsTab from '@/components/admin/AdminBookingsTab';
import { CalendarDays, LayoutList, ShieldCheck } from 'lucide-react';

interface ReceptionistDashboardProps {
  initialData: AdminDashboardData;
}

export default function ReceptionistDashboard({ initialData }: ReceptionistDashboardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const currentTab = (searchParams.get('tab') as 'calendar' | 'bookings') || 'calendar';

  const switchTab = (tab: 'calendar' | 'bookings') => {
    router.push(`/receptionist?tab=${tab}`);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-6 rounded-3xl shadow-xl border border-blue-800/40">
        <div>
          <div className="flex items-center space-x-2 text-blue-300 text-xs font-bold uppercase tracking-wider mb-1">
            <ShieldCheck className="w-4 h-4 text-blue-400" />
            <span>Reception Desk Front Office</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Receptionist Control Portal
          </h1>
          <p className="text-xs sm:text-sm text-blue-200/80 mt-1 max-w-xl">
            Manage schedule oversight and book rooms on behalf of Dhanuka executives and departments.
          </p>
        </div>
        <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/10 self-start sm:self-center">
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-blue-300 block">Total Active Bookings</span>
            <span className="text-lg font-black text-white">{initialData.bookings.length}</span>
          </div>
        </div>
      </div>

      {/* Tab Switcher Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-4">
        <button
          type="button"
          onClick={() => switchTab('calendar')}
          className={`px-5 py-3 rounded-2xl font-bold text-xs flex items-center space-x-2 transition-all shadow-sm ${
            currentTab === 'calendar'
              ? 'bg-blue-600 text-white shadow-blue-500/20 scale-105'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
          }`}
        >
          <CalendarDays className="w-4 h-4" />
          <span>Calendar Oversight</span>
        </button>

        <button
          type="button"
          onClick={() => switchTab('bookings')}
          className={`px-5 py-3 rounded-2xl font-bold text-xs flex items-center space-x-2 transition-all shadow-sm ${
            currentTab === 'bookings'
              ? 'bg-blue-600 text-white shadow-blue-500/20 scale-105'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
          }`}
        >
          <LayoutList className="w-4 h-4" />
          <span>All Bookings Directory ({initialData.bookings.length})</span>
        </button>
      </div>

      {/* Tab Content */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-800/80 p-6">
        {currentTab === 'calendar' && (
          <AdminCalendarTab
            bookings={initialData.bookings}
            rooms={initialData.rooms}
            departments={initialData.departments}
            currentUserId={initialData.currentUserId}
            currentUserInvitedBookingIds={initialData.currentUserInvitedBookingIds}
          />
        )}

        {currentTab === 'bookings' && (
          <AdminBookingsTab
            bookings={initialData.bookings}
            departments={initialData.departments}
            currentUserId={initialData.currentUserId}
            userRole="receptionist"
          />
        )}
      </div>

    </div>
  );
}
