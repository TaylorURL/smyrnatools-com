-- Lock down the `dispatch_data` table so the parsed schedule data is
-- unreachable from the browser. Reads now go through the
-- `dispatch-data-service` edge function (session-validated, runs with the
-- service role); writes only ever come from the `dispatch-import` edge
-- function (also service role).
--
-- Without this, the anon key embedded in the JS bundle could hit
-- `/rest/v1/dispatch_data?select=*` and pull every order, customer,
-- ticket, driver, and yardage row — the same data we just locked the
-- HTML bucket for.

alter table public.dispatch_data enable row level security;

do $$
declare
    policy_name text;
begin
    for policy_name in
        select policyname
        from pg_policies
        where schemaname = 'public'
          and tablename = 'dispatch_data'
    loop
        execute format('drop policy if exists %I on public.dispatch_data', policy_name);
    end loop;
end
$$;

revoke all on public.dispatch_data from anon;
revoke all on public.dispatch_data from authenticated;

grant all on public.dispatch_data to service_role;

create policy "dispatch_data_service_role_all"
on public.dispatch_data
as permissive
for all
to service_role
using (true)
with check (true);
