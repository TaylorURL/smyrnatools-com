-- Investigate "April 14 missing data" on the Plan Statistics page.
--
-- Replace the :target_date binding (or substitute the literal) for the
-- year you actually want to verify. The Statistics page treats `older data`
-- as anything not in the current default window, so we usually mean the
-- most recent April 14 first.

-- ---------------------------------------------------------------------------
-- 1. plans table — does a saved plan exist for that date?
--    A row here means a dispatcher opened/saved Plan view that day. No row
--    means the day is invisible to every Statistics chart that pulls from
--    `plans` (yardage, orders, loads, customer/product breakdowns).
-- ---------------------------------------------------------------------------
SELECT
    plan_date,
    updated_at,
    jsonb_typeof(plant_production)                         AS plant_production_type,
    coalesce(jsonb_object_keys_count(plant_production), 0) AS plant_codes_in_production,
    coalesce(jsonb_array_length(assignments), 0)           AS assignment_count
FROM plans
WHERE plan_date IN ('2026-04-14', '2025-04-14')
ORDER BY plan_date;

-- (helper — Postgres has no built-in jsonb_object_keys_count, swap in this
--  inline expression if the function isn't defined in the schema)
SELECT
    plan_date,
    updated_at,
    (
        SELECT count(*) FROM jsonb_object_keys(plant_production)
    )                                                      AS plant_codes_in_production,
    coalesce(jsonb_array_length(assignments), 0)           AS assignment_count
FROM plans
WHERE plan_date IN ('2026-04-14', '2025-04-14')
ORDER BY plan_date;

-- ---------------------------------------------------------------------------
-- 2. dispatch_data — was the daily HTML import run for that date?
--    `ticket_num = ''` rows are order-header stubs (DailyOrder pass).
--    Real ticket rows have ticket_num != ''.
-- ---------------------------------------------------------------------------
SELECT
    order_date,
    count(*) FILTER (WHERE ticket_num = '')                AS order_stub_rows,
    count(*) FILTER (WHERE ticket_num <> '')               AS ticket_rows,
    count(DISTINCT order_id)                               AS distinct_orders,
    count(DISTINCT loaded_plant_code) FILTER (
        WHERE ticket_num <> ''
    )                                                       AS plants_with_tickets,
    sum(quantity) FILTER (WHERE ticket_num <> '')          AS total_yardage_loaded
FROM dispatch_data
WHERE order_date IN ('2026-04-14', '2025-04-14')
GROUP BY order_date
ORDER BY order_date;

-- ---------------------------------------------------------------------------
-- 3. Per-plant breakdown for the same day — surfaces partial imports
--    (e.g. some plants imported, some skipped). Expected plant codes:
--    401, 402, 403, 404, 405, 406, 407, 408, 409, 410, 453, 455, 461, 468.
-- ---------------------------------------------------------------------------
SELECT
    order_date,
    coalesce(loaded_plant_code, '(none)')                  AS loaded_plant_code,
    count(*)                                               AS rows,
    count(*) FILTER (WHERE ticket_num <> '')               AS ticket_rows,
    sum(quantity) FILTER (WHERE ticket_num <> '')          AS yardage_loaded
FROM dispatch_data
WHERE order_date IN ('2026-04-14', '2025-04-14')
GROUP BY order_date, loaded_plant_code
ORDER BY order_date, loaded_plant_code;

-- ---------------------------------------------------------------------------
-- 4. Source-report distribution — which HTML reports actually landed.
--    DailyOrder       → `<date>.html`
--    DetailOrderAnalysis → `detail/<date>_<plant>.html`
--    DetailDriver     → `driver/<date>_<plant>.html`
--    A day missing DetailOrderAnalysis explains "no ticket detail / no
--    customer satisfaction" while still having yardage from DailyOrder.
-- ---------------------------------------------------------------------------
SELECT
    order_date,
    src                                                    AS source_report,
    count(*)                                               AS rows
FROM dispatch_data
CROSS JOIN LATERAL unnest(
    coalesce(source_reports, ARRAY[]::text[])
) AS src
WHERE order_date IN ('2026-04-14', '2025-04-14')
GROUP BY order_date, src
ORDER BY order_date, src;

-- ---------------------------------------------------------------------------
-- 5. Sanity: how do neighboring days look?  Apr 14 ± 3 days. If neighbors
--    have data and Apr 14 doesn't, the import was skipped for Apr 14
--    specifically (vs. a multi-day gap).
-- ---------------------------------------------------------------------------
SELECT
    order_date,
    count(*) FILTER (WHERE ticket_num <> '')               AS ticket_rows,
    count(DISTINCT order_id) FILTER (WHERE ticket_num = '') AS order_stubs
FROM dispatch_data
WHERE order_date BETWEEN '2026-04-11' AND '2026-04-17'
   OR order_date BETWEEN '2025-04-11' AND '2025-04-17'
GROUP BY order_date
ORDER BY order_date;
