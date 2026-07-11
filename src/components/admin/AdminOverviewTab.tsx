'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Room, Department, Employee } from '@/lib/types';
import { sortEmployeesByHierarchy } from '@/lib/sorting';
import { 
  Building2, 
  Layers, 
  ShieldCheck, 
  Lock, 
  CheckCircle2, 
  Users,
  Sparkles
} from 'lucide-react';

interface AdminOverviewTabProps {
  rooms: Room[];
  departments: Department[];
  employees: Employee[];
}

export default function AdminOverviewTab({ rooms, departments, employees }: AdminOverviewTabProps) {
  const router = useRouter();

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* Overview Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div 
          onClick={() => router.push('/admin?tab=rooms#meeting-room-inventory')}
          className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between hover:shadow-md transition-all cursor-pointer hover:-translate-y-1 hover:border-purple-300 dark:hover:border-purple-700"
        >
          <div>
            <div className="w-12 h-12 rounded-xl bg-sky-100 dark:bg-sky-900/40 text-sky-600 dark:text-sky-400 flex items-center justify-center mb-4">
              <Building2 className="w-6 h-6" />
            </div>
            <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-1">{rooms.length} Meeting Rooms</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
              Configured across 4 floors in GHO Branch with diverse attendee capacities from 4 to 20 seats.
            </p>
          </div>
          <div className="text-xs font-semibold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/60 py-2.5 px-3.5 rounded-xl border border-sky-100 dark:border-sky-900/50 flex items-center justify-between">
            <span>Includes Restricted Board Spaces</span>
            <Lock className="w-3.5 h-3.5" />
          </div>
        </div>

        <div 
          onClick={() => router.push('/admin?tab=rooms#department-structure')}
          className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between hover:shadow-md transition-all cursor-pointer hover:-translate-y-1 hover:border-purple-300 dark:hover:border-purple-700"
        >
          <div>
            <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4">
              <Layers className="w-6 h-6" />
            </div>
            <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-1">{departments.length} Departments</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
              IT, R&D, Marketing, Board, HR, Finance, Sales, Production, QA, and Admin organizational hierarchy.
            </p>
          </div>
          <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 py-2.5 px-3.5 rounded-xl border border-emerald-100 dark:border-emerald-900/50 flex items-center justify-between">
            <span>Dynamic Department Inventory</span>
            <CheckCircle2 className="w-3.5 h-3.5" />
          </div>
        </div>

        <div 
          onClick={() => router.push('/admin?tab=rooms#meeting-room-inventory')}
          className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between hover:shadow-md transition-all cursor-pointer hover:-translate-y-1 hover:border-purple-300 dark:hover:border-purple-700"
        >
          <div>
            <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-4">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-1">Security & Access</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
              Role-Based Access Control and security policies enforced across all system tiers and operations.
            </p>
          </div>
          <div className="text-xs font-semibold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 py-2.5 px-3.5 rounded-xl border border-purple-100 dark:border-purple-900/50 flex items-center justify-between">
            <span>Agenda Masking & Oversight Active</span>
            <Lock className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>

      {/* Meeting Rooms Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Meeting Rooms ({rooms.length})</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Master inventory of all conference and collaboration spaces across GHO Branch.
            </p>
          </div>
          <span className="text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-3 py-1 rounded-full">
            Meeting Rooms
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 text-xs uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <th className="py-3.5 px-5">Room Name</th>
                  <th className="py-3.5 px-5">Floor</th>
                  <th className="py-3.5 px-5">Capacity</th>
                  <th className="py-3.5 px-5">Amenities</th>
                  <th className="py-3.5 px-5">Access Restriction</th>
                  <th className="py-3.5 px-5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                {rooms.map((room) => {
                  const isRestricted = room.restricted_to_department_id !== null;
                  const restrictedDept = departments.find(d => d.id === room.restricted_to_department_id);
                  return (
                    <tr key={room.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-4 px-5 font-bold text-slate-900 dark:text-slate-100">
                        {room.name}
                      </td>
                      <td className="py-4 px-5 text-slate-600 dark:text-slate-400">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs bg-slate-100 dark:bg-slate-800 font-medium">
                          {room.floor}
                        </span>
                      </td>
                      <td className="py-4 px-5 font-mono font-bold text-slate-700 dark:text-slate-300">
                        {room.capacity} seats
                      </td>
                      <td className="py-4 px-5">
                        <div className="flex flex-wrap gap-1.5">
                          {room.amenities.map((amenity, i) => (
                            <span key={i} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-100 dark:border-sky-900/50 font-medium">
                              {amenity}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-4 px-5">
                        {isRestricted ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            <Lock className="w-3 h-3 mr-1.5" />
                            {restrictedDept ? `${restrictedDept.name} Only` : 'Restricted'}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 font-medium">Open to All Depts</span>
                        )}
                      </td>
                      <td className="py-4 px-5">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                          Active
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Departments & Employee Accounts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4">
        
        {/* Departments Table */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div>
              <h3 className="font-bold text-lg text-slate-900 dark:text-white">Departments ({departments.length})</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Organizational units with access permissions.</p>
            </div>
            <span className="text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-3 py-1 rounded-full">
              Departments
            </span>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 text-xs uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <th className="py-3 px-4">Department Name</th>
                  <th className="py-3 px-4 text-right">Default Restriction</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                {departments.map((dept) => (
                  <tr key={dept.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-200">{dept.name}</td>
                    <td className="py-3 px-4 text-right">
                      {dept.is_restricted_default ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 font-semibold">
                          Restricted Default
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 font-medium">Standard</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Employee Accounts Table */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div>
              <h3 className="font-bold text-lg text-slate-900 dark:text-white">Employee Accounts ({employees.length})</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Authorized employee accounts and system roles.</p>
            </div>
            <span className="text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-3 py-1 rounded-full">
              Employee Accounts
            </span>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 text-xs uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <th className="py-3 px-4">Emp ID</th>
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4 text-right">Department</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                {sortEmployeesByHierarchy(employees, departments).map((emp) => {
                  const dept = departments.find(d => d.id === emp.department_id);
                  const isAdmin = emp.role === 'admin';
                  return (
                    <tr key={emp.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-sky-600 dark:text-sky-400">
                        {emp.employee_id}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">{emp.name}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${
                          isAdmin 
                            ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800' 
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}>
                          {emp.role}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right text-slate-500 dark:text-slate-400 text-xs font-medium">
                        {dept ? dept.name : 'N/A'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>

    </div>
  );
}
