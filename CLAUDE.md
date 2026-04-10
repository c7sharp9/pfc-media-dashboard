# PFC Media Dashboard

Internal dashboard for managing People of Faith Church (PFC) media operations -- sermon tracking, video editing workflow, and content publishing pipeline.

- **Repo:** c7sharp9/pfc-media-dashboard
- **Live:** https://pfc-media-dashboard.netlify.app
- **Deploys via:** Netlify (auto-deploy from main)

## Stack

- **Frontend:** React 18, Vite, Tailwind CSS, Radix UI (shadcn-style), TanStack Query, wouter (routing), Recharts, Framer Motion
- **Backend:** Express 5, TypeScript (tsx runner)
- **Data:** Airtable API as primary data store (sermons, edits, workflow steps). Drizzle ORM + SQLite configured but currently unused in routes -- all CRUD goes through Airtable REST API.
- **Validation:** Zod schemas in `shared/schema.ts`
- **Deployment:** Netlify Functions (`netlify/functions/api.mts`) wraps the Express API for serverless; Vite builds the SPA to `dist/public`

## Local Development

```bash
npm install
npm run dev          # starts Express dev server with Vite HMR (tsx server/index.ts)
```

Requires `AIRTABLE_PAT` env var for live data. Without it, the server falls back to hardcoded sample data automatically.

## Key Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev server (Express + Vite HMR) |
| `npm run build` | Production build via custom script (`script/build.ts`) |
| `npm run build:netlify` | Vite-only build for Netlify deploy |
| `npm run check` | TypeScript type check |
| `npm run db:push` | Push Drizzle schema to SQLite (not actively used) |

## Project Structure

```
client/           # React SPA
  src/
    pages/        # sermons-list, sermon-detail, edits, workflow, not-found
    components/   # AppLayout, UI components (shadcn/Radix)
    hooks/        # Custom React hooks
    lib/          # Utilities
server/
  index.ts        # Express app entry
  routes.ts       # All API routes (Airtable proxy)
  storage.ts      # Storage interface
  vite.ts         # Vite dev middleware
shared/
  schema.ts       # TypeScript interfaces + Zod schemas (Sermon, Edit, WorkflowStep)
netlify/
  functions/
    api.mts       # Netlify Function wrapper for Express
```

## Data Model

All data lives in Airtable. Three tables:

- **Sermons** -- service date, platform (Sunday/Wednesday), title, URLs (video, trimmed, audio, transcription, YouTube, recap), publishing status (Facebook Done, Website Done), replay tracking
- **Edits** -- clips, recaps, sizzle reels linked to sermons; tracked by editor name, status, and dates
- **Workflow** -- reference steps for the media publishing process (platform-specific)

## Path Aliases

Configured in `vite.config.ts`:
- `@` = `client/src`
- `@shared` = `shared`
- `@assets` = `attached_assets`

## Gotchas

- **Airtable is the database.** There is no local SQLite in production. Drizzle config exists but routes bypass it entirely -- all reads/writes go to Airtable REST API.
- **Sample data fallback:** If `AIRTABLE_PAT` is missing or Airtable is unreachable, the server silently falls back to in-memory sample data. This makes local dev possible without credentials but can mask connection issues.
- **Netlify redirects:** `/api/*` is proxied to the serverless function. The SPA fallback catches everything else. Order matters in `netlify.toml`.
- **Express 5:** This project uses Express v5, which has breaking changes from v4 (e.g., path matching, error handling).
- **Airtable IDs are hardcoded** in `server/routes.ts` (base ID, table IDs). Changing the Airtable base requires updating these constants.
