-- ==============================================================================
-- Dhanuka Agritech Ltd. (GHO Branch)
-- Meeting Room Management System — Automated Data Retention & Cleanup System
-- ==============================================================================
--
-- This migration script sets up:
-- 1. `usage_stats` summary table for aggregating historical booking data before deletion.
-- 2. `cleanup_job_logs` table for tracking daily cleanup execution status and any errors.
-- 3. `series_id` and `is_recurring` columns on `bookings` to safely protect ongoing recurring series from deletion.
-- 4. `run_daily_booking_cleanup()` PostgreSQL stored procedure with transactional safety:
--    Aggregates eligible bookings (> 7 days old, non-recurring) into weekly and monthly usage statistics FIRST.
--    Only deletes detailed `bookings` rows AFTER safe aggregation is confirmed.
--    Prunes `usage_stats` records older than 6 months.
-- 5. `pg_cron` daily schedule trigger running at 02:00 UTC daily.
-- ==============================================================================

-- ── 1. Create Summary Aggregation Table (usage_stats) ─────────────────────────
CREATE TABLE IF NOT EXISTS public.usage_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE NOT NULL,
    department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    period_start DATE NOT NULL,          -- Monday of the week (weekly) or 1st of the month (monthly)
    period_type TEXT NOT NULL CHECK (period_type IN ('weekly', 'monthly')),
    booking_count INTEGER NOT NULL DEFAULT 0,
    total_hours_booked NUMERIC(10,2) NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT usage_stats_unique_period UNIQUE(room_id, department_id, period_start, period_type)
);

CREATE INDEX IF NOT EXISTS idx_usage_stats_period ON public.usage_stats(period_start DESC, period_type);
CREATE INDEX IF NOT EXISTS idx_usage_stats_room_dept ON public.usage_stats(room_id, department_id);

