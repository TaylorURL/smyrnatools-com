-- Expired comments and open issues are marked resolved, not deleted.
--
-- 20261113_expire_notes_after_three_months.sql deleted every comment, and every
-- open issue, older than three months that was not kept permanently. They are
-- now kept and marked resolved instead, with `auto_resolved` set so the popups
-- can say it was resolved automatically because it timed out, not by a person.
--
-- Comments had no resolved state, so they get one: `resolved_at` (null while
-- the comment is active) and `auto_resolved`. Issues already resolve through
-- `time_completed`, so they only get `auto_resolved`. A manual resolve leaves
-- `auto_resolved` false.

do $$
declare
    t text;
begin
    foreach t in array array[
        'mixers_comments',
        'tractors_comments',
        'trailers_comments',
        'heavy_equipment_comments',
        'pickup_trucks_comments',
        'operators_comments'
    ]
    loop
        execute format('alter table public.%I add column if not exists resolved_at timestamp with time zone', t);
        execute format('alter table public.%I add column if not exists auto_resolved boolean not null default false', t);
    end loop;

    foreach t in array array[
        'mixers_maintenance',
        'tractors_maintenance',
        'trailers_maintenance',
        'heavy_equipment_maintenance',
        'pickup_trucks_maintenance'
    ]
    loop
        execute format('alter table public.%I add column if not exists auto_resolved boolean not null default false', t);
    end loop;
end $$;

create or replace function public.expire_old_notes()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    t text;
begin
    foreach t in array array[
        'mixers_comments',
        'tractors_comments',
        'trailers_comments',
        'heavy_equipment_comments',
        'pickup_trucks_comments',
        'operators_comments'
    ]
    loop
        execute format(
            'update public.%I set resolved_at = now(), auto_resolved = true '
            'where not permanent and resolved_at is null and created_at < now() - interval ''3 months''',
            t
        );
    end loop;

    foreach t in array array[
        'mixers_maintenance',
        'tractors_maintenance',
        'trailers_maintenance',
        'heavy_equipment_maintenance',
        'pickup_trucks_maintenance'
    ]
    loop
        execute format(
            'update public.%I set time_completed = now(), auto_resolved = true '
            'where not permanent and time_completed is null and time_created < now() - interval ''3 months''',
            t
        );
    end loop;
end;
$$;

revoke all on function public.expire_old_notes() from public, anon, authenticated;
