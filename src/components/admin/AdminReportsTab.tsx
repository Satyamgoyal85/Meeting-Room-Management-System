'use client';

import React, { useState, useTransition } from 'react';
import { AdminMetrics, AdminBookingItem } from '@/actions/admin';
import { Room, Department, UsageStat, CleanupJobLog } from '@/lib/types';
import { runBookingCleanupJobAction } from '@/actions/cleanup';
import { 
  BarChart3, 
  Download, 
  Building2, 
  Calendar, 
  Clock, 
  Users, 
  TrendingUp, 
  Sparkles, 
  CheckCircle2, 
  FileSpreadsheet,
  Database,
  ShieldAlert,
  AlertTriangle,
  Play,
  RefreshCw,
  History,
  CalendarRange,
  CheckCircle,
  XCircle,
  Info
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toIstDate, getIstDateStr } from '@/lib/timezone';
import { useRouter } from 'next/navigation';

interface AdminReportsTabProps {
  metrics: AdminMetrics;
  bookings: AdminBookingItem[];
  rooms?: Room[];
  departments?: Department[];
  usageStats?: UsageStat[];
  cleanupJobLogs?: CleanupJobLog[];
}

export default function AdminReportsTab({
  metrics,
  bookings,
  rooms = [],
  departments = [],
  usageStats = [],
  cleanupJobLogs = [],
}: AdminReportsTabProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [jobResult, setJobResult] = useState<{ success?: boolean; message?: string; error?: string } | null>(null);

  // Trigger manual daily cleanup job execution
  const handleRunJob = () => {
    setJobResult(null);
    startTransition(async () => {
      try {
        const res = await runBookingCleanupJobAction();
        if (res.success) {
          setJobResult({ success: true, message: res.message });
          router.refresh();
        } else {
          setJobResult({ success: false, error: res.error || 'Job failed.' });
        }
      } catch (err: any) {
        setJobResult({ success: false, error: err.message || 'Error triggering job.' });
      }
    });
  };

  // Generate & Download Detailed Bookings CSV Report (< 7 days or active)
  const handleExportCSV = () => {
    const headers = [
      'Booking ID',
      'Room Name',
      'Floor',
      'Booker Name',
      'Employee Code',
      'Department',
      'Date',
      'Start Time',
      'End Time',
      'Status',
      'Meeting Agenda',
      'Cancellation Reason'
    ];

    const rows = bookings.map(b => {
      const dateStr = format(toIstDate(b.start_time), 'yyyy-MM-dd');
      const startStr = format(toIstDate(b.start_time), 'HH:mm');
      const endStr = format(toIstDate(b.end_time), 'HH:mm');

      const escape = (val: string | null | undefined) => {
        if (!val) return '""';
        return `"${val.replace(/"/g, '""')}"`;
      };

      return [
        escape(b.id),
        escape(b.room_name),
        escape(b.room_floor),
        escape(b.booker_name),
        escape(b.booker_code),
        escape(b.department_name),
        escape(dateStr),
        escape(startStr),
        escape(endStr),
        escape(b.status),
        escape(b.agenda),
        escape(b.cancel_reason || 'N/A')
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Dhanuka_GHO_Detailed_Bookings_${getIstDateStr()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Generate & Download Aggregated Usage Stats CSV Report
  const handleExportStatsCSV = () => {
    const headers = [
      'Period Start Date',
      'Granularity Type',
      'Room Name',
      'Department Name',
      'Total Bookings Count',
      'Total Hours Booked',
      'Last Aggregated At'
    ];

    const rows = usageStats.map(s => {
      const rm = rooms.find(r => r.id === s.room_id);
      const dep = departments.find(d => d.id === s.department_id);
      
      const escape = (val: string | number | null | undefined) => {
        if (val === null || val === undefined) return '""';
        return `"${String(val).replace(/"/g, '""')}"`;
      };

      return [
        escape(s.period_start),
        escape(s.period_type.toUpperCase()),
        escape(rm ? rm.name : 'Deleted Room'),
        escape(dep ? dep.name : 'All / General'),
        escape(s.booking_count),
        escape(s.total_hours_booked),
        escape(s.updated_at ? format(new Date(s.updated_at), 'yyyy-MM-dd HH:mm') : 'N/A')
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Dhanuka_GHO_Aggregated_Usage_Stats_${getIstDateStr()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Compute summary trend tables from usageStats
  const weeklyStats = usageStats.filter(s => s.period_type === 'weekly');
  const monthlyStats = usageStats.filter(s => s.period_type === 'monthly');

  // Group by period_start for summary overview
  const weeklySummary = weeklyStats.reduce<Record<string, { bookings: number; hours: number }>>((acc, curr) => {
    if (!acc[curr.period_start]) acc[curr.period_start] = { bookings: 0, hours: 0 };
    acc[curr.period_start].bookings += curr.booking_count;
    acc[curr.period_start].hours += Number(curr.total_hours_booked);
    return acc;
  }, {});

  const monthlySummary = monthlyStats.reduce<Record<string, { bookings: number; hours: number }>>((acc, curr) => {
    if (!acc[curr.period_start]) acc[curr.period_start] = { bookings: 0, hours: 0 };
    acc[curr.period_start].bookings += curr.booking_count;
    acc[curr.period_start].hours += Number(curr.total_hours_booked);
    return acc;
  }, {});

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      
      {/* Header Bar with Export Buttons */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center">
            <span>Utilization & Compliance Reports</span>
            <span className="ml-3 px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 text-xs font-bold border border-emerald-300 dark:border-emerald-800">
              Aggregated Long-Term Tracking
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Data retention policy active: Detailed bookings &gt; 7 days old are safely rolled into historical usage summaries.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-bold border border-slate-700 shadow-sm flex items-center space-x-2 transition-all active:scale-95"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Export Recent Detailed Bookings</span>
          </button>

          <button
            type="button"
            onClick={handleExportStatsCSV}
            className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-lg shadow-purple-500/20 flex items-center space-x-2 transition-all active:scale-95"
          >
            <Database className="w-4 h-4" />
            <span>Export Historical Usage Stats</span>
          </button>
        </div>
      </div>

      {/* KPI Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Active Rooms
            </span>
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-slate-900 dark:text-white font-mono">
              {metrics.totalRooms}
            </div>
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1 flex items-center">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
              <span>100% Operational Inventory</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Recent Live Bookings
            </span>
            <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-slate-900 dark:text-white font-mono">
              {metrics.totalBookings}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Active detailed records (&lt; 7 days old)
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Historical Aggregated
            </span>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center">
              <Database className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-slate-900 dark:text-white font-mono">
              {usageStats.length}
            </div>
            <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold mt-1">
              Summary buckets (6-month retention)
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Most Booked Room (All Time)
            </span>
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-lg font-extrabold text-slate-900 dark:text-white truncate" title={metrics.mostBookedRoomName}>
              {metrics.mostBookedRoomName}
            </div>
            <div className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold mt-1">
              Highest utilization demand
            </div>
          </div>
        </div>
      </div>

      {/* ── Daily Data Retention & Cleanup System Status ── */}
      <div className="bg-gradient-to-br from-slate-900 to-indigo-950 p-7 rounded-3xl border border-indigo-500/30 text-white shadow-xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div className="space-y-1">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                <Database className="w-4 h-4" />
              </div>
              <h3 className="text-lg font-black tracking-tight text-white">
                Automated Daily Data Retention & Cleanup Engine
              </h3>
            </div>
            <p className="text-xs text-slate-300 max-w-3xl">
              Ensures compliance by running daily at <strong>02:00 UTC (07:30 IST)</strong>. Aggregates expired bookings (&gt; 7 days old) into weekly/monthly trends before deleting detailed records. Protects active recurring series automatically.
            </p>
          </div>

          <button
            type="button"
            disabled={isPending}
            onClick={handleRunJob}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 flex items-center space-x-2 transition-all active:scale-95 whitespace-nowrap self-start md:self-center"
          >
            {isPending ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Running Cleanup & Aggregation...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" />
                <span>Run Daily Cleanup Job Now</span>
              </>
            )}
          </button>
        </div>

        {/* Job Trigger Result Alert */}
        {jobResult && (
          <div className={`p-4 rounded-2xl border text-xs font-medium flex items-start space-x-3 ${
            jobResult.success 
              ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-200' 
              : 'bg-red-950/80 border-red-500/40 text-red-200'
          }`}>
            {jobResult.success ? <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" /> : <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />}
            <div className="space-y-1">
              <div className="font-bold text-sm">{jobResult.success ? 'Cleanup Job Completed Successfully' : 'Cleanup Job Failed'}</div>
              <div>{jobResult.message || jobResult.error}</div>
            </div>
          </div>
        )}

        {/* Recent Job Run Logs */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
            <span className="flex items-center"><History className="w-3.5 h-3.5 mr-1.5 text-indigo-400" /> Recent Execution Logs</span>
            <span>Policy: 7-Day Detailed • 6-Month Summary • 1-Year Audit Log</span>
          </div>

          {cleanupJobLogs.length === 0 ? (
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-xs text-slate-400 text-center">
              No cleanup job runs recorded yet. The automated job will log its execution here once run.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {cleanupJobLogs.slice(0, 3).map((log) => (
                <div key={log.id} className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                      log.status === 'success' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                      log.status === 'running' ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30 animate-pulse' :
                      'bg-red-500/20 text-red-300 border border-red-500/30'
                    }`}>
                      {log.status}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      {format(new Date(log.started_at), 'MMM d, HH:mm')}
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-2 text-center pt-1 border-t border-white/10">
                    <div>
                      <div className="text-[10px] text-slate-400">Aggregated</div>
                      <div className="text-sm font-bold font-mono text-emerald-400">+{log.records_aggregated}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400">Deleted</div>
                      <div className="text-sm font-bold font-mono text-amber-400">-{log.records_deleted}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400">Stats Pruned</div>
                      <div className="text-sm font-bold font-mono text-purple-400">-{log.usage_stats_pruned}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400">Audit Pruned</div>
                      <div className="text-sm font-bold font-mono text-sky-400">-{log.audit_logs_pruned || 0}</div>
                    </div>
                  </div>

                  {log.error_message && (
                    <div className="text-[10px] text-red-300 bg-red-950/60 p-2 rounded-lg border border-red-800/50 truncate" title={log.error_message}>
                      ⚠️ {log.error_message}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Department-Wise Distribution Chart */}
      <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
        <div>
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center">
            <Users className="w-4 h-4 mr-2 text-purple-600" />
            Department-Wise Booking Distribution (Combined Historical &amp; Live)
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Comprehensive utilization ranking combining both long-term aggregated summaries (`usage_stats`) and recent detailed bookings across all departments.
          </p>
        </div>

        <div className="space-y-4">
          {metrics.deptDistribution.map((item, idx) => (
            <div key={item.deptName} className="space-y-1.5">
              <div className="flex justify-between items-center text-xs font-bold">
                <span className="text-slate-800 dark:text-slate-200 flex items-center">
                  <span className="w-5 h-5 rounded-md bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 inline-flex items-center justify-center mr-2 text-[10px] font-mono">
                    #{idx + 1}
                  </span>
                  {item.deptName}
                </span>
                <span className="font-mono text-slate-600 dark:text-slate-400">
                  {item.count} booking(s) • <strong className="text-purple-600 dark:text-purple-400">{item.percentage}%</strong>
                </span>
              </div>

              <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-600 to-indigo-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(item.percentage, 4)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Weekly & Monthly Trend Statistics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Weekly Trend Overview */}
        <div className="bg-white dark:bg-slate-900 p-7 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h4 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center">
                <CalendarRange className="w-4 h-4 mr-2 text-indigo-600" />
                Short-Term Weekly Utilization Trends
              </h4>
              <p className="text-[11px] text-slate-500">Aggregated weekly buckets (Monday start)</p>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 text-[10px] font-bold">
              Weekly Granularity
            </span>
          </div>

          {Object.keys(weeklySummary).length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No historical weekly aggregations yet. Will populate as bookings older than 7 days are processed.
            </div>
          ) : (
            <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
              {Object.entries(weeklySummary)
                .sort(([a], [b]) => b.localeCompare(a))
                .map(([weekStart, data]) => (
                  <div key={weekStart} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 text-xs">
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white font-mono">Week of {weekStart}</div>
                      <div className="text-[10px] text-slate-500">Total meetings across GHO</div>
                    </div>
                    <div className="text-right font-mono">
                      <div className="font-extrabold text-indigo-600 dark:text-indigo-400">{data.bookings} bookings</div>
                      <div className="text-[10px] text-slate-500">{data.hours.toFixed(1)} hrs booked</div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Monthly Trend Overview */}
        <div className="bg-white dark:bg-slate-900 p-7 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h4 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center">
                <BarChart3 className="w-4 h-4 mr-2 text-purple-600" />
                Long-Term Monthly Utilization Trends
              </h4>
              <p className="text-[11px] text-slate-500">Aggregated monthly buckets (1st of month)</p>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600 text-[10px] font-bold">
              6-Month Retention
            </span>
          </div>

          {Object.keys(monthlySummary).length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No historical monthly aggregations yet. Will populate as bookings older than 7 days are processed.
            </div>
          ) : (
            <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
              {Object.entries(monthlySummary)
                .sort(([a], [b]) => b.localeCompare(a))
                .map(([monthStart, data]) => (
                  <div key={monthStart} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 text-xs">
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white font-mono">{format(parseISO(monthStart), 'MMMM yyyy')}</div>
                      <div className="text-[10px] text-slate-500">Monthly aggregate</div>
                    </div>
                    <div className="text-right font-mono">
                      <div className="font-extrabold text-purple-600 dark:text-purple-400">{data.bookings} bookings</div>
                      <div className="text-[10px] text-slate-500">{data.hours.toFixed(1)} hrs booked</div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
