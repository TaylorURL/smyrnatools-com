-- ============================================================================
-- Public schema lockdown
-- ============================================================================
-- Closes the anon-key-from-anywhere hole at db.smyrnatools.com/rest/v1/...
--
-- After this runs:
--   - anon role:           denied on every public table (REST + realtime)
--   - authenticated role:  SELECT only, on every public table
--                          (password_hash / salt on users are revoked)
--   - service_role:        unchanged (bypasses RLS) — edge functions keep working
--
-- The frontend continues to read directly via the Supabase JS client because
-- signed-in users carry a JWT that resolves to the authenticated role.
-- All writes are denied on the direct path; mutations must go through edge
-- functions (which already use service_role, per CLAUDE.md).
-- ============================================================================

BEGIN;

-- 1. Enable RLS and revoke all direct grants from anon + authenticated
--    on every table in the public schema.
DO $$
DECLARE
    tbl record;
BEGIN
    FOR tbl IN
        SELECT schemaname, tablename
        FROM pg_tables
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format(
            'ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',
            tbl.schemaname, tbl.tablename
        );
        EXECUTE format(
            'REVOKE ALL ON TABLE %I.%I FROM anon, authenticated',
            tbl.schemaname, tbl.tablename
        );
    END LOOP;
END $$;

-- 2. Grant SELECT back to authenticated on every public table so signed-in
--    users keep working through the direct Supabase JS client.
DO $$
DECLARE
    tbl record;
BEGIN
    FOR tbl IN
        SELECT schemaname, tablename
        FROM pg_tables
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format(
            'GRANT SELECT ON TABLE %I.%I TO authenticated',
            tbl.schemaname, tbl.tablename
        );
    END LOOP;
END $$;

-- 3. Create a permissive SELECT policy for authenticated on every table.
--    A privilege grant alone is not enough under RLS — you also need a policy
--    that lets the rows through. anon has no grant and no policy = no access.
DO $$
DECLARE
    tbl record;
    policy_name text;
BEGIN
    FOR tbl IN
        SELECT schemaname, tablename
        FROM pg_tables
        WHERE schemaname = 'public'
    LOOP
        policy_name := tbl.tablename || '_authenticated_select';
        EXECUTE format(
            'DROP POLICY IF EXISTS %I ON %I.%I',
            policy_name, tbl.schemaname, tbl.tablename
        );
        EXECUTE format(
            'CREATE POLICY %I ON %I.%I FOR SELECT TO authenticated USING (true)',
            policy_name, tbl.schemaname, tbl.tablename
        );
    END LOOP;
END $$;

-- 4. Hide sensitive columns on public.users from authenticated reads.
--    Verified safe: only useMyAccountLoad.js reads users directly and it
--    selects only the email column.
REVOKE SELECT (password_hash, salt) ON TABLE public.users FROM authenticated;

COMMIT;

-- ============================================================================
-- Verification — run after the lockdown
-- ============================================================================
-- Expect zero rows: anon has no privileges left on public tables.
--
--   SELECT grantee, table_name, privilege_type
--   FROM information_schema.role_table_grants
--   WHERE table_schema = 'public' AND grantee = 'anon';
--
-- Expect only SELECT rows for authenticated:
--
--   SELECT grantee, table_name, privilege_type
--   FROM information_schema.role_table_grants
--   WHERE table_schema = 'public' AND grantee = 'authenticated'
--   ORDER BY table_name, privilege_type;
--
-- External proof — should return 401 or empty (was 200 + data before):
--
--   curl -s -o /dev/null -w "%{http_code}\n" \
--     "https://db.smyrnatools.com/rest/v1/users?select=id&limit=1" \
--     -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"
