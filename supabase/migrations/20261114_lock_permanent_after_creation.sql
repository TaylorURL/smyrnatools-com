-- Whether a comment or an issue is kept permanently is chosen once, when it
-- is written, and never changes afterwards.
--
-- The popups only offer the choice in the create form, and the edge functions
-- only ever write `permanent` on insert: the one update they make to these
-- tables is setting `time_completed` when an issue is resolved. This trigger
-- holds the rule in the database as well, so no later code path, script or
-- manual edit can flip a note to permanent (or back) and change whether
-- `expire_old_notes()` deletes it.

create or replace function public.lock_note_permanent()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    if new.permanent is distinct from old.permanent then
        raise exception 'permanent is set when a note is written and cannot be changed'
            using errcode = 'check_violation';
    end if;
    return new;
end;
$$;

revoke all on function public.lock_note_permanent() from public, anon, authenticated;

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
        'operators_comments',
        'mixers_maintenance',
        'tractors_maintenance',
        'trailers_maintenance',
        'heavy_equipment_maintenance',
        'pickup_trucks_maintenance'
    ]
    loop
        execute format('drop trigger if exists lock_note_permanent on public.%I', t);
        execute format(
            'create trigger lock_note_permanent before update of permanent on public.%I '
            'for each row execute function public.lock_note_permanent()',
            t
        );
    end loop;
end $$;
