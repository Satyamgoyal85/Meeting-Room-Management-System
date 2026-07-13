-- ==============================================================================
-- DESTRUCTIVE MIGRATION: COMPLETE MEETING & ROOM DATA RESET
-- ==============================================================================
-- WARNING: This script permanently deletes all rooms, bookings, usage stats,
-- audit logs, and SMTP configuration from the database.
--
-- PRESERVED TABLES (Untouched):
--   - employees
--   - departments
--   - amenities
-- ==============================================================================

-- 1. Ensure service role has full permissions on usage_stats just in case RLS/grants drifted
GRANT ALL ON TABLE public.usage_stats TO postgres, service_role;
GRANT ALL ON TABLE public.smtp_settings TO postgres, service_role;

-- 2. Execute deletions in exact foreign-key child-to-parent order
DELETE FROM public.booking_invitees;
DELETE FROM public.bookings;
DELETE FROM public.rooms;
DELETE FROM public.usage_stats;
DELETE FROM public.audit_log;
DELETE FROM public.smtp_settings;

-- 3. Verify counts after deletion (should all return 0 for wiped tables, and preserve employees/departments/amenities)
SELECT 
  (SELECT COUNT(*) FROM public.booking_invitees) AS booking_invitees_count,
  (SELECT COUNT(*) FROM public.bookings)         AS bookings_count,
  (SELECT COUNT(*) FROM public.rooms)            AS rooms_count,
  (SELECT COUNT(*) FROM public.usage_stats)      AS usage_stats_count,
  (SELECT COUNT(*) FROM public.audit_log)        AS audit_log_count,
  (SELECT COUNT(*) FROM public.smtp_settings)    AS smtp_settings_count,
  (SELECT COUNT(*) FROM public.employees)        AS employees_preserved_count,
  (SELECT COUNT(*) FROM public.departments)      AS departments_preserved_count,
  (SELECT COUNT(*) FROM public.amenities)        AS amenities_preserved_count;
