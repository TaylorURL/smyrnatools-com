-- ROLLBACK of 20260504_jwt_session_rls_global_lockdown.sql
--
-- The lockdown assumed we could mint JWTs against a symmetric
-- SUPABASE_JWT_SECRET. This project is on Supabase's new asymmetric
-- (JWKS) auth, so the signing key is held server-side by Supabase and
-- isn't exposed to edge functions — meaning we can't produce a JWT
-- PostgREST will accept. Restoring the previous "anon can read
-- everything" posture so the app works again.

do $$
declare
    t record;
    policy_name text;
begin
    for t in
        select tablename
        from pg_tables
        where schemaname = 'public'
    loop
        for policy_name in
            select policyname
            from pg_policies
            where schemaname = 'public'
              and tablename = t.tablename
        loop
            execute format('drop policy if exists %I on public.%I', policy_name, t.tablename);
        end loop;

        execute format('grant all on public.%I to anon', t.tablename);
        execute format('grant all on public.%I to authenticated', t.tablename);
        execute format('grant all on public.%I to service_role', t.tablename);

        execute format(
            'create policy "allow_all" on public.%I as permissive for all to public using (true) with check (true)',
            t.tablename
        );
    end loop;
end
$$;

do $$
declare
    s record;
begin
    for s in
        select sequence_name
        from information_schema.sequences
        where sequence_schema = 'public'
    loop
        execute format('grant usage, select on sequence public.%I to anon, authenticated, service_role', s.sequence_name);
    end loop;
end
$$;

drop function if exists public.has_active_session();
