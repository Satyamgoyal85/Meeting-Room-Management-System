'use client';

import React, { useState, useTransition } from 'react';
import { Room } from '@/lib/types';
import { createBookingAction, BookingResult, getActualServerIstTimeAction, getEmployeesForBookingAction, EmployeeSearchItem } from '@/actions/bookings';
import InviteAttendeesInput from './InviteAttendeesInput';
import { 
  X, 
  Calendar as CalendarIcon, 
  Clock, 
  Users, 
  FileText, 
  Repeat, 
  AlertTriangle, 
  CheckCircle2, 
  Loader2, 
  Sparkles, 
  ArrowRight,
  ShieldAlert,
  Info,
  Search
} from 'lucide-react';
import { format, addMonths } from 'date-fns';
import { isIstTimeInPast, getIstDateStr } from '@/lib/timezone';

interface BookingModalProps {
  room: Room | null;
  initialDateStr: string;
  currentUserRole?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

// Generate 15-minute interval time options from 08:00 to 20:00
function generateTimeOptions(): string[] {
  const times: string[] = [];
  for (let hour = 8; hour <= 20; hour++) {
    for (let min = 0; min < 60; min += 15) {
      if (hour === 20 && min > 0) break; // End at 20:00
      const hStr = hour.toString().padStart(2, '0');
      const mStr = min.toString().padStart(2, '0');
      times.push(`${hStr}:${mStr}`);
    }
  }
  return times;
}

const TIME_OPTIONS = generateTimeOptions();

export default function BookingModal({
  room,
  initialDateStr,
  currentUserRole,
  onClose,
  onSuccess,
}: BookingModalProps) {
  const [dateStr, setDateStr] = useState(initialDateStr || getIstDateStr());
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('11:00');
  const [attendeesCount, setAttendeesCount] = useState(4);
  const [agenda, setAgenda] = useState('');
  
  // Recurring state
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringFreq, setRecurringFreq] = useState<'weekly' | 'daily' | 'monthly'>('weekly');
  const [recurringCount, setRecurringCount] = useState(4);
  const [conflictStrategy, setConflictStrategy] = useState<'skip' | 'fail'>('skip');

  // Submit & Result state
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BookingResult | null>(null);

  const [serverTimeMs, setServerTimeMs] = useState<number>(Date.now());
  const [minDateStr, setMinDateStr] = useState<string>(getIstDateStr());

  // Admin Book For state
  const [employeesList, setEmployeesList] = useState<EmployeeSearchItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeSearchItem | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Invite Attendees state
  const [inviteeIds, setInviteeIds] = useState<string[]>([]);

  React.useEffect(() => {
    getActualServerIstTimeAction().then((res) => {
      setServerTimeMs(res.serverTimeMs);
      setMinDateStr(res.istDateStr);
    });
  }, []);

  React.useEffect(() => {
    if (currentUserRole === 'admin' && room) {
      getEmployeesForBookingAction().then((list) => {
        setEmployeesList(list);
      });
    }
  }, [currentUserRole, room]);

  const filteredEmployees = React.useMemo(() => {
    if (!searchQuery.trim()) return employeesList;
    const q = searchQuery.toLowerCase();
    return employeesList.filter(e => 
      e.name.toLowerCase().includes(q) || 
      e.employee_id.toLowerCase().includes(q)
    );
  }, [employeesList, searchQuery]);

  React.useEffect(() => {
    if (isIstTimeInPast(dateStr, startTime, serverTimeMs)) {
      const firstAvailable = TIME_OPTIONS.find(t => !isIstTimeInPast(dateStr, t, serverTimeMs));
      if (firstAvailable) {
        setStartTime(firstAvailable);
        const startIdx = TIME_OPTIONS.indexOf(firstAvailable);
        if (startIdx !== -1 && startIdx + 4 < TIME_OPTIONS.length) {
          setEndTime(TIME_OPTIONS[startIdx + 4]);
        } else if (startIdx !== -1 && startIdx + 1 < TIME_OPTIONS.length) {
          setEndTime(TIME_OPTIONS[startIdx + 1]);
        }
      }
    }
  }, [dateStr, serverTimeMs]);

  if (!room) return null;

  const maxDateStr = format(addMonths(new Date(), 3), 'yyyy-MM-dd');
  const isOverCapacity = attendeesCount > room.capacity;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (startTime >= endTime) {
      setError('End time must be later than start time.');
      return;
    }

    if (isOverCapacity) {
      setError(`Attendee count (${attendeesCount}) exceeds ${room.name}'s maximum capacity of ${room.capacity} seats.`);
      return;
    }

