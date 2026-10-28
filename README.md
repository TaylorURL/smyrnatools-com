<img src="public/srm-logo.svg" width="200" alt="Smyrna Ready Mix" />

# Smyrna Tools

The internal operations app for Smyrna Ready Mix, a ready-mix concrete company.

[smyrnatools.com](https://www.smyrnatools.com)

<img src="https://img.shields.io/badge/version-2026.44.1-222d65?style=for-the-badge" alt="Version 2026.44.1" />

I built Smyrna Tools while I was running plants for Smyrna Ready Mix. Managers track their trucks, equipment, operators and plants in one place. Everything is behind a company sign-in. The only public pages are login, privacy, terms and contact.

Mixers, tractors, trailers, heavy equipment and pickups each get a status, service tracking, a verification checklist and a full change history with a generated summary. Operators move from pending start through training, active and light duty. There are stats for every asset type and roster, Excel export of any list, messaging by name, role or plant, and admin screens for plants, regions and roles.

It's a React app on Supabase. The browser reads Postgres through PostgREST under row level security, and anything privileged runs in Deno edge functions, one per area (`auth-service`, `mixer-service`, `operator-service`, `plant-service` and so on).

## Sign-in

I didn't use Supabase Auth. `auth-service` checks the password (PBKDF2, old hashes rehashed on a good login) and writes a row to `users_sessions`. The session rides in two `HttpOnly`, `Secure`, `SameSite=Lax` cookies on `.smyrnatools.com` so the app and the database subdomain share them. A third cookie holds nothing secret and only tells the frontend it's probably signed in.

For the database, `auth-service` mints an HS256 JWT with `role: authenticated` and the session id. The anon role is locked out at the table level, so the key in the bundle reads nothing on its own. `DatabaseService` wraps `fetch` so every REST and Storage call carries the current JWT, re-mints it on expiry and replays once on a rejection. The JWT only ever lives in memory.

Every function goes through `requireSession`, which checks `users_sessions` with a rolling 30-day inactivity window. `last_active` is written at most every five minutes, since stamping it on every call was write and vacuum load the window never needed. Unattended and service-to-service calls use a separate `X-Internal-Token`, compared in constant time, so a leaked service-role key isn't enough by itself.

Roles carry named permissions like `region.select.all` and `detailview.delete`, which decide the regions, plants and actions a user gets.

## Assets

`BaseAssetService` does CRUD, history, comments, issues and verification once. Each asset type passes a config and gets thin typed methods on top. Change summaries come from `ai-service`, which calls the xAI API on the server so the key never reaches the browser. Plan schedule snapshots are taken at 5:30 PM Chicago time by `pg_cron` and `pg_net` calling an edge function from inside Postgres.

<details>
<summary>Running it locally</summary>

You need Node 22 or newer and a Supabase project.

```bash
npm install
cp .env.example .env
npm start          # http://localhost:3000
npm run build
npm test           # Vitest
```

The React app reads four variables from `.env`:

| Variable                       | What it is                      |
| :----------------------------- | :------------------------------ |
| `REACT_APP_SUPABASE_URL`       | Supabase project URL            |
| `REACT_APP_SUPABASE_ANON_KEY`  | Supabase publishable key        |
| `REACT_APP_EDGE_FUNCTIONS_URL` | Base URL for the edge functions |
| `REACT_APP_SENTRY_DSN`         | Sentry error reporting          |

The rest of `.env.example` is for the edge functions and the Sentry source map upload. `npm run supabase -- start` runs a local Supabase stack through the CLI.

</details>

React 19, React Router, Vite, Tailwind CSS, Supabase, Recharts, ExcelJS and Sentry, on Vercel. The footer bar is [`@taylorurl/split-rail`](https://github.com/TaylorURL/split-rail), pinned to a tag. Proprietary, see [LICENSE.md](LICENSE.md).

Built and maintained by [TaylorURL](https://www.taylorurl.com).
