-- Comments and open issues now expire after three months instead of six.
--
-- Same daily job as 20261112_permanent_notes_and_expiry.sql: every comment, and
-- every issue that is still open, that is older than three months and was not
-- marked permanent when it was written is deleted. Resolved issues are history
-- and are never expired.

create or replace function public.expire_old_notes()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    delete from public.mixers_comments where not permanent and created_at < now() - interval '3 months';
    delete from public.tractors_comments where not permanent and created_at < now() - interval '3 months';
    delete from public.trailers_comments where not permanent and created_at < now() - interval '3 months';
    delete from public.heavy_equipment_comments where not permanent and created_at < now() - interval '3 months';
    delete from public.pickup_trucks_comments where not permanent and created_at < now() - interval '3 months';
    delete from public.operators_comments where not permanent and created_at < now() - interval '3 months';

    delete from public.mixers_maintenance
        where not permanent and time_completed is null and time_created < now() - interval '3 months';
    delete from public.tractors_maintenance
        where not permanent and time_completed is null and time_created < now() - interval '3 months';
    delete from public.trailers_maintenance
        where not permanent and time_completed is null and time_created < now() - interval '3 months';
    delete from public.heavy_equipment_maintenance
        where not permanent and time_completed is null and time_created < now() - interval '3 months';
    delete from public.pickup_trucks_maintenance
        where not permanent and time_completed is null and time_created < now() - interval '3 months';
end;
$$;

revoke all on function public.expire_old_notes() from public, anon, authenticated;
