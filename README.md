<p align="center">
  <img src="public/srm-logo.svg" width="200" alt="Smyrna Tools" />
</p>

<h1 align="center">Smyrna Tools</h1>

<p align="center">
  <b>The internal operations platform for Smyrna Ready Mix.</b>
</p>
<p align="center">
  Fleet, people, and plant performance in one place —<br />
  tracked across every region and plant at <a href="https://smyrnatools.com">smyrnatools.com</a>.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-2026.36.1-222d65?style=for-the-badge" alt="Version 2026.36.1" />
  <img src="https://img.shields.io/badge/React-19-222d65?style=for-the-badge&logo=react&logoColor=white" alt="React 19" />
  <img src="https://img.shields.io/badge/Vite-6-222d65?style=for-the-badge&logo=vite&logoColor=white" alt="Vite 6" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-3-222d65?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind CSS 3" />
  <img src="https://img.shields.io/badge/React_Router-7-c12033?style=for-the-badge&logo=reactrouter&logoColor=white" alt="React Router 7" />
  <img src="https://img.shields.io/badge/Supabase-222d65?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase" />
  <img src="https://img.shields.io/badge/Sentry-c12033?style=for-the-badge&logo=sentry&logoColor=white" alt="Sentry" />
  <img src="https://img.shields.io/badge/Vercel-222d65?style=for-the-badge&logo=vercel&logoColor=white" alt="Vercel" />
</p>

<br />

## Why Smyrna Tools

Running a ready-mix operation means tracking hundreds of moving assets, an operator workforce flowing through onboarding, training, and duty changes, and fleet numbers that only mean something once they roll up across plants and regions. Smyrna Tools puts all of it behind one authenticated portal: every asset and every person carries a verification state and a full change history, and every write goes through the server — the browser never mutates the database directly.

<table width="100%">
  <tr>
    <td width="33%" valign="top">
      <h3 align="center">Fleet &amp; assets</h3>
      <p align="center">Mixers, tractors, trailers, equipment, and pickup trucks, each with verification status, service tracking, and a full change-history timeline.</p>
    </td>
    <td width="33%" valign="top">
      <h3 align="center">People &amp; personnel</h3>
      <p align="center">The operator lifecycle from onboarding through training, active duty, light duty, and separation, plus manager profiles and role-based access.</p>
    </td>
    <td width="33%" valign="top">
      <h3 align="center">Statistics &amp; export</h3>
      <p align="center">A live dashboard plus a statistics surface for every asset type and roster — status mix, service health, shop queue, coverage and aging — and an Excel export of any list or its open issues.</p>
    </td>
  </tr>
</table>

<br />

## Stack

| Layer | Technology |
| :--- | :--- |
| UI | React 19 + React Router 7 |
| Build & dev | Vite 6 (output `build/`) |
| Styling | Tailwind CSS 3 — light / dark / gray themes via semantic tokens, no plain CSS |
| Backend | Supabase — Postgres, Storage, Deno edge functions |
| Auth | Own accounts table, PBKDF2 password hashing, session rows, and HS256 session JWTs minted in `auth-service` |
| Charts | Recharts |
| Icons | Font Awesome Free |
| Export | ExcelJS |
| Monitoring | Sentry · Vercel Analytics + Speed Insights · the hosted traffic tracker |
| Testing | Vitest + Testing Library |
| Hosting | Vercel |

## Getting started

```bash
npm install
cp .env.example .env   # Supabase URL + keys, Sentry DSN, edge secrets
npm start              # Vite dev server on http://localhost:3000
npm run build          # production build to build/
```

| Variable | Purpose |
| :--- | :--- |
| `REACT_APP_SUPABASE_URL` | Supabase project URL. |
| `REACT_APP_SUPABASE_ANON_KEY` | Publishable key for the browser client. |
| `REACT_APP_EDGE_FUNCTIONS_URL` | Base URL the client posts writes to. |
| `REACT_APP_SENTRY_DSN` | Error reporting. |

