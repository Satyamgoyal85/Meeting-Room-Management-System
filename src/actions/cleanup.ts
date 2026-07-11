'use server';

import { getSession } from '@/actions/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { Booking, UsageStat, CleanupJobLog } from '@/lib/types';
import { 
  getStoreBookings, 
  getStoreUsageStats, 
  upsertStoreUsageStat, 
  pruneStoreUsageStats, 
  pruneStoreAuditLogs,
  getStoreCleanupLogs, 
  addStoreCleanupLog, 
  acquireStoreLock, 
  releaseStoreLock,
  addMockAuditLog
} from '@/lib/mock-store';
import { format, startOfWeek, startOfMonth, subDays, subMonths, parseISO } from 'date-fns';

/**
 * Helper to get the Monday of a given date (for weekly aggregation).
 */
function getMonday(date: Date): string {
  // date-fns startOfWeek with weekStartsOn: 1 (Monday)
  return format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd');
}

/**
 * Helper to get the 1st of the month of a given date (for monthly aggregation).
 */
function getFirstOfMonth(date: Date): string {
  return format(startOfMonth(date), 'yyyy-MM-dd');
}

/**
 * Server action to manually trigger or verify the daily booking cleanup and aggregation job.
 * This runs the exact same aggregation-before-deletion workflow as the automated daily pg_cron job.
 */
