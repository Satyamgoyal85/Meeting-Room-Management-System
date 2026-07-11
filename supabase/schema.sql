-- ==========================================
-- Dhanuka Agritech Ltd. (GHO Branch)
-- Meeting Room Management System Schema
-- ==========================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Departments Table
CREATE TABLE IF NOT EXISTS public.departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    is_restricted_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Employees Table
CREATE TABLE IF NOT EXISTS public.employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    employee_id TEXT UNIQUE NOT NULL, -- e.g., "DAL-1023", "DAL-0001"
    name TEXT NOT NULL,
    department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    role TEXT NOT NULL CHECK (role IN ('employee', 'admin')) DEFAULT 'employee',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Rooms Table
CREATE TABLE IF NOT EXISTS public.rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE, -- e.g., "Room 5 - Falcon"
    floor TEXT NOT NULL,
    capacity INTEGER NOT NULL CHECK (capacity > 0),
    amenities JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of strings e.g. ["Projector", "Video Conferencing"]
    is_active BOOLEAN DEFAULT true,
    restricted_to_department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.5 Amenities Table
CREATE TABLE IF NOT EXISTS public.amenities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    icon TEXT NOT NULL DEFAULT 'Sparkles',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Bookings Table
CREATE TABLE IF NOT EXISTS public.bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE NOT NULL,
    employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
    department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL NOT NULL,
    agenda TEXT NOT NULL, -- RESTRICTED FIELD: visible only to admin and booking owner
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('confirmed', 'cancelled')) DEFAULT 'confirmed',
    cancelled_by UUID REFERENCES public.employees(id) ON DELETE SET NULL,
    cancel_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

-- 5. Audit Log Table
CREATE TABLE IF NOT EXISTS public.audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_type TEXT NOT NULL CHECK (
        action_type IN ('create_booking', 'cancel_booking', 'edit_booking', 'room_change', 'department_change', 'employee_change')
    ),
    performed_by UUID REFERENCES public.employees(id) ON DELETE SET NULL,
    target_id UUID,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Booking Invitees Table
CREATE TABLE IF NOT EXISTS public.booking_invitees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE NOT NULL,
    employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
    status TEXT NOT NULL DEFAULT 'invited',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. SMTP Settings Table
CREATE TABLE IF NOT EXISTS public.smtp_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_address TEXT NOT NULL,
    port INTEGER NOT NULL DEFAULT 587,
    username TEXT NOT NULL,
    password_encrypted TEXT NOT NULL, -- AES-256-GCM encrypted
    sender_name TEXT NOT NULL,
    sender_email TEXT NOT NULL,
    use_ssl BOOLEAN DEFAULT false,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Email Logs Table
CREATE TABLE IF NOT EXISTS public.email_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient TEXT NOT NULL,
    subject TEXT NOT NULL,
    event_type TEXT NOT NULL,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
    status TEXT NOT NULL,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Password Reset Tokens Table
CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- INDEXES FOR PERFORMANCE & REALTIME
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_bookings_room_time ON public.bookings(room_id, start_time, end_time) WHERE status = 'confirmed';
CREATE INDEX IF NOT EXISTS idx_bookings_employee ON public.bookings(employee_id);
CREATE INDEX IF NOT EXISTS idx_booking_invitees_booking ON public.booking_invitees(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_invitees_employee ON public.booking_invitees(employee_id);
CREATE INDEX IF NOT EXISTS idx_employees_auth_user ON public.employees(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_employees_emp_id ON public.employees(employee_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log(created_at DESC);

-- ==========================================
-- HELPER FUNCTIONS FOR ACCESS CONTROL (SECURITY DEFINER)
-- ==========================================

-- Check if currently logged in auth user is an Admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.employees
        WHERE auth_user_id = auth.uid()
          AND role = 'admin'
          AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get current employee UUID from auth user
CREATE OR REPLACE FUNCTION public.current_employee_id()
RETURNS UUID AS $$
DECLARE
    emp_id UUID;
BEGIN
    SELECT id INTO emp_id FROM public.employees
    WHERE auth_user_id = auth.uid()
      AND is_active = true
    LIMIT 1;
    RETURN emp_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get current employee's department UUID
CREATE OR REPLACE FUNCTION public.current_department_id()
RETURNS UUID AS $$
DECLARE
    dept_id UUID;
BEGIN
    SELECT department_id INTO dept_id FROM public.employees
    WHERE auth_user_id = auth.uid()
      AND is_active = true
    LIMIT 1;
    RETURN dept_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- VIEW FOR PUBLIC BOOKINGS (MASKS AGENDA FIELD)
-- ==========================================
-- Non-admins only see agenda of their own bookings; others see "Private Meeting"
CREATE OR REPLACE VIEW public.v_bookings_public AS
SELECT 
    b.id,
    b.room_id,
    b.employee_id,
    b.department_id,
    CASE 
        WHEN public.is_admin() 
          OR b.employee_id = public.current_employee_id() 
          OR EXISTS (
              SELECT 1 FROM public.booking_invitees bi 
              WHERE bi.booking_id = b.id AND bi.employee_id = public.current_employee_id()
          ) THEN b.agenda
        ELSE 'Private Meeting'
    END AS agenda,
    b.start_time,
    b.end_time,
    b.status,
    b.cancelled_by,
    b.cancel_reason,
    b.created_at
FROM public.bookings b;

-- ==========================================
-- SERVER-SIDE ROOM RESTRICTION & CONFLICT CHECK TRIGGER
-- ==========================================
CREATE OR REPLACE FUNCTION public.check_booking_constraints()
RETURNS TRIGGER AS $$
DECLARE
    room_record RECORD;
    conflict_count INTEGER;
BEGIN
    -- Only check on confirmed bookings
    IF NEW.status = 'confirmed' THEN
        -- 1. Check room restrictions (Server-side enforcement)
        SELECT * INTO room_record FROM public.rooms WHERE id = NEW.room_id;
        
        IF NOT room_record.is_active THEN
            RAISE EXCEPTION 'Room % is currently inactive and cannot be booked.', room_record.name;
        END IF;

        IF room_record.restricted_to_department_id IS NOT NULL AND NOT public.is_admin() THEN
            IF NEW.department_id != room_record.restricted_to_department_id THEN
                RAISE EXCEPTION 'Access Denied: Room % is restricted to a specific department.', room_record.name;
            END IF;
        END IF;

        -- 2. Check for overlapping bookings (Server-side conflict check)
        SELECT COUNT(*) INTO conflict_count
        FROM public.bookings
        WHERE room_id = NEW.room_id
          AND status = 'confirmed'
          AND id != COALESCE(NEW.id, gen_random_uuid())
          AND (start_time, end_time) OVERLAPS (NEW.start_time, NEW.end_time);

        IF conflict_count > 0 THEN
            RAISE EXCEPTION 'Room Conflict: Room is already booked for the selected time slot.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_check_booking_constraints ON public.bookings;
CREATE TRIGGER trg_check_booking_constraints
    BEFORE INSERT OR UPDATE ON public.bookings
    FOR EACH ROW
    EXECUTE FUNCTION public.check_booking_constraints();

-- ==========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amenities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_invitees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smtp_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- Departments Policies
DROP POLICY IF EXISTS "Anyone can read departments" ON public.departments;
CREATE POLICY "Anyone can read departments" ON public.departments FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins can manage departments" ON public.departments;
CREATE POLICY "Admins can manage departments" ON public.departments FOR ALL USING (public.is_admin());

-- Amenities Policies
DROP POLICY IF EXISTS "Anyone can read amenities" ON public.amenities;
CREATE POLICY "Anyone can read amenities" ON public.amenities FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins can manage amenities" ON public.amenities;
CREATE POLICY "Admins can manage amenities" ON public.amenities FOR ALL USING (public.is_admin());

-- Employees Policies
DROP POLICY IF EXISTS "Anyone can read employees" ON public.employees;
CREATE POLICY "Anyone can read employees" ON public.employees FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins can manage employees" ON public.employees;
CREATE POLICY "Admins can manage employees" ON public.employees FOR ALL USING (public.is_admin());

-- Rooms Policies
DROP POLICY IF EXISTS "Anyone can read rooms" ON public.rooms;
CREATE POLICY "Anyone can read rooms" ON public.rooms FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins can manage rooms" ON public.rooms;
CREATE POLICY "Admins can manage rooms" ON public.rooms FOR ALL USING (public.is_admin());

-- Bookings Policies (Restricted direct table access so regular users cannot read unmasked agendas)
DROP POLICY IF EXISTS "Employees can read own or invited bookings on bookings table" ON public.bookings;
CREATE POLICY "Employees can read own or invited bookings on bookings table" ON public.bookings
    FOR SELECT USING (
        employee_id = public.current_employee_id()
        OR public.is_admin()
        OR EXISTS (
            SELECT 1 FROM public.booking_invitees bi 
            WHERE bi.booking_id = id AND bi.employee_id = public.current_employee_id()
        )
    );
DROP POLICY IF EXISTS "Employees can create bookings for themselves" ON public.bookings;
CREATE POLICY "Employees can create bookings for themselves" ON public.bookings
    FOR INSERT WITH CHECK (
        (employee_id = public.current_employee_id() OR public.is_admin())
    );
DROP POLICY IF EXISTS "Employees can update/cancel own confirmed bookings" ON public.bookings;
CREATE POLICY "Employees can update/cancel own confirmed bookings" ON public.bookings
    FOR UPDATE USING (
        (employee_id = public.current_employee_id() AND status = 'confirmed') OR public.is_admin()
    );
DROP POLICY IF EXISTS "Admins bypass all on bookings" ON public.bookings;
CREATE POLICY "Admins bypass all on bookings" ON public.bookings FOR ALL USING (public.is_admin());

-- Booking Invitees Policies
DROP POLICY IF EXISTS "Anyone can read booking invitees" ON public.booking_invitees;
CREATE POLICY "Anyone can read booking invitees" ON public.booking_invitees FOR SELECT USING (true);
DROP POLICY IF EXISTS "Booking owners or admins can manage invitees" ON public.booking_invitees;
CREATE POLICY "Booking owners or admins can manage invitees" ON public.booking_invitees
    FOR ALL USING (
        public.is_admin() OR EXISTS (
            SELECT 1 FROM public.bookings b 
            WHERE b.id = booking_id AND b.employee_id = public.current_employee_id()
        )
    );

-- SMTP Settings Policies (Admin strictly only)
DROP POLICY IF EXISTS "Only admins can manage smtp_settings" ON public.smtp_settings;
CREATE POLICY "Only admins can manage smtp_settings" ON public.smtp_settings FOR ALL USING (public.is_admin());

-- Email Logs Policies (Admin strictly only)
DROP POLICY IF EXISTS "Only admins can manage email_logs" ON public.email_logs;
CREATE POLICY "Only admins can manage email_logs" ON public.email_logs FOR ALL USING (public.is_admin());

-- Password Reset Tokens Policies (Admin strictly only)
DROP POLICY IF EXISTS "Only admins can manage password_reset_tokens" ON public.password_reset_tokens;
CREATE POLICY "Only admins can manage password_reset_tokens" ON public.password_reset_tokens FOR ALL USING (public.is_admin());

-- Audit Log Policies
DROP POLICY IF EXISTS "Admins can read audit log" ON public.audit_log;
CREATE POLICY "Admins can read audit log" ON public.audit_log FOR SELECT USING (public.is_admin());
DROP POLICY IF EXISTS "Authenticated users can insert audit log" ON public.audit_log;
CREATE POLICY "Authenticated users can insert audit log" ON public.audit_log FOR INSERT WITH CHECK (true);

-- ==========================================
-- ENABLE REALTIME ON TABLES
-- ==========================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.amenities;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.departments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.booking_invitees;
