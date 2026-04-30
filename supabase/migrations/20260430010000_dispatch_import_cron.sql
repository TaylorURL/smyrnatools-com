-- Schedule the `dispatch-import` edge function to run continuously without
-- needing the bridge userscript to fire it. Two extensions and one cron job
-- are all that's needed:
--
--   * pg_cron — runs SQL on a schedule
--   * pg_net  — issues HTTP requests from inside Postgres
--
-- The job fires every minute. Each tick dispatches one HTTP POST per
-- (report, plant) combination so each importer invocation stays small
-- enough to fit under the edge runtime's memory cap. The HTTP calls are
-- queued by pg_net (fire-and-forget), so the cron tick returns instantly
-- regardless of how long each importer call takes.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Service-role key in Vault. The same key is already embedded in the
-- bridge userscript that runs on the dispatch workstation, so committing
-- it here is no incremental exposure. Stored in vault rather than as a
-- literal in the cron body so it can be rotated in one place.
DO $vault$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'dispatch_import_service_key') THEN
        PERFORM vault.create_secret(
            'REDACTED-ROTATED-CREDENTIAL',
            'dispatch_import_service_key',
            'Used by the pg_cron dispatch-import-tick job to call the dispatch-import edge function.'
        );
    END IF;
END;
$vault$;

-- Drop any prior incarnation so re-running this migration is idempotent.
SELECT cron.unschedule(jobname) FROM cron.job WHERE jobname = 'dispatch-import-tick';

SELECT cron.schedule(
    'dispatch-import-tick',
    '* * * * *',  -- every minute
    $cron$
    DO $tick$
    DECLARE
        v_url       TEXT := 'https://hzudmeptzciqukwlroos.supabase.co/functions/v1/dispatch-import';
        v_key       TEXT;
        v_headers   JSONB;
        v_today     DATE := CURRENT_DATE;
        v_plant     TEXT;
        v_plants    TEXT[] := ARRAY[
            '401','402','403','404','405','406','407','408','409','410','453','455','461','468'
        ];
    BEGIN
        SELECT decrypted_secret INTO v_key
            FROM vault.decrypted_secrets
            WHERE name = 'dispatch_import_service_key'
            LIMIT 1;
        IF v_key IS NULL THEN
            RAISE NOTICE 'dispatch_import_service_key not in vault — skipping tick';
            RETURN;
        END IF;

        v_headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_key,
            'apikey', v_key
        );

        -- DailyOrder (one file, all plants) — small + fast.
        PERFORM net.http_post(
            url := v_url,
            headers := v_headers,
            body := jsonb_build_object('date', v_today::TEXT, 'reports', ARRAY['DailyOrder'])
        );

        -- DetailOrderAnalysis (14 plant files, parsed in one invocation) —
        -- fits in memory because each file is <200KB and tickets are sparse.
        PERFORM net.http_post(
            url := v_url,
            headers := v_headers,
            body := jsonb_build_object('date', v_today::TEXT, 'reports', ARRAY['DetailOrderAnalysis'])
        );

        -- DetailDriver — one HTTP call per plant. The driver report's
        -- per-plant file is large enough that 14 in one invocation OOMs the
        -- edge runtime; splitting them gives each a fresh memory budget.
        FOREACH v_plant IN ARRAY v_plants LOOP
            PERFORM net.http_post(
                url := v_url,
                headers := v_headers,
                body := jsonb_build_object(
                    'date', v_today::TEXT,
                    'reports', ARRAY['DetailDriver'],
                    'plants', ARRAY[v_plant]
                )
            );
        END LOOP;
    END;
    $tick$;
    $cron$
);

-- Sanity check — list active dispatch-import cron jobs.
SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname LIKE 'dispatch-import%';