export async function runBookingCleanupJobAction(): Promise<{
  success: boolean;
  records_aggregated: number;
  records_deleted: number;
  usage_stats_pruned: number;
  audit_logs_pruned?: number;
  error?: string;
  message?: string;
}> {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return { success: false, records_aggregated: 0, records_deleted: 0, usage_stats_pruned: 0, audit_logs_pruned: 0, error: 'Unauthorized: Admin access required.' };
  }

  const isPlaceholderUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('placeholder') || !process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!isPlaceholderUrl) {
    const supabase = createAdminClient();
    try {
      // Execute the PostgreSQL stored procedure via RPC
      const { data, error } = await (supabase.rpc as any)('run_daily_booking_cleanup');
      if (error) {
        console.error('RPC error running run_daily_booking_cleanup:', error);
        return { 
          success: false, 
          records_aggregated: 0, 
          records_deleted: 0, 
          usage_stats_pruned: 0, 
          audit_logs_pruned: 0,
          error: `Database error during cleanup job: ${error.message}` 
        };
      }

      const result = data as { records_aggregated: number; records_deleted: number; usage_stats_pruned: number; audit_logs_pruned?: number; status: string; error_message?: string };
      
      // Log audit trail
      await (supabase.from('audit_log') as any).insert({
        action_type: 'booking_cleanup_job',
        performed_by: session.id,
        target_id: null,
        details: {
          records_aggregated: result?.records_aggregated || 0,
          records_deleted: result?.records_deleted || 0,
          usage_stats_pruned: result?.usage_stats_pruned || 0,
          audit_logs_pruned: result?.audit_logs_pruned || 0,
          status: result?.status || 'success',
          triggered_by: 'manual_admin_trigger',
        },
      });

      return {
        success: result?.status === 'success',
        records_aggregated: result?.records_aggregated || 0,
        records_deleted: result?.records_deleted || 0,
        usage_stats_pruned: result?.usage_stats_pruned || 0,
        audit_logs_pruned: result?.audit_logs_pruned || 0,
        error: result?.error_message,
        message: `Cleanup job finished successfully. Aggregated ${result?.records_aggregated || 0} records, deleted ${result?.records_deleted || 0} historical bookings (> 7 days old), pruned ${result?.usage_stats_pruned || 0} expired usage stats (> 6 months old), and pruned ${result?.audit_logs_pruned || 0} expired audit logs (> 1 year old).`,
      };
    } catch (err: any) {
      console.error('Exception running run_daily_booking_cleanup:', err);
      return { success: false, records_aggregated: 0, records_deleted: 0, usage_stats_pruned: 0, audit_logs_pruned: 0, error: err.message || 'Failed to execute cleanup job.' };
    }
  } else {
    // ── Local Dev / Mock Store Execution ──────────────────────────────────────
    await acquireStoreLock();
    const jobId = crypto.randomUUID();
    const startTimeIso = new Date().toISOString();

    try {
      const allBookings = getStoreBookings();
      const cutoff7DaysAgo = subDays(new Date(), 7).getTime();
      const nowMs = Date.now();

      // Find eligible bookings: ended > 7 days ago and confirmed
      const eligibleBookings = allBookings.filter(b => {
        if (b.status !== 'confirmed') return false;
        const endMs = new Date(b.end_time).getTime();
        return endMs < cutoff7DaysAgo;
      });

      // Filter out active recurring series
      const toDeleteAndAggregate: Booking[] = [];
      for (const b of eligibleBookings) {
        let isPartofActiveSeries = false;

        if (b.series_id) {
          isPartofActiveSeries = allBookings.some(b2 => 
            b2.series_id === b.series_id && 
            new Date(b2.end_time).getTime() >= nowMs && 
            b2.status === 'confirmed'
          );
        } else {
          // Fallback check for bookings without series_id
          isPartofActiveSeries = allBookings.some(b2 => 
            b2.room_id === b.room_id && 
            b2.employee_id === b.employee_id && 
            b2.agenda === b.agenda && 
            new Date(b2.end_time).getTime() >= nowMs && 
            b2.status === 'confirmed' && 
            b2.id !== b.id
          );
        }

        if (!isPartofActiveSeries) {
          toDeleteAndAggregate.push(b);
        }
      }

      // Step 1: Aggregation before deletion (Safety Check)
      let aggregatedCount = 0;
      for (const b of toDeleteAndAggregate) {
        const bStart = new Date(b.start_time);
        const bEnd = new Date(b.end_time);
        const hours = Math.max(0, Number(((bEnd.getTime() - bStart.getTime()) / (1000 * 3600)).toFixed(2)));

        const weekStartStr = getMonday(bStart);
        const monthStartStr = getFirstOfMonth(bStart);

        // Aggregate weekly
        upsertStoreUsageStat({
          room_id: b.room_id,
          department_id: b.department_id,
          period_start: weekStartStr,
          period_type: 'weekly',
          booking_count: 1,
          total_hours_booked: hours,
        });

        // Aggregate monthly
        upsertStoreUsageStat({
          room_id: b.room_id,
          department_id: b.department_id,
          period_start: monthStartStr,
          period_type: 'monthly',
          booking_count: 1,
          total_hours_booked: hours,
        });

        aggregatedCount++;
      }

      // Step 2: Delete detailed booking records only AFTER safe aggregation
      const deleteIds = new Set(toDeleteAndAggregate.map(b => b.id));
      if (deleteIds.size > 0 && globalThis.__MOCK_BOOKINGS__) {
        globalThis.__MOCK_BOOKINGS__ = globalThis.__MOCK_BOOKINGS__.filter(b => !deleteIds.has(b.id));
        if (globalThis.__MOCK_INVITEES__) {
          globalThis.__MOCK_INVITEES__ = globalThis.__MOCK_INVITEES__.filter(inv => !deleteIds.has(inv.booking_id));
        }
      }

      // Step 3: Prune usage_stats older than 6 months
      const cutoff6MonthsAgoStr = format(subMonths(new Date(), 6), 'yyyy-MM-dd');
      const prunedStatsCount = pruneStoreUsageStats(cutoff6MonthsAgoStr);

      // Step 4: Prune audit_log older than 1 year (365 days)
      const cutoff1YearAgoIso = subDays(new Date(), 365).toISOString();
      const prunedAuditCount = pruneStoreAuditLogs(cutoff1YearAgoIso);

      // Record Job Log
      const logEntry: CleanupJobLog = {
        id: jobId,
        job_name: 'daily_booking_cleanup',
        status: 'success',
        started_at: startTimeIso,
        completed_at: new Date().toISOString(),
        records_aggregated: aggregatedCount,
        records_deleted: deleteIds.size,
        usage_stats_pruned: prunedStatsCount,
        audit_logs_pruned: prunedAuditCount,
      };
      addStoreCleanupLog(logEntry);

      // Record Audit Log
      addMockAuditLog({
        id: crypto.randomUUID(),
        action_type: 'booking_cleanup_job',
        performed_by: session.id,
        target_id: jobId,
        details: {
          records_aggregated: aggregatedCount,
          records_deleted: deleteIds.size,
          usage_stats_pruned: prunedStatsCount,
          audit_logs_pruned: prunedAuditCount,
          status: 'success',
          triggered_by: 'manual_admin_trigger',
        },
        created_at: new Date().toISOString(),
      });

      releaseStoreLock();

      return {
        success: true,
        records_aggregated: aggregatedCount,
        records_deleted: deleteIds.size,
        usage_stats_pruned: prunedStatsCount,
        audit_logs_pruned: prunedAuditCount,
        message: `Cleanup job finished successfully. Aggregated ${aggregatedCount} records into usage_stats, deleted ${deleteIds.size} historical bookings (> 7 days old), pruned ${prunedStatsCount} expired usage stats (> 6 months old), and pruned ${prunedAuditCount} expired audit logs (> 1 year old).`,
      };
    } catch (err: any) {
      // If error occurs during aggregation/deletion, record failure log
      addStoreCleanupLog({
        id: jobId,
        job_name: 'daily_booking_cleanup',
        status: 'failed',
        started_at: startTimeIso,
        completed_at: new Date().toISOString(),
        records_aggregated: 0,
        records_deleted: 0,
        usage_stats_pruned: 0,
        audit_logs_pruned: 0,
        error_message: err.message || 'Unknown failure during cleanup job execution.',
      });
      releaseStoreLock();
      return { success: false, records_aggregated: 0, records_deleted: 0, usage_stats_pruned: 0, audit_logs_pruned: 0, error: err.message || 'Failed to execute cleanup job.' };
    }
  }
}

