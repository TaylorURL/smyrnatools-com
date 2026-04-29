-- Quality issues — active/follow-up/holding/closed disputes tracked by QC.
-- Cost-to-close captures the dollar impact of resolving each issue so QC
-- can roll up financial exposure alongside the operational backlog.
-- RLS uses `USING (true)` per project rules; access control is enforced
-- at the edge-function layer via the `reports.qc_strength` permission.

CREATE TABLE IF NOT EXISTS quality_issues
(
    id
    UUID
    PRIMARY
    KEY
    DEFAULT
    gen_random_uuid
(
),
    title TEXT NOT NULL,
    description TEXT,
    plant_code TEXT,
    region_code TEXT,
    status TEXT NOT NULL DEFAULT 'active'
    CHECK
(
    status
    IN
(
    'active',
    'follow_up',
    'holding',
    'closed'
)),
    severity TEXT
    CHECK
(
    severity
    IN
(
    'low',
    'medium',
    'high',
    'critical'
)),
    cost_to_close NUMERIC
(
    12,
    2
),
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW
(
),
    closed_at TIMESTAMPTZ,
    created_by UUID,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW
(
),
    updated_by UUID
    );

CREATE INDEX IF NOT EXISTS idx_quality_issues_status ON quality_issues(status);
CREATE INDEX IF NOT EXISTS idx_quality_issues_region ON quality_issues(region_code);
CREATE INDEX IF NOT EXISTS idx_quality_issues_plant ON quality_issues(plant_code);
CREATE INDEX IF NOT EXISTS idx_quality_issues_opened ON quality_issues(opened_at DESC);

ALTER TABLE quality_issues ENABLE ROW LEVEL SECURITY;
DROP
POLICY IF EXISTS quality_issues_all ON quality_issues;
CREATE
POLICY quality_issues_all ON quality_issues
    FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS quality_issues_history
(
    id
    UUID
    PRIMARY
    KEY
    DEFAULT
    gen_random_uuid
(
),
    issue_id UUID NOT NULL REFERENCES quality_issues
(
    id
) ON DELETE CASCADE,
    field_name TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW
(
),
    changed_by UUID
    );
CREATE INDEX IF NOT EXISTS idx_quality_issues_history_issue ON quality_issues_history(issue_id);

ALTER TABLE quality_issues_history ENABLE ROW LEVEL SECURITY;
DROP
POLICY IF EXISTS quality_issues_history_all ON quality_issues_history;
CREATE
POLICY quality_issues_history_all ON quality_issues_history
    FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS quality_issues_comments
(
    id
    UUID
    PRIMARY
    KEY
    DEFAULT
    gen_random_uuid
(
),
    issue_id UUID NOT NULL REFERENCES quality_issues
(
    id
) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW
(
),
    created_by UUID
    );
CREATE INDEX IF NOT EXISTS idx_quality_issues_comments_issue ON quality_issues_comments(issue_id);

ALTER TABLE quality_issues_comments ENABLE ROW LEVEL SECURITY;
DROP
POLICY IF EXISTS quality_issues_comments_all ON quality_issues_comments;
CREATE
POLICY quality_issues_comments_all ON quality_issues_comments
    FOR ALL USING (true) WITH CHECK (true);
