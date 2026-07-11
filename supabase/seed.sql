-- ==========================================
-- Dhanuka Agritech Ltd. (GHO Branch)
-- Seed Data for Meeting Room Management System
-- ==========================================

-- 1. Insert 10 Departments
INSERT INTO public.departments (id, name, is_restricted_default) VALUES
    ('11111111-1111-1111-1111-111111111101', 'IT', false),
    ('11111111-1111-1111-1111-111111111102', 'R&D', false),
    ('11111111-1111-1111-1111-111111111103', 'Marketing', false),
    ('11111111-1111-1111-1111-111111111104', 'Board', true),
    ('11111111-1111-1111-1111-111111111105', 'HR', false),
    ('11111111-1111-1111-1111-111111111106', 'Finance', false),
    ('11111111-1111-1111-1111-111111111107', 'Sales', false),
    ('11111111-1111-1111-1111-111111111108', 'Production', false),
    ('11111111-1111-1111-1111-111111111109', 'Quality Assurance', false),
    ('11111111-1111-1111-1111-111111111110', 'Admin & Operations', false)
ON CONFLICT (name) DO NOTHING;

-- 1.5 Insert Default Amenities
INSERT INTO public.amenities (id, name, icon) VALUES
    ('55555555-5555-5555-5555-555555555501', 'Projector', 'Projector'),
    ('55555555-5555-5555-5555-555555555502', 'Video Conferencing', 'Video'),
    ('55555555-5555-5555-5555-555555555503', 'Whiteboard', 'Edit3'),
    ('55555555-5555-5555-5555-555555555504', 'AC', 'Wind'),
    ('55555555-5555-5555-5555-555555555505', 'TV Screen', 'Tv'),
    ('55555555-5555-5555-5555-555555555506', 'Executive Seating', 'Armchair'),
    ('55555555-5555-5555-5555-555555555507', 'Sound System', 'Volume2'),
    ('55555555-5555-5555-5555-555555555508', 'Wifi', 'Wifi'),
    ('55555555-5555-5555-5555-555555555509', 'Coffee Machine', 'Coffee')
ON CONFLICT (name) DO NOTHING;

-- 2. Insert 14 Meeting Rooms (GHO Branch)
-- Capacities: 4, 6, 8, 10, 12, 15, 20
INSERT INTO public.rooms (id, name, floor, capacity, amenities, is_active, restricted_to_department_id) VALUES
    -- Floor 1: Small & Medium Rooms
    ('22222222-2222-2222-2222-222222222201', 'Room 1 - Harvest', 'Floor 1', 4, '["TV Screen", "Whiteboard", "AC"]'::jsonb, true, NULL),
    ('22222222-2222-2222-2222-222222222202', 'Room 2 - Sprout', 'Floor 1', 4, '["TV Screen", "Whiteboard", "AC"]'::jsonb, true, NULL),
    ('22222222-2222-2222-2222-222222222203', 'Room 3 - Seedling', 'Floor 1', 6, '["Projector", "Whiteboard", "AC"]'::jsonb, true, NULL),
    ('22222222-2222-2222-2222-222222222204', 'Room 4 - Canopy', 'Floor 1', 6, '["Projector", "Video Conferencing", "Whiteboard", "AC"]'::jsonb, true, NULL),
    
    -- Floor 2: Medium Rooms
    ('22222222-2222-2222-2222-222222222205', 'Room 5 - Falcon', 'Floor 2', 8, '["Projector", "Video Conferencing", "Whiteboard", "AC"]'::jsonb, true, NULL),
    ('22222222-2222-2222-2222-222222222206', 'Room 6 - Monsoon', 'Floor 2', 8, '["TV Screen", "Video Conferencing", "Whiteboard", "AC"]'::jsonb, true, NULL),
    ('22222222-2222-2222-2222-222222222207', 'Room 7 - Horizon', 'Floor 2', 10, '["Projector", "Video Conferencing", "Whiteboard", "AC"]'::jsonb, true, NULL),
    ('22222222-2222-2222-2222-222222222208', 'Room 8 - Pinnacle', 'Floor 2', 10, '["Projector", "Video Conferencing", "Whiteboard", "AC"]'::jsonb, true, NULL),
    
    -- Floor 3: Large Rooms & Labs
    ('22222222-2222-2222-2222-222222222209', 'Room 9 - Vanguard', 'Floor 3', 12, '["Projector", "Video Conferencing", "Whiteboard", "TV Screen", "AC"]'::jsonb, true, NULL),
    ('22222222-2222-2222-2222-222222222210', 'Room 10 - Synergy', 'Floor 3', 12, '["Projector", "Video Conferencing", "Whiteboard", "AC"]'::jsonb, true, NULL),
    ('22222222-2222-2222-2222-222222222211', 'Room 11 - Innovation Lab', 'Floor 3', 15, '["Projector", "Video Conferencing", "Whiteboard", "TV Screen", "AC"]'::jsonb, true, NULL),
    
    -- Floor 4: Executive & Conference Suites
    ('22222222-2222-2222-2222-222222222212', 'Room 12 - Summit', 'Floor 4', 15, '["Projector", "Video Conferencing", "Whiteboard", "AC"]'::jsonb, true, NULL),
    -- Board Room is restricted to Board department (id: 11111111-1111-1111-1111-111111111104)
    ('22222222-2222-2222-2222-222222222213', 'Room 13 - Board Room', 'Floor 4', 20, '["Projector", "Video Conferencing", "Whiteboard", "TV Screen", "AC", "Executive Seating"]'::jsonb, true, '11111111-1111-1111-1111-111111111104'),
    ('22222222-2222-2222-2222-222222222214', 'Room 14 - Auditorium Mini', 'Floor 4', 20, '["Projector", "Video Conferencing", "Whiteboard", "Sound System", "AC"]'::jsonb, true, NULL)
