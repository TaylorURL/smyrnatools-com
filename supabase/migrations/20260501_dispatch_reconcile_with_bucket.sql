-- Bucket-wide reconciliation. Caller (dispatch-import?reconcile=true) lists
-- every `<date>.html` in the dispatch-reports bucket and passes the dates
-- here. Any `order_date` present in dispatch_data but NOT in the supplied
-- list gets every one of its rows deleted — that handles the case where a
-- whole date was removed from the bucket and would otherwise sit forever
-- as DB-only data.
--
-- Returns one row per date that was pruned, with the count of dispatch_data
-- rows removed for that date. Empty bucket list is rejected so a misfire
-- can't silently wipe the table.

CREATE OR REPLACE FUNCTION dispatch_reconcile_with_bucket(
    p_bucket_dates date[]
) RETURNS TABLE(orphan_date date, rows_deleted integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    distinct_db_dates  integer;
    bucket_date_count  integer;
BEGIN
    IF p_bucket_dates IS NULL OR array_length(p_bucket_dates, 1) IS NULL THEN
        RAISE EXCEPTION 'p_bucket_dates must be a non-empty array — refusing to reconcile against an empty bucket list';
    END IF;

    -- Sanity guard: refuse to run when the supplied bucket list looks
    -- implausibly small relative to what's in the DB. A probe call with
    -- one synthetic date once wiped the whole table; never again. The
    -- threshold is "at least 50% of the DB's distinct dates must be in
    -- the supplied list" — anything less is almost certainly a misfire.
    SELECT count(DISTINCT d.order_date)
      INTO distinct_db_dates
      FROM dispatch_data d
      WHERE d.order_date IS NOT NULL;
    bucket_date_count := array_length(p_bucket_dates, 1);

    IF distinct_db_dates > 0 AND bucket_date_count < (distinct_db_dates / 2) THEN
        RAISE EXCEPTION
            'Reconcile aborted: caller supplied % dates but DB has % distinct dates. Supplied list is implausibly small — refusing to wipe the table.',
            bucket_date_count, distinct_db_dates;
    END IF;

    RETURN QUERY
    WITH deletions AS (
        DELETE FROM dispatch_data d
        WHERE d.order_date IS NOT NULL
          AND NOT (d.order_date = ANY(p_bucket_dates))
        RETURNING d.order_date
    )
    SELECT
        deletions.order_date                AS orphan_date,
        count(*)::integer                   AS rows_deleted
    FROM deletions
    GROUP BY deletions.order_date
    ORDER BY deletions.order_date;
END;
$$;

REVOKE ALL ON FUNCTION dispatch_reconcile_with_bucket(date[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION dispatch_reconcile_with_bucket(date[]) TO service_role;
