'use client';

import React, { useMemo } from 'react';
import { Room } from '@/lib/types';
import { CheckSquare, Square } from 'lucide-react';

interface RoomChecklistProps {
  rooms: Room[];
  visibleRoomIds: Set<string>;
  onToggleRoom: (roomId: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

// Stable color dot for each room (using department color palette logic keyed by room id)
function getRoomColorDot(id: string): string {
  const colors = [
    'bg-blue-500',
    'bg-emerald-500',
    'bg-amber-500',
    'bg-rose-500',
    'bg-purple-500',
    'bg-cyan-500',
    'bg-indigo-500',
    'bg-pink-500',
    'bg-teal-500',
    'bg-orange-500',
  ];
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

// Group rooms by floor
function groupByFloor(rooms: Room[]): Record<string, Room[]> {
  return rooms.reduce((acc, room) => {
    const floor = room.floor || 'Other';
    if (!acc[floor]) acc[floor] = [];
    acc[floor].push(room);
    return acc;
  }, {} as Record<string, Room[]>);
}

export default function RoomChecklist({
  rooms,
  visibleRoomIds,
  onToggleRoom,
  onSelectAll,
  onDeselectAll,
}: RoomChecklistProps) {
  const allSelected = visibleRoomIds.size === rooms.length;
  const grouped = useMemo(() => groupByFloor(rooms), [rooms]);
  const floorKeys = Object.keys(grouped).sort();

  return (
    <div className="space-y-3">
      {/* Select / Deselect All */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Rooms ({visibleRoomIds.size}/{rooms.length})
        </span>
        <button
          onClick={allSelected ? onDeselectAll : onSelectAll}
          className="text-[10px] font-bold text-purple-600 dark:text-purple-400 hover:underline transition-colors"
        >
          {allSelected ? 'Deselect All' : 'Select All'}
        </button>
      </div>

      {/* Room list grouped by floor */}
      <div className="space-y-3">
        {floorKeys.map(floor => (
          <div key={floor}>
            <div className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-600 mb-1.5 px-0.5">
              {floor}
            </div>
            <div className="space-y-0.5">
              {grouped[floor].map(room => {
                const isVisible = visibleRoomIds.has(room.id);
                const dotColor = getRoomColorDot(room.id);
                const isRestricted = !!room.restricted_to_department_id;

                return (
                  <button
                    key={room.id}
                    onClick={() => onToggleRoom(room.id)}
                    className={`w-full flex items-center space-x-2 px-2 py-1.5 rounded-lg transition-all text-left group ${
                      isVisible
                        ? 'hover:bg-slate-100 dark:hover:bg-slate-800/80'
                        : 'opacity-50 hover:opacity-70 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className={`w-2 h-2 rounded-full shrink-0 ${dotColor} ${!isVisible ? 'opacity-40' : ''}`} />
                    <span
                      className={`flex-1 text-[11px] font-semibold truncate ${
                        isVisible
                          ? 'text-slate-800 dark:text-slate-200'
                          : 'text-slate-400 dark:text-slate-600 line-through'
                      }`}
                    >
                      {room.name}
                    </span>
                    {isRestricted && (
                      <span className="text-[8px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-1 py-0.5 rounded shrink-0">
                        RESTRICTED
                      </span>
                    )}
                    <div className={`shrink-0 text-slate-400 dark:text-slate-600`}>
                      {isVisible
                        ? <CheckSquare className="w-3.5 h-3.5 text-purple-500" />
                        : <Square className="w-3.5 h-3.5" />
                      }
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
