<img src="public/srm-logo.svg" width="200" alt="Smyrna Ready Mix" />

# Smyrna Tools

The internal operations app for Smyrna Ready Mix, a ready-mix concrete company.

[smyrnatools.com](https://www.smyrnatools.com)

<img src="https://img.shields.io/badge/version-2026.44.0-222d65?style=for-the-badge" alt="Version 2026.44.0" />

I built Smyrna Tools while I was running plants for Smyrna Ready Mix. Managers track their trucks, equipment, operators and plants in one place. Everything is behind a company sign-in. The only public pages are login, privacy, terms and contact.

Mixers, tractors, trailers, heavy equipment and pickups each get a status, service tracking, a verification checklist and a full change history with a generated summary. Operators move from pending start through training, active and light duty. There are stats for every asset type and roster, Excel export of any list, messaging by name, role or plant, and admin screens for plants, regions and roles.

## How it's built

React single-page app (Vite, React Router) on Supabase. The browser reads Postgres through PostgREST under row-level security. Anything privileged runs in Deno edge functions, one per domain (`auth-service`, `mixer-service`, `operator-service`, `plant-service` and so on), with shared helpers in `supabase/functions/_shared/`.

- **Own sessions, not Supabase Auth.** `auth-service` checks the password (PBKDF2, 100,000 iterations; old hashes get rehashed on a good login) and writes a row to `users_sessions`. The session rides in two `HttpOnly`, `Secure`, `SameSite=Lax` cookies on `.smyrnatools.com`, so the app and the database subdomain share them. A third cookie holds nothing secret. It just tells the frontend it's probably signed in.
- **JWTs minted for RLS.** `auth-service` mints an HS256 JWT with `role: authenticated` and the session id. The anon role is locked out at the table level, so the key in the bundle reads nothing by itself. `DatabaseService` wraps `fetch` so every REST and Storage request carries the current JWT. It re-mints on expiry and replays once on a rejection. The JWT only lives in memory.
- **One gate for every function.** `requireSession` checks the session against `users_sessions` with a rolling 30-day inactivity window. Service-to-service and unattended calls use a separate `X-Internal-Token`, compared in constant time. A leaked service-role key alone isn't enough.
- **Permissions.** Roles carry named permissions (`region.select.all`, `detailview.delete` and so on) that decide which regions, plants and actions a user gets.
- **One asset pipeline.** `BaseAssetService` does CRUD, history, comments, issues and verification once. Each asset type passes a config and gets thin typed methods on top.

<details>
<summary>Decisions and tradeoffs</summary>

- `last_active` is written at most every five minutes. Stamping it on every call was write and vacuum load the 30-day window never needed.
- Presence and the online list come from a Supabase Realtime channel. Concurrent callers share one subscription setup.
- Change summaries come from `ai-service`, which calls the xAI chat completions API on the server. The key never reaches the browser.
- Plan schedule snapshots are taken at 5:30 PM Chicago time. `pg_cron` and `pg_net` call an edge function from inside Postgres.
- A lazy chunk removed by a deploy is caught in `src/utils/ChunkRecovery.js` instead of crashing the route.
- Excel export is ExcelJS with shared workbook and sheet layout helpers.
- Sentry reports errors. Vercel Analytics and Speed Insights record traffic and Web Vitals.
- The bottom footer bar is [`@taylorurl/split-rail`](https://github.com/TaylorURL/split-rail), pinned to a tag.

</details>

<details>
<summary>Running it locally</summary>

You need Node 22 or newer and a Supabase project.

```bash
npm install
cp .env.example .env
npm start          # dev server on http://localhost:3000
npm run build      # production build to build/
npm test           # Vitest
```

The React app reads four variables from `.env`:

| Variable                       | What it is                      |
| :----------------------------- | :------------------------------ |
| `REACT_APP_SUPABASE_URL`       | Supabase project URL            |
| `REACT_APP_SUPABASE_ANON_KEY`  | Supabase publishable key        |
| `REACT_APP_EDGE_FUNCTIONS_URL` | Base URL for the edge functions |
| `REACT_APP_SENTRY_DSN`         | Sentry error reporting          |

The rest of `.env.example` is for the edge functions and the Sentry source map upload. `npm run supabase -- <command>` runs the Supabase CLI, for example `npm run supabase -- start` for a local stack.

</details>

## Built with

React 19, React Router, Vite, Tailwind CSS, Supabase (Postgres, Storage, edge functions), Recharts, ExcelJS and Sentry. Hosted on Vercel.

<details>
<summary>License</summary>

Proprietary. Copyright (c) 2026 TaylorURL LLC, all rights reserved. See [LICENSE.md](LICENSE.md).

</details>

Built and maintained by [TaylorURL](https://www.taylorurl.com).
