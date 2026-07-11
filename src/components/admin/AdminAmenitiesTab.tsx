'use client';

import React, { useState, useTransition } from 'react';
import { Amenity, Room } from '@/lib/types';
import { createAmenityAction, deleteAmenityAction } from '@/actions/admin';
import {
  Projector,
  Video,
  Edit3,
  Wind,
  Tv,
  Armchair,
  Volume2,
  Wifi,
  Coffee,
  Monitor,
  Sparkles,
  Shield,
  Zap,
  Mic,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Layers
} from 'lucide-react';

const ICON_OPTIONS = [
  { name: 'Projector', label: 'Projector', icon: Projector },
  { name: 'Video', label: 'Video Conf', icon: Video },
  { name: 'Edit3', label: 'Whiteboard', icon: Edit3 },
  { name: 'Wind', label: 'AC / Climate', icon: Wind },
  { name: 'Tv', label: 'TV Display', icon: Tv },
  { name: 'Armchair', label: 'Executive Seat', icon: Armchair },
  { name: 'Volume2', label: 'Sound / Audio', icon: Volume2 },
  { name: 'Wifi', label: 'High-Speed Wifi', icon: Wifi },
  { name: 'Coffee', label: 'Coffee / Tea', icon: Coffee },
  { name: 'Monitor', label: 'Digital Podium', icon: Monitor },
  { name: 'Sparkles', label: 'Premium Suite', icon: Sparkles },
  { name: 'Shield', label: 'Secure Conf', icon: Shield },
  { name: 'Zap', label: 'Fast Charging', icon: Zap },
  { name: 'Mic', label: 'Microphone System', icon: Mic },
];

export const ICON_MAP: Record<string, React.ElementType> = {
  Projector,
  Video,
  Edit3,
  Wind,
  Tv,
  Armchair,
  Volume2,
  Wifi,
  Coffee,
  Monitor,
  Sparkles,
  Shield,
  Zap,
  Mic,
};

export function renderAmenityIcon(iconName: string, className = 'w-4 h-4') {
  const IconComponent = ICON_MAP[iconName] || Sparkles;
  return <IconComponent className={className} />;
}

interface AdminAmenitiesTabProps {
  amenities: Amenity[];
  rooms: Room[];
  isEmbedded?: boolean;
}

