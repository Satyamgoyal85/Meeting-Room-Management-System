import React from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/actions/auth';
import { getAdminDashboardData } from '@/actions/admin';
import Navbar from '@/components/layout/Navbar';
import AdminCalendarTab from '@/components/admin/AdminCalendarTab';
import AdminBookingsTab from '@/components/admin/AdminBookingsTab';

export const revalidate = 0; // Always fetch fresh records

interface ReceptionistPageProps {
  searchParams?: { tab?: string };
}

export default async function ReceptionistDashboardPage({ searchParams }: ReceptionistPageProps) {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  if (session.role !== 'receptionist' && session.role !== 'admin') {
    redirect('/dashboard');
  }

  // Determine the active tab (default to 'calendar')
  const currentTab = searchParams?.tab === 'bookings' ? 'bookings' : 'calendar';
  
  // Always fetch the required data
  const adminData = await getAdminDashboardData();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      <Navbar session={session} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-300">
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-800/80 p-6">
          {currentTab === 'calendar' && (
            <AdminCalendarTab
              bookings={adminData.bookings}
              rooms={adminData.rooms}
              departments={adminData.departments}
              currentUserId={adminData.currentUserId}
              currentUserInvitedBookingIds={adminData.currentUserInvitedBookingIds}
            />
          )}

          {currentTab === 'bookings' && (
            <AdminBookingsTab
              bookings={adminData.bookings}
              departments={adminData.departments}
              currentUserId={adminData.currentUserId}
              userRole="receptionist"
            />
          )}
        </div>
      </main>

      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-6 text-center text-xs text-slate-500 dark:text-slate-400 mt-12">
        <p>
          Dhanuka Agritech Ltd. — Meeting Room Management System (GHO Branch)
        </p>
      </footer>
    </div>
  );
}