`GROK_API_KEY`, `MAILERSEND_*`, `EDGE_INTERNAL_TOKEN`, and `EMAIL_DEBUG_WHITELIST` are read by the edge functions, not the React app — in production they are set with `supabase secrets set`. `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT` are build-time only: `vite.config.js` uploads source maps with them on a production build and skips the upload when the token is absent.

### Scripts

| Script | Does |
| :--- | :--- |
| `npm start` | Vite dev server on port 3000. |
| `npm run build` | Production build to `build/`. |
| `npm run preview` | Serve the production build. |
| `npm test` | Run the Vitest suite once. |
| `npm run test:watch` | Vitest in watch mode. |
| `npm run lint` | ESLint over `src/`. |
| `npm run typecheck` | TypeScript over the project, no emit. |
| `npm run format` | Prettier over `src/`. |
| `npm run format:check` | Check formatting without writing. |
| `npm run analyze` | Build with a Rollup bundle treemap. |

CI runs `format:check`, `lint`, `typecheck`, `test`, and `build` on every pull request, so a change that fails any of them locally fails the same way there.

### Supabase workflow

A `supabase:*` script family wraps the Supabase CLI through `scripts/supabase.js`:

| Script | Does |
| :--- | :--- |
| `supabase:start` · `:stop` · `:status` | Run the local Supabase stack. |
| `supabase:db:reset` | Reset the local database. |
| `supabase:functions:serve` · `:deploy` · `:invoke` | Develop and ship edge functions. |
| `supabase:functions:list` · `:new` · `:download` · `:delete` | Manage edge functions. |
| `supabase:login` · `:init` · `:version` | CLI auth and setup. |

## Architecture

```mermaid
flowchart LR
    V["React SPA — views + app shell"] --> D["DatabaseService — only supabase-js consumer"]
    D -->|"reads, RLS-scoped"| DB[("Supabase — Postgres, Storage, Auth")]
    D -->|"writes"| EF["Edge functions — Deno, one per domain"]
    EF -->|"insert / update / delete"| DB
    V -.->|"errors"| SEN["Sentry"]
    V -.->|"served by"| VER["Vercel"]
```

## How it works

- **One database gateway.** Every Supabase call flows through a single `DatabaseService.js` — the only module in the app that imports `@supabase/supabase-js`.
- **Writes live on the server.** The client reads through row-level security; every insert, update, and delete runs in a Deno edge function, one per domain (`mixer-service`, `operator-service`, `plant-service`, …).
- **JWT-scoped requests.** The database client swaps the publishable-key bearer for the current session JWT on every REST and realtime request, so PostgREST evaluates RLS against the signed-in user — and the token never touches storage.
- **Themed by tokens, never by hex.** All styling is Tailwind semantic tokens backed by CSS variables across three themes. The shared vocabulary lives in [`src/app/styles/DESIGN_SYSTEM.md`](src/app/styles/DESIGN_SYSTEM.md).

## Project structure

```
smyrnatools-com/
├── public/                 Logos, favicon, PWA manifest + service worker, self-hosted fonts,
│                           robots.txt, sitemap.xml, llms.txt, release.json
├── docs/                   Workflow map and the running todo list
├── scripts/                Dev/ops helpers — Supabase CLI wrapper, CalVer, email templates,
│                           PDF and training-packet generators
├── supabase/
│   ├── functions/          Deno edge functions (deployed individually) — all database writes
│   └── migrations/         Schema, row-level security, and the scheduled housekeeping jobs
└── src/
    ├── index.jsx           Entry — Sentry init, context providers, root <App/>
    ├── app/                Shell — components, hooks, context, models, constants, ai, styles
    ├── views/              Feature domains — admin, assets, common, people, tools
    ├── services/           Service classes; DatabaseService.js is the only supabase-js consumer
    ├── utils/              Pure helpers (+ tests)
    └── assets/             Images and video
```

## License

Copyright (c) 2026 Trenton Taylor. All rights reserved. See [LICENSE.md](LICENSE.md).

<br />

<p align="center">
  <sub>Built by <strong>Trenton Taylor</strong> for <strong>Smyrna Ready Mix</strong>.</sub>
</p>