/**
 * Server action to fetch usage stats, recent bookings, and cleanup job logs for the Reports tab.
 */
export async function getCleanupReportsDataAction(): Promise<{
  usageStats: UsageStat[];
  recentBookings: Booking[];
  jobLogs: CleanupJobLog[];
}> {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    throw new Error('Unauthorized: Admin access required.');
  }

  const isPlaceholderUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('placeholder') || !process.env.NEXT_PUBLIC_SUPABASE_URL;

  let usageStats: UsageStat[] = [];
  let recentBookings: Booking[] = [];
  let jobLogs: CleanupJobLog[] = [];

  if (!isPlaceholderUrl) {
    const supabase = createAdminClient();
    const cutoff7DaysAgoIso = subDays(new Date(), 7).toISOString();
    
    // Fetch all 3 report tables in parallel (`usage_stats`, recent `bookings`, and `cleanup_job_logs`)
    const [
      { data: uData, error: uErr },
      { data: bData, error: bErr },
      { data: lData, error: lErr }
    ] = await Promise.all([
      (supabase.from('usage_stats') as any).select('*').order('period_start', { ascending: false }).limit(100),
      (supabase.from('bookings') as any).select('*').gte('end_time', cutoff7DaysAgoIso).order('start_time', { ascending: false }),
      (supabase.from('cleanup_job_logs') as any).select('*').order('started_at', { ascending: false }).limit(10)
    ]);

    if (!uErr && uData) {
      usageStats = uData as UsageStat[];
    } else {
      if (uErr) console.warn('[Supabase fallback] Error fetching usage_stats:', uErr.message || uErr);
      usageStats = [...getStoreUsageStats()].sort((a, b) => b.period_start.localeCompare(a.period_start));
    }

    if (!bErr && bData) {
      recentBookings = bData as Booking[];
    } else {
      if (bErr) console.warn('[Supabase fallback] Error fetching recent bookings for cleanup reports:', bErr.message || bErr);
      const cutoff7DaysAgo = subDays(new Date(), 7).getTime();
      recentBookings = getStoreBookings()
        .filter(b => new Date(b.end_time).getTime() >= cutoff7DaysAgo)
        .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
    }

    if (!lErr && lData) {
      jobLogs = lData as CleanupJobLog[];
    } else {
      if (lErr) console.warn('[Supabase fallback] Error fetching cleanup job logs:', lErr.message || lErr);
      jobLogs = [...getStoreCleanupLogs()].sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
    }
  } else {
    usageStats = [...getStoreUsageStats()].sort((a, b) => b.period_start.localeCompare(a.period_start));
    
    const cutoff7DaysAgo = subDays(new Date(), 7).getTime();
    recentBookings = getStoreBookings()
      .filter(b => new Date(b.end_time).getTime() >= cutoff7DaysAgo)
      .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());

    jobLogs = [...getStoreCleanupLogs()].sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
  }

  return {
    usageStats,
    recentBookings,
    jobLogs,
  };
}
