-- ============================================================================
-- ROLLBACK of lockdown_rls.sql — restores the pre-lockdown state.
-- Run this immediately to unbreak the site while we fix the edge functions.
-- ============================================================================
BEGIN;

-- 1. Drop the SELECT policies we created.
DO $$
DECLARE
    tbl record;
    policy_name text;
BEGIN
    FOR tbl IN
        SELECT schemaname, tablename FROM pg_tables WHERE schemaname = 'public'
    LOOP
        policy_name := tbl.tablename || '_authenticated_select';
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
                       policy_name, tbl.schemaname, tbl.tablename);
    END LOOP;
END $$;

-- 2. Restore full table privileges to anon and authenticated on every public
--    table. This matches the original pre-lockdown grants.
DO $$
DECLARE
    tbl record;
BEGIN
    FOR tbl IN
        SELECT schemaname, tablename FROM pg_tables WHERE schemaname = 'public'
    LOOP
        EXECUTE format('GRANT ALL ON TABLE %I.%I TO anon, authenticated',
                       tbl.schemaname, tbl.tablename);
    END LOOP;
END $$;

-- 3. Restore column-level SELECT on users.password_hash + users.salt
--    (the column-level revoke we added).
GRANT SELECT (password_hash, salt) ON TABLE public.users TO authenticated;

-- Note: we leave ENABLE ROW LEVEL SECURITY on. Without policies that's
-- equivalent to deny-all under RLS — but since we restored GRANTs and there's
-- no per-table policy left, you also need a permissive RLS policy. Add one:
DO $$
DECLARE
    tbl record;
    policy_name text;
BEGIN
    FOR tbl IN
        SELECT schemaname, tablename FROM pg_tables WHERE schemaname = 'public'
    LOOP
        policy_name := tbl.tablename || '_allow_all';
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
                       policy_name, tbl.schemaname, tbl.tablename);
        EXECUTE format(
            'CREATE POLICY %I ON %I.%I FOR ALL USING (true) WITH CHECK (true)',
            policy_name, tbl.schemaname, tbl.tablename
        );
    END LOOP;
END $$;

COMMIT;
