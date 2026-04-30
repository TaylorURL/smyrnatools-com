-- Dispatch report storage tables.
--
-- These tables are populated by an import job that reads the raw HTML files
-- the bridge userscript uploads to the `dispatch-reports` bucket, parses
-- them, and writes structured rows here. The web app reads from these
-- tables instead of pulling + parsing HTML on every page load — orders of
-- magnitude faster, plus enables server-side filtering, aggregation, and
-- joins across reports.
--
-- Three reports feed these tables:
--   1. DailyOrder           — schedule, one row per order (per date)
--   2. DetailOrderAnalysis  — per-ticket details for orders the report's
--                              plant has loaded for (intersection: home
--                              plant AND loading plant)
--   3. DetailDriver         — per-ticket details for every truck loaded by
--                              drivers based at this plant — fills in the
--                              cross-plant gap DetailOrderAnalysis misses
--
-- All access control is enforced at the edge-function layer (the project
-- does NOT use Supabase auth). RLS is `using (true)` per project rules.

-- ============================================================
-- 1. dispatch_orders — DailyOrder schedule data
-- ============================================================
CREATE TABLE IF NOT EXISTS public.dispatch_orders (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_date          DATE        NOT NULL,
    order_id            TEXT        NOT NULL,            -- dispatch URL id (e.g. "1040686947")
    order_num           TEXT,                            -- user-visible order # (e.g. "144")
    home_plant_code     TEXT,                            -- DB plant code (e.g. "403", "408")
    customer            TEXT,
    customer_num        TEXT,
    job_number          TEXT,
    address             TEXT,
    city                TEXT,
    contact             TEXT,
    phone               TEXT,
    po_number           TEXT,
    product_code        TEXT,
    description         TEXT,
    start_time          TEXT,                            -- HH:MM
    rate                TEXT,                            -- minutes between trucks (HH:MM)
    yardage             NUMERIC,
    load_size           NUMERIC,
    truck_count         NUMERIC,
    truck_class         TEXT,
    tkt_time            TEXT,
    to_job_time         TEXT,
    to_plant_time       TEXT,
    raw_data            JSONB,                           -- full parser output for forensics
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT dispatch_orders_date_id_unique UNIQUE (order_date, order_id)
);

CREATE INDEX IF NOT EXISTS dispatch_orders_order_date_idx       ON public.dispatch_orders (order_date);
CREATE INDEX IF NOT EXISTS dispatch_orders_home_plant_idx       ON public.dispatch_orders (home_plant_code, order_date);
CREATE INDEX IF NOT EXISTS dispatch_orders_order_num_idx        ON public.dispatch_orders (order_num);
CREATE INDEX IF NOT EXISTS dispatch_orders_customer_idx         ON public.dispatch_orders USING gin (to_tsvector('simple', COALESCE(customer, '')));

ALTER TABLE public.dispatch_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dispatch_orders_all ON public.dispatch_orders;
CREATE POLICY dispatch_orders_all ON public.dispatch_orders FOR ALL USING (TRUE) WITH CHECK (TRUE);


-- ============================================================
-- 2. dispatch_tickets — per-ticket truck-load data
--    Sourced from DetailOrderAnalysis and DetailDriver, merged by ticket_num.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.dispatch_tickets (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_date             DATE        NOT NULL,
    ticket_num              TEXT        NOT NULL,        -- user-visible ticket # (e.g. "40157821")
    ticket_id               TEXT,                        -- dispatch URL id (DetailOrderAnalysis only)
    order_id                TEXT,                        -- joins to dispatch_orders.order_id when known
    order_num               TEXT,                        -- always present
    home_plant_code         TEXT,                        -- order's home plant (resolved at import time)
    loaded_plant_code       TEXT,                        -- the plant that physically loaded the truck
    truck_num               TEXT,
    driver_num              TEXT,
    driver_name             TEXT,
    customer                TEXT,
    ticket_time             TEXT,                        -- when ticket created (HH:MM)
    loaded_time             TEXT,                        -- when truck finished loading
    to_job_time             TEXT,
    on_job_time             TEXT,
    unload_time             TEXT,
    finished_load_time      TEXT,                        -- "Fin Load"
    to_plant_time           TEXT,
    at_plant_time           TEXT,
    rtt_minutes             NUMERIC,                     -- round-trip time
    quantity                NUMERIC,                     -- concrete yards on this ticket (0 when only DetailDriver-sourced)
    source_reports          TEXT[]    NOT NULL DEFAULT ARRAY[]::TEXT[],  -- e.g. {DetailOrderAnalysis,DetailDriver}
    raw_data                JSONB,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT dispatch_tickets_date_num_unique UNIQUE (ticket_date, ticket_num)
);

CREATE INDEX IF NOT EXISTS dispatch_tickets_ticket_date_idx     ON public.dispatch_tickets (ticket_date);
CREATE INDEX IF NOT EXISTS dispatch_tickets_order_id_idx        ON public.dispatch_tickets (order_id, ticket_date);
CREATE INDEX IF NOT EXISTS dispatch_tickets_order_num_idx       ON public.dispatch_tickets (order_num, ticket_date);
CREATE INDEX IF NOT EXISTS dispatch_tickets_home_plant_idx      ON public.dispatch_tickets (home_plant_code, ticket_date);
CREATE INDEX IF NOT EXISTS dispatch_tickets_loaded_plant_idx    ON public.dispatch_tickets (loaded_plant_code, ticket_date);
CREATE INDEX IF NOT EXISTS dispatch_tickets_truck_idx           ON public.dispatch_tickets (truck_num, ticket_date);
CREATE INDEX IF NOT EXISTS dispatch_tickets_driver_idx          ON public.dispatch_tickets (driver_num, ticket_date);

