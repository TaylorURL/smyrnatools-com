-- Global lockdown: every public table now requires a custom session JWT
-- (minted by `auth-service` after credential verification) to be read or
-- written. The anon role is fully revoked across the public schema, so
-- the anon key embedded in the JS bundle no longer unlocks anything.
--
-- How the policy works:
--   • The frontend's `Database` client sends every REST + Storage request
--     with `Authorization: Bearer <session_jwt>` (see
--     `src/services/DatabaseService.js`).
--   • The JWT is signed with the project's JWT secret and carries
--     `{ role: "authenticated", sub: <user_id>, session_id: <session_id> }`.
--   • PostgREST honors the signature, runs the query as the
--     `authenticated` Postgres role, and exposes the claims to RLS via
--     `auth.jwt()`.
--   • The policy below requires `session_id` to point at a live row in
--     `users_sessions` whose `last_active` is within the 7-day window —
--     so revoking a session (or terminating a user) takes effect on the
--     very next query.
--
-- Trust posture: identical to today's "any authenticated user can read /
-- write any table." If you eventually want per-user data isolation you
-- can layer a stricter `using (...)` predicate on individual tables that
-- inspects `auth.jwt() ->> 'sub'` or joins to `users_permissions`.

create
or replace function public.has_active_session()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
select exists (select 1
               from public.users_sessions
               where id::text = (auth.jwt() ->> 'session_id')
    and last_active > now() - interval '7 days')
           $$;

revoke all on function public.has_active_session() from public;
grant
execute
on
function
public
.
has_active_session
() to authenticated, service_role;

do
$$
declare
t record;
    policy_name
text;
begin
for t in
select tablename
from pg_tables
where schemaname = 'public' loop
        execute format('alter table public.%I enable row level security', t.tablename);

for policy_name in
select policyname
from pg_policies
where schemaname = 'public'
  and tablename = t.tablename loop
            execute format('drop policy if exists %I on public.%I', policy_name, t.tablename);
end loop;

execute format('revoke all on public.%I from anon', t.tablename);
execute format('revoke all on public.%I from authenticated', t.tablename);
execute format('revoke all on public.%I from public', t.tablename);
execute format('grant all on public.%I to service_role', t.tablename);
execute format('grant select, insert, update, delete on public.%I to authenticated', t.tablename);

execute format(
        'create policy "session_jwt_authenticated_all" on public.%I as permissive for all to authenticated using (public.has_active_session()) with check (public.has_active_session())',
        t.tablename
        );
execute format(
        'create policy "service_role_all" on public.%I as permissive for all to service_role using (true) with check (true)',
        t.tablename
        );
end loop;
end
$$;

-- Sequences need usage too, otherwise INSERTs that depend on a serial
-- default fail with "permission denied for sequence" even after the table
-- grants land. Same posture as the tables: authenticated + service_role.
do
$$
declare
s record;
begin
for s in
select sequence_name
from information_schema.sequences
where sequence_schema = 'public' loop
        execute format('revoke all on sequence public.%I from anon', s.sequence_name);
execute format('grant usage, select on sequence public.%I to authenticated, service_role', s.sequence_name);
end loop;
end
$$;
