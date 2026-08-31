-- Drops the `allow_all` policy carried by 43 tables, and the identically
-- shaped `users_pinned_conversations_all`.
--
-- Each was `for all to public using (true) with check (true)`, which is
-- row-level security switched on in name only: it reads as protection to
-- anything that counts policies rather than reading them, and this database
-- has already been caught once by that -- 20260827_close_crm_public_read.sql
-- removed the same shape from six CRM tables holding 689 customer accounts.
--
-- Dropping them takes nothing away from anything that currently works, which
-- was checked against the live instance rather than assumed:
--
--   anon           has no grant on any of these tables. A request carrying the
--                  key that ships in the browser bundle is refused at the grant
--                  layer with 42501 `permission denied` before a policy is ever
--                  consulted. Verified against https://db.smyrnatools.com/rest/v1
--                  for users, users_presence, crm_accounts, messages and plants.
--   authenticated  keeps its own `<table>_authenticated_select` policy on every
--                  table here, so reads are unchanged. The application issues no
--                  Supabase JWT -- it carries its own session in users_sessions
--                  -- so nothing reaches PostgREST under this role today.
--   service_role   bypasses row-level security entirely. This is the path the
--                  application actually uses: the browser calls edge functions,
--                  and the edge functions hold the service key.
--
-- What changes is that the remaining policies now describe the access that is
-- real. Writes are the service role's alone, which is already true in practice.
--
-- Dropped by shape rather than by name so the statement covers every table
-- carrying one and is idempotent on a database that has none.
do $$
declare
    pol record;
begin
    for pol in
        select schemaname, tablename, policyname
        from pg_policies
        where schemaname = 'public'
          and cmd = 'ALL'
          and roles::text = '{public}'
          and coalesce(qual, '') in ('true', '(true)')
          and coalesce(with_check, '') in ('true', '(true)')
    loop
        execute format('drop policy %I on %I.%I', pol.policyname, pol.schemaname, pol.tablename);
    end loop;
end $$;

notify pgrst, 'reload schema';
