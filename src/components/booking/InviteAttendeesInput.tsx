'use client';

import React, { useState, useEffect, useRef, useTransition, useCallback } from 'react';
import { X, Users, Building2, Search, UserPlus, Loader2 } from 'lucide-react';
import { InviteeSuggestion, getInviteeSuggestionsAction, getDepartmentEmployeesAction } from '@/actions/bookings';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface InviteeChip {
  /** employee UUID */
  id: string;
  label: string;
  subLabel: string;
  employeeCode?: string;
  /** Whether this chip came from a department expansion */
  fromDeptId?: string;
}

interface InviteAttendeesInputProps {
  /** Called whenever the selected list changes — always emits flat employee UUID array */
  onChange: (employeeIds: string[]) => void;
  /** IDs to exclude from suggestions (e.g. the organizer) */
  excludeSelfId?: string;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function InviteAttendeesInput({ onChange, excludeSelfId }: InviteAttendeesInputProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<InviteeSuggestion[]>([]);
  const [chips, setChips] = useState<InviteeChip[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Close dropdown on outside click ─────────────────────────────────────────
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Debounced search ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }
    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        const results = await getInviteeSuggestionsAction(query.trim());
        // Filter out already-selected employees
        const selectedIds = new Set(chips.map(c => c.id));
        const filtered = results.filter(r => {
          if (r.type === 'employee') return !selectedIds.has(r.id);
          return true; // always show departments (chips come from expansion)
        });
        setSuggestions(filtered);
        setIsOpen(filtered.length > 0);
      });
    }, 200);
  }, [query, chips]);

  // ── Emit changes to parent ───────────────────────────────────────────────────
  useEffect(() => {
    onChange(chips.map(c => c.id));
  }, [chips, onChange]);

  // ── Add an employee chip ─────────────────────────────────────────────────────
  function addEmployeeChip(s: InviteeSuggestion, fromDeptId?: string) {
    setChips(prev => {
      if (prev.some(c => c.id === s.id)) return prev; // already selected
      return [...prev, {
        id: s.id,
        label: s.label,
        subLabel: s.subLabel,
        employeeCode: s.employee_code,
        fromDeptId,
      }];
    });
  }

  // ── Add a department (expands to employees via a separate search fetch) ──────
  function addDepartmentChip(s: InviteeSuggestion) {
    if (!s.department_id) return;
    startTransition(async () => {
      const deptMembers = await getDepartmentEmployeesAction(s.department_id!);
      setChips(prev => {
        const existing = new Set(prev.map(c => c.id));
        const toAdd = deptMembers
          .filter(m => !existing.has(m.id))
          .map(m => ({
            id: m.id,
            label: m.label,
            subLabel: m.subLabel,
            employeeCode: m.employee_code,
            fromDeptId: s.department_id,
          }));
        return [...prev, ...toAdd];
      });
    });
    setQuery('');
    setIsOpen(false);
  }

  function handleSelect(s: InviteeSuggestion) {
    if (s.type === 'employee') {
      addEmployeeChip(s);
    } else {
      addDepartmentChip(s);
    }
    setQuery('');
    setIsOpen(false);
    inputRef.current?.focus();
  }

  function removeChip(id: string) {
    setChips(prev => prev.filter(c => c.id !== id));
  }

  const employeeSuggestions = suggestions.filter(s => s.type === 'employee');
  const deptSuggestions = suggestions.filter(s => s.type === 'department');

  return (
    <div ref={containerRef} className="relative">

      {/* ── Input row ── */}
      <div
        className={`flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border rounded-xl transition-all ${
          isOpen || document.activeElement === inputRef.current
            ? 'border-emerald-500 ring-2 ring-emerald-500/20'
            : 'border-slate-200 dark:border-slate-700'
        }`}
      >
        <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => query.trim().length >= 2 && suggestions.length > 0 && setIsOpen(true)}
          placeholder="Search by name, code, or department…"
          className="flex-1 bg-transparent text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 outline-none"
        />
        {isPending && <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin shrink-0" />}
      </div>

      {/* ── Dropdown ── */}
      {isOpen && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">

          {/* Employees section */}
          {employeeSuggestions.length > 0 && (
            <div>
              <div className="px-3 pt-2 pb-1">
                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 flex items-center gap-1">
                  <Users className="w-3 h-3" /> Employees
                </span>
              </div>
              {employeeSuggestions.map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleSelect(s)}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left"
                >
                  <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0 text-[10px] font-bold">
                    {s.label.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">{s.label}</div>
                    <div className="text-[10px] text-slate-400 truncate">
                      {s.employee_code} · {s.subLabel}
                    </div>
                  </div>
                  <UserPlus className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 ml-auto shrink-0" />
                </button>
              ))}
            </div>
          )}

          {/* Departments section */}
          {deptSuggestions.length > 0 && (
            <div className={employeeSuggestions.length > 0 ? 'border-t border-slate-100 dark:border-slate-800' : ''}>
              <div className="px-3 pt-2 pb-1">
                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 flex items-center gap-1">
                  <Building2 className="w-3 h-3" /> Invite Whole Department
                </span>
              </div>
              {deptSuggestions.map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleSelect(s)}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors text-left"
                >
                  <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                    <Building2 className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-900 dark:text-white">{s.label}</div>
                    <div className="text-[10px] text-indigo-500 dark:text-indigo-400">{s.subLabel} · Add all members as chips</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Selected chips ── */}
      {chips.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {chips.map(chip => (
            <span
              key={chip.id}
              className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700 rounded-full text-[10px] font-semibold"
            >
              <span className="max-w-[120px] truncate" title={`${chip.label} — ${chip.subLabel}`}>
                {chip.label}
              </span>
              <span className="text-emerald-400 dark:text-emerald-600 opacity-70 font-normal shrink-0">
                {chip.subLabel}
              </span>
              <button
                type="button"
                onClick={() => removeChip(chip.id)}
                className="ml-0.5 w-3.5 h-3.5 rounded-full hover:bg-emerald-200 dark:hover:bg-emerald-800 flex items-center justify-center transition-colors"
                title={`Remove ${chip.label}`}
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={() => setChips([])}
            className="text-[10px] font-medium text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 transition-colors px-1"
          >
            Clear all
          </button>
        </div>
      )}

      {chips.length > 0 && (
        <p className="mt-1.5 text-[10px] text-slate-400 dark:text-slate-500">
          {chips.length} invitee{chips.length !== 1 ? 's' : ''} selected · Remove individual chips above to exclude someone
        </p>
      )}
    </div>
  );
}
