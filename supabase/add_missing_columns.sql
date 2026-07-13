-- Migration to add missing columns across tables based on application requirements

-- 1. Employees table missing columns
ALTER TABLE public.employees 
  ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false;

-- Re-create the role constraint to ensure it includes receptionist (just to be safe)
ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_role_check;
ALTER TABLE public.employees ADD CONSTRAINT employees_role_check CHECK (role IN ('employee', 'admin', 'receptionist'));

-- 2. SMTP Settings missing columns
ALTER TABLE public.smtp_settings
  ADD COLUMN IF NOT EXISTS password_required BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_configured BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.employees(id) ON DELETE SET NULL;

-- 3. Additional fixes just in case (as verified)
-- (No other missing columns found during full audit of types vs DB)

-- Force schema cache reload for PostgREST by notifying the pgrst daemon
NOTIFY pgrst, 'reload schema';
