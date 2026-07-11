'use client';

import React, { useState, useTransition, useEffect } from 'react';
import { Room, Department, Amenity, Booking, Employee } from '@/lib/types';
import { createRoomAction, updateRoomAction, deleteRoomAction, createDepartmentAction, deleteDepartmentAction } from '@/actions/admin';
import AdminAmenitiesTab, { renderAmenityIcon } from './AdminAmenitiesTab';
import { sortRoomsByCapacityAndName } from '@/lib/sorting';
import { 
  Building2, 
  Plus, 
  Edit3, 
  Users, 
  MapPin, 
  Lock, 
  Unlock, 
  Sparkles, 
  CheckCircle2, 
  XCircle, 
  X, 
  Loader2, 
  ArrowRight, 
  ShieldAlert,
  Sliders,
  Trash2,
  AlertTriangle,
  Search
} from 'lucide-react';

interface AdminRoomsTabProps {
  rooms: Room[];
  departments: Department[];
  amenities?: Amenity[];
  bookings?: Booking[];
  employees?: Employee[];
  initialSection?: 'rooms' | 'amenities' | 'departments';
}

export default function AdminRoomsTab({
  rooms,
  departments,
  amenities,
  bookings,
  employees,
  initialSection = 'rooms',
}: AdminRoomsTabProps) {
  const sortedRooms = sortRoomsByCapacityAndName(rooms);
  const [activeSubSection, setActiveSubSection] = useState<'rooms' | 'amenities' | 'departments'>(initialSection);
  const availableAmenitiesList = amenities && amenities.length > 0
    ? amenities.map(a => a.name)
    : [
        'Projector',
        'Video Conferencing',
        'Whiteboard',
        'AC',
        'TV Screen',
        'Executive Seating',
        'Sound System',
      ];
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Form State
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState(8);
  const [floor, setFloor] = useState('Ground Floor');
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>(['AC', 'Whiteboard']);
  const [restrictedDeptId, setRestrictedDeptId] = useState<string>('none');
  const [isActive, setIsActive] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Room Deletion State
  const [deletingRoom, setDeletingRoom] = useState<Room | null>(null);
  const [upcomingCount, setUpcomingCount] = useState<number>(0);
  const [showConfirmCancelModal, setShowConfirmCancelModal] = useState<boolean>(false);

  // Department Management State
  const [newDeptName, setNewDeptName] = useState<string>('');
  const [deptError, setDeptError] = useState<string | null>(null);
  const [deptSuccess, setDeptSuccess] = useState<string | null>(null);
  const [blockedDeptMessage, setBlockedDeptMessage] = useState<string | null>(null);
  const [deletingDept, setDeletingDept] = useState<Department | null>(null);

  const handleInitiateDeleteRoom = (room: Room) => {
    setDeletingRoom(room);
    const count = bookings ? bookings.filter(b => b.room_id === room.id && b.status === 'confirmed' && new Date(b.end_time).getTime() >= Date.now()).length : 0;
    setUpcomingCount(count);
    setShowConfirmCancelModal(true);
    setError(null);
    setSuccessMsg(null);
  };

  const handleConfirmDeleteRoom = () => {
    if (!deletingRoom) return;
    setError(null);
    setSuccessMsg(null);

    startTransition(async () => {
      const res = await deleteRoomAction(deletingRoom.id, true);
      if (res.error) {
        setError(res.error);
      } else {
        setSuccessMsg(res.message || 'Room deleted successfully.');
      }
      setDeletingRoom(null);
      setShowConfirmCancelModal(false);
    });
  };

  const handleCreateDepartment = (e: React.FormEvent) => {
    e.preventDefault();
    setDeptError(null);
    setDeptSuccess(null);
    if (!newDeptName.trim()) {
      setDeptError('Please enter a department name.');
      return;
    }
    const formData = new FormData();
    formData.append('name', newDeptName);

    startTransition(async () => {
      const res = await createDepartmentAction(formData);
      if (res.error) {
        setDeptError(res.error);
      } else {
        setDeptSuccess(res.message || 'Department added.');
        setNewDeptName('');
        setTimeout(() => setDeptSuccess(null), 3000);
      }
    });
  };

  const handleDeleteDepartment = (deptId: string) => {
    setDeptError(null);
    setDeptSuccess(null);
    setBlockedDeptMessage(null);

    startTransition(async () => {
      const res = await deleteDepartmentAction(deptId);
      if (res.error) {
        if (res.error === 'is_linked') {
          setBlockedDeptMessage(res.message || 'Cannot delete department.');
        } else {
          setDeptError(res.error);
        }
      } else {
        setDeptSuccess(res.message || 'Department removed.');
        setTimeout(() => setDeptSuccess(null), 3000);
      }
    });
  };

  const openCreateModal = () => {
    setName('');
    setCapacity(8);
    setFloor('Ground Floor');
    setSelectedAmenities(['AC', 'Whiteboard', 'Projector']);
    setRestrictedDeptId('none');
    setIsActive(true);
    setError(null);
    setSuccessMsg(null);
    setIsCreating(true);
  };

  const openEditModal = (room: Room) => {
    setName(room.name);
    setCapacity(room.capacity);
    setFloor(room.floor);
    setSelectedAmenities([...room.amenities]);
    setRestrictedDeptId(room.restricted_to_department_id || 'none');
    setIsActive(room.is_active);
    setError(null);
    setSuccessMsg(null);
    setEditingRoom(room);
  };

  const toggleAmenity = (item: string) => {
    if (selectedAmenities.includes(item)) {
      setSelectedAmenities(selectedAmenities.filter(a => a !== item));
    } else {
      setSelectedAmenities([...selectedAmenities, item]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!name || capacity < 1) {
      setError('Please provide a valid Room Name and Seating Capacity.');
      return;
    }

    const formData = new FormData();
    if (editingRoom) {
      formData.append('roomId', editingRoom.id);
    }
    formData.append('name', name);
    formData.append('capacity', capacity.toString());
    formData.append('floor', floor);
    formData.append('amenities', selectedAmenities.join(','));
    formData.append('restrictedDeptId', restrictedDeptId);
    formData.append('isActive', isActive ? 'true' : 'false');

    startTransition(async () => {
      let res;
      if (editingRoom) {
        res = await updateRoomAction(formData);
      } else {
        res = await createRoomAction(formData);
      }

      if (res && res.error) {
        setError(res.error);
      } else if (res && res.success) {
        setSuccessMsg(res.message || 'Operation successful!');
        setTimeout(() => {
          setIsCreating(false);
          setEditingRoom(null);
          window.location.reload();
        }, 1200);
      }
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Sub-tab Switcher for Rooms, Amenities & Departments */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-4">
        <button
          type="button"
          onClick={() => setActiveSubSection('rooms')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center space-x-2 transition-all ${
            activeSubSection === 'rooms'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20 scale-105'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Meeting Room Inventory ({sortedRooms.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubSection('amenities')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center space-x-2 transition-all ${
            activeSubSection === 'amenities'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20 scale-105'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Room Equipment & Amenities ({amenities?.length || 0})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubSection('departments')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center space-x-2 transition-all ${
            activeSubSection === 'departments'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20 scale-105'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Department Structure ({departments.length})</span>
        </button>
      </div>

      {activeSubSection === 'rooms' && (
        <div className="space-y-6">
          {/* Header Action Bar */}
          <div id="meeting-room-inventory" className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4 scroll-mt-24">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                Meeting Room Inventory
              </h2>
            </div>

            <div className="flex items-center space-x-3 w-full sm:w-auto">
              {/* Search Input */}
              <div className="relative flex-1 sm:w-72">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search room, floor, amenity..."
                  className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all placeholder:text-slate-400"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={openCreateModal}
                className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-lg shadow-purple-500/20 flex items-center space-x-2 transition-all active:scale-95 whitespace-nowrap flex-shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Add New Meeting Room</span>
                <span className="sm:hidden">Add Room</span>
              </button>
            </div>
          </div>

          {/* Rooms Grid */}
          {(() => {
            const filteredRooms = sortedRooms.filter(room => {
              if (!debouncedSearch.trim()) return true;
              const q = debouncedSearch.toLowerCase().trim();

              // Check Room Name
              if (room.name.toLowerCase().includes(q)) return true;

              // Check Floor (e.g. "floor 2", "ground floor", or just "2")
              if (room.floor.toLowerCase().includes(q)) return true;

              // Check Capacity (e.g. typing "8" or "8 seats")
              if (room.capacity.toString().includes(q)) return true;

              // Check Amenities (e.g. "projector", "ac", "whiteboard")
              if (room.amenities.some(a => a.toLowerCase().includes(q))) return true;

              // Check Department Restriction (e.g. "board", "executive", "open access", "unrestricted")
              const isRestricted = room.restricted_to_department_id !== null;
              const restrictedDept = isRestricted
                ? departments.find(d => d.id === room.restricted_to_department_id)
                : null;
              const deptName = restrictedDept ? restrictedDept.name.toLowerCase() : 'open access all departments unrestricted';
              if (deptName.includes(q)) return true;

              return false;
            });

            if (filteredRooms.length === 0) {
              return (
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 border border-slate-200 dark:border-slate-800 text-center flex flex-col items-center justify-center space-y-3 shadow-sm">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                    <Search className="w-6 h-6" />
                  </div>
                  <div className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    {searchQuery ? `No meeting rooms matching "${searchQuery}"` : 'No meeting rooms found.'}
                  </div>
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="text-xs text-purple-600 dark:text-purple-400 font-bold hover:underline mt-1 flex items-center space-x-1"
                    >
                      <span>Clear search filter</span>
                    </button>
                  )}
                </div>
              );
            }

            return (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredRooms.map((room) => {
                  const isRestricted = room.restricted_to_department_id !== null;
                  const restrictedDept = isRestricted
                    ? departments.find(d => d.id === room.restricted_to_department_id)
                    : null;

                  return (
                    <div
                      key={room.id}
                      className={`bg-white dark:bg-slate-900 rounded-3xl p-6 border transition-all shadow-sm flex flex-col justify-between ${
                        !room.is_active
                          ? 'border-slate-300 dark:border-slate-800 opacity-60 bg-slate-50 dark:bg-slate-950/60'
                          : isRestricted
                            ? 'border-amber-200/80 dark:border-amber-900/40 hover:border-amber-400'
                            : 'border-slate-200 dark:border-slate-800 hover:border-purple-500/80'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                            room.is_active
                              ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200'
                          }`}>
                            {room.is_active ? <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" /> : <XCircle className="w-3 h-3 mr-1" />}
                            {room.is_active ? 'Active' : 'Inactive'}
                          </span>

                          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
                            {room.floor}
                          </span>
                        </div>

                        <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                          {room.name}
                        </h3>

                        <div className="flex items-center space-x-2 text-xs font-semibold text-slate-600 dark:text-slate-300 mt-1.5">
                          <Users className="w-4 h-4 text-sky-500" />
                          <span>Capacity: <strong className="text-slate-900 dark:text-white font-mono">{room.capacity} seats</strong></span>
                        </div>

                        {/* Restriction Badge */}
                        {isRestricted ? (
                          <div className="mt-3 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-300 flex items-center space-x-2">
                            <Lock className="w-4 h-4 flex-shrink-0 text-amber-600" />
                            <span>Restricted to: <strong className="font-bold">{restrictedDept ? restrictedDept.name : 'Dept'} Only</strong></span>
                          </div>
                        ) : (
                          <div className="mt-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-400 flex items-center space-x-2">
                            <Unlock className="w-4 h-4 flex-shrink-0 text-emerald-600" />
                            <span>Open Access (All Departments)</span>
                          </div>
                        )}

                        {/* Amenities */}
                        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                            Available Amenities
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {room.amenities.map((amenity, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                              >
                                {amenity}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(room)}
                          className="flex-1 py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center justify-center space-x-1.5 transition-all shadow-sm"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-purple-600" />
                          <span>Configure Settings</span>
                        </button>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleInitiateDeleteRoom(room)}
                          className="py-2.5 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center justify-center space-x-1 transition-all border border-rose-200 dark:border-rose-800/80"
                          title="Delete Room"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {activeSubSection === 'amenities' && (
        <div id="room-amenities" className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6 scroll-mt-24">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-5">
            <div>
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center">
                <Sparkles className="w-5 h-5 mr-2 text-purple-600 dark:text-purple-400" />
                Room Equipment & Amenities Management
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Create and manage equipment types (e.g. Projectors, Whiteboards, Polycom) available across Dhanuka conference rooms.
              </p>
            </div>
          </div>
          <AdminAmenitiesTab amenities={amenities || []} rooms={sortedRooms} isEmbedded={true} />
        </div>
      )}

      {/* Department Management Section */}
      {activeSubSection === 'departments' && (
        <div id="department-structure" className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6 scroll-mt-24">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-6">
            <div>
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                Department Structure
              </h3>
            </div>

            <form onSubmit={handleCreateDepartment} className="flex items-center space-x-2 flex-shrink-0">
              <input
                type="text"
                value={newDeptName}
                onChange={(e) => setNewDeptName(e.target.value)}
                placeholder="New Department Name..."
                className="px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
              />
              <button
                type="submit"
                disabled={isPending || !newDeptName.trim()}
                className="px-5 py-2.5 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center space-x-1.5 shadow-lg shadow-purple-500/20 transition-all disabled:opacity-50"
              >
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                <span>Add Department</span>
              </button>
            </form>
          </div>

          {deptError && (
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300 font-medium flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{deptError}</span>
            </div>
          )}

          {deptSuccess && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-xs text-emerald-700 dark:text-emerald-300 font-bold flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>{deptSuccess}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {departments.map((dept) => {
              const linkedRoomsCount = rooms.filter(r => r.restricted_to_department_id === dept.id).length;
              return (
                <div
                  key={dept.id}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between gap-3 hover:border-purple-300 dark:hover:border-purple-700 transition-all"
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-300 flex items-center justify-center font-bold text-sm flex-shrink-0">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                        {dept.name}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                        {linkedRoomsCount === 0 ? 'No restricted rooms' : `${linkedRoomsCount} restricted room(s)`}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => setDeletingDept(dept)}
                    className="p-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-slate-400 hover:text-rose-600 transition-colors border border-slate-200 dark:border-slate-700 flex-shrink-0"
                    title="Remove Department"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {(isCreating || editingRoom) && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-6 max-h-[92vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => {
                setIsCreating(false);
                setEditingRoom(null);
              }}
              className="absolute top-4 right-4 p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-14 h-14 rounded-2xl bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 flex items-center justify-center mx-auto shadow-md">
              <Sliders className="w-7 h-7" />
            </div>

            <div className="text-center">
              <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
                {editingRoom ? `Configure ${editingRoom.name}` : 'Add New Meeting Room'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {editingRoom ? 'Update room inventory details and access policies.' : 'Create a new conference space for the Dhanuka GHO Branch.'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-left">
              {error && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 rounded-xl text-xs text-rose-700 dark:text-rose-300">
                  {error}
                </div>
              )}

              {successMsg && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900/60 rounded-xl text-xs text-emerald-700 dark:text-emerald-300 font-bold flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* 1. Room Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Room Name (Required)
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Room 15 - Apex Executive Suite"
                  required
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* 2. Seating Capacity & Floor */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Seating Capacity (seats)
                  </label>
                  <input
                    type="number"
                    min={2}
                    max={100}
                    value={capacity}
                    onChange={(e) => setCapacity(Number(e.target.value))}
                    required
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Floor Location
                  </label>
                  <select
                    value={floor}
                    onChange={(e) => setFloor(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                  >
                    <option value="Ground Floor">Ground Floor</option>
                    <option value="1st Floor">1st Floor</option>
                    <option value="2nd Floor">2nd Floor</option>
                    <option value="3rd Floor">3rd Floor</option>
                    <option value="4th Floor">4th Floor</option>
                    <option value="5th Floor">5th Floor</option>
                  </select>
                </div>
              </div>

              {/* 3. Department Exclusivity */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                  <span>Department Restriction Policy</span>
                  <span className="text-[10px] text-purple-600 font-normal">Exclusivity Access</span>
                </label>
                <select
                  value={restrictedDeptId}
                  onChange={(e) => setRestrictedDeptId(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                >
                  <option value="none">🔓 Open Access (All Departments Can Book)</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>🔒 Restrict exclusively to: {d.name}</option>
                  ))}
                </select>
              </div>

              {/* 4. Amenities Checkboxes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Available Amenities
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                  {availableAmenitiesList.map((item) => {
                    const isSelected = selectedAmenities.includes(item);
                    const amenityObj = amenities?.find(a => a.name === item);
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => toggleAmenity(item)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center space-x-1 transition-all ${
                          isSelected
                            ? 'bg-purple-600 text-white shadow-sm scale-95'
                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {amenityObj ? renderAmenityIcon(amenityObj.icon, 'w-3.5 h-3.5 mr-1') : (isSelected && <CheckCircle2 className="w-3.5 h-3.5 mr-1" />)}
                        <span>{item}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 5. Active Status Toggle (if editing) */}
              {editingRoom && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Room Operating Status:
                  </span>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {isActive ? '⚡ Active & Bookable' : '🛑 Inactive / Under Maintenance'}
                    </span>
                  </label>
                </div>
              )}

              <div className="flex items-center gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreating(false);
                    setEditingRoom(null);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition-all"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isPending || Boolean(successMsg)}
                  className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-lg shadow-purple-500/20 flex items-center justify-center space-x-1.5 transition-all disabled:opacity-50"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <span>{editingRoom ? 'Update Room' : 'Create Room'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Room Deletion Modal */}
      {showConfirmCancelModal && deletingRoom && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-rose-200 dark:border-rose-900/60 p-6 space-y-6">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto shadow-md">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                Delete Meeting Room
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Are you sure you want to delete the room <strong className="font-bold text-slate-900 dark:text-white">{deletingRoom.name}</strong>? This action cannot be undone.
              </p>
              {upcomingCount > 0 && (
                <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-left text-xs text-amber-800 dark:text-amber-300 mt-3 space-y-1">
                  <div className="font-bold flex items-center space-x-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Warning: Active Bookings Conflict</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    This room has <strong className="font-extrabold">{upcomingCount} upcoming confirmed booking(s)</strong>. Deleting it will automatically cancel these meetings and soft-delete the room to preserve historical audit logs.
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowConfirmCancelModal(false);
                  setDeletingRoom(null);
                }}
                className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleConfirmDeleteRoom}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center space-x-1.5 shadow-lg shadow-rose-500/20 transition-all"
              >
                {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Confirm Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Department Deletion Modal */}
      {deletingDept && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-rose-200 dark:border-rose-900/60 p-6 space-y-6">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto shadow-md">
              <Trash2 className="w-6 h-6" />
            </div>

            {(() => {
              const empCount = employees ? employees.filter(e => e.department_id === deletingDept.id).length : 0;
              const roomCount = rooms.filter(r => r.restricted_to_department_id === deletingDept.id).length;
              const hasDependencies = empCount > 0 || roomCount > 0;

              return (
                <>
                  <div className="text-center space-y-2">
                    <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                      Delete Department
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      Are you sure you want to delete the <strong className="font-bold text-slate-900 dark:text-white">{deletingDept.name}</strong> department? This action cannot be undone.
                    </p>
                    {hasDependencies && (
                      <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-left text-xs text-rose-800 dark:text-rose-300 mt-3 space-y-1">
                        <div className="font-bold flex items-center space-x-1.5">
                          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                          <span>Deletion Blocked: Active Dependencies</span>
                        </div>
                        <p className="text-[11px] leading-relaxed">
                          This department has <strong className="font-extrabold">{empCount} employee(s) and {roomCount} restricted room(s) assigned</strong>. Deleting it will require reassignment. Please reassign them before removing this department.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-end space-x-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setDeletingDept(null)}
                      className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isPending || hasDependencies}
                      onClick={() => {
                        handleDeleteDepartment(deletingDept.id);
                        setDeletingDept(null);
                      }}
                      className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center space-x-1.5 shadow-lg shadow-rose-500/20 transition-all disabled:opacity-50 disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:shadow-none"
                    >
                      {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                      <span>{hasDependencies ? 'Resolve Dependencies First' : 'Confirm Delete'}</span>
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Blocked Department Removal Modal */}
      {blockedDeptMessage && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-rose-200 dark:border-rose-900/60 p-6 space-y-6">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto shadow-md">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                Department Currently in Use
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {blockedDeptMessage}
              </p>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-left text-xs text-slate-500 dark:text-slate-400 mt-2">
                <span className="font-bold text-slate-700 dark:text-slate-200">Safety Check:</span> To prevent orphaned employee records or unassigned room restrictions, please reassign all linked employees and meeting rooms to another department before removing this one.
              </div>
            </div>

            <div className="flex items-center justify-end pt-2">
              <button
                type="button"
                onClick={() => setBlockedDeptMessage(null)}
                className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-lg shadow-purple-500/20 transition-all"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
