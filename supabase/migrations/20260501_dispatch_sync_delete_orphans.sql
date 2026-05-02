-- Removes any `dispatch_data` rows for a given date that weren't part of the
-- freshly-parsed set, keeping the table in lockstep with the bucket on every
-- import. Caller passes the (order_id, ticket_num) tuples that DID land; we
-- delete everything else for that date.
--
-- Stub rows have ticket_num = '' so we coalesce both sides — a missing
-- ticket_num in the input is treated as the stub key, exactly matching the
-- (order_date, order_id, ticket_num) primary key of the table.

CREATE OR REPLACE FUNCTION dispatch_sync_delete_orphans(
    p_date         date,
    p_keys         jsonb,
    p_run_reports  text[] DEFAULT ARRAY['DailyOrder','DetailOrderAnalysis','DetailDriver']
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    deleted_count integer;
BEGIN
    IF p_date IS NULL THEN
        RAISE EXCEPTION 'p_date is required';
    END IF;
    IF jsonb_typeof(p_keys) IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'p_keys must be a JSON array';
    END IF;
    -- Safety latch: refuse to sync when the caller didn't actually upsert
    -- anything. Otherwise an empty `p_keys` would silently delete every
    -- row for the date — exactly the kind of foot-gun a "sync" function
    -- shouldn't expose. Real imports always upsert at least the day's
    -- order stubs, so an empty array means the import bailed early.
    IF jsonb_array_length(p_keys) = 0 THEN
        RETURN 0;
    END IF;

    -- `p_run_reports` lists the reports the caller actually parsed this
    -- run. We only delete rows whose `source_reports` is a SUBSET of that
    -- list — i.e., rows owned exclusively by reports that just re-parsed.
    -- Rows that also list a report we didn't run are left alone, since we
    -- didn't have a chance to verify them.
    --
    -- Default = the full report set, which means the subset check passes
    -- for every row (preserving behavior for full-default callers).
    WITH live AS (
        SELECT
            (k->>'order_id')::text                  AS order_id,
            coalesce(k->>'ticket_num', '')::text    AS ticket_num
        FROM jsonb_array_elements(p_keys) AS k
        WHERE coalesce(k->>'order_id','') <> ''
    )
    DELETE FROM dispatch_data d
    WHERE d.order_date = p_date
      AND coalesce(d.source_reports, ARRAY[]::text[]) <@ p_run_reports
      AND NOT EXISTS (
          SELECT 1 FROM live l
          WHERE l.order_id   = d.order_id
            AND l.ticket_num = coalesce(d.ticket_num, '')
      );

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION dispatch_sync_delete_orphans(date, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION dispatch_sync_delete_orphans(date, jsonb) TO service_role;
