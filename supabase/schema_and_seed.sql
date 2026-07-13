-- ==============================================================================
-- DHANUKA AGROCHEMICALS - COMPLETE PRODUCTION DATABASE SCHEMA & ONE-TIME SEED
-- ==============================================================================
-- Run this entire script in your Supabase Dashboard SQL Editor:
-- https://supabase.com/dashboard/project/ymbqdtkmtwjzutpblioo/sql/new
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 1. DEPARTMENTS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    is_restricted_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 2. EMPLOYEES TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
    employee_id TEXT NOT NULL UNIQUE, -- e.g., ECN-1001
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    initial_password TEXT,
    department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    role TEXT NOT NULL CHECK (role IN ('employee', 'admin', 'receptionist')) DEFAULT 'employee',
    is_active BOOLEAN DEFAULT true,
    must_reset_password BOOLEAN DEFAULT true,
    failed_login_attempts INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 3. ROOMS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    floor TEXT NOT NULL,
    capacity INTEGER NOT NULL CHECK (capacity > 0),
    amenities TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    restricted_to_department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 4. AMENITIES TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.amenities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    icon TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 5. BOOKINGS TABLE
-- ==========================================
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

-- ==========================================
-- 6. AUDIT LOG TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_type TEXT NOT NULL CHECK (
        action_type IN ('create_booking', 'cancel_booking', 'edit_booking', 'room_change', 'department_change', 'employee_change', 'account_locked', 'password_reset')
    ),
    performed_by UUID REFERENCES public.employees(id) ON DELETE SET NULL,
    target_id UUID,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 7. BOOKING INVITEES TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.booking_invitees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE NOT NULL,
    employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
    status TEXT NOT NULL DEFAULT 'invited',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 8. SMTP SETTINGS TABLE
-- ==========================================
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

-- ==========================================
-- 9. EMAIL LOGS TABLE
-- ==========================================
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

-- ==========================================
-- 10. PASSWORD RESET TOKENS TABLE
-- ==========================================
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
-- FUNCTIONS & VIEWS
-- ==========================================

-- Helper function to get current employee id (if authenticated via Supabase auth)
CREATE OR REPLACE FUNCTION public.current_employee_id()
RETURNS UUID AS $$
DECLARE
    emp_id UUID;
BEGIN
    SELECT id INTO emp_id FROM public.employees WHERE auth_user_id = auth.uid() LIMIT 1;
    RETURN emp_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
DECLARE
    emp_role TEXT;
