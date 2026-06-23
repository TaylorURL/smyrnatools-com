-- Drop the deprecated "Reporting" feature set (Phase 2 of the Dumb-Down Smyrna Tools effort).
--
-- This removes the database tables backing three view clusters that were deleted from the app
-- in Phase 1: Maintenance (maintenance_forms), NRMCA / Calibrations & Certifications
-- (nrmca_*), and List + Reports (list_*, reports*). The entire "Reporting" navigation
-- section and all of its application code were removed in Phase 1.
--
-- DATA SAFETY: every row of all 11 tables below was exported to JSON and uploaded to the
-- sunday-my Files tab (folder "Smyrna Tools Backup 2026-06-23", source backup taken
-- 2026-06-23) before any code or schema removal. Restore from those backups if needed.
--
-- NOTE: This migration is intentionally NOT applied in Phase 1. It exists so Phase 2 can drop
-- the tables once the code removal has shipped and been verified in production.
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
