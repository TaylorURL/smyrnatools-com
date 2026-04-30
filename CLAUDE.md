# smyrnatools.com — Project Rules

## Live Directives

- **This project does NOT use Supabase's default auth system.** Authentication is handled via a custom session table (
  `users_sessions`). RLS policies must use `using (true)` (allow all) — access control is enforced at the edge function
  layer, not via `auth.role()` or `auth.uid()`. Do NOT reference `auth.role()`, `auth.uid()`, or `auth.users` in RLS
  policies or foreign keys.
- **NEVER use the word "supabase" in application code.** The database client is exported as `Database` from
  `DatabaseService.js` — always import and reference it as `Database`. Helper functions follow the same pattern:
  `logDatabaseError`, `getDatabaseErrorDetails`, `DatabaseUtils`, etc. The only acceptable places for "supabase" are the
  `@supabase/supabase-js` package import and `REACT_APP_SUPABASE_*` env var reads inside `DatabaseService.js`. Comments
  must also use "database" instead of "Supabase".
- **Follow existing file structure and naming conventions exactly.** Never co-locate utilities, hooks, or shared
  components next to view files. Place them in their canonical directories and match the existing naming pattern:
    - Utilities → `src/utils/` — PascalCase with `Utility` suffix (e.g. `PlanUtility.js`, `ExportUtility.js`)
    - Hooks → `src/app/hooks/` — camelCase with `use` prefix (e.g. `usePlanData.js`, `useDashboardChat.js`)
    - Shared components → `src/app/components/common/` — PascalCase (e.g. `PlanComponents.jsx`, `Navigation.jsx`)
    - Services → `src/services/` — PascalCase with `Service` suffix (e.g. `PlanService.js`)
    - Views stay in their feature directory under `src/views/`
- **SQL delivery: always do BOTH.** Whenever you produce SQL, paste it inline in chat in a fenced ```sql block AND write
  it to a `.sql` file in the repo root (or appropriate migrations folder). Never one or the other — always both.
- **Imports must satisfy `simple-import-sort`.** This project's eslint config enforces `simple-import-sort/imports` —
  CRA does NOT auto-fix on save and the dev server fails to compile on violations. Whenever you add, move, or rename an
  import in any `.js` / `.jsx` file you touch, sort the imports yourself before considering the change done. The rules:
    1. **Group order**, separated by a single blank line: (a) external packages (`react`, `react-dom`, `@supabase/...`,
       etc.), (b) absolute / project-relative imports starting with `../` or `./`. Do not interleave groups.
    2. **Within a group**, sort case-insensitively by the import path string. `useCloserPlantLookup` comes before
       `useDetailOrders` (C < D), `useDetailOrders` before `useLiveMinuteOfDay` (D < L), `useLiveMinuteOfDay` before
       `useLiveTravelTimes` (Li-M < Li-T), `useLiveTravelTimes` before `usePlanTravelPairs` (Li < P).
    3. **Default and named imports from the same path do NOT change ordering** — they sort by the path, not by
       `default` vs `{ named }`.
    4. After every batch of edits to a file's imports, re-read the import block and verify the sort by eyeballing the
       paths in alphabetical order. If you can't tell at a glance, you haven't sorted it. Don't ship until it's clean.