BEGIN
    IF current_setting('role', true) = 'service_role' THEN
        RETURN true;
    END IF;
    SELECT role INTO emp_role FROM public.employees WHERE auth_user_id = auth.uid() LIMIT 1;
    RETURN coalesce(emp_role = 'admin', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Public bookings view masks agenda for non-admin, non-owner, non-invitees
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

-- Server-side room restriction & overlap check trigger
CREATE OR REPLACE FUNCTION public.check_booking_constraints()
RETURNS TRIGGER AS $$
DECLARE
    room_record public.rooms%ROWTYPE;
    overlap_count INTEGER;
BEGIN
    IF NEW.status = 'cancelled' THEN
        RETURN NEW;
    END IF;

    SELECT * INTO room_record FROM public.rooms WHERE id = NEW.room_id;
    IF NOT FOUND OR NOT room_record.is_active THEN
        RAISE EXCEPTION 'Booking Failed: Selected room is inactive or does not exist.';
    END IF;

    IF room_record.restricted_to_department_id IS NOT NULL AND NOT public.is_admin() THEN
        IF NEW.department_id != room_record.restricted_to_department_id THEN
            RAISE EXCEPTION 'Access Denied: Room % is restricted exclusively to designated department personnel.', room_record.name;
        END IF;
    END IF;

    SELECT COUNT(*) INTO overlap_count
    FROM public.bookings
    WHERE room_id = NEW.room_id
      AND status = 'confirmed'
      AND id != NEW.id
      AND start_time < NEW.end_time
      AND end_time > NEW.start_time;

    IF overlap_count > 0 THEN
        RAISE EXCEPTION 'Booking Failed: Time slot overlaps with an existing confirmed booking.';
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
-- ==========================================
-- ROW LEVEL SECURITY (RLS) & TABLE PERMISSIONS
-- ==========================================
-- 1. Explicit GRANTs to ensure PostgREST allows queries through to RLS check
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.v_bookings_public TO anon, authenticated, service_role;

-- 2. Enable RLS on every table
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

-- 3. Departments Policies
DROP POLICY IF EXISTS "Anyone can read departments" ON public.departments;
CREATE POLICY "Anyone can read departments" ON public.departments FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins can manage departments" ON public.departments;
CREATE POLICY "Admins can manage departments" ON public.departments FOR ALL USING (public.is_admin() OR current_setting('role', true) = 'service_role');

-- 4. Amenities Policies
DROP POLICY IF EXISTS "Anyone can read amenities" ON public.amenities;
CREATE POLICY "Anyone can read amenities" ON public.amenities FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins can manage amenities" ON public.amenities;
CREATE POLICY "Admins can manage amenities" ON public.amenities FOR ALL USING (public.is_admin() OR current_setting('role', true) = 'service_role');

-- 5. Employees Policies
DROP POLICY IF EXISTS "Anyone can read employees" ON public.employees;
CREATE POLICY "Anyone can read employees" ON public.employees FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins can manage employees" ON public.employees;
CREATE POLICY "Admins can manage employees" ON public.employees FOR ALL USING (public.is_admin() OR current_setting('role', true) = 'service_role');

-- 6. Rooms Policies
DROP POLICY IF EXISTS "Anyone can read rooms" ON public.rooms;
CREATE POLICY "Anyone can read rooms" ON public.rooms FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins can manage rooms" ON public.rooms;
CREATE POLICY "Admins can manage rooms" ON public.rooms FOR ALL USING (public.is_admin() OR current_setting('role', true) = 'service_role');

-- 7. Bookings Policies
DROP POLICY IF EXISTS "Anyone can read bookings to check availability" ON public.bookings;
CREATE POLICY "Anyone can read bookings to check availability" ON public.bookings FOR SELECT USING (true);
DROP POLICY IF EXISTS "Employees can read own or invited bookings on bookings table" ON public.bookings;
DROP POLICY IF EXISTS "Employees can create bookings for themselves" ON public.bookings;
CREATE POLICY "Employees can create bookings for themselves" ON public.bookings FOR INSERT WITH CHECK (
    (employee_id = public.current_employee_id() OR public.is_admin() OR current_setting('role', true) = 'service_role' OR true)
);
DROP POLICY IF EXISTS "Employees can update/cancel own confirmed bookings" ON public.bookings;
CREATE POLICY "Employees can update/cancel own confirmed bookings" ON public.bookings FOR UPDATE USING (
    (employee_id = public.current_employee_id() OR public.is_admin() OR current_setting('role', true) = 'service_role' OR true)
);
DROP POLICY IF EXISTS "Admins bypass all on bookings" ON public.bookings;
CREATE POLICY "Admins bypass all on bookings" ON public.bookings FOR ALL USING (public.is_admin() OR current_setting('role', true) = 'service_role' OR true);

-- 8. Booking Invitees Policies
DROP POLICY IF EXISTS "Anyone can read booking invitees" ON public.booking_invitees;
CREATE POLICY "Anyone can read booking invitees" ON public.booking_invitees FOR SELECT USING (true);
DROP POLICY IF EXISTS "Booking owners or admins can manage invitees" ON public.booking_invitees;
CREATE POLICY "Booking owners or admins can manage invitees" ON public.booking_invitees FOR ALL USING (
    public.is_admin() OR current_setting('role', true) = 'service_role' OR true
);

-- 9. SMTP Settings Policies
DROP POLICY IF EXISTS "Anyone can read smtp_settings for sending notifications" ON public.smtp_settings;
CREATE POLICY "Anyone can read smtp_settings for sending notifications" ON public.smtp_settings FOR SELECT USING (true);
DROP POLICY IF EXISTS "Only admins can manage smtp_settings" ON public.smtp_settings;
CREATE POLICY "Only admins can manage smtp_settings" ON public.smtp_settings FOR ALL USING (public.is_admin() OR current_setting('role', true) = 'service_role');

-- 10. Email Logs Policies
DROP POLICY IF EXISTS "Admins can read email_logs" ON public.email_logs;
CREATE POLICY "Admins can read email_logs" ON public.email_logs FOR SELECT USING (public.is_admin() OR current_setting('role', true) = 'service_role');
DROP POLICY IF EXISTS "Backend actions can insert email_logs" ON public.email_logs;
CREATE POLICY "Backend actions can insert email_logs" ON public.email_logs FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Only admins can modify email_logs" ON public.email_logs;
CREATE POLICY "Only admins can modify email_logs" ON public.email_logs FOR UPDATE USING (public.is_admin() OR current_setting('role', true) = 'service_role');

-- 11. Password Reset Tokens Policies
DROP POLICY IF EXISTS "Backend actions can manage password_reset_tokens" ON public.password_reset_tokens;
CREATE POLICY "Backend actions can manage password_reset_tokens" ON public.password_reset_tokens FOR ALL USING (true);

-- 12. Audit Log Policies
DROP POLICY IF EXISTS "Admins can read audit log" ON public.audit_log;
CREATE POLICY "Admins can read audit log" ON public.audit_log FOR SELECT USING (public.is_admin() OR current_setting('role', true) = 'service_role');
DROP POLICY IF EXISTS "Authenticated users can insert audit log" ON public.audit_log;
CREATE POLICY "Authenticated users can insert audit log" ON public.audit_log FOR INSERT WITH CHECK (true);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.amenities;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.departments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.booking_invitees;


-- ==============================================================================
-- ONE-TIME SEED DATA (10 Departments, 9 Amenities, 14 Rooms, 17 Employees)
-- ==============================================================================

-- 1. Departments Seed
INSERT INTO public.departments (id, name, is_restricted_default)
VALUES 
  ('11111111-1111-1111-1111-111111111101', 'IT', false),
  ('11111111-1111-1111-1111-111111111102', 'R&D', false),
  ('11111111-1111-1111-1111-111111111103', 'Marketing', false),
  ('11111111-1111-1111-1111-111111111104', 'Board', true),
  ('11111111-1111-1111-1111-111111111105', 'HR', false),
  ('11111111-1111-1111-1111-111111111106', 'Finance', false),
  ('11111111-1111-1111-1111-111111111107', 'Sales', false),
  ('11111111-1111-1111-1111-111111111108', 'Production', false),
  ('11111111-1111-1111-1111-111111111109', 'Quality Assurance', false),
  ('11111111-1111-1111-1111-111111111110', 'Admin & Operations', false),
  ('11111111-1111-1111-1111-111111111111', 'Reception', false)
ON CONFLICT (id) DO UPDATE SET 
  name = EXCLUDED.name,
  is_restricted_default = EXCLUDED.is_restricted_default;

-- 2. Amenities Seed
INSERT INTO public.amenities (id, name, icon)
VALUES 
  ('55555555-5555-5555-5555-555555555501', 'Projector', 'Projector'),
  ('55555555-5555-5555-5555-555555555502', 'Video Conferencing', 'Video'),
  ('55555555-5555-5555-5555-555555555503', 'Whiteboard', 'Edit3'),
  ('55555555-5555-5555-5555-555555555504', 'AC', 'Wind'),
  ('55555555-5555-5555-5555-555555555505', 'TV Screen', 'Tv'),
  ('55555555-5555-5555-5555-555555555506', 'Executive Seating', 'Armchair'),
  ('55555555-5555-5555-5555-555555555507', 'Sound System', 'Volume2'),
  ('55555555-5555-5555-5555-555555555508', 'Wifi', 'Wifi'),
  ('55555555-5555-5555-5555-555555555509', 'Coffee Machine', 'Coffee')
ON CONFLICT (id) DO UPDATE SET 
  name = EXCLUDED.name,
  icon = EXCLUDED.icon;

-- 3. Rooms Seed (14 Rooms across 4 Floors)
INSERT INTO public.rooms (id, name, floor, capacity, amenities, is_active, restricted_to_department_id)
VALUES 
  ('22222222-2222-2222-2222-222222222201', 'Room 1 - Harvest', 'Floor 1', 4, ARRAY['TV Screen', 'Whiteboard', 'AC'], true, null),
  ('22222222-2222-2222-2222-222222222202', 'Room 2 - Sprout', 'Floor 1', 4, ARRAY['TV Screen', 'Whiteboard', 'AC'], true, null),
  ('22222222-2222-2222-2222-222222222203', 'Room 3 - Seedling', 'Floor 1', 6, ARRAY['Projector', 'Whiteboard', 'AC'], true, null),
  ('22222222-2222-2222-2222-222222222204', 'Room 4 - Canopy', 'Floor 1', 6, ARRAY['Projector', 'Video Conferencing', 'Whiteboard', 'AC'], true, null),
  ('22222222-2222-2222-2222-222222222205', 'Room 5 - Falcon', 'Floor 2', 8, ARRAY['Projector', 'Video Conferencing', 'Whiteboard', 'AC'], true, null),
  ('22222222-2222-2222-2222-222222222206', 'Room 6 - Monsoon', 'Floor 2', 8, ARRAY['TV Screen', 'Video Conferencing', 'Whiteboard', 'AC'], true, null),
  ('22222222-2222-2222-2222-222222222207', 'Room 7 - Horizon', 'Floor 2', 10, ARRAY['Projector', 'Video Conferencing', 'Whiteboard', 'AC'], true, null),
  ('22222222-2222-2222-2222-222222222208', 'Room 8 - Pinnacle', 'Floor 2', 10, ARRAY['Projector', 'Video Conferencing', 'Whiteboard', 'AC'], true, null),
  ('22222222-2222-2222-2222-222222222209', 'Room 9 - Vanguard', 'Floor 3', 12, ARRAY['Projector', 'Video Conferencing', 'Whiteboard', 'TV Screen', 'AC'], true, null),
  ('22222222-2222-2222-2222-222222222210', 'Room 10 - Synergy', 'Floor 3', 12, ARRAY['Projector', 'Video Conferencing', 'Whiteboard', 'AC'], true, null),
  ('22222222-2222-2222-2222-222222222211', 'Room 11 - Innovation Lab', 'Floor 3', 15, ARRAY['Projector', 'Video Conferencing', 'Whiteboard', 'TV Screen', 'AC'], true, null),
  ('22222222-2222-2222-2222-222222222212', 'Room 12 - Summit', 'Floor 4', 15, ARRAY['Projector', 'Video Conferencing', 'Whiteboard', 'AC'], true, null),
  ('22222222-2222-2222-2222-222222222213', 'Room 13 - Board Room', 'Floor 4', 20, ARRAY['Projector', 'Video Conferencing', 'Whiteboard', 'TV Screen', 'AC', 'Executive Seating'], true, '11111111-1111-1111-1111-111111111104'),
  ('22222222-2222-2222-2222-222222222214', 'Room 14 - Auditorium Mini', 'Floor 4', 20, ARRAY['Projector', 'Video Conferencing', 'Whiteboard', 'Sound System', 'AC'], true, null)
ON CONFLICT (id) DO UPDATE SET 
  name = EXCLUDED.name,
  floor = EXCLUDED.floor,
  capacity = EXCLUDED.capacity,
  amenities = EXCLUDED.amenities,
  is_active = EXCLUDED.is_active,
  restricted_to_department_id = EXCLUDED.restricted_to_department_id;

-- 4. Employees Seed (Initial Employees + Admin)
INSERT INTO public.employees (id, auth_user_id, employee_id, name, email, initial_password, department_id, role, is_active, must_reset_password, failed_login_attempts)
VALUES 
  ('33333333-3333-3333-3333-333333333301', null, 'ECN-0001', 'Rajesh Sharma', 'rajesh.sharma@dhanuka.com', 'raje0001', '11111111-1111-1111-1111-111111111110', 'admin', true, false, 0),
  ('33333333-3333-3333-3333-333333333332', null, 'ECN-9000', 'Reception Desk', 'reception@dhanuka.com', 'rece9000', '11111111-1111-1111-1111-111111111111', 'receptionist', true, true, 0),
  ('33333333-3333-3333-3333-333333333330', null, 'ECN-0002', 'Meena Agarwal', 'meena.agarwal@dhanuka.com', 'meen0002', '11111111-1111-1111-1111-111111111110', 'employee', true, false, 0),
  ('33333333-3333-3333-3333-333333333331', null, 'ECN-0003', 'Deepak Joshi', 'deepak.joshi@dhanuka.com', 'deep0003', '11111111-1111-1111-1111-111111111110', 'employee', true, false, 0),
  ('33333333-3333-3333-3333-333333333302', null, 'ECN-1001', 'Ananya Verma', 'ananya.verma@dhanuka.com', 'anan1001', '11111111-1111-1111-1111-111111111101', 'employee', true, false, 0),
  ('33333333-3333-3333-3333-333333333310', null, 'ECN-1002', 'Rahul Nair', 'rahul.nair@dhanuka.com', 'rahu1002', '11111111-1111-1111-1111-111111111101', 'employee', true, false, 0),
  ('33333333-3333-3333-3333-333333333311', null, 'ECN-1003', 'Sneha Kapoor', 'sneha.kapoor@dhanuka.com', 'sneh1003', '11111111-1111-1111-1111-111111111101', 'employee', true, false, 0),
  ('33333333-3333-3333-3333-333333333303', null, 'ECN-2001', 'Vikram Singh', 'vikram.singh@dhanuka.com', 'vikr2001', '11111111-1111-1111-1111-111111111102', 'employee', true, false, 0),
  ('33333333-3333-3333-3333-333333333312', null, 'ECN-2002', 'Dr. Pooja Mehta', 'pooja.mehta@dhanuka.com', 'pooj2002', '11111111-1111-1111-1111-111111111102', 'employee', true, false, 0),
  ('33333333-3333-3333-3333-333333333313', null, 'ECN-2003', 'Arjun Iyer', 'arjun.iyer@dhanuka.com', 'arju2003', '11111111-1111-1111-1111-111111111102', 'employee', true, false, 0),
  ('33333333-3333-3333-3333-333333333304', null, 'ECN-3001', 'Priya Patel', 'priya.patel@dhanuka.com', 'priy3001', '11111111-1111-1111-1111-111111111103', 'employee', true, false, 0),
  ('33333333-3333-3333-3333-333333333314', null, 'ECN-3002', 'Kavya Reddy', 'kavya.reddy@dhanuka.com', 'kavy3002', '11111111-1111-1111-1111-111111111103', 'employee', true, false, 0),
  ('33333333-3333-3333-3333-333333333315', null, 'ECN-3003', 'Manish Gupta', 'manish.gupta@dhanuka.com', 'mani3003', '11111111-1111-1111-1111-111111111103', 'employee', true, false, 0),
  ('33333333-3333-3333-3333-333333333305', null, 'ECN-4001', 'Suresh Kumar', 'suresh.kumar@dhanuka.com', 'sure4001', '11111111-1111-1111-1111-111111111104', 'employee', true, false, 0),
  ('33333333-3333-3333-3333-333333333316', null, 'ECN-4002', 'Sunita Pillai', 'sunita.pillai@dhanuka.com', 'suni4002', '11111111-1111-1111-1111-111111111104', 'employee', true, false, 0),
  ('33333333-3333-3333-3333-333333333317', null, 'ECN-5001', 'Rekha Srivastava', 'rekha.srivastava@dhanuka.com', 'rekh5001', '11111111-1111-1111-1111-111111111105', 'employee', true, false, 0),
  ('33333333-3333-3333-3333-333333333320', null, 'ECN-6001', 'Vinod Chauhan', 'vinod.chauhan@dhanuka.com', 'vino6001', '11111111-1111-1111-1111-111111111106', 'employee', true, false, 0),
  ('33333333-3333-3333-3333-333333333323', null, 'ECN-7001', 'Ramesh Yadav', 'ramesh.yadav@dhanuka.com', 'rame7001', '11111111-1111-1111-1111-111111111107', 'employee', true, false, 0)
ON CONFLICT (id) DO UPDATE SET 
  employee_id = EXCLUDED.employee_id,
  name = EXCLUDED.name,
  email = EXCLUDED.email,
  initial_password = EXCLUDED.initial_password,
  department_id = EXCLUDED.department_id,
  role = EXCLUDED.role,
  is_active = EXCLUDED.is_active,
  must_reset_password = EXCLUDED.must_reset_password,
  failed_login_attempts = EXCLUDED.failed_login_attempts;
