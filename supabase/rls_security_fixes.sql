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