ON CONFLICT (name) DO NOTHING;

-- 3. Insert Sample Employees (Note: In production, auth_user_id will be linked when created via Supabase Auth)
-- 1 Admin + 4 Sample Employees across departments
INSERT INTO public.employees (id, employee_id, name, department_id, role, is_active) VALUES
    ('33333333-3333-3333-3333-333333333301', 'DAL-0001', 'Rajesh Sharma (Admin)', '11111111-1111-1111-1111-111111111110', 'admin', true),
    ('33333333-3333-3333-3333-333333333302', 'DAL-1001', 'Ananya Verma', '11111111-1111-1111-1111-111111111101', 'employee', true),
    ('33333333-3333-3333-3333-333333333303', 'DAL-1002', 'Vikram Singh', '11111111-1111-1111-1111-111111111102', 'employee', true),
    ('33333333-3333-3333-3333-333333333304', 'DAL-1003', 'Priya Patel', '11111111-1111-1111-1111-111111111103', 'employee', true),
    ('33333333-3333-3333-3333-333333333305', 'DAL-1004', 'Suresh Kumar', '11111111-1111-1111-1111-111111111104', 'employee', true)
ON CONFLICT (employee_id) DO NOTHING;

-- 4. Insert Sample Bookings for today/tomorrow (to demonstrate live status and timeline view)
INSERT INTO public.bookings (id, room_id, employee_id, department_id, agenda, start_time, end_time, status) VALUES
    -- Room 5 booked today from 10:00 to 11:30 by IT
    ('44444444-4444-4444-4444-444444444401', '22222222-2222-2222-2222-222222222205', '33333333-3333-3333-3333-333333333302', '11111111-1111-1111-1111-111111111101', 'Q3 IT Infrastructure Upgrade Discussion', CURRENT_DATE + INTERVAL '10 hours', CURRENT_DATE + INTERVAL '11 hours 30 minutes', 'confirmed'),
    -- Room 8 booked today from 14:00 to 15:30 by Marketing
    ('44444444-4444-4444-4444-444444444402', '22222222-2222-2222-2222-222222222208', '33333333-3333-3333-3333-333333333304', '11111111-1111-1111-1111-111111111103', 'Agri-Tech Kharif Campaign Review', CURRENT_DATE + INTERVAL '14 hours', CURRENT_DATE + INTERVAL '15 hours 30 minutes', 'confirmed'),
    -- Board Room booked tomorrow from 11:00 to 13:00 by Board
    ('44444444-4444-4444-4444-444444444403', '22222222-2222-2222-2222-222222222213', '33333333-3333-3333-3333-333333333305', '11111111-1111-1111-1111-111111111104', 'Annual Board Meeting & Strategy Alignment', CURRENT_DATE + INTERVAL '1 day 11 hours', CURRENT_DATE + INTERVAL '1 day 13 hours', 'confirmed')
ON CONFLICT (id) DO NOTHING;
