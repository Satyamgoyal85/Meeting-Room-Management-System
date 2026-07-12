'use client';

import React, { useState, useTransition } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { loginAction } from '@/actions/auth';
import {
  Lock,
  User,
  ShieldAlert,
  ArrowRight,
  Loader2,
  Sparkles,
  HelpCircle,
  CheckCircle2,
  KeyRound,
  AlertTriangle,
  PhoneCall,
} from 'lucide-react';
import { Role } from '@/lib/types';

export default function LoginForm() {
  const [loginType, setLoginType] = useState<Role>('employee');
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [showDemoHelp, setShowDemoHelp] = useState(false);
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLocked(false);
    setShowForgotPassword(false);

    const formData = new FormData();
    formData.append('employeeId', employeeId);
    formData.append('password', password);
    formData.append('loginType', loginType);

    startTransition(async () => {
      const result = await loginAction(formData);
      if (!result) return; // Redirected — no result returned

      if (result.mustResetPassword) {
        // Employee authenticated but needs to set a new password first
        router.push('/reset-password');
        return;
      }

      if (result.locked) {
        setIsLocked(true);
        setError(result.error || 'Account locked.');
        return;
      }

      if (result.error) {
        setError(result.error);
      }
    });
  };

  const handleDemoFill = (id: string, pass: string, type: Role) => {
    setLoginType(type);
    setEmployeeId(id.replace(/^ECN-|^DAL-/i, ''));
    setPassword(pass);
    setError(null);
    setIsLocked(false);
    setShowForgotPassword(false);
  };

  const isAdmin = loginType === 'admin';

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Main Glass Card */}
      <div className="glass-panel rounded-3xl p-8 shadow-2xl relative overflow-hidden transition-all duration-300">

        {/* Subtle background glow */}
        <div className={`absolute -top-24 -right-24 w-48 h-48 rounded-full blur-3xl pointer-events-none transition-colors duration-500 ${
          isAdmin ? 'bg-purple-500/20' : 'bg-emerald-500/20'
        }`} />
        <div className={`absolute -bottom-24 -left-24 w-48 h-48 rounded-full blur-3xl pointer-events-none transition-colors duration-500 ${
          isAdmin ? 'bg-amber-500/10' : 'bg-sky-500/20'
        }`} />

        {/* Header */}
        <div className="text-center mb-8 relative z-10">
          <Image
            src="/logo.png"
            alt="Dhanuka Agritech Ltd. Logo"
            width={180}
            height={48}
            priority
            className="h-12 w-auto mx-auto object-contain mb-4"
          />

          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            {isAdmin ? 'Administrator Portal' : 'Employee Login'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
            {isAdmin
              ? 'Elevated access for system & booking management'
              : 'Dhanuka Agritech Ltd. • GHO Branch Meeting Rooms'}
          </p>
        </div>

        {/* Account Locked State */}
        {isLocked && (
          <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900/60 rounded-xl animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-start space-x-3 mb-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-amber-800 dark:text-amber-300 mb-1">Account Locked</p>
                <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                  Too many failed login attempts. Your account has been locked for security.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowForgotPassword(!showForgotPassword)}
              className="w-full py-2 px-3 text-xs font-semibold text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40 hover:bg-amber-200 dark:hover:bg-amber-900/60 rounded-lg transition-all border border-amber-200 dark:border-amber-800/60 flex items-center justify-center space-x-1.5"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Forgot Password? Contact Administrator</span>
            </button>

            {showForgotPassword && (
              <div className="mt-3 p-3 bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-800/60 rounded-lg animate-in fade-in duration-200">
                <div className="flex items-start space-x-2">
                  <PhoneCall className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    <p className="font-bold text-slate-800 dark:text-slate-200 mb-1">Contact Your System Administrator</p>
                    <p>
                      Please reach out to your system administrator to request a password reset for your account. 
                      They will provide you with a secure reset link.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error Alert (non-locked errors only) */}
        {error && !isLocked && (
          <div className="mb-6 p-3.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-start space-x-2.5 animate-in fade-in slide-in-from-top-2 duration-200">
            <ShieldAlert className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
              Employee ID Code
            </label>
            <div className="flex rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500 dark:focus-within:ring-emerald-400 transition-all">
              <div className="px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex items-center space-x-1.5 text-slate-600 dark:text-slate-300 font-mono font-bold text-sm select-none">
                <User className="w-4 h-4 text-slate-400" />
                <span>ECN-</span>
              </div>
              <input
                type="text"
                inputMode="numeric"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value.replace(/^ECN-|^DAL-/i, '').replace(/\D/g, ''))}
                placeholder={isAdmin ? '0001' : '1001'}
                required
                disabled={isLocked}
                className="w-full px-4 py-2.5 bg-transparent text-sm font-mono font-semibold placeholder:text-slate-400 focus:outline-none disabled:opacity-50"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                disabled={isLocked}
                className="w-full pl-10 pr-4 py-2.5 bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 transition-all shadow-sm disabled:opacity-50"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isPending || isLocked}
            className={`w-full py-3 px-4 rounded-xl text-white font-bold text-sm shadow-lg flex items-center justify-center space-x-2 transition-all duration-200 ${
              isAdmin
                ? 'bg-gradient-to-r from-purple-700 to-indigo-600 hover:from-purple-800 hover:to-indigo-700 shadow-purple-500/20 hover:shadow-purple-500/30'
                : loginType === 'receptionist'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-blue-500/20 hover:shadow-blue-500/30'
                : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-emerald-500/20 hover:shadow-emerald-500/30'
            } disabled:opacity-70 disabled:cursor-not-allowed transform active:scale-[0.98]`}
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Authenticating...</span>
              </>
            ) : (
              <>
                <span>
                  {isAdmin
                    ? 'Sign In as Admin'
                    : loginType === 'receptionist'
                    ? 'Sign In as Receptionist'
                    : 'Sign In to Dashboard'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Admin / Receptionist / Employee Toggle Link */}
        <div className="mt-8 text-center border-t border-slate-200/60 dark:border-slate-800/60 pt-5 flex items-center justify-center gap-4 text-xs text-slate-400">
          {loginType !== 'admin' && (
            <button
              type="button"
              onClick={() => {
                setLoginType('admin');
                setError(null);
                setIsLocked(false);
                setShowForgotPassword(false);
              }}
              className="hover:text-slate-600 dark:hover:text-slate-300 font-normal transition-colors underline decoration-slate-300 dark:decoration-slate-700 underline-offset-4"
            >
              login as administrator
            </button>
          )}
          {loginType !== 'receptionist' && (
            <button
              type="button"
              onClick={() => {
                setLoginType('receptionist');
                setError(null);
                setIsLocked(false);
                setShowForgotPassword(false);
              }}
              className="hover:text-slate-600 dark:hover:text-slate-300 font-normal transition-colors underline decoration-slate-300 dark:decoration-slate-700 underline-offset-4"
            >
              login as receptionist
            </button>
          )}
          {loginType !== 'employee' && (
            <button
              type="button"
              onClick={() => {
                setLoginType('employee');
                setError(null);
                setIsLocked(false);
                setShowForgotPassword(false);
              }}
              className="hover:text-slate-600 dark:hover:text-slate-300 font-normal transition-colors underline decoration-slate-300 dark:decoration-slate-700 underline-offset-4"
            >
              return to employee login
            </button>
          )}
        </div>
      </div>

      {/* Demo / Testing Credentials Accordion */}
      <div className="mt-6">
        <button
          type="button"
          onClick={() => setShowDemoHelp(!showDemoHelp)}
          className="w-full py-2.5 px-4 bg-white/60 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 flex items-center justify-between hover:bg-white dark:hover:bg-slate-900 transition-all shadow-sm"
        >
          <span className="flex items-center">
            <KeyRound className="w-3.5 h-3.5 mr-2 text-emerald-600 dark:text-emerald-400" />
            Demo / Local Dev Test Credentials
          </span>
          <span className="text-[10px] uppercase font-mono bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-600 dark:text-slate-300">
            {showDemoHelp ? 'Hide' : 'Quick Fill'}
          </span>
        </button>

        {showDemoHelp && (
          <div className="mt-2 p-4 bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-lg space-y-3 animate-in fade-in duration-200">
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Click any account below to auto-fill credentials for instant testing:
            </p>

            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => handleDemoFill('ECN-1001', 'anan1001', 'employee')}
                className="text-left p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 bg-slate-50/50 dark:bg-slate-800/30 transition-all group flex items-center justify-between"
              >
                <div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                    Ananya Verma (IT Dept)
                  </div>
                  <div className="text-[11px] font-mono text-slate-500">ID: ECN-1001 • Pass: anan1001</div>
                </div>
                <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 px-2 py-0.5 rounded">
                  Employee
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleDemoFill('ECN-2001', 'vikr2001', 'employee')}
                className="text-left p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 bg-slate-50/50 dark:bg-slate-800/30 transition-all group flex items-center justify-between"
              >
                <div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                    Vikram Singh (R&D Dept)
                  </div>
                  <div className="text-[11px] font-mono text-slate-500">ID: ECN-2001 • Pass: vikr2001</div>
                </div>
                <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 px-2 py-0.5 rounded">
                  Employee
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleDemoFill('ECN-4001', 'sure4001', 'employee')}
                className="text-left p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 bg-slate-50/50 dark:bg-slate-800/30 transition-all group flex items-center justify-between"
              >
                <div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                    Suresh Kumar (Board Dept)
                  </div>
                  <div className="text-[11px] font-mono text-slate-500">ID: ECN-4001 • Pass: sure4001</div>
                </div>
                <span className="text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 px-2 py-0.5 rounded">
                  Board Access
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleDemoFill('ECN-0001', 'raje0001', 'admin')}
                className="text-left p-2.5 rounded-xl border border-purple-200 dark:border-purple-800/60 hover:border-purple-500 dark:hover:border-purple-400 bg-purple-50/30 dark:bg-purple-950/20 transition-all group flex items-center justify-between"
              >
                <div>
                  <div className="text-xs font-bold text-purple-900 dark:text-purple-300 group-hover:text-purple-700 dark:group-hover:text-purple-200">
                    Rajesh Sharma (Admin Account)
                  </div>
                  <div className="text-[11px] font-mono text-slate-500">ID: ECN-0001 • Pass: raje0001</div>
                </div>
                <span className="text-[10px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 px-2 py-0.5 rounded">
                  Admin
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleDemoFill('ECN-9000', 'rece9000', 'receptionist')}
                className="text-left p-2.5 rounded-xl border border-blue-200 dark:border-blue-800/60 hover:border-blue-500 dark:hover:border-blue-400 bg-blue-50/30 dark:bg-blue-950/20 transition-all group flex items-center justify-between"
              >
                <div>
                  <div className="text-xs font-bold text-blue-900 dark:text-blue-300 group-hover:text-blue-700 dark:group-hover:text-blue-200">
                    Reception Desk (Receptionist Account)
                  </div>
                  <div className="text-[11px] font-mono text-slate-500">ID: ECN-9000 • Pass: rece9000</div>
                </div>
                <span className="text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 px-2 py-0.5 rounded">
                  Receptionist
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
