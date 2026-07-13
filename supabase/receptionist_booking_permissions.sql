-- =====================================================================================
-- RECEPTIONIST BOOKING PERMISSIONS & RESTRICTED ROOM BYPASS MIGRATION
-- =====================================================================================
-- This migration updates the database functions, triggers, and RLS policies so that
-- the 'receptionist' role can bypass department-based room restrictions (e.g. Board Room)
-- when using the "Book On Behalf Of Employee" feature (`Book For`).
-- Self-booking restricted rooms without booking on behalf of another employee remains restricted.
-- =====================================================================================

-- 1. Helper function to check if current user is receptionist
CREATE OR REPLACE FUNCTION public.is_receptionist()
RETURNS BOOLEAN AS $$
DECLARE
    emp_role TEXT;
BEGIN
    IF current_setting('role', true) = 'service_role' THEN
        RETURN false;
    END IF;
    SELECT role INTO emp_role FROM public.employees WHERE auth_user_id = auth.uid() LIMIT 1;
    RETURN coalesce(emp_role = 'receptionist', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Update server-side booking constraint check trigger
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

    -- Room Restriction Check:
    -- Admins always bypass.
    -- Receptionists bypass ONLY when booking on behalf of another employee (`NEW.employee_id != current_employee_id()`).
    IF room_record.restricted_to_department_id IS NOT NULL THEN
        IF NOT public.is_admin() AND NOT (public.is_receptionist() AND NEW.employee_id != coalesce(public.current_employee_id(), '00000000-0000-0000-0000-000000000000'::uuid)) THEN
            IF NEW.department_id != room_record.restricted_to_department_id THEN
                RAISE EXCEPTION 'Access Denied: Room % is restricted exclusively to designated department personnel.', room_record.name;
            END IF;
        END IF;
    END IF;

    -- Overlap Check
    SELECT COUNT(*) INTO overlap_count
    FROM public.bookings
    WHERE room_id = NEW.room_id
      AND status = 'confirmed'
      AND id != COALESCE(NEW.id, gen_random_uuid())
      AND (start_time, end_time) OVERLAPS (NEW.start_time, NEW.end_time);

    IF overlap_count > 0 THEN
        RAISE EXCEPTION 'Booking Failed: Time slot overlaps with an existing confirmed booking.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Update RLS policies on public.bookings and public.booking_invitees
DROP POLICY IF EXISTS "Employees can create bookings for themselves" ON public.bookings;
CREATE POLICY "Employees can create bookings for themselves" ON public.bookings
    FOR INSERT WITH CHECK (
        (employee_id = public.current_employee_id() OR public.is_admin() OR public.is_receptionist())
    );

DROP POLICY IF EXISTS "Booking owners or admins can manage invitees" ON public.booking_invitees;
CREATE POLICY "Booking owners or admins can manage invitees" ON public.booking_invitees
    FOR ALL USING (
        public.is_admin() OR public.is_receptionist() OR EXISTS (
            SELECT 1 FROM public.bookings b 
            WHERE b.id = booking_id AND b.employee_id = public.current_employee_id()
        )
    );
