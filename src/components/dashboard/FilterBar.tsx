'use client';

import React from 'react';
import { 
  Filter, 
  Users, 
  Calendar as CalendarIcon, 
  Clock, 
  Sparkles, 
  X, 
  Check, 
  RotateCcw
} from 'lucide-react';
import { format } from 'date-fns';
import { getIstDateStr } from '@/lib/timezone';

export interface FilterState {
  minCapacity: number;
  amenities: string[];
  dateStr: string;
  isRightNow: boolean;
  startTime: string; // e.g. "10:00"
  endTime: string;   // e.g. "11:30"
  searchQuery: string;
}

interface FilterBarProps {
  filters: FilterState;
  onFilterChange: (newFilters: FilterState) => void;
  availableAmenities: string[];
  totalRoomsCount: number;
  filteredRoomsCount: number;
}

export default function FilterBar({
  filters,
  onFilterChange,
  availableAmenities,
  totalRoomsCount,
  filteredRoomsCount,
}: FilterBarProps) {

  const handleCapacityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFilterChange({ ...filters, minCapacity: Number(e.target.value) });
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({ ...filters, dateStr: e.target.value });
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({ ...filters, searchQuery: e.target.value });
  };

  const toggleAmenity = (amenity: string) => {
    const exists = filters.amenities.includes(amenity);
    const updated = exists
      ? filters.amenities.filter(a => a !== amenity)
      : [...filters.amenities, amenity];
    onFilterChange({ ...filters, amenities: updated });
  };

  const toggleRightNow = (isRightNow: boolean) => {
    onFilterChange({ ...filters, isRightNow });
  };

  const handleTimeChange = (field: 'startTime' | 'endTime', value: string) => {
    onFilterChange({
      ...filters,
      isRightNow: false,
      [field]: value,
    });
  };

  const resetFilters = () => {
    onFilterChange({
      minCapacity: 0,
      amenities: [],
      dateStr: getIstDateStr(),
      isRightNow: true,
      startTime: '10:00',
      endTime: '11:00',
      searchQuery: '',
    });
  };

  const hasActiveFilters = 
    filters.minCapacity > 0 || 
    filters.amenities.length > 0 || 
    !filters.isRightNow || 
    filters.searchQuery !== '' || 
    filters.dateStr !== getIstDateStr();

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
      
      {/* Top Bar: Count & Search & Reset */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <span className="text-sm font-bold text-slate-900 dark:text-white">
            Showing <span className="text-emerald-600 dark:text-emerald-400">{filteredRoomsCount}</span> of {totalRoomsCount} Rooms
          </span>
        </div>

        <div className="flex items-center space-x-3 w-full md:w-auto">
          {/* Search Input */}
          <input
            type="text"
            placeholder="Search room name or floor..."
            value={filters.searchQuery}
            onChange={handleSearchChange}
            className="w-full md:w-64 px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
          />

          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              title="Reset Filters"
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold flex items-center space-x-1 transition-colors whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Filter Controls Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-12 gap-6">
        
        {/* 1. Date & Time Mode Selector (Span 5) */}
        <div className="lg:col-span-5 space-y-2.5 bg-slate-50/70 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/60">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center justify-between">
            <span className="flex items-center">
              <Clock className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
              Check Availability For
            </span>
            <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
              {filters.isRightNow ? 'Live Real-Time' : 'Future Time Slot'}
            </span>
          </label>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => toggleRightNow(true)}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                filters.isRightNow
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
              }`}
            >
              ⚡ Right Now (Live)
            </button>
            <button
              type="button"
              onClick={() => toggleRightNow(false)}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                !filters.isRightNow
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
              }`}
            >
              📅 Specific Slot
            </button>
          </div>

          {!filters.isRightNow && (
            <div className="grid grid-cols-3 gap-2 pt-2 animate-in fade-in duration-200">
              <div>
                <span className="block text-[10px] font-semibold text-slate-500 mb-1">Date</span>
                <input
                  type="date"
                  value={filters.dateStr}
                  min={getIstDateStr()}
                  onChange={handleDateChange}
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <span className="block text-[10px] font-semibold text-slate-500 mb-1">Start Time</span>
                <input
                  type="time"
                  value={filters.startTime}
                  onChange={(e) => handleTimeChange('startTime', e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <span className="block text-[10px] font-semibold text-slate-500 mb-1">End Time</span>
                <input
                  type="time"
                  value={filters.endTime}
                  onChange={(e) => handleTimeChange('endTime', e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* 2. Minimum Capacity Needed (Span 3) */}
        <div className="lg:col-span-3 space-y-2.5 bg-slate-50/70 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 flex flex-col justify-between">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center">
            <Users className="w-3.5 h-3.5 mr-1.5 text-sky-600" />
            Min Capacity Needed
          </label>
          
          <select
            value={filters.minCapacity}
            onChange={handleCapacityChange}
            className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-sm"
          >
            <option value={0}>All Room Sizes (4 to 20 seats)</option>
            <option value={4}>4+ Seats (Small Discussion)</option>
            <option value={6}>6+ Seats (Team Meeting)</option>
            <option value={8}>8+ Seats (Department Sync)</option>
            <option value={10}>10+ Seats (Large Conference)</option>
            <option value={12}>12+ Seats (Executive Presentation)</option>
            <option value={15}>15+ Seats (Major Briefing)</option>
            <option value={20}>20+ Seats (Board / Townhall)</option>
          </select>
          
          <span className="text-[10px] text-slate-400 font-medium">
            Filters out rooms smaller than selected seats
          </span>
        </div>

        {/* 3. Required Amenities Pill Tags (Span 4) */}
        <div className="lg:col-span-4 space-y-2.5 bg-slate-50/70 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/60">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center justify-between">
            <span className="flex items-center">
              <Sparkles className="w-3.5 h-3.5 mr-1.5 text-purple-600" />
              Required Amenities
            </span>
            {filters.amenities.length > 0 && (
              <span className="text-[10px] bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 px-1.5 py-0.5 rounded font-bold">
                {filters.amenities.length} Selected
              </span>
            )}
          </label>

          <div className="flex flex-wrap gap-1.5 max-h-[82px] overflow-y-auto pr-1">
            {availableAmenities.map((amenity) => {
              const isSelected = filters.amenities.includes(amenity);
              return (
                <button
                  key={amenity}
                  type="button"
                  onClick={() => toggleAmenity(amenity)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center space-x-1 transition-all ${
                    isSelected
                      ? 'bg-purple-600 text-white shadow-sm shadow-purple-500/20 scale-95'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:border-purple-300'
                  }`}
                >
                  {isSelected && <Check className="w-3 h-3 mr-1" />}
                  <span>{amenity}</span>
                </button>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