export default function AdminAmenitiesTab({ amenities, rooms, isEmbedded = false }: AdminAmenitiesTabProps) {
  const [isPending, startTransition] = useTransition();
  const [newAmenityName, setNewAmenityName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('Sparkles');
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modal state for removing amenity assigned to rooms
  const [amenityToDelete, setAmenityToDelete] = useState<Amenity | null>(null);
  const [assignedRoomsForDelete, setAssignedRoomsForDelete] = useState<Room[]>([]);

  const handleAddAmenity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAmenityName.trim()) {
      setStatusMsg({ type: 'error', text: 'Please enter a valid Amenity Name.' });
      return;
    }

    setStatusMsg(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.append('name', newAmenityName.trim());
      formData.append('icon', selectedIcon);

      const res = await createAmenityAction(formData);
      if (res.error) {
        setStatusMsg({ type: 'error', text: res.error });
      } else if (res.success) {
        setStatusMsg({ type: 'success', text: res.message || 'Amenity added successfully!' });
        setNewAmenityName('');
        setSelectedIcon('Sparkles');
      }
    });
  };

  const initiateRemove = (amenity: Amenity) => {
    setStatusMsg(null);
    const affectedRooms = rooms.filter(r => r.amenities && r.amenities.includes(amenity.name));
    setAmenityToDelete(amenity);
    setAssignedRoomsForDelete(affectedRooms);
  };

  const confirmRemove = () => {
    if (!amenityToDelete) return;
    const targetId = amenityToDelete.id;
    setAmenityToDelete(null);
    setAssignedRoomsForDelete([]);

    startTransition(async () => {
      const res = await deleteAmenityAction(targetId);
      if (res.error) {
        setStatusMsg({ type: 'error', text: res.error });
      } else if (res.success) {
        setStatusMsg({ type: 'success', text: res.message || 'Amenity removed!' });
      }
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {!isEmbedded && (
        <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
            Manage Amenities
          </h2>
        </div>
      )}

      {/* Status Message */}
      {statusMsg && (
        <div className={`p-4 rounded-xl border flex items-center space-x-3 text-sm font-medium ${
          statusMsg.type === 'success' 
            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
            : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
        }`}>
          {statusMsg.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Add Amenity Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
        <h3 className="text-lg font-bold mb-4 flex items-center">
          <Plus className="w-5 h-5 mr-2 text-emerald-600 dark:text-emerald-400" />
          Add New Amenity
        </h3>
        
        <form onSubmit={handleAddAmenity} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Amenity Name Input */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Amenity Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={newAmenityName}
                onChange={(e) => setNewAmenityName(e.target.value)}
                placeholder="e.g., Digital Podium, 4K OLED Display, Polycom Audio"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                disabled={isPending}
              />
            </div>

            {/* Icon Selector Grid */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Select Icon
              </label>
              <div className="grid grid-cols-7 gap-2">
                {ICON_OPTIONS.map((opt) => {
                  const IconComp = opt.icon;
                  const isSelected = selectedIcon === opt.name;
                  return (
                    <button
                      key={opt.name}
                      type="button"
                      onClick={() => setSelectedIcon(opt.name)}
                      title={opt.label}
                      className={`p-2.5 rounded-xl border flex items-center justify-center transition-all ${
                        isSelected
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-md scale-105'
                          : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                      disabled={isPending}
                    >
                      <IconComp className="w-4 h-4" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isPending || !newAmenityName.trim()}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-sm shadow-md shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 transition-all"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Adding Amenity...</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Create Amenity</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Current Amenities Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
          <div>
            <h3 className="text-xl font-bold tracking-tight">Configured Amenities ({amenities.length})</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              These options appear dynamically in room filter chips and room configuration modals.
            </p>
          </div>
          <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            Master List
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {amenities.map((amenity) => {
            const assignedRooms = rooms.filter(r => r.amenities && r.amenities.includes(amenity.name));
            const count = assignedRooms.length;

            return (
              <div
                key={amenity.id}
                className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex items-start justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-all group"
              >
                <div className="flex items-start space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                    {renderAmenityIcon(amenity.icon, 'w-5 h-5')}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-base">
                      {amenity.name}
                    </h4>
                    <div className="mt-1">
                      {count > 0 ? (
                        <span className="inline-flex items-center text-xs font-semibold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 px-2.5 py-0.5 rounded-full border border-sky-100 dark:border-sky-900/50">
                          Assigned to {count} {count === 1 ? 'room' : 'rooms'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-xs font-medium text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-full">
                          Unassigned
                        </span>
                      )}
                    </div>
                    {count > 0 && (
                      <p className="text-[11px] text-slate-400 mt-1.5 line-clamp-1" title={assignedRooms.map(r => r.name).join(', ')}>
                        {assignedRooms.map(r => r.name.replace(/^Room \d+ - /, '')).join(', ')}
                      </p>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => initiateRemove(amenity)}
                  disabled={isPending}
                  title="Remove Amenity"
                  className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Confirmation Modal when Removing Assigned Amenity */}
      {amenityToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-5">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto border border-rose-200 dark:border-rose-900/50">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Delete Amenity?
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Are you sure you want to delete the amenity <span className="font-bold text-slate-900 dark:text-white">&quot;{amenityToDelete.name}&quot;</span>? This action cannot be undone.
              </p>
              {assignedRoomsForDelete.length > 0 && (
                <>
                  <p className="text-xs text-rose-600 dark:text-rose-400 font-bold pt-1">
                    Warning: Currently assigned to {assignedRoomsForDelete.length} {assignedRoomsForDelete.length === 1 ? 'room' : 'rooms'}:
                  </p>
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 max-h-32 overflow-y-auto text-xs font-medium text-slate-700 dark:text-slate-300 text-left border border-slate-200 dark:border-slate-700/50">
                    <ul className="list-disc list-inside space-y-1">
                      {assignedRoomsForDelete.map(r => (
                        <li key={r.id}>{r.name} ({r.floor})</li>
                      ))}
                    </ul>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 pt-1">
                    Removing it will automatically unassign it from those rooms.
                  </p>
                </>
              )}
            </div>

            <div className="flex items-center space-x-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setAmenityToDelete(null);
                  setAssignedRoomsForDelete([]);
                }}
                disabled={isPending}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmRemove}
                disabled={isPending}
                className="flex-1 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm shadow-md shadow-rose-500/20 flex items-center justify-center space-x-2 transition-all"
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Removing...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Yes, Remove</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
