-- Audit log for the "Find a Spot" booking-assist tool. Captures every
-- form submission alongside the recommendation the system produced AND
-- the full decision context (rank inputs, conflict math, best-effort
-- slot details, help availability, alternate-time scan results) so a
-- bad suggestion can be diagnosed after the fact by replaying the
-- inputs against the current algorithm.

CREATE TABLE IF NOT EXISTS plan_book_order_logs
(
    id
    UUID
    PRIMARY
    KEY
    DEFAULT
    gen_random_uuid
(
),
    user_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW
(
),

    -- Form inputs the dispatcher filled out
    plan_date DATE NOT NULL,
    yardage NUMERIC,
    requested_start_time TEXT, -- "HH:MM"
    pour_method TEXT,
    truck_spacing_min INTEGER,
    job_address TEXT,
    estimated_trucks INTEGER,
    estimated_pour_window_start_min INTEGER,
    estimated_pour_window_end_min INTEGER,

    -- Recommendation surfaced to the dispatcher
    recommendation_title TEXT,
    recommendation_subtitle TEXT,
    recommendation_kind TEXT, -- 'shift' | 'help' | 'best-effort' | 'none' | 'happy-path'
    recommended_plant_code TEXT,
    recommended_plant_name TEXT,
    recommended_start_time TEXT,
    recommended_date DATE,

    -- Full decision context blob — every input + computed value used
    -- to produce the recommendation. Kept as JSONB so the schema can
    -- evolve with the algorithm without a migration per change.
    decision_context JSONB NOT NULL DEFAULT '{}'::jsonb
    );

CREATE INDEX IF NOT EXISTS idx_plan_book_order_logs_user_created
    ON plan_book_order_logs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_plan_book_order_logs_plan_date
    ON plan_book_order_logs (plan_date);

CREATE INDEX IF NOT EXISTS idx_plan_book_order_logs_recommended_plant
    ON plan_book_order_logs (recommended_plant_code);

-- RLS open at the row level — auth is enforced by the edge function
-- via the `users_sessions` table check before any insert / select.
ALTER TABLE plan_book_order_logs ENABLE ROW LEVEL SECURITY;

DROP
POLICY IF EXISTS plan_book_order_logs_all_access ON plan_book_order_logs;
CREATE
POLICY plan_book_order_logs_all_access ON plan_book_order_logs
    FOR ALL
    USING (true)
    WITH CHECK (true);
