'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { logoutAction, AuthSession } from '@/actions/auth';
import { 
  Building2, 
  LogOut, 
  User, 
  ShieldAlert, 
  Calendar, 
  CalendarDays,
  Layers, 
  Settings, 
  BarChart3,
  CheckCircle2,
  BookmarkCheck,
  Menu,
  X,
  Mail
} from 'lucide-react';

interface NavbarProps {
  session: AuthSession;
}

export default function Navbar({ session }: NavbarProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const adminTab = searchParams.get('tab') || 'bookings';
  
  const isAdmin = session.role === 'admin';
  const isAdminPage = pathname === '/admin';

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <header className="sticky top-0 z-50 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand & Logo */}
        <div className="flex items-center space-x-6">
          <Link 
            href={isAdmin ? "/admin" : "/dashboard"} 
            onClick={closeMobileMenu}
            className="flex items-center space-x-3.5 group"
          >
            <img 
              src="/logo.png" 
              alt="Dhanuka Agritech Ltd. Logo" 
              className="h-8 sm:h-11 w-auto object-contain shrink-0 transition-transform group-hover:scale-105" 
            />
            <div>
              <span className="font-bold text-base sm:text-lg bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                Dhanuka Agritech Ltd.
              </span>
              <span className="text-[10px] sm:text-xs block text-slate-500 dark:text-slate-400 font-medium">
                GHO Branch • {isAdmin ? 'Admin Portal' : 'Room Dashboard'}
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center space-x-1 lg:space-x-1.5 pl-4 lg:pl-6 border-l border-slate-200 dark:border-slate-800">
            {/* 1. Calendar (Admin -> /admin?tab=calendar, Employee -> /dashboard/calendar) */}
            {isAdmin ? (
              <Link
                href="/admin?tab=calendar"
                title="Calendar"
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors ${
                  isAdminPage && adminTab === 'calendar'
                    ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                <span>Calendar</span>
              </Link>
            ) : (
              <Link
                href="/dashboard/calendar"
                title="Calendar"
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors ${
                  pathname === '/dashboard/calendar'
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                <span>Calendar</span>
              </Link>
            )}

            {/* 2. Room Dashboard (Available to all users) */}
            <Link
              href="/dashboard"
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors ${
                pathname === '/dashboard'
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Room Dashboard</span>
            </Link>

            {/* 3. My Bookings (Available to all users) */}
            <Link
              href="/dashboard/my-bookings"
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors ${
                pathname.startsWith('/dashboard/my-bookings')
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <BookmarkCheck className="w-3.5 h-3.5" />
              <span>My Bookings</span>
            </Link>

            {/* 4-6. Admin links (All Bookings, Rooms & Depts, Reports) */}
            {isAdmin && (
              <>
                <Link
                  href="/admin?tab=bookings"
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors ${
                    isAdminPage && adminTab === 'bookings'
                      ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>All Bookings</span>
                </Link>
                <Link
                  href="/admin?tab=rooms"
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors ${
                    isAdminPage && adminTab === 'rooms'
                      ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Rooms & Depts</span>
                </Link>
                <Link
                  href="/admin?tab=reports"
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors ${
                    isAdminPage && adminTab === 'reports'
                      ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>Reports</span>
                </Link>
              </>
            )}
          </nav>
        </div>

        {/* User Profile & Logout (Desktop) */}
        <div className="hidden md:flex items-center space-x-3 relative shrink-0">
          
          {/* User Badge / Dropdown Toggle */}
          <button 
            onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
            className="flex items-center space-x-2.5 bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800/80 px-2 py-1.5 rounded-xl transition-colors text-left"
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm shrink-0 ${
              isAdmin ? 'bg-purple-600' : 'bg-emerald-600'
            }`}>
              {session.name.charAt(0)}
            </div>
            <div className="text-left leading-none">
              <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                {session.name}
              </div>
              <div className="text-[10px] font-mono text-slate-500 mt-1 flex items-center space-x-1">
                <span className="text-sky-600 dark:text-sky-400 font-semibold">{session.employee_id}</span>
                <span>•</span>
                <span className="capitalize">{session.role}</span>
              </div>
            </div>
          </button>

          {/* Profile Dropdown */}
          {isProfileDropdownOpen && (
            <div className="absolute top-full right-0 mt-2 w-52 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg py-1 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
              {isAdmin && (
                <>
                  <Link
                    href="/admin?tab=smtp"
                    onClick={() => setIsProfileDropdownOpen(false)}
                    className="w-full text-left px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 flex items-center transition-colors"
                  >
                    <Mail className="w-4 h-4 mr-2.5 text-emerald-500 shrink-0" />
                    <span>Email Settings</span>
                  </Link>
                  <div className="border-t border-slate-100 dark:border-slate-800 my-1" />
                </>
              )}
              <form action={logoutAction} className="w-full">
                <button
                  type="submit"
                  className="w-full text-left px-4 py-2.5 text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center transition-colors"
                >
                  <LogOut className="w-4 h-4 mr-2.5 shrink-0" />
                  <span>Sign Out</span>
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Mobile Hamburger Menu Button */}
        <div className="flex md:hidden items-center space-x-2">
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            aria-label="Toggle Navigation Menu"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

      </div>

      {/* Mobile Menu Dropdown */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-4 pt-3 pb-6 space-y-4 animate-in slide-in-from-top duration-200">
          
          {/* User Profile Info (Mobile) */}
          <div className="flex items-center space-x-3 p-3 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/80">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white shadow-md ${
              isAdmin ? 'bg-purple-600' : 'bg-emerald-600'
            }`}>
              {session.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
                {session.name}
              </div>
              <div className="text-xs font-mono text-slate-500 flex items-center space-x-1 mt-0.5">
                <span className="text-sky-600 dark:text-sky-400 font-bold">{session.employee_id}</span>
                <span>•</span>
                <span className="capitalize">{session.role}</span>
              </div>
            </div>
          </div>

          {/* Navigation Links (Mobile) */}
          <nav className="space-y-1.5">
            {/* 1. Calendar (Admin -> /admin?tab=calendar, Employee -> /dashboard/calendar) */}
            {isAdmin ? (
              <Link
                href="/admin?tab=calendar"
                onClick={closeMobileMenu}
                className={`w-full px-4 py-2.5 rounded-xl text-sm font-bold flex items-center space-x-3 transition-colors ${
                  isAdminPage && adminTab === 'calendar'
                    ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <CalendarDays className="w-5 h-5 text-purple-600" />
                <span>Calendar</span>
              </Link>
            ) : (
              <Link
                href="/dashboard/calendar"
                onClick={closeMobileMenu}
                className={`w-full px-4 py-2.5 rounded-xl text-sm font-bold flex items-center space-x-3 transition-colors ${
                  pathname === '/dashboard/calendar'
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <CalendarDays className="w-5 h-5 text-emerald-600" />
                <span>Calendar</span>
              </Link>
            )}

            {/* 2. Room Dashboard */}
            <Link
              href="/dashboard"
              onClick={closeMobileMenu}
              className={`w-full px-4 py-2.5 rounded-xl text-sm font-bold flex items-center space-x-3 transition-colors ${
                pathname === '/dashboard'
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Calendar className="w-5 h-5 text-emerald-600" />
              <span>Room Dashboard</span>
            </Link>

            {/* 3. My Bookings */}
            <Link
              href="/dashboard/my-bookings"
              onClick={closeMobileMenu}
              className={`w-full px-4 py-2.5 rounded-xl text-sm font-bold flex items-center space-x-3 transition-colors ${
                pathname.startsWith('/dashboard/my-bookings')
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <BookmarkCheck className="w-5 h-5 text-sky-600" />
              <span>My Bookings</span>
            </Link>

            {/* 4-6. Admin links */}
            {isAdmin && (
              <div className="pt-2 mt-2 border-t border-slate-200 dark:border-slate-800 space-y-1.5">
                <div className="px-4 text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                  Admin Control Portal
                </div>
                
                <Link
                  href="/admin?tab=bookings"
                  onClick={closeMobileMenu}
                  className={`w-full px-4 py-2.5 rounded-xl text-sm font-bold flex items-center space-x-3 transition-colors ${
                    isAdminPage && adminTab === 'bookings'
                      ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <ShieldAlert className="w-5 h-5 text-purple-600" />
                  <span>All Bookings & Oversight</span>
                </Link>

                <Link
                  href="/admin?tab=rooms"
                  onClick={closeMobileMenu}
                  className={`w-full px-4 py-2.5 rounded-xl text-sm font-bold flex items-center space-x-3 transition-colors ${
                    isAdminPage && adminTab === 'rooms'
                      ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Layers className="w-5 h-5 text-purple-600" />
                  <span>Rooms & Depts Inventory</span>
                </Link>

                <Link
                  href="/admin?tab=reports"
                  onClick={closeMobileMenu}
                  className={`w-full px-4 py-2.5 rounded-xl text-sm font-bold flex items-center space-x-3 transition-colors ${
                    isAdminPage && adminTab === 'reports'
                      ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300'
                      : 'text-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <BarChart3 className="w-5 h-5 text-purple-600" />
                  <span>Utilization Reports & Export</span>
                </Link>
              </div>
            )}
          </nav>

          {/* Profile / Logout Section (Mobile) */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
            {isAdmin && (
              <Link
                href="/admin?tab=smtp"
                onClick={closeMobileMenu}
                className="w-full py-3 px-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700/80 text-sm font-bold flex items-center space-x-3 transition-all"
              >
                <Mail className="w-5 h-5 text-emerald-500" />
                <span>Email Settings</span>
              </Link>
            )}
            <form action={logoutAction}>
              <button
                type="submit"
                className="w-full py-3 px-4 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-sm font-bold flex items-center justify-center space-x-2 transition-all shadow-sm"
              >
                <LogOut className="w-5 h-5" />
                <span>Sign Out of Dhanuka GHO</span>
              </button>
            </form>
          </div>

        </div>
      )}
    </header>
  );
}