ALTER TABLE public.dispatch_tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dispatch_tickets_all ON public.dispatch_tickets;
CREATE POLICY dispatch_tickets_all ON public.dispatch_tickets FOR ALL USING (TRUE) WITH CHECK (TRUE);


-- ============================================================
-- 3. dispatch_plant_daily — per-plant per-day production rollup.
--    Pre-computed for fast chart/dashboard queries; the source-of-truth
--    is dispatch_orders + dispatch_tickets, but rollups avoid scanning
--    thousands of rows for common views (yard totals, job counts).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.dispatch_plant_daily (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_date       DATE        NOT NULL,
    plant_code          TEXT        NOT NULL,
    first_job_time      TEXT,
    last_job_time       TEXT,
    order_count         INT         NOT NULL DEFAULT 0,
    scheduled_yardage   NUMERIC     NOT NULL DEFAULT 0,
    loaded_yardage      NUMERIC     NOT NULL DEFAULT 0,        -- concrete yards loaded so far (any plant)
    loaded_yardage_home NUMERIC     NOT NULL DEFAULT 0,        -- yards loaded BY this plant (DetailOrderAnalysis intersection)
    ticket_count        INT         NOT NULL DEFAULT 0,
    truck_count         NUMERIC     NOT NULL DEFAULT 0,        -- planned trucks across orders
    raw_data            JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT dispatch_plant_daily_unique UNIQUE (schedule_date, plant_code)
);

CREATE INDEX IF NOT EXISTS dispatch_plant_daily_date_idx        ON public.dispatch_plant_daily (schedule_date);
CREATE INDEX IF NOT EXISTS dispatch_plant_daily_plant_idx       ON public.dispatch_plant_daily (plant_code, schedule_date);

ALTER TABLE public.dispatch_plant_daily ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dispatch_plant_daily_all ON public.dispatch_plant_daily;
CREATE POLICY dispatch_plant_daily_all ON public.dispatch_plant_daily FOR ALL USING (TRUE) WITH CHECK (TRUE);


-- ============================================================
-- 4. dispatch_report_imports — idempotency / audit log.
--    Records every bucket file the importer has processed, including its
--    parsed counts and ETag so the importer can skip files that haven't
--    changed since last run.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.dispatch_report_imports (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bucket_path         TEXT        NOT NULL,                  -- e.g. "detail/2026-04-30_403.html"
    report_type         TEXT        NOT NULL,                  -- DailyOrder | DetailOrderAnalysis | DetailDriver
    report_date         DATE        NOT NULL,
    plant_code          TEXT,                                  -- null for DailyOrder (multi-plant)
    file_size_bytes     BIGINT,
    file_etag           TEXT,                                  -- last-imported ETag for change detection
    imported_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    duration_ms         INT,
    orders_inserted     INT         NOT NULL DEFAULT 0,
    orders_updated      INT         NOT NULL DEFAULT 0,
    tickets_inserted    INT         NOT NULL DEFAULT 0,
    tickets_updated     INT         NOT NULL DEFAULT 0,
    error               TEXT,
    CONSTRAINT dispatch_report_imports_path_unique UNIQUE (bucket_path)
);

CREATE INDEX IF NOT EXISTS dispatch_report_imports_date_idx     ON public.dispatch_report_imports (report_date);
CREATE INDEX IF NOT EXISTS dispatch_report_imports_type_idx     ON public.dispatch_report_imports (report_type, report_date);
CREATE INDEX IF NOT EXISTS dispatch_report_imports_imported_idx ON public.dispatch_report_imports (imported_at DESC);

ALTER TABLE public.dispatch_report_imports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dispatch_report_imports_all ON public.dispatch_report_imports;
CREATE POLICY dispatch_report_imports_all ON public.dispatch_report_imports FOR ALL USING (TRUE) WITH CHECK (TRUE);


-- ============================================================
-- 5. updated_at triggers — auto-bump on row changes.
-- ============================================================
CREATE OR REPLACE FUNCTION public.dispatch_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS dispatch_orders_set_updated_at ON public.dispatch_orders;
CREATE TRIGGER dispatch_orders_set_updated_at
    BEFORE UPDATE ON public.dispatch_orders
    FOR EACH ROW EXECUTE FUNCTION public.dispatch_set_updated_at();

DROP TRIGGER IF EXISTS dispatch_tickets_set_updated_at ON public.dispatch_tickets;
CREATE TRIGGER dispatch_tickets_set_updated_at
    BEFORE UPDATE ON public.dispatch_tickets
    FOR EACH ROW EXECUTE FUNCTION public.dispatch_set_updated_at();

DROP TRIGGER IF EXISTS dispatch_plant_daily_set_updated_at ON public.dispatch_plant_daily;
CREATE TRIGGER dispatch_plant_daily_set_updated_at
    BEFORE UPDATE ON public.dispatch_plant_daily
    FOR EACH ROW EXECUTE FUNCTION public.dispatch_set_updated_at();
