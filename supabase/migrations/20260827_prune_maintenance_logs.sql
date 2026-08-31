-- Keep the two housekeeping tables from growing without bound.
--
-- pg_cron appends a row to cron.job_run_details for every run of every job and
-- never removes one. With the dispatch import ticking every five minutes, that
-- table had reached 37,810 rows spanning a year and 316 MB on disk.
--
-- pg_net deletes old rows from net._http_response but a plain DELETE only marks
-- the space reusable, so a burst of responses leaves a file that never shrinks
-- back. It was holding 1,508 live rows -- 231 kB of content -- in 1,129 MB.
--
-- The cost of that is not the disk. Every sequential scan, every autovacuum
-- pass, and pg_net's own cleanup DELETE read the whole file, and that cleanup
-- had become the longest-running statement on the instance at 449 s. While it
-- ran, unrelated queries hit the statement timeout and PostgREST returned 500 --
-- including primary-key reads on tables holding a few dozen rows.
--
-- Both tables were compacted by hand when this was diagnosed. The jobs below
-- are what stop them getting back there.

-- Nothing reads a cron run older than a week; the recent rows are what a failing
-- job is diagnosed from.
select cron.unschedule('prune-cron-run-log')
    where exists (select 1 from cron.job where jobname = 'prune-cron-run-log');

select cron.schedule(
    'prune-cron-run-log',
    '15 4 * * *',
    $$delete from cron.job_run_details where end_time < now() - interval '7 days'$$
);

-- The prune above only frees space for reuse. Vacuuming behind it is what keeps
-- the file itself flat.
select cron.unschedule('vacuum-maintenance-logs')
    where exists (select 1 from cron.job where jobname = 'vacuum-maintenance-logs');

select cron.schedule('vacuum-maintenance-logs', '45 4 * * 0', 'vacuum (analyze) cron.job_run_details');

select cron.unschedule('vacuum-http-response-log')
    where exists (select 1 from cron.job where jobname = 'vacuum-http-response-log');

select cron.schedule('vacuum-http-response-log', '55 4 * * 0', 'vacuum (analyze) net._http_response');
