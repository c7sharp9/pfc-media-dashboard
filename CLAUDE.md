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
    pages/        # sermons-list, sermon-detail, edits (list), edit-detail, website-quotes (review), quotes (browse), workflow, not-found
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
Co-host (Steve) lines are fair game on podcasts, held to the same near-verbatim
quality bar as Gary's.
Quotes split into two corpora via `Source`: pipeline quotes (Claude/Manual,
tied to sermons) and **OG** (733 legacy hand-logged social one-liners, date +
quote only -- not part of the website pipeline). The **Quotes page** (/quotes)
is display-only browsing for the team: toggle chips for Sermon Quotes (only
the KEPT/On Website ones) and OG Quotes, search, one-click copy.
The **Website Quotes page** (/website-quotes) is the review workspace: collapsible per-date
groups (unreviewed open by default), inline On Website checkboxes + editable
Final, per-group Send, Expand/Collapse all, Unreviewed filter, one-click copy
for marketing. `Reviewed` (checkbox) is set on EVERY quote of a date by a
successful send -- a send IS the review; quotes seeded later arrive
unreviewed and flip the group back to Needs review. Legacy manual quotes were
grandfathered as Reviewed.
Endpoints: GET `/api/quotes?date` (no date = whole table), PATCH +
DELETE `/api/quotes/:id`, POST `/api/sermons/:id/send-quotes`.

## Sermon Prepare (AI descriptions + moment quotes)

The sermon page's **Prepare with AI** button (in the Additional Info header;
`POST /api/sermons/:id/prepare`, both API layers -> `prepare-sermon`
repository_dispatch on pfc-website) runs `tools/prepare-sermon.py` in CI:
fetch transcript (Drive with timecodes/speaker labels -> YouTube captions with
timecodes preserved), then Claude (claude-sonnet-5) drafts short+long
descriptions into the sermon's AI fields AND extracts near-verbatim moment
quotes -- **15 for a Sunday service, 10 for a Wednesday podcast** -- with
timecodes and speaker attribution into the Quotes table (Source=Claude,
On Website/Reviewed = false, ready for the Website Quotes review page).

Sermons have NO video processing (they're YouTube), so this writes ONLY to
Airtable -- no commit, no Stream. Idempotent: descriptions overwrite the AI
fields (manual wins at publish); quotes seed only when none exist yet for the
date (protects review work -- pass `--force-quotes` locally to override).
**Transcript gate:** Prepare runs in CI, where YouTube captions CANNOT be
fetched (YouTube blocks GitHub's datacenter IPs; we never use cookies). So the
`/api/sermons/:id/prepare` endpoint pre-checks for a `Transcription URL`
(the Descript transcript) and returns 422 with a friendly message if it's
missing -- a freshly logged service must wait for its Descript transcription
(usually within a day). The script itself exits 0 (no failure email) on a
NoTranscript condition. For immediacy on a fresh service, prepare-sermon.py
can be run LOCALLY (residential IP fetches YouTube captions fine).
Note: claude-sonnet-5 emits a thinking block that counts against max_tokens,
so the quotes call budgets 8000 tokens. After Prepare: review descriptions in
the sermon workspace, review quotes on the Website Quotes page, then Send each.

## Send to Website (recap edits)

Recap edits publish in TWO stages (both fire `repository_dispatch` on
`c7sharp9/pfc-website`; both endpoints exist in BOTH API layers):

1. **Prepare** (`POST /api/edits/:id/prepare`, event `prepare-recap`): Drive
   download -> ffmpeg 1080p 2250kbps -> Cloudflare Stream -> AI captions ->
   transcript -> Claude (claude-sonnet-5, ANTHROPIC_API_KEY secret) drafts
   short+long descriptions into the AUTO fields, writes `Stream ID` +
   `Transcript` back to the edit. NOTHING goes on the site. ~10 min.
2. Review the drafts in the edit workspace (manual fields win at publish).
3. **Send to Website** (`POST /api/edits/:id/publish`, event `publish-recap`):
   writes src/recaps/<slug>.md from the reviewed fields. A prepared edit
   (Stream ID present) reuses the video -- live in ~1 minute, no reprocessing,
   no orphaned Stream copies on re-sends. Unprepared edits still run the full
   pipeline (legacy path).

All 35 pre-existing recaps were backfilled (2026-07-13) with descriptions +
Stream IDs from the site files, so the whole back catalog is "prepared" and
re-publishes are non-destructive. Re-prepare regenerates the AUTO drafts (it
overwrites them -- manual fields are the safe place for human copy). The
Action's secrets (AIRTABLE_PAT, CF_ACCOUNT_ID, CF_STREAM_TOKEN,
ANTHROPIC_API_KEY) live on the website repo; the dispatch uses GITHUB_TOKEN.

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
