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
- **Versioning: CalVer `YYYY.WW.PATCH`.** This project uses calendar versioning, not semver. `YYYY` is the four-digit
  year, `WW` is the zero-padded ISO week number, and `PATCH` is a sequential counter within that week (starting at 0).
  Example: `2026.20.0` → `2026.20.1` → (next week) `2026.21.0`. During a `/release`, run `node scripts/calver.js` for
  the version bump step — it computes the next CalVer version and writes it to both `package.json` and `public/nit.json`.
  Do NOT manually pick semver bump types (patch/minor/major). The calver script handles week/year rollovers
  automatically.
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

## Edge Functions

- **Every non-public edge function MUST call `requireAuthenticated`** from `_shared/requireSession.ts` before processing
  a request. This validates the caller's session against the `users_sessions` table and returns the authenticated userId.
  Without this check, the endpoint is fully open — RLS policies are `using (true)`.
- Import pattern: `import { requireAuthenticated } from '../_shared/requireSession.ts'`
- Call pattern: `const auth = await requireAuthenticated(supabase, req, headers, body); if (auth instanceof Response) return auth;`
- The only exceptions are pure utility functions with no database access (e.g. `crypto-utility`, `user-utility`,
  `geocode-service`) and pre-auth endpoints (e.g. `sign-in`, `sign-up`, `reset-password` in `auth-context`).
- For functions that receive service-to-service calls (e.g. `email-service`), check for the service role key in the
  `Authorization` header as an alternative to session auth.

## Testing

- **Runner**: Jest via `react-app-rewired test`. Run with `npm test -- --watchAll=false` for a single pass.
- **Libraries**: `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`.
- **Setup file**: `src/setupTests.js` — imports `jest-dom` matchers and polyfills missing jsdom APIs (e.g.
  `ResizeObserver`).
- **CI**: `.github/workflows/test.yml` runs `npm test -- --watchAll=false` on every PR to `main` / `core`.

### File placement and naming
- Unit tests for utilities: `src/utils/__tests__/<UtilityName>.test.js`
- Unit tests for services: `src/services/__tests__/<ServiceName>.test.js`
- Integration tests for views: `src/views/__tests__/<ViewName>.test.jsx`
- Always use a `__tests__/` directory co-located with the module under test — do NOT place test files next to source
  files.

### Mocking conventions
- **Modules that read env vars at load time** (APIUtility, DatabaseService): set `process.env.*` before the import,
  use `jest.resetModules()` + `require()` (dynamic import) so the module re-evaluates with the correct values.
- **Database client**: mock `DatabaseService` at the module level (`jest.mock('../../services/DatabaseService', ...)`).
  Never let tests hit a real database.
- **Edge function calls**: mock `APIUtility.post` via `jest.mock('../../utils/APIUtility')`.
- **React context hooks** (useAuth, usePreferences): mock the context module to return controlled values.
- **Heavy child components** (plugins, modals, lazy-loaded views): stub with simple function components to keep tests
  focused and fast.

### Writing tests
- Prioritize tests that catch regressions: boundary conditions, error paths, security guards (allowlist enforcement,
  injection prevention).
- Do not chase coverage numbers. Write tests for behavior a user or caller would observe.
- Keep integration tests focused on one flow per test file. Mock at the service/hook boundary, not deep internals.
- Avoid snapshot tests — they break on trivial markup changes and provide little signal.
