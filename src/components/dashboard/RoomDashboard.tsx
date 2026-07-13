'use client';

import React, { useState, useTransition } from 'react';
import { DashboardData, getDashboardData } from '@/actions/rooms';
import FilterBar, { FilterState } from '@/components/dashboard/FilterBar';
import RoomCard from '@/components/dashboard/RoomCard';
import RoomTimelineModal from '@/components/dashboard/RoomTimelineModal';
import BookingModal from '@/components/booking/BookingModal';
import { Room } from '@/lib/types';
import { 
  Building2, 
  Calendar, 
  Loader2, 
  AlertTriangle
} from 'lucide-react';
import { format } from 'date-fns';
import { getIstDateStr } from '@/lib/timezone';

interface RoomDashboardProps {
  initialData: DashboardData;
}

export default function RoomDashboard({ initialData }: RoomDashboardProps) {
  const [data, setData] = useState<DashboardData>(initialData);
  const [isPending, startTransition] = useTransition();
  const [selectedTimelineRoom, setSelectedTimelineRoom] = useState<Room | null>(null);
  const [selectedBookingRoom, setSelectedBookingRoom] = useState<Room | null>(null);

  // Filter state
  const [filters, setFilters] = useState<FilterState>({
    minCapacity: 0,
    amenities: [],
    dateStr: getIstDateStr(),
    isRightNow: true,
    startTime: '10:00',
    endTime: '11:00',
    searchQuery: '',
  });

  // Extract all unique amenities from master list or across rooms for the filter chips
  const allAmenities = data.amenities && data.amenities.length > 0
    ? data.amenities.map((a) => a.name)
    : Array.from(new Set(data.rooms.flatMap((r) => r.amenities))).sort();

  const handleFilterChange = (newFilters: FilterState) => {
    const dateChanged = newFilters.dateStr !== filters.dateStr;
    setFilters(newFilters);

    if (dateChanged) {
      startTransition(async () => {
        const freshData = await getDashboardData(newFilters.dateStr);
        setData(freshData);
      });
    }
  };

  // Refresh data after successful booking
  const refreshData = () => {
    startTransition(async () => {
      const newData = await getDashboardData(filters.dateStr);
      setData(newData);
    });
  };

  // Filter rooms
  const filteredRooms = data.rooms.filter((room) => {
    // 1. Search Query
    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      const matchName = room.name.toLowerCase().includes(q);
      const matchFloor = room.floor.toLowerCase().includes(q);
      const matchExt = room.extension_no ? room.extension_no.toLowerCase().includes(q) : false;
      if (!matchName && !matchFloor && !matchExt) return false;
    }

    // 2. Min Capacity
    if (filters.minCapacity > 0 && room.capacity < filters.minCapacity) {
      return false;
    }

    // 3. Required Amenities
    if (filters.amenities.length > 0) {
      const hasAll = filters.amenities.every((a) =>
        room.amenities.includes(a)
      );
      if (!hasAll) return false;
    }

    return true;
  });

  const handleBookRoomClick = (room: Room) => {
    setSelectedBookingRoom(room);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
          Meeting Rooms
        </h1>
      </div>

      {/* Filter Bar Component */}
      <div className="relative">
        {isPending && (
          <div className="absolute inset-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-[1px] z-10 rounded-3xl flex items-center justify-center">
            <div className="flex items-center space-x-2 bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
              <span>Updating date schedule...</span>
            </div>
          </div>
        )}
        <FilterBar
          filters={filters}
          onFilterChange={handleFilterChange}
          availableAmenities={allAmenities}
          totalRoomsCount={data.rooms.length}
          filteredRoomsCount={filteredRooms.length}
        />
      </div>

      {/* Room Grid */}
      {filteredRooms.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
            No Meeting Rooms Found
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-6">
            None of our 14 meeting rooms match your current filter combination (minimum capacity of {filters.minCapacity} seats + {filters.amenities.length} selected amenities).
          </p>
          <button
            type="button"
            onClick={() => handleFilterChange({
              minCapacity: 0,
              amenities: [],
              dateStr: getIstDateStr(),
              isRightNow: true,
              startTime: '10:00',
              endTime: '11:00',
              searchQuery: '',
            })}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all"
          >
            Reset All Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRooms.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              departments={data.departments}
              bookings={data.bookings}
              currentUserId={data.currentUserId}
              currentUserRole={data.currentUserRole}
              currentUserDeptId={data.currentUserDeptId}
              isRightNow={filters.isRightNow}
              selectedDateStr={filters.dateStr}
              onViewSchedule={(r) => setSelectedTimelineRoom(r)}
              onBookRoom={(r) => handleBookRoomClick(r)}
            />
          ))}
        </div>
      )}

      {/* Day Timeline Modal */}
      <RoomTimelineModal
        room={selectedTimelineRoom}
        selectedDateStr={filters.dateStr}
        departments={data.departments}
        bookings={data.bookings}
        currentUserId={data.currentUserId}
        currentUserRole={data.currentUserRole}
        onClose={() => setSelectedTimelineRoom(null)}
        onProceedToBook={(r) => {
          setSelectedTimelineRoom(null);
          handleBookRoomClick(r);
        }}
      />

      {/* Booking Form Modal */}
      <BookingModal
        room={selectedBookingRoom}
        initialDateStr={filters.dateStr}
        currentUserRole={data.currentUserRole}
        onClose={() => setSelectedBookingRoom(null)}
        onSuccess={() => {
          refreshData();
        }}
      />

    </div>
  );
}
