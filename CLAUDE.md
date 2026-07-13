# PFC Media Dashboard

Internal dashboard for managing People of Faith Church (PFC) media operations -- sermon tracking, video editing workflow, and content publishing pipeline.

- **Repo:** c7sharp9/pfc-media-dashboard
- **Live:** https://pfc-media-dashboard.netlify.app
- **Deploys via:** Netlify (auto-deploy from main)
- **iCloud docs:** `~/Library/Mobile Documents/com~apple~CloudDocs/Projects/business/reframe/Content Creation/Content Creation/PFC HUB FOLDER TEMPLATE/`

## Stack

- **Frontend:** React 18, Vite, Tailwind CSS, Radix UI (shadcn-style), TanStack Query, wouter (routing), Recharts, Framer Motion
- **Backend:** Express 5, TypeScript (tsx runner)
- **Data:** Airtable API as primary data store (sermons, edits, workflow steps). Drizzle ORM + SQLite configured but currently unused in routes -- all CRUD goes through Airtable REST API.
- **Validation:** Zod schemas in `shared/schema.ts`
- **Deployment:** Netlify Functions (`netlify/functions/api.mts`) reimplements the API for serverless -- it does NOT import `server/routes.ts`; Vite builds the SPA to `dist/public`

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
    api.mts       # Netlify Function — separate reimplementation of the API routes
```

## Data Model

All data lives in Airtable. Three tables:

- **Sermons** -- service date, platform (Sunday/Wednesday), title, four description fields (`Short Description`/`Manual Short Description`/`Long Description`/`Manual Long Description` -- manual wins at publish, short capped 125 chars), URLs (video, trimmed, audio, transcription, YouTube, recap), publishing status (Facebook Done, Website Done = "Verified Live"), replay tracking
- **Edits** -- clips, recaps, sizzle reels linked to sermons; tracked by editor name, status, and dates. Also carry `Edit Description` (internal note) and four website description fields (`Short Website Description`/`Manual Short Website Description`/`Long Description`/`Manual Long Description` -- manual wins at publish) and `Transcript` (relabeled "Final Edit Transcription" in the UI; the sermon's `Transcription URL` is "Full Service Transcription")

## Send to Website

The sermon page's Website step has a **Send to Website** button: it commits
`src/sermons/<slug>.md` to `c7sharp9/pfc-website` via the GitHub contents API
(the site auto-deploys from main), then writes the page URL back to the
record's `Sermon URL`. Logic lives ONCE in `shared/send-to-website.ts` and is
imported by BOTH API layers (`POST /api/sermons/:id/send-to-website`).

- Sunday -> broadcast "Prophetic Fulfillment Church" (`YouTube Trimmed URL` +
  `YouTube Full Service URL`); Wednesday -> "Pulling on Heaven Podcast"
  (`Wednesday YouTube Link`). Slug = `july-5-2026` style from `Service`.
- **Idempotent and non-destructive**: identical content = no commit
  ("unchanged"); front-matter keys the dashboard doesn't manage
  (legacyAudio, rebroadcast, visible, speaker) are preserved on update.
- Env: `GITHUB_TOKEN` (contents:write on pfc-website) required;
  `PFC_SITE_URL` optional (defaults to the Netlify preview; set to
  https://garyzamora.com at domain cutover).
- "Verified Live" (`Website Done`) stays a manual human check after the send.

## Website Quotes ("Moments from this message")

The sermon page's **Website Quotes** section manages the pull-quote cards on
the site's message pages. Pipeline mirrors the description system: Claude
extracts near-verbatim quotes + timecodes from the transcript into the Quotes
table (`tbl6fKPmeuqBksu5H`, `Source=Claude`, quotes match sermons by Service
Date); the team checks `On Website` and optionally edits `Quote Final`
(Final wins over the untouched Original -- manual-wins again); **Send Quotes
to Website** rewrites ONLY the `pullQuotes` front-matter block in
`src/sermons/<slug>.md` via `shared/send-quotes-to-website.ts` (both API
layers). Re-sending replaces the live set (= the update button); zero checked
quotes removes the section; idempotent when nothing changed. Targets: ~15
quotes per service, ~10 per podcast -- Jonathan thins them editorially.
Endpoints: GET `/api/quotes?date`, PATCH `/api/quotes/:id`,
POST `/api/sermons/:id/send-quotes`.

## Send to Website (recap edits)

Recap-type edits have their own **Send to Website** button: it POSTs
`/api/edits/:id/publish`, which fires a `repository_dispatch` (event
`publish-recap`) on `c7sharp9/pfc-website`. A GitHub Action there runs
`tools/recap-pipeline.py --edit <id> --apply` in CI (Drive download -> ffmpeg
1080p 2250kbps -> Cloudflare Stream -> AI captions -> transcript ->
recaps.json entry) and commits, so the recap is live ~10 minutes after the
click. Title comes from the edit (or its sermon); the site tagline comes from
`Short Website Description`. Uses the same `GITHUB_TOKEN`; the Action's own
secrets (AIRTABLE_PAT, CF_ACCOUNT_ID, CF_STREAM_TOKEN) live on the website repo.

## Path Aliases

Configured in `vite.config.ts`:
- `@` = `client/src`
- `@shared` = `shared`
- `@assets` = `attached_assets`

## Gotchas

- **The API exists twice.** `server/routes.ts` serves local dev; `netlify/functions/api.mts` serves production. They are independent implementations of the same endpoints -- any route change MUST be made in both files or production silently diverges from local dev (this has caused real bugs).
- **Airtable is the database.** There is no local SQLite in production. Drizzle config exists but routes bypass it entirely -- all reads/writes go to Airtable REST API.
- **Sample data fallback:** If `AIRTABLE_PAT` is missing or Airtable is unreachable, the server silently falls back to in-memory sample data. This makes local dev possible without credentials but can mask connection issues.
- **Netlify redirects:** `/api/*` is proxied to the serverless function. The SPA fallback catches everything else. Order matters in `netlify.toml`.
- **Express 5:** This project uses Express v5, which has breaking changes from v4 (e.g., path matching, error handling).
- **Airtable IDs are hardcoded** in both `server/routes.ts` and `netlify/functions/api.mts` (base ID, table IDs). Changing the Airtable base requires updating the constants in both files.

- **Workflow** -- reference steps for the media publishing process (platform-specific)