    const formData = new FormData();
    formData.append('roomId', room.id);
    formData.append('dateStr', dateStr);
    formData.append('startTime', startTime);
    formData.append('endTime', endTime);
    formData.append('agenda', agenda.trim() || 'General');
    formData.append('attendeesCount', attendeesCount.toString());
    formData.append('isRecurring', isRecurring ? 'true' : 'false');
    formData.append('recurringFreq', recurringFreq);
    formData.append('recurringCount', recurringCount.toString());
    formData.append('conflictStrategy', conflictStrategy);

    if (currentUserRole === 'admin' && selectedEmployee) {
      formData.append('bookForEmployeeId', selectedEmployee.id);
      formData.append('bookForDepartmentId', selectedEmployee.department_id || '');
    }

    // Invite attendees
    if (inviteeIds.length > 0) {
      formData.append('inviteeIds', JSON.stringify(inviteeIds));
    }

    startTransition(async () => {
      const res = await createBookingAction(formData);
      if (res.error) {
        setError(res.error);
      } else if (res.success) {
        setResult(res);
        if (onSuccess) onSuccess();
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-900 via-slate-900 to-teal-950 text-white p-6 relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-6 right-6 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 mb-3">
            <Sparkles className="w-3.5 h-3.5 mr-1.5" />
            New Room Reservation
          </div>

          <h2 className="text-2xl font-extrabold tracking-tight">
            Reserve {room.name}
          </h2>

          <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-slate-300 font-medium">
            <span className="bg-white/10 px-2 py-0.5 rounded text-white">{room.floor}</span>
            <span>•</span>
            <span className="font-mono font-bold text-emerald-400">Max Capacity: {room.capacity} seats</span>
            <span>•</span>
            <span className="text-slate-300">{room.amenities.join(', ')}</span>
          </div>
        </div>

        {/* Body: Success Screen OR Booking Form */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {result?.success ? (
            <div className="py-8 text-center space-y-6 animate-in zoom-in-95 duration-300">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div>
                <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white">
                  Reservation Confirmed!
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 max-w-md mx-auto font-medium">
                  {result.message}
                </p>
              </div>

              {/* Skipped dates alert if any conflicts occurred */}
              {result.skippedDates && result.skippedDates.length > 0 && (
                <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 rounded-2xl text-left max-w-lg mx-auto space-y-2">
                  <div className="flex items-center space-x-2 text-xs font-bold text-amber-900 dark:text-amber-200">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>Skipped Dates (Existing Booking Conflicts):</span>
                  </div>
                  <ul className="list-disc list-inside text-xs text-amber-800 dark:text-amber-300 space-y-1 font-mono max-h-32 overflow-y-auto pl-1">
                    {result.skippedDates.map((skipped, idx) => (
                      <li key={idx}>{skipped}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="pt-4 flex justify-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-8 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all"
                >
                  Return to Dashboard
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Error Alert */}
              {error && (
                <div className="p-3.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-start space-x-2.5 animate-in fade-in">
                  <ShieldAlert className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Admin Book For Section */}
              {currentUserRole === 'admin' && (
                <div className="bg-purple-50 dark:bg-purple-950/40 p-4 rounded-2xl border border-purple-200 dark:border-purple-800/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-purple-900 dark:text-purple-300 flex items-center">
                      <Users className="w-3.5 h-3.5 mr-1.5 text-purple-600 dark:text-purple-400" />
                      Book On Behalf Of Employee (Admin Only)
                    </label>
                    {selectedEmployee && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedEmployee(null);
                          setSearchQuery('');
                        }}
                        className="text-xs text-purple-600 dark:text-purple-400 hover:underline font-semibold"
                      >
                        Reset to Myself
                      </button>
                    )}
                  </div>

                  {!selectedEmployee ? (
                    <div className="relative">
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Type employee name or ID (e.g., 'ra' or 'ECN-1001')..."
                          value={searchQuery}
                          onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setIsDropdownOpen(true);
                          }}
                          onFocus={() => setIsDropdownOpen(true)}
                          onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
                          className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-purple-300 dark:border-purple-700/60 rounded-xl text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-sm transition-all"
                        />
                        <Search className="w-4 h-4 text-purple-500 absolute left-3 top-3 pointer-events-none" />
                      </div>

                      {/* Autocomplete Dropdown */}
                      {isDropdownOpen && (
                        <div className="absolute left-0 right-0 top-full mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80">
                          {filteredEmployees.length === 0 ? (
                            <div className="p-3 text-xs text-slate-500 dark:text-slate-400 text-center">
                              No matching employees found.
                            </div>
                          ) : (
                            filteredEmployees.map((emp) => (
                              <button
                                key={emp.id}
                                type="button"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  setSelectedEmployee(emp);
                                  setIsDropdownOpen(false);
                                  setSearchQuery('');
                                }}
                                className="w-full text-left px-3.5 py-2.5 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors flex items-center justify-between"
                              >
                                <span className="font-bold text-sm text-slate-900 dark:text-white">
                                  {emp.name} — {emp.employee_id} — {emp.department_name}
                                </span>
                                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 ml-2">
                                  Select
                                </span>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                      <p className="text-xs text-purple-700 dark:text-purple-300/80 mt-1.5">
                        Leave empty to book for yourself (Admin default).
                      </p>
                    </div>
                  ) : (
                    <div className="bg-purple-100 dark:bg-purple-900/50 p-3 rounded-xl border border-purple-300 dark:border-purple-700 flex items-center justify-between animate-in fade-in duration-200">
                      <div>
                        <div className="text-xs font-bold text-purple-900 dark:text-purple-200">
                          Selected: {selectedEmployee.name}
                        </div>
                        <div className="text-[11px] text-purple-700 dark:text-purple-300 mt-1 flex flex-wrap items-center gap-2">
                          <span className="bg-white dark:bg-slate-900 px-2 py-0.5 rounded font-mono border border-purple-200 dark:border-purple-800 font-bold">
                            Auto-filled ID: {selectedEmployee.employee_id}
                          </span>
                          <span className="bg-white dark:bg-slate-900 px-2 py-0.5 rounded font-semibold border border-purple-200 dark:border-purple-800">
                            Auto-filled Dept: {selectedEmployee.department_name}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedEmployee(null);
                          setSearchQuery('');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 text-purple-700 dark:text-purple-300 text-xs font-bold shadow-sm hover:bg-purple-50 transition-colors whitespace-nowrap ml-2"
                      >
                        Change
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* 1. Date & Time Selection */}
              <div className="space-y-3 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/60">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center">
                  <Clock className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                  1. Select Date & 15-Minute Time Slot
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">Date</label>
                    <input
                      type="date"
                      value={dateStr}
                      min={minDateStr}
                      max={maxDateStr}
                      onChange={(e) => setDateStr(e.target.value)}
                      required
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">Start Time</label>
                    <select
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      required
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-emerald-500"
                    >
                      {TIME_OPTIONS.map((t) => {
                        const isPast = isIstTimeInPast(dateStr, t, serverTimeMs);
                        return (
                          <option key={`start-${t}`} value={t} disabled={isPast}>
                            {t}{isPast ? ' (Past)' : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">End Time</label>
                    <select
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      required
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-emerald-500"
                    >
                      {TIME_OPTIONS.map((t) => {
                        const isPast = isIstTimeInPast(dateStr, t, serverTimeMs);
                        return (
                          <option key={`end-${t}`} value={t} disabled={isPast || t <= startTime}>
                            {t}{isPast ? ' (Past)' : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>
              </div>

              {/* 2. Attendees Count & Capacity Validation */}
              <div className="space-y-3 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/60">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center">
                    <Users className="w-3.5 h-3.5 mr-1.5 text-sky-600" />
                    2. Expected Attendees Count
                  </div>
                  <span className="text-[11px] font-mono font-semibold text-slate-500">
                    Max: {room.capacity} seats
                  </span>
                </div>

                <div className="flex items-center space-x-4">
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={attendeesCount}
                    onChange={(e) => setAttendeesCount(Number(e.target.value))}
                    required
                    className={`w-32 px-3.5 py-2 bg-white dark:bg-slate-900 border rounded-xl text-sm font-mono font-bold focus:outline-none focus:ring-2 transition-all ${
                      isOverCapacity 
                        ? 'border-rose-500 text-rose-600 focus:ring-rose-500 bg-rose-50/50 dark:bg-rose-950/20' 
                        : 'border-slate-200 dark:border-slate-700 focus:ring-sky-500'
                    }`}
                  />
                  
                  {isOverCapacity ? (
                    <div className="text-xs text-rose-600 dark:text-rose-400 font-semibold flex items-center space-x-1.5">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      <span>Warning: Exceeds room capacity by {attendeesCount - room.capacity} seats!</span>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-500">
                      We check this against capacity to ensure fire & safety compliance.
                    </span>
                  )}
                </div>
              </div>

              {/* 2b. Invite Attendees (Optional) */}
              <div className="space-y-2 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/60">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center">
                    <Users className="w-3.5 h-3.5 mr-1.5 text-indigo-500" />
                    Invite Employees / Departments
                  </label>
                  <span className="text-[10px] font-bold uppercase bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded">
                    Optional
                  </span>
                </div>
                <InviteAttendeesInput
                  onChange={setInviteeIds}
                />
                <p className="text-[10px] text-slate-400 dark:text-slate-500">
                  Invited people will see this meeting in their calendar, including the agenda.
                  Remove individual chips above to exclude specific members when inviting a department.
                </p>
              </div>

              {/* 3. Meeting Agenda / Purpose */}
              <div className="space-y-2 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/60">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center">
                    <FileText className="w-3.5 h-3.5 mr-1.5 text-purple-600" />
                    3. Meeting Agenda / Purpose (Optional)
                  </label>
                  <span className="text-[10px] font-bold uppercase bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded">
                    Optional
                  </span>
                </div>

                <textarea
                  rows={2}
                  value={agenda}
                  onChange={(e) => setAgenda(e.target.value)}
                  placeholder="e.g., Q3 Tech Roadmap Review & Budget Allocation (Defaults to 'General' if left blank)..."
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                />
                <p className="text-[11px] text-slate-400">
                  Note: Agenda text will be masked from general employees on the public timeline per security rules.
                </p>
              </div>

              {/* 4. Recurring Booking Options */}
              <div className="space-y-3 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/60 transition-all">
                <div className="flex items-center justify-between">
                  <label className="flex items-center space-x-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isRecurring}
                      onChange={(e) => setIsRecurring(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center">
                      <Repeat className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                      4. Make This a Recurring Reservation?
                    </span>
                  </label>
                  <span className="text-[10px] font-mono text-slate-400">Max 3 Months Out</span>
                </div>

                {isRecurring && (
                  <div className="pt-3 border-t border-slate-200/80 dark:border-slate-700/80 space-y-4 animate-in fade-in duration-200">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 mb-1">Repeat Frequency</label>
                        <select
                          value={recurringFreq}
                          onChange={(e) => setRecurringFreq(e.target.value as any)}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                        >
                          <option value="weekly">Weekly (Same day of week)</option>
                          <option value="daily">Daily (Every consecutive day)</option>
                          <option value="monthly">Monthly (Same date each month)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 mb-1">Total Occurrences (Max 24)</label>
                        <input
                          type="number"
                          min={2}
                          max={24}
                          value={recurringCount}
                          onChange={(e) => setRecurringCount(Number(e.target.value))}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold"
                        />
                      </div>
                    </div>

                    {/* Conflict Handling Strategy Toggle */}
                    <div className="space-y-2 pt-1">
                      <span className="block text-[11px] font-bold text-slate-600 dark:text-slate-300">
                        Conflict Resolution Strategy (If any date is already booked):
                      </span>
                      
                      <div className="space-y-1.5">
                        <label className="flex items-start space-x-2.5 p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 cursor-pointer">
                          <input
                            type="radio"
                            name="conflictStrategy"
                            value="skip"
                            checked={conflictStrategy === 'skip'}
                            onChange={() => setConflictStrategy('skip')}
                            className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                          />
                          <div className="text-xs">
                            <span className="font-bold text-slate-800 dark:text-slate-200 block">
                              ⚡ Skip conflicting dates & book open slots (Recommended)
                            </span>
                            <span className="text-slate-500 text-[11px]">
                              Automatically reserves all available dates in the series and lists any skipped dates.
                            </span>
                          </div>
                        </label>

                        <label className="flex items-start space-x-2.5 p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 cursor-pointer">
                          <input
                            type="radio"
                            name="conflictStrategy"
                            value="fail"
                            checked={conflictStrategy === 'fail'}
                            onChange={() => setConflictStrategy('fail')}
                            className="mt-0.5 text-rose-600 focus:ring-rose-500"
                          />
                          <div className="text-xs">
                            <span className="font-bold text-slate-800 dark:text-slate-200 block">
                              🛑 Fail entire series if any date has a conflict
                            </span>
                            <span className="text-slate-500 text-[11px]">
                              Strict all-or-nothing mode. Aborts without booking if even one session is blocked.
                            </span>
                          </div>
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer Actions */}
              <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition-all"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isPending || isOverCapacity}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 flex items-center space-x-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Verifying Conflicts...</span>
                    </>
                  ) : (
                    <>
                      <span>Confirm Reservation</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

            </form>
          )}
        </div>

      </div>
    </div>
  );
}
