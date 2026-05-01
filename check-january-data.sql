-- Inventory January orders/tickets in the database for the Statistics
-- "older data missing" investigation. Run for both Jan 2026 and Jan 2025.

-- 1. Day-by-day row counts inside January.
--    (a) order_stubs = order header rows the daily HTML produces
--    (b) ticket_rows = per-truck rows the detail HTML produces
SELECT
    order_date,
    count(*) FILTER (WHERE ticket_num = '')                AS order_stubs,
    count(*) FILTER (WHERE ticket_num <> '')               AS ticket_rows,
    count(DISTINCT order_id)                               AS distinct_orders,
    sum(quantity) FILTER (WHERE ticket_num <> '')          AS yardage_loaded
FROM dispatch_data
WHERE order_date BETWEEN '2026-01-01' AND '2026-01-31'
GROUP BY order_date
ORDER BY order_date;

SELECT
    order_date,
    count(*) FILTER (WHERE ticket_num = '')                AS order_stubs,
    count(*) FILTER (WHERE ticket_num <> '')               AS ticket_rows,
    count(DISTINCT order_id)                               AS distinct_orders,
    sum(quantity) FILTER (WHERE ticket_num <> '')          AS yardage_loaded
FROM dispatch_data
WHERE order_date BETWEEN '2025-01-01' AND '2025-01-31'
GROUP BY order_date
ORDER BY order_date;

-- 2. Aggregate January totals — quick yes/no on "does data exist".
SELECT
    to_char(order_date, 'YYYY-MM')                         AS month,
    count(DISTINCT order_date)                             AS distinct_dates,
    count(*) FILTER (WHERE ticket_num = '')                AS order_stubs,
    count(*) FILTER (WHERE ticket_num <> '')               AS ticket_rows,
    sum(quantity) FILTER (WHERE ticket_num <> '')          AS yardage_loaded
FROM dispatch_data
WHERE (order_date BETWEEN '2026-01-01' AND '2026-01-31')
   OR (order_date BETWEEN '2025-01-01' AND '2025-01-31')
GROUP BY month
ORDER BY month;

-- 3. Source-report distribution — DailyOrder vs DetailOrderAnalysis vs DetailDriver.
SELECT
    to_char(order_date, 'YYYY-MM')                         AS month,
    src                                                    AS source_report,
    count(*)                                               AS rows
FROM dispatch_data
CROSS JOIN LATERAL unnest(coalesce(source_reports, ARRAY[]::text[])) AS src
WHERE (order_date BETWEEN '2026-01-01' AND '2026-01-31')
   OR (order_date BETWEEN '2025-01-01' AND '2025-01-31')
GROUP BY month, src
ORDER BY month, src;

-- 4. Earliest / latest order_date in the table — frames "how far back does
--    the data even go?".
SELECT
    min(order_date)                                        AS earliest_date,
    max(order_date)                                        AS latest_date,
    count(DISTINCT order_date)                             AS total_distinct_dates
FROM dispatch_data;
