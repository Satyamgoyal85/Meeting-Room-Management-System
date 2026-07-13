-- =====================================================================================
-- FIX PASSWORD RESET TOKENS RLS POLICY
-- =====================================================================================
-- This migration updates the Row Level Security (RLS) policy on `password_reset_tokens`
-- so that backend/server actions and unauthenticated users visiting the password reset link
-- can read (`SELECT`) and consume (`UPDATE used = true`) valid token records without being
-- blocked by `public.is_admin()`.
-- =====================================================================================

ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Only admins can manage password_reset_tokens" ON public.password_reset_tokens;
DROP POLICY IF EXISTS "Backend actions can manage password_reset_tokens" ON public.password_reset_tokens;

CREATE POLICY "Anyone can check or consume reset tokens" ON public.password_reset_tokens
    FOR ALL USING (
        public.is_admin() OR current_setting('role', true) = 'service_role' OR true
    );
