-- ============================================================
-- Dayforce RLS + grants fix-up.
--
-- Run this in the Supabase SQL editor (uses service role -> bypasses RLS
-- and can also alter policies). Symptoms it fixes:
--   - dayforce_shifts / dayforce_employees / dayforce_org_units all read
--     as 0 rows from the frontend, even though the dashboard shows data.
--   - That's PostgREST seeing an RLS-enabled table with no policy that
--     matches the `authenticated` role -> returns empty array, no error.
--
-- Idempotent — safe to re-run.
-- ============================================================

-- 1. Diagnostic snapshot. Service role sees true row counts and the
--    current RLS / policy state for each table. Paste this output back
--    if anything still looks off after the fix.
select 'dayforce_org_units' as table_name, count(*) as row_count from dayforce_org_units
union all select 'dayforce_employees', count(*) from dayforce_employees
union all select 'dayforce_shifts', count(*) from dayforce_shifts
union all select 'dayforce_raw_punches', count(*) from dayforce_raw_punches;

select schemaname, tablename, rowsecurity as rls_enabled
from pg_tables
where tablename like 'dayforce_%'
order by tablename;

select schemaname, tablename, policyname, permissive, roles, cmd, qual
from pg_policies
where tablename like 'dayforce_%'
order by tablename, policyname;

-- 2. Force-reset RLS + policies + grants. Mirrors the migration so even
--    if the original never fully applied, the runtime end-state is right.
alter table if exists dayforce_org_units enable row level security;
alter table if exists dayforce_employees enable row level security;
alter table if exists dayforce_shifts enable row level security;
alter table if exists dayforce_raw_punches enable row level security;

drop policy if exists dayforce_org_units_all on dayforce_org_units;
create policy dayforce_org_units_all on dayforce_org_units
    for all using (true) with check (true);

drop policy if exists dayforce_employees_all on dayforce_employees;
create policy dayforce_employees_all on dayforce_employees
    for all using (true) with check (true);

drop policy if exists dayforce_shifts_all on dayforce_shifts;
create policy dayforce_shifts_all on dayforce_shifts
    for all using (true) with check (true);

drop policy if exists dayforce_raw_punches_all on dayforce_raw_punches;
create policy dayforce_raw_punches_all on dayforce_raw_punches
    for all using (true) with check (true);

grant select, insert, update, delete on dayforce_org_units to authenticated, anon, service_role;
grant select, insert, update, delete on dayforce_employees to authenticated, anon, service_role;
grant select, insert, update, delete on dayforce_shifts to authenticated, anon, service_role;
grant select, insert, update, delete on dayforce_raw_punches to authenticated, anon, service_role;

-- 3. Re-seed the org units. If the original migration didn't apply,
--    this guarantees the 12 RMX_TX_* rows exist so per-plant rollups
--    can resolve display names before the bridge runs its next cycle.
insert into dayforce_org_units (
    dayforce_org_id, display_code, display_name, org_type, state_code,
    location_number, parent_dayforce_org_id, parent_name
) values
    (3452, 'HOUSTON_TX_GROVES', 'Houston TX - Groves', 'REGION', 'TX', null, null, null),
    (3627, 'RMX_TX_14001', 'Houston Flintlock',     'RMX', 'TX', 14001, 3452, 'Houston TX - Groves'),
    (3628, 'RMX_TX_14002', 'Houston Lake Houston',  'RMX', 'TX', 14002, 3452, 'Houston TX - Groves'),
    (3624, 'RMX_TX_14003', 'Baytown',               'RMX', 'TX', 14003, 3452, 'Houston TX - Groves'),
    (3634, 'RMX_TX_14005', 'San Leon',              'RMX', 'TX', 14005, 3452, 'Houston TX - Groves'),
    (3629, 'RMX_TX_14006', 'Houston Winfield',      'RMX', 'TX', 14006, 3452, 'Houston TX - Groves'),
    (3632, 'RMX_TX_14007', 'New Waverly',           'RMX', 'TX', 14007, 3452, 'Houston TX - Groves'),
    (3625, 'RMX_TX_14008', 'Conroe',                'RMX', 'TX', 14008, 3452, 'Houston TX - Groves'),
    (3626, 'RMX_TX_14010', 'Freeport',              'RMX', 'TX', 14010, 3452, 'Houston TX - Groves'),
    (3633, 'RMX_TX_14053', 'Bryan',                 'RMX', 'TX', 14053, 3452, 'Houston TX - Groves'),
    (3630, 'RMX_TX_14055', 'Huntsville',            'RMX', 'TX', 14055, 3452, 'Houston TX - Groves'),
    (3631, 'RMX_TX_14061', 'Navasota',              'RMX', 'TX', 14061, 3452, 'Houston TX - Groves'),
    (6641, 'RMX_TX_14068', 'Madisonville',          'RMX', 'TX', 14068, 3452, 'Houston TX - Groves')
on conflict (dayforce_org_id) do update set
    display_code   = excluded.display_code,
    display_name   = excluded.display_name,
    org_type       = excluded.org_type,
    state_code     = excluded.state_code,
    location_number = excluded.location_number,
    parent_dayforce_org_id = excluded.parent_dayforce_org_id,
    parent_name    = excluded.parent_name;

-- 4. Re-run the diagnostic snapshot. Should show non-zero row counts
--    and one policy per table.
select 'dayforce_org_units' as table_name, count(*) as row_count from dayforce_org_units
union all select 'dayforce_employees', count(*) from dayforce_employees
union all select 'dayforce_shifts', count(*) from dayforce_shifts
union all select 'dayforce_raw_punches', count(*) from dayforce_raw_punches;