-- ── 2. Create Cleanup Job Execution Logs Table (cleanup_job_logs) ─────────────
CREATE TABLE IF NOT EXISTS public.cleanup_job_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_name TEXT NOT NULL DEFAULT 'daily_booking_cleanup',
    status TEXT NOT NULL CHECK (status IN ('running', 'success', 'failed', 'completed_with_errors')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    records_aggregated INTEGER DEFAULT 0,
    records_deleted INTEGER DEFAULT 0,
    usage_stats_pruned INTEGER DEFAULT 0,
    audit_logs_pruned INTEGER DEFAULT 0,
    error_message TEXT,
    details JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_cleanup_job_logs_started_at ON public.cleanup_job_logs(started_at DESC);

-- ── 3. Add Series Tracking Columns to Bookings ────────────────────────────────
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bookings' AND column_name='series_id') THEN
        ALTER TABLE public.bookings ADD COLUMN series_id UUID NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bookings' AND column_name='is_recurring') THEN
        ALTER TABLE public.bookings ADD COLUMN is_recurring BOOLEAN DEFAULT false;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bookings_series_id ON public.bookings(series_id) WHERE series_id IS NOT NULL;

-- ── 4. Row Level Security (RLS) for New Tables ────────────────────────────────
ALTER TABLE public.usage_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cleanup_job_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read usage stats" ON public.usage_stats;
CREATE POLICY "Anyone can read usage stats" ON public.usage_stats FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage usage stats" ON public.usage_stats;
CREATE POLICY "Admins can manage usage stats" ON public.usage_stats FOR ALL USING (public.is_admin() OR current_setting('role', true) = 'service_role');

DROP POLICY IF EXISTS "Admins can read cleanup job logs" ON public.cleanup_job_logs;
CREATE POLICY "Admins can read cleanup job logs" ON public.cleanup_job_logs FOR SELECT USING (public.is_admin() OR current_setting('role', true) = 'service_role');

DROP POLICY IF EXISTS "Service role can insert cleanup job logs" ON public.cleanup_job_logs;
CREATE POLICY "Service role can insert cleanup job logs" ON public.cleanup_job_logs FOR INSERT WITH CHECK (current_setting('role', true) = 'service_role' OR public.is_admin());

-- ── 5. Stored Procedure: run_daily_booking_cleanup() ──────────────────────────
CREATE OR REPLACE FUNCTION public.run_daily_booking_cleanup()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_job_id UUID := gen_random_uuid();
    v_eligible_record RECORD;
    v_delete_ids UUID[] := '{}';
    v_aggregated_count INTEGER := 0;
    v_deleted_count INTEGER := 0;
    v_pruned_stats_count INTEGER := 0;
    v_pruned_audit_count INTEGER := 0;
    v_week_start DATE;
    v_month_start DATE;
    v_hours NUMERIC(10,2);
    v_is_active_series BOOLEAN;
BEGIN
    -- Step 0: Insert 'running' log entry
    INSERT INTO public.cleanup_job_logs (id, job_name, status, started_at)
    VALUES (v_job_id, 'daily_booking_cleanup', 'running', NOW());

    -- Step 1: Aggregation Before Deletion (Safety First)
    -- Loop through confirmed bookings where end_time < 7 days ago
    FOR v_eligible_record IN
        SELECT b.id, b.room_id, b.department_id, b.start_time, b.end_time, b.series_id, b.agenda, b.employee_id
        FROM public.bookings b
        WHERE b.status = 'confirmed'
          AND b.end_time < (NOW() - INTERVAL '7 days')
    LOOP
        -- Safety Check: Never delete a booking that is part of an active/ongoing recurring series
        v_is_active_series := false;
        IF v_eligible_record.series_id IS NOT NULL THEN
            SELECT EXISTS (
                SELECT 1 FROM public.bookings b2
                WHERE b2.series_id = v_eligible_record.series_id
                  AND b2.end_time >= NOW()
                  AND b2.status = 'confirmed'
            ) INTO v_is_active_series;
        ELSE
            -- Fallback check for older bookings without series_id
            SELECT EXISTS (
                SELECT 1 FROM public.bookings b2
                WHERE b2.room_id = v_eligible_record.room_id
                  AND b2.employee_id = v_eligible_record.employee_id
                  AND b2.agenda = v_eligible_record.agenda
                  AND b2.end_time >= NOW()
                  AND b2.status = 'confirmed'
                  AND b2.id != v_eligible_record.id
            ) INTO v_is_active_series;
        END IF;

        IF NOT v_is_active_series THEN
            -- Calculate duration in hours
            v_hours := ROUND(EXTRACT(EPOCH FROM (v_eligible_record.end_time - v_eligible_record.start_time))::numeric / 3600.0, 2);
            IF v_hours < 0 THEN v_hours := 0; END IF;

            -- Calculate weekly and monthly period_start dates
            v_week_start := DATE_TRUNC('week', v_eligible_record.start_time AT TIME ZONE 'Asia/Kolkata')::DATE;
            v_month_start := DATE_TRUNC('month', v_eligible_record.start_time AT TIME ZONE 'Asia/Kolkata')::DATE;

            -- Upsert weekly usage stat
            INSERT INTO public.usage_stats (room_id, department_id, period_start, period_type, booking_count, total_hours_booked, updated_at)
            VALUES (v_eligible_record.room_id, v_eligible_record.department_id, v_week_start, 'weekly', 1, v_hours, NOW())
            ON CONFLICT (room_id, department_id, period_start, period_type)
            DO UPDATE SET 
                booking_count = usage_stats.booking_count + 1,
                total_hours_booked = usage_stats.total_hours_booked + EXCLUDED.total_hours_booked,
                updated_at = NOW();

            -- Upsert monthly usage stat
            INSERT INTO public.usage_stats (room_id, department_id, period_start, period_type, booking_count, total_hours_booked, updated_at)
            VALUES (v_eligible_record.room_id, v_eligible_record.department_id, v_month_start, 'monthly', 1, v_hours, NOW())
            ON CONFLICT (room_id, department_id, period_start, period_type)
            DO UPDATE SET 
                booking_count = usage_stats.booking_count + 1,
                total_hours_booked = usage_stats.total_hours_booked + EXCLUDED.total_hours_booked,
                updated_at = NOW();

            v_aggregated_count := v_aggregated_count + 1;
            v_delete_ids := array_append(v_delete_ids, v_eligible_record.id);
        END IF;
    END LOOP;

    -- Step 2: Delete detailed bookings ONLY AFTER safe aggregation is completed without error
    IF array_length(v_delete_ids, 1) > 0 THEN
        -- Delete linked invitees explicitly before deleting bookings
        DELETE FROM public.booking_invitees WHERE booking_id = ANY(v_delete_ids);
        
        DELETE FROM public.bookings WHERE id = ANY(v_delete_ids);
        GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    END IF;

    -- Step 3: Retention on usage_stats (Keep for 6 months, delete older)
    DELETE FROM public.usage_stats WHERE period_start < (CURRENT_DATE - INTERVAL '6 months');
    GET DIAGNOSTICS v_pruned_stats_count = ROW_COUNT;

    -- Step 4: Retention on audit_log (Keep for 1 year / 365 days, delete older)
    DELETE FROM public.audit_log WHERE created_at < (NOW() - INTERVAL '1 year');
    GET DIAGNOSTICS v_pruned_audit_count = ROW_COUNT;

    -- Step 5: Update job log to 'success'
    UPDATE public.cleanup_job_logs
    SET status = 'success',
        completed_at = NOW(),
        records_aggregated = v_aggregated_count,
        records_deleted = v_deleted_count,
        usage_stats_pruned = v_pruned_stats_count,
        audit_logs_pruned = v_pruned_audit_count,
        details = jsonb_build_object(
            'deleted_ids_count', array_length(v_delete_ids, 1),
            'timestamp', NOW()
        )
    WHERE id = v_job_id;

    RETURN jsonb_build_object(
        'status', 'success',
        'job_id', v_job_id,
        'records_aggregated', v_aggregated_count,
        'records_deleted', v_deleted_count,
        'usage_stats_pruned', v_pruned_stats_count,
        'audit_logs_pruned', v_pruned_audit_count
    );

EXCEPTION WHEN OTHERS THEN
    -- Safety Check: Catch any error during aggregation or deletion, rollback changes, and log failure
    UPDATE public.cleanup_job_logs
    SET status = 'failed',
        completed_at = NOW(),
        error_message = SQLERRM,
        details = jsonb_build_object('error_detail', SQLSTATE)
    WHERE id = v_job_id;

    RAISE WARNING 'run_daily_booking_cleanup failed: %', SQLERRM;
    RETURN jsonb_build_object(
        'status', 'failed',
        'job_id', v_job_id,
        'error_message', SQLERRM
    );
END;
$$;

-- ── 6. Automated Daily Schedule (pg_cron) ─────────────────────────────────────
-- Runs every night at 02:00 UTC (07:30 IST)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        -- Unschedule previous job if exists to avoid duplicates
        PERFORM cron.unschedule('daily-booking-cleanup-job') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-booking-cleanup-job');
        -- Schedule new job
        PERFORM cron.schedule('daily-booking-cleanup-job', '0 2 * * *', 'SELECT public.run_daily_booking_cleanup();');
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron extension not installed or permission denied. Use server action cron endpoint instead.';
END $$;
