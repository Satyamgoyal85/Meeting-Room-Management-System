'use client';

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AdminDashboardData } from '@/actions/admin';
import AdminBookingsTab from '@/components/admin/AdminBookingsTab';
import AdminRoomsTab from '@/components/admin/AdminRoomsTab';
import AdminReportsTab from '@/components/admin/AdminReportsTab';
import AdminOverviewTab from '@/components/admin/AdminOverviewTab';
import AdminEmployeesTab from '@/components/admin/AdminEmployeesTab';
import AdminCalendarTab from '@/components/admin/AdminCalendarTab';
import { 
  Layers, 
  BarChart3, 
  Calendar,
  CalendarDays,
  Sparkles,
  Building2,
  Users,
  LayoutList
} from 'lucide-react';

interface AdminDashboardProps {
  initialData: AdminDashboardData;
}

export default function AdminDashboard({ initialData }: AdminDashboardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const currentTab = (searchParams.get('tab') as 'overview' | 'bookings' | 'rooms' | 'amenities' | 'employees' | 'reports' | 'calendar') || 'overview';

  const switchTab = (tab: 'overview' | 'bookings' | 'rooms' | 'amenities' | 'employees' | 'reports' | 'calendar') => {
    router.push(`/admin?tab=${tab}`);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
          Admin Dashboard
        </h1>
      </div>

      {/* Tab Switcher Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-4">
        <button
          type="button"
          onClick={() => switchTab('overview')}
          className={`px-5 py-3 rounded-2xl font-bold text-xs flex items-center space-x-2 transition-all shadow-sm ${
            currentTab === 'overview'
              ? 'bg-purple-600 text-white shadow-purple-500/20 scale-105'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>System Overview</span>
        </button>

        <button
          type="button"
          onClick={() => switchTab('calendar')}
          className={`px-5 py-3 rounded-2xl font-bold text-xs flex items-center space-x-2 transition-all shadow-sm ${
            currentTab === 'calendar'
              ? 'bg-purple-600 text-white shadow-purple-500/20 scale-105'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
          }`}
        >
          <CalendarDays className="w-4 h-4" />
          <span>Calendar</span>
        </button>

        <button
          type="button"
          onClick={() => switchTab('bookings')}
          className={`px-5 py-3 rounded-2xl font-bold text-xs flex items-center space-x-2 transition-all shadow-sm ${
            currentTab === 'bookings'
              ? 'bg-purple-600 text-white shadow-purple-500/20 scale-105'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
          }`}
        >
          <LayoutList className="w-4 h-4" />
          <span>All Bookings & Oversight ({initialData.bookings.length})</span>
        </button>

        <button
          type="button"
          onClick={() => switchTab('rooms')}
          className={`px-5 py-3 rounded-2xl font-bold text-xs flex items-center space-x-2 transition-all shadow-sm ${
            currentTab === 'rooms' || currentTab === 'amenities'
              ? 'bg-purple-600 text-white shadow-purple-500/20 scale-105'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Rooms & Depts ({initialData.rooms.filter(r => r.is_active !== false).length})</span>
        </button>

        <button
          type="button"
          onClick={() => switchTab('employees')}
          className={`px-5 py-3 rounded-2xl font-bold text-xs flex items-center space-x-2 transition-all shadow-sm ${
            currentTab === 'employees'
              ? 'bg-purple-600 text-white shadow-purple-500/20 scale-105'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Employee Directory ({initialData.employees.length})</span>
        </button>

        <button
          type="button"
          onClick={() => switchTab('reports')}
          className={`px-5 py-3 rounded-2xl font-bold text-xs flex items-center space-x-2 transition-all shadow-sm ${
            currentTab === 'reports'
              ? 'bg-purple-600 text-white shadow-purple-500/20 scale-105'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Utilization & Analytics Reports</span>
        </button>
      </div>

      {/* Tab Content Rendering */}
      <div className="pt-2">
        {currentTab === 'overview' && (
          <AdminOverviewTab
            rooms={initialData.rooms}
            departments={initialData.departments}
            employees={initialData.employees}
          />
        )}

        {currentTab === 'bookings' && (
          <AdminBookingsTab
            bookings={initialData.bookings}
            departments={initialData.departments}
            currentUserId={initialData.currentUserId}
          />
        )}

        {currentTab === 'calendar' && (
          <AdminCalendarTab
            bookings={initialData.bookings}
            rooms={initialData.rooms}
            departments={initialData.departments}
            currentUserId={initialData.currentUserId}
            currentUserInvitedBookingIds={initialData.currentUserInvitedBookingIds}
          />
        )}

        {(currentTab === 'rooms' || currentTab === 'amenities') && (
          <AdminRoomsTab
            rooms={initialData.rooms}
            departments={initialData.departments}
            amenities={initialData.amenities}
            bookings={initialData.bookings}
            employees={initialData.employees}
            initialSection={currentTab === 'amenities' ? 'amenities' : 'rooms'}
          />
        )}

        {currentTab === 'employees' && (
          <AdminEmployeesTab
            employees={initialData.employees}
            departments={initialData.departments}
            bookings={initialData.bookings}
          />
        )}

        {currentTab === 'reports' && (
          <AdminReportsTab
            metrics={initialData.metrics}
            bookings={initialData.bookings}
            rooms={initialData.rooms}
            departments={initialData.departments}
            usageStats={initialData.usageStats || []}
            cleanupJobLogs={initialData.cleanupJobLogs || []}
          />
        )}

      </div>

    </div>
  );
}
