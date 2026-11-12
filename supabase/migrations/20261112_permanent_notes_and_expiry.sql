-- Comments and open issues expire after six months unless they were marked
-- permanent when written.
--
-- The apps already flag a note older than thirty days as "May be out of date"
-- and ask plant managers whether it still applies. Past six months nobody is
-- going to answer for it, so a daily job deletes what is left: every comment,
-- and every issue that is still open, that is older than six months and was not
-- marked permanent. Resolved issues are history and are never expired.

alter table public.mixers_comments add column if not exists permanent boolean not null default false;
alter table public.tractors_comments add column if not exists permanent boolean not null default false;
alter table public.trailers_comments add column if not exists permanent boolean not null default false;
alter table public.heavy_equipment_comments add column if not exists permanent boolean not null default false;
alter table public.pickup_trucks_comments add column if not exists permanent boolean not null default false;
alter table public.operators_comments add column if not exists permanent boolean not null default false;

alter table public.mixers_maintenance add column if not exists permanent boolean not null default false;
alter table public.tractors_maintenance add column if not exists permanent boolean not null default false;
alter table public.trailers_maintenance add column if not exists permanent boolean not null default false;
alter table public.heavy_equipment_maintenance add column if not exists permanent boolean not null default false;
alter table public.pickup_trucks_maintenance add column if not exists permanent boolean not null default false;

create or replace function public.expire_old_notes()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    delete from public.mixers_comments where not permanent and created_at < now() - interval '6 months';
    delete from public.tractors_comments where not permanent and created_at < now() - interval '6 months';
    delete from public.trailers_comments where not permanent and created_at < now() - interval '6 months';
    delete from public.heavy_equipment_comments where not permanent and created_at < now() - interval '6 months';
    delete from public.pickup_trucks_comments where not permanent and created_at < now() - interval '6 months';
    delete from public.operators_comments where not permanent and created_at < now() - interval '6 months';

    delete from public.mixers_maintenance
        where not permanent and time_completed is null and time_created < now() - interval '6 months';
    delete from public.tractors_maintenance
        where not permanent and time_completed is null and time_created < now() - interval '6 months';
    delete from public.trailers_maintenance
        where not permanent and time_completed is null and time_created < now() - interval '6 months';
    delete from public.heavy_equipment_maintenance
        where not permanent and time_completed is null and time_created < now() - interval '6 months';
    delete from public.pickup_trucks_maintenance
        where not permanent and time_completed is null and time_created < now() - interval '6 months';
end;
$$;

revoke all on function public.expire_old_notes() from public, anon, authenticated;

select cron.unschedule('expire-old-notes')
    where exists (select 1 from cron.job where jobname = 'expire-old-notes');

select cron.schedule('expire-old-notes', '30 4 * * *', 'select public.expire_old_notes()');

notify pgrst, 'reload schema';
