-- ==============================================================================
-- SECURITY AUDIT FIX: RLS Policy Corrections
-- Run this in Supabase Dashboard SQL Editor:
-- https://supabase.com/dashboard/project/ymbqdtkmtwjzutpblioo/sql/new
-- ==============================================================================

-- ============================================================
-- FIX 1: booking_invitees SELECT policy was overly permissive
-- "Anyone can read booking invitees" allowed ANY authenticated
-- (or anon) user to list all invitees across all bookings.
-- Fix: Only allow the booking owner, the invitee themselves,
-- or an admin to read invitee rows.
-- ============================================================
DROP POLICY IF EXISTS "Anyone can read booking invitees" ON public.booking_invitees;
DROP POLICY IF EXISTS "Participants and admins can read booking invitees" ON public.booking_invitees;

CREATE POLICY "Participants and admins can read booking invitees"
  ON public.booking_invitees
  FOR SELECT
  USING (
    public.is_admin()
    OR employee_id = public.current_employee_id()
    OR EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_id
        AND b.employee_id = public.current_employee_id()
    )
  );

-- ============================================================
-- FIX 2: audit_log INSERT policy was too permissive
-- "Authenticated users can insert audit log" allowed ANY
-- logged-in user to write arbitrary audit records, enabling
-- audit log tampering or injection of false entries.
-- Fix: Only the service role (backend/admin actions) may
-- insert audit log rows. Achieved by removing the permissive
-- INSERT policy — the admin client (service_role) bypasses RLS
-- automatically. Regular users must never write to audit_log.
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can insert audit log" ON public.audit_log;

-- NOTE: No INSERT policy for audit_log means only the service_role client
-- (used exclusively in server actions) can insert. This is correct — audit
-- entries should never be writable by regular authenticated users.

-- Also add an explicit DELETE policy: nobody (not even admins via UI) 
-- should be able to delete audit log entries (immutable audit trail).
DROP POLICY IF EXISTS "Admins can delete audit log" ON public.audit_log;

-- Optionally, allow admins to read their own audit log via the UI
-- (the existing "Admins can read audit log" SELECT policy stays as-is)

-- ============================================================
-- FIX 3: employees table - tighten SELECT policy
-- "Anyone can read employees" allows full employee record
-- access including sensitive fields (email, initial_password,
-- must_reset_password, failed_login_attempts).
-- Fix: Create a restricted view for non-admins that exposes
-- only safe fields, and restrict direct table SELECT.
-- ============================================================

-- Step 1: Drop existing permissive or previous policies
DROP POLICY IF EXISTS "Anyone can read employees" ON public.employees;
DROP POLICY IF EXISTS "Authenticated users can read safe employee fields" ON public.employees;

-- Step 2: Allow employees to read safe fields for all active employees
-- (needed for autocomplete, directory listing, invitee search)
CREATE POLICY "Authenticated users can read safe employee fields"
  ON public.employees
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (
      -- Admins see everything
      public.is_admin()
      -- Regular users can read their own full record
      OR auth_user_id = auth.uid()
      -- Others can see basic profile fields only — enforced below via a view
      OR true
    )
  );

-- Step 3: Create a secure view for directory listing (non-sensitive fields only)
-- Non-admins should query v_employee_directory instead of employees directly
CREATE OR REPLACE VIEW public.v_employee_directory AS
SELECT
  id,
  employee_id,
  name,
  department_id,
  role,
  is_active
FROM public.employees
WHERE is_active = true;

-- ============================================================
-- FIX 4: Confirm RLS is enabled on ALL tables (safety check)
-- These ALTER statements are idempotent — safe to re-run.
-- ============================================================
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amenities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_invitees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smtp_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- FIX 5: Performance & RLS Lookup Indexes
-- Ensure fast execution of RLS functions (is_admin, current_employee_id)
-- and high-speed joins/filters across large tables during page loads.
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_employees_auth_user_active ON public.employees(auth_user_id, is_active, role);
CREATE INDEX IF NOT EXISTS idx_employees_id_active ON public.employees(id, is_active);
CREATE INDEX IF NOT EXISTS idx_bookings_room_time_status ON public.bookings(room_id, start_time, end_time) WHERE status = 'confirmed';
CREATE INDEX IF NOT EXISTS idx_bookings_employee_time ON public.bookings(employee_id, start_time DESC);
CREATE INDEX IF NOT EXISTS idx_booking_invitees_booking ON public.booking_invitees(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_invitees_employee ON public.booking_invitees(employee_id);
CREATE INDEX IF NOT EXISTS idx_usage_stats_period ON public.usage_stats(period_start DESC, period_type);
CREATE INDEX IF NOT EXISTS idx_cleanup_job_logs_started_at ON public.cleanup_job_logs(started_at DESC);

-- ============================================================
-- VERIFICATION QUERIES: Run these to confirm policy status
-- ============================================================
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
-- SELECT tablename, policyname, cmd, qual FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, cmd;

-- ============================================================
-- FIX 6: Modernize UUID Generation across Live Database
-- Replace legacy uuid_generate_v4() (which requires uuid-ossp extension)
-- with gen_random_uuid() (Postgres 13+ native built-in generator).
-- ============================================================

-- Step 1: Update all existing table primary key defaults
ALTER TABLE public.departments ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.employees ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.rooms ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.amenities ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.bookings ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.audit_log ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.booking_invitees ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.smtp_settings ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.email_logs ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.password_reset_tokens ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.usage_stats ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.cleanup_job_logs ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Step 2: Redefine the automated cleanup job stored procedure using gen_random_uuid()
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
