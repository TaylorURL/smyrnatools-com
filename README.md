<p align="center">
  <img src="public/srm-logo.svg" width="200" alt="Smyrna Ready Mix" />
</p>

<h1 align="center">Smyrna Tools</h1>

<p align="center">The internal operations app for Smyrna Ready Mix, a ready-mix concrete company.</p>
<p align="center"><a href="https://www.smyrnatools.com">smyrnatools.com</a></p>

<p align="center">
  <img src="https://img.shields.io/badge/version-2026.44.0-222d65?style=for-the-badge" alt="Version 2026.44.0" />
</p>

I built Smyrna Tools while I was running plants for Smyrna Ready Mix, and it became the system two Texas regions use. Managers keep track of their trucks, equipment, operators and plants in one place. Everything is behind a company sign-in. The only public pages are the login screen, privacy policy, terms and contact page.

## What it does

- **Dashboard** with a fleet overview, alerts for anything that needs attention, and a summary of the crew.
- **Assets**: mixers, tractors, trailers, heavy equipment and pickup trucks. Each one has a status, service tracking, a verification checklist and a full change history with an AI-written summary.
- **Operators** from pending start through training, active duty and light duty, plus manager profiles.
- **Statistics** for every asset type and roster: status mix, service health, shop queue.
- **Excel export** of any list or its open issues.
- **Admin** screens for plants, regions and roles. Roles decide what each person can see and change.
- **Messages** between users, addressed by name, role or plant.

## Running it locally

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

## Built with

React 19, React Router, Vite, Tailwind CSS, Supabase (Postgres, Storage, edge functions), Recharts, ExcelJS and Sentry. Hosted on Vercel.

## License

Proprietary. Copyright (c) 2026 TaylorURL LLC, all rights reserved. See [LICENSE.md](LICENSE.md).

Built and maintained by [TaylorURL](https://www.taylorurl.com).
