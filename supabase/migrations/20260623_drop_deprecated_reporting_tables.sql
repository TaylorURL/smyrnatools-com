-- Drop the schema behind the retired "Reporting" feature set: Maintenance
-- (maintenance_forms), NRMCA / Calibrations & Certifications (nrmca_*), and
-- List + Reports (list_*, reports*). The navigation section and every view
-- reading these tables were removed from the app first, so nothing in src/ or
-- supabase/functions/ touches them.
--
-- DATA SAFETY: every row of all 11 tables below was exported to JSON and uploaded to the
-- sunday-my Files tab (folder "Smyrna Tools Backup 2026-06-23", source backup taken
-- 2026-06-23) before any code or schema removal. Restore from those backups if needed.
--
-- Tables are dropped children-first (FK-safe); CASCADE additionally removes any dependent
-- objects (e.g. foreign-key constraints pointing at these tables) so the drops cannot be
-- blocked by leftover references.

-- List + Reports
DROP TABLE IF EXISTS public.list_items_activity CASCADE;
DROP TABLE IF EXISTS public.list_planned_items CASCADE;
DROP TABLE IF EXISTS public.list_items CASCADE;
DROP TABLE IF EXISTS public.reports_reviewed CASCADE;
DROP TABLE IF EXISTS public.reports CASCADE;

-- Maintenance
DROP TABLE IF EXISTS public.maintenance_form_fields CASCADE;
DROP TABLE IF EXISTS public.maintenance_forms CASCADE;

-- NRMCA / Calibrations & Certifications
DROP TABLE IF EXISTS public.nrmca_scale_calibrations CASCADE;
DROP TABLE IF EXISTS public.nrmca_renewals CASCADE;
DROP TABLE IF EXISTS public.nrmca_scales CASCADE;
DROP TABLE IF EXISTS public.nrmca_plants CASCADE;

-- Functions exclusive to the dropped tables. Sourced from pg_proc and
-- verified to reference no surviving table (the only callers were the
-- removed Lists view's list-service edge function and direct PostgREST
-- calls from its UI). SQL-language functions that depend on a dropped
-- table are typically auto-dropped via the CASCADE on the table above,
-- but we DROP explicitly so the migration is self-documenting and
-- idempotent regardless of the planner's dependency tracking.
DROP FUNCTION IF EXISTS public.fetch_list_items_all();
DROP FUNCTION IF EXISTS public.update_list_item_all(uuid, text, text, timestamptz, text, boolean, timestamptz, text, text, text);

-- The 22 RLS policies attached to the 11 tables above are auto-dropped
-- by the DROP TABLE ... CASCADE statements (policies live ON the table
-- and cannot outlive it), so no explicit DROP POLICY statements are
-- needed. There are no triggers on any of the dropped tables.
