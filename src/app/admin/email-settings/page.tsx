import React from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/actions/auth';
import Navbar from '@/components/layout/Navbar';
import AdminSmtpTab from '@/components/admin/AdminSmtpTab';

export const revalidate = 0; // Always fetch fresh settings/session check

export default async function EmailSettingsPage() {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  if (session.role !== 'admin') {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      {/* Global Top Navigation Bar */}
      <Navbar session={session} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Clean Standalone Page Header (No Admin Dashboard tabs or chrome) */}
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
            Email Settings
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage system-wide SMTP gateway configuration and email notification delivery logs.
          </p>
        </div>

        {/* Standalone SMTP Gateway Configuration & Testing Component */}
        <AdminSmtpTab />
      </main>

      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-6 text-center text-xs text-slate-500 dark:text-slate-400 mt-12">
        <p>
          Dhanuka Agritech Ltd. — Meeting Room Management System (GHO Branch)
        </p>
      </footer>
    </div>
  );
}
