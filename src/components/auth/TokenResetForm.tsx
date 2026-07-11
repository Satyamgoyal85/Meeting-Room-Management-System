'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { redeemResetTokenAction } from '@/actions/auth';
import {
  Lock,
  ShieldAlert,
  Loader2,
  CheckCircle2,
  Eye,
  EyeOff,
  ShieldCheck,
  KeyRound,
  ArrowLeft,
  AlertTriangle,
} from 'lucide-react';

interface TokenResetFormProps {
  token: string;
  employeeName?: string;
  initialError?: string;
}

interface StrengthResult {
  score: number; // 0–4
  label: string;
  color: string;
}

function getPasswordStrength(password: string): StrengthResult {
  if (!password) return { score: 0, label: '', color: '' };
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  score = Math.min(score, 4);

  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const colors = ['', 'text-rose-500', 'text-amber-500', 'text-sky-500', 'text-emerald-500'];

  return { score, label: labels[score], color: colors[score] };
}

function getBarColor(score: number): string {
  const barColors = ['', 'bg-rose-500', 'bg-amber-500', 'bg-sky-500', 'bg-emerald-500'];
  return barColors[score] || '';
}

export default function TokenResetForm({ token, employeeName, initialError }: TokenResetFormProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(initialError || null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const strength = getPasswordStrength(newPassword);

  // Client-side validation
  const meetsLength = newPassword.length >= 8;
  const meetsNumber = /\d/.test(newPassword);
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;
  const isValid = meetsLength && meetsNumber;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!meetsLength) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (!meetsNumber) {
      setError('Password must contain at least one number.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please try again.');
      return;
    }

    const formData = new FormData();
    formData.append('token', token);
    formData.append('newPassword', newPassword);
    formData.append('confirmPassword', confirmPassword);

    startTransition(async () => {
      const result = await redeemResetTokenAction(formData);
      if (result?.error) {
        setError(result.error);
      }
      // On success, redeemResetTokenAction calls redirect() server-side
    });
  };

  // If the token was invalid or expired when checked, show error card
  if (initialError) {
    return (
      <div className="w-full max-w-md mx-auto">
        <div className="glass-panel rounded-3xl p-8 shadow-2xl relative overflow-hidden text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 mb-4">
            <AlertTriangle className="w-7 h-7 text-rose-500" />
          </div>
          <h2 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-2">
            Reset Link Invalid or Expired
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
            {initialError}
          </p>
          <button
            type="button"
            onClick={() => router.push('/login')}
            className="w-full py-3 px-4 rounded-xl text-white font-bold text-sm bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 transition-all flex items-center justify-center space-x-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Login</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="glass-panel rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 rounded-full blur-3xl pointer-events-none bg-emerald-500/20" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 rounded-full blur-3xl pointer-events-none bg-sky-500/20" />

        {/* Header */}
        <div className="text-center mb-8 relative z-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mb-4">
            <KeyRound className="w-7 h-7 text-emerald-500" />
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Set New Password
          </h2>
          {employeeName && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-medium leading-relaxed">
              Account: <span className="text-emerald-600 dark:text-emerald-400 font-bold">{employeeName}</span>
            </p>
          )}
        </div>

        {/* Security notice */}
        <div className="mb-6 p-3.5 bg-sky-50 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-900/60 rounded-xl text-xs text-sky-700 dark:text-sky-300 flex items-start space-x-2.5">
          <ShieldCheck className="w-4 h-4 text-sky-500 flex-shrink-0 mt-0.5" />
          <span>
            This reset link is single-use and will expire after use. Enter your new secure password below.
          </span>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-3.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-start space-x-2.5 animate-in fade-in slide-in-from-top-2 duration-200">
            <ShieldAlert className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
          {/* New Password */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
              New Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                required
                autoComplete="new-password"
                className="w-full pl-10 pr-10 py-2.5 bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 transition-all shadow-sm"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Strength meter */}
            {newPassword && (
              <div className="mt-2 space-y-1">
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                        i <= strength.score ? getBarColor(strength.score) : 'bg-slate-200 dark:bg-slate-700'
                      }`}
                    />
                  ))}
                </div>
                <p className={`text-[10px] font-bold ${strength.color}`}>
                  {strength.label}
                </p>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
              Confirm New Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                required
                autoComplete="new-password"
                className={`w-full pl-10 pr-10 py-2.5 bg-white/80 dark:bg-slate-900/80 border rounded-xl text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all shadow-sm ${
                  confirmPassword.length > 0
                    ? passwordsMatch
                      ? 'border-emerald-400 dark:border-emerald-600 focus:ring-emerald-500'
                      : 'border-rose-300 dark:border-rose-700 focus:ring-rose-400'
                    : 'border-slate-200 dark:border-slate-700 focus:ring-emerald-500 dark:focus:ring-emerald-400'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {confirmPassword.length > 0 && (
              <p className={`text-[10px] font-bold mt-1 ${passwordsMatch ? 'text-emerald-600' : 'text-rose-500'}`}>
                {passwordsMatch ? '✓ Passwords match' : '✗ Passwords do not match'}
              </p>
            )}
          </div>

          {/* Requirements checklist */}
          <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 space-y-1.5">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-2">
              Password Requirements
            </span>
            <div className={`flex items-center space-x-2 text-xs ${meetsLength ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
              <CheckCircle2 className={`w-3.5 h-3.5 ${meetsLength ? 'opacity-100' : 'opacity-30'}`} />
              <span>At least 8 characters</span>
            </div>
            <div className={`flex items-center space-x-2 text-xs ${meetsNumber ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
              <CheckCircle2 className={`w-3.5 h-3.5 ${meetsNumber ? 'opacity-100' : 'opacity-30'}`} />
              <span>At least one number</span>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isPending || !isValid || !passwordsMatch}
            className="w-full py-3 px-4 rounded-xl text-white font-bold text-sm shadow-lg flex items-center justify-center space-x-2 transition-all duration-200 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-emerald-500/20 hover:shadow-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-[0.98]"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Updating Password...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Set New Password &amp; Login</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
