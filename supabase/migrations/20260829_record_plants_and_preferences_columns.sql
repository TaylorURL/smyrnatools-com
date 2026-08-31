-- Two columns that stand in the live database and in no migration.
--
-- 20260829_baseline_existing_schema.sql records the forty-two tables no
-- migration creates; plants and users_preferences are outside that set, on the
-- grounds that earlier migrations account for them. For these two columns
-- nothing does. Both are in the request path -- plant_address is selected by
-- the plant service and the Plan route maps, accept_comment_emails is written
-- by the preferences UI on every save -- so the schema the app depends on had
-- no record behind it.
--
-- Reproduced as found rather than corrected: plant_address is nullable with no
-- default, accept_comment_emails is nullable defaulting to true, and the
-- partial lower() index on plant_address is the one the live instance carries.
-- Every statement is guarded, so this is a no-op against the live database and
-- reproduces the columns against an empty one.

alter table public.plants
    add column if not exists plant_address text;

create index if not exists plants_plant_address_lower_idx
    on public.plants (lower(plant_address))
    where plant_address is not null;

alter table public.users_preferences
    add column if not exists accept_comment_emails boolean default true;

-- Force PostgREST to refresh its schema cache so the columns are queryable
-- immediately without waiting for the next auto-reload cycle.
notify pgrst, 'reload schema';
