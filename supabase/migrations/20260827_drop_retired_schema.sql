-- Remove the schema behind what the app no longer does: dispatch order data,
-- Dayforce time import, Plans, the maintenance log and submissions, operator
-- teams, Saturday forecasts, and travel-time caching.
--
-- Nothing in src/ or supabase/functions/ reads any of these 24 tables. Their
-- edge functions had already outlived the code too -- dispatch-import,
-- dispatch-data-service, dayforce-import, plan-service, book-order-log-service,
-- schedule-snapshot-service, daily-plan-email, saturday-forecast-service,
-- traffic-service, geocode-service and chat-service were all still deployed with
-- no source in this repository and no caller in the app, and have been removed.
-- The cron jobs that drove them are unscheduled below.
--
-- dispatch_data was the live one: a browser userscript uploaded dispatch reports
-- to storage and a five-minute tick fired 26 edge-function imports per run, which
-- had taken 11.46M row updates against 55,860 rows and was the standing write
-- load on the instance. The app never read a row of it, and nothing in the
-- repository drives the upload any more.
--
-- DATA SAFETY: every row of all 24 tables was exported to JSON before this ran,
-- along with the source of each removed edge function, to
-- ~/Archives/smyrna-tools-backup-2026-08-27 on the workstation (123 MB,
-- 2026-08-27). Restore from there if a table is wanted back.
--
-- The foreign keys among these tables all point within the set, so no surviving
-- table loses a constraint. Children are dropped first regardless, and CASCADE
-- covers the policies and triggers that live on them.

-- The jobs are unscheduled by name so this is idempotent, and so a fresh
-- database that never had them is not an error.
select cron.unschedule(jobname)
    from cron.job
    where jobname in (
        'dispatch-import-tick',
        'schedule-snapshot-cdt', 'schedule-snapshot-cst',
        'email-baseline-snapshot-cdt', 'email-baseline-snapshot-cst',
        'email-baseline-snapshot-sat-cdt', 'email-baseline-snapshot-sat-cst',
        'plan-corrections-cdt', 'plan-corrections-cst',
        'plan-corrections-sat-cdt', 'plan-corrections-sat-cst'
    );

-- Dispatch order data.
drop function if exists public.service_improvement_summary(date, integer);
drop function if exists public.dispatch_upsert_data(jsonb);
drop function if exists public.dispatch_reconcile_with_bucket(date[]);
drop function if exists public.dispatch_sync_delete_orphans(date, jsonb);
drop function if exists public.dispatch_sync_delete_orphans(date, jsonb, text[]);
drop table if exists public.dispatch_data cascade;
drop function if exists public.dispatch_data_set_updated_at();

-- Dayforce time import.
drop table if exists public.dayforce_raw_punches cascade;
drop table if exists public.dayforce_shifts cascade;
drop table if exists public.dayforce_employees cascade;
drop table if exists public.dayforce_org_units cascade;

-- Plans, and the snapshots and emails built on them.
drop function if exists public.trigger_plan_corrections_email();
drop function if exists public.trigger_daily_plan_email();
drop function if exists public.trigger_email_baseline_snapshot();
drop function if exists public.trigger_schedule_snapshot();
drop table if exists public.plan_book_order_logs cascade;
drop table if exists public.plan_schedule_snapshots cascade;
drop table if exists public.plan_schedule_snapshot_config cascade;
drop table if exists public.plan_templates cascade;
drop table if exists public.users_plans cascade;
drop table if exists public.plans cascade;
drop table if exists public.plan_settings cascade;
drop function if exists public.plan_settings_touch_updated_at();
drop table if exists public.daily_plan_email_config cascade;

-- Maintenance log and submissions.
drop table if exists public.maintenance_due_items cascade;
drop table if exists public.maintenance_submission_responses cascade;
drop table if exists public.maintenance_submissions cascade;
drop table if exists public.maintenance_log_entries cascade;
drop table if exists public.maintenance_log_equipment cascade;
drop table if exists public.maintenance_log_categories cascade;
drop table if exists public.maintenance_log_service_types cascade;

-- Operator teams and Saturday forecasts.
drop table if exists public.operators_teams cascade;
drop table if exists public.saturday_operator_forecasts cascade;

-- Travel-time caching, which only the removed traffic and geocode services wrote.
drop function if exists public.purge_stale_travel_cache();
drop table if exists public.travel_time_cache cascade;
drop table if exists public.plant_travel_times cascade;
