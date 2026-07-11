import React from 'react';
import LoginForm from '@/components/auth/LoginForm';
import { Building2, Sparkles } from 'lucide-react';

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 flex flex-col justify-between p-4 sm:p-6 lg:p-8 relative overflow-hidden">
      
      {/* Decorative ambient background lights */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header / Branding */}
      <div className="max-w-7xl w-full mx-auto flex items-center justify-between relative z-10">
        <div className="flex items-center space-x-3.5">
          <img 
            src="/logo.png" 
            alt="Dhanuka Agritech Ltd. Logo" 
            className="h-8 sm:h-11 w-auto object-contain shrink-0 bg-white px-2 py-1 rounded-xl shadow-md" 
          />
          <div>
            <span className="font-bold text-lg text-white tracking-tight">
              Dhanuka Agritech Ltd.
            </span>
            <span className="text-xs block text-emerald-400 font-medium">
              GHO Branch • Meeting Room Portal
            </span>
          </div>
        </div>

        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-white/10 text-emerald-300 border border-white/10 backdrop-blur-md">
          <Sparkles className="w-3.5 h-3.5 mr-1.5" />
          Secure Login
        </span>
      </div>

      {/* Center Form Container */}
      <div className="my-auto py-12 relative z-10">
        <LoginForm />
      </div>

      {/* Footer */}
      <div className="max-w-7xl w-full mx-auto text-center text-xs text-slate-400 relative z-10">
        <p>
          &copy; {new Date().getFullYear()} Dhanuka Agritech Ltd. All rights reserved. • Authorized Personnel Only
        </p>
      </div>
    </div>
  );
}
