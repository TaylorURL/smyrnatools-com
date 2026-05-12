-- Lock down the `dispatch-reports` storage bucket so only the service role
-- (used by edge functions) can read or write it. Previously the bucket was
-- reachable from the browser via the anon key, which exposed every daily
-- schedule HTML file to anyone who could pull the bucket name + anon key
-- out of the JS bundle.
--
-- After this migration:
--   • Bucket is private (no public URL access)
--   • All anon / authenticated SELECT, INSERT, UPDATE, DELETE policies on
--     storage.objects targeting this bucket are removed
--   • A single service-role policy grants full access, used exclusively by
--     the `dispatch-import` edge function (server-side, never exposed)

update storage.buckets
set public = false
where id = 'dispatch-reports';

do
$$
declare
policy_name text;
begin
for policy_name in
select policyname
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and (
    qual ilike '%dispatch-reports%'
              or with_check ilike '%dispatch-reports%'
    )
    loop
        execute format('drop policy if exists %I on storage.objects', policy_name);
end loop;
end
$$;

drop
policy if exists "dispatch_reports_service_role_all" on storage.objects;

create
policy "dispatch_reports_service_role_all"
on storage.objects
as permissive
for all
to service_role
using (bucket_id = 'dispatch-reports')
with check (bucket_id = 'dispatch-reports');
