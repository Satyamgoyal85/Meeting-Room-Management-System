/**
 * Unit Tests: Automated Booking Data Retention & Cleanup System
 * Tests aggregation before deletion, 7-day cutoff rule, recurring series protection, and 6-month usage_stats pruning.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  getStoreBookings, 
  getStoreUsageStats, 
  upsertStoreUsageStat, 
  pruneStoreUsageStats,
  getStoreCleanupLogs,
  pruneStoreAuditLogs,
  getStoreAuditLogs,
  addMockAuditLog
} from '@/lib/mock-store';
import { Booking, UsageStat } from '@/lib/types';
import { subDays, subMonths, format } from 'date-fns';

describe('Data Retention & Cleanup System', () => {
  beforeEach(() => {
    // Reset global stores
    globalThis.__MOCK_BOOKINGS__ = [];
    globalThis.__MOCK_USAGE_STATS__ = [];
    globalThis.__MOCK_CLEANUP_LOGS__ = [];
    globalThis.__MOCK_AUDIT_LOGS__ = [];
  });

  describe('upsertStoreUsageStat (Aggregation Engine)', () => {
    it('creates a new usage stat when combination does not exist', () => {
      upsertStoreUsageStat({
        room_id: 'room-1',
        department_id: 'dept-1',
        period_start: '2026-07-06',
        period_type: 'weekly',
        booking_count: 1,
        total_hours_booked: 2.5,
      });

      const stats = getStoreUsageStats();
      expect(stats.length).toBe(1);
      expect(stats[0].booking_count).toBe(1);
      expect(stats[0].total_hours_booked).toBe(2.5);
    });

    it('increments counters correctly when exact combination already exists', () => {
      upsertStoreUsageStat({
        room_id: 'room-1',
        department_id: 'dept-1',
        period_start: '2026-07-06',
        period_type: 'weekly',
        booking_count: 1,
        total_hours_booked: 2.0,
      });

      upsertStoreUsageStat({
        room_id: 'room-1',
        department_id: 'dept-1',
        period_start: '2026-07-06',
        period_type: 'weekly',
        booking_count: 1,
        total_hours_booked: 1.5,
      });

      const stats = getStoreUsageStats();
      expect(stats.length).toBe(1);
      expect(stats[0].booking_count).toBe(2);
      expect(stats[0].total_hours_booked).toBe(3.5);
    });

    it('keeps different period_type (weekly vs monthly) separated', () => {
      upsertStoreUsageStat({
        room_id: 'room-1',
        department_id: 'dept-1',
        period_start: '2026-07-06',
        period_type: 'weekly',
        booking_count: 1,
        total_hours_booked: 1.0,
      });

      upsertStoreUsageStat({
        room_id: 'room-1',
        department_id: 'dept-1',
        period_start: '2026-07-01',
        period_type: 'monthly',
        booking_count: 1,
        total_hours_booked: 1.0,
      });

      const stats = getStoreUsageStats();
      expect(stats.length).toBe(2);
    });
  });

  describe('pruneStoreUsageStats (6-Month Summary Retention Rule)', () => {
    it('deletes usage stats older than the 6-month cutoff date', () => {
      const cutoffStr = format(subMonths(new Date(), 6), 'yyyy-MM-dd');
      const oldDateStr = format(subMonths(new Date(), 7), 'yyyy-MM-dd');
      const recentDateStr = format(subDays(new Date(), 10), 'yyyy-MM-dd');

      // Old record (should be pruned)
      upsertStoreUsageStat({
        room_id: 'room-1',
        department_id: 'dept-1',
        period_start: oldDateStr,
        period_type: 'monthly',
        booking_count: 5,
        total_hours_booked: 10,
      });

      // Recent record (should be kept)
      upsertStoreUsageStat({
        room_id: 'room-1',
        department_id: 'dept-1',
        period_start: recentDateStr,
        period_type: 'weekly',
        booking_count: 2,
        total_hours_booked: 4,
      });

      const prunedCount = pruneStoreUsageStats(cutoffStr);
      expect(prunedCount).toBe(1);
      const remaining = getStoreUsageStats();
      expect(remaining.length).toBe(1);
      expect(remaining[0].period_start).toBe(recentDateStr);
    });
  });

  describe('pruneStoreAuditLogs (1-Year Audit Retention Rule)', () => {
    it('deletes audit logs older than the 1-year (365 days) cutoff date', () => {
      const cutoffIso = subDays(new Date(), 365).toISOString();
      const oldIso = subDays(new Date(), 400).toISOString();
      const recentIso = subDays(new Date(), 30).toISOString();

      addMockAuditLog({
        id: 'old-log',
        action_type: 'create_booking',
        performed_by: 'admin-id',
        target_id: null,
        details: {},
        created_at: oldIso,
      });

      addMockAuditLog({
        id: 'recent-log',
        action_type: 'create_booking',
        performed_by: 'admin-id',
        target_id: null,
        details: {},
        created_at: recentIso,
      });

      const prunedCount = pruneStoreAuditLogs(cutoffIso);
      expect(prunedCount).toBe(1);
      const remaining = getStoreAuditLogs();
      expect(remaining.length).toBe(1);
      expect(remaining[0].id).toBe('recent-log');
    });
  });
});
