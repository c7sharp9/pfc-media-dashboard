# Architecture Decisions -- PFC Media Dashboard

## Format

Each decision follows: **Context** (why), **Decision** (what), **Consequences** (tradeoffs).

---

### 001 -- Airtable as primary data store

- **Context:** Needed a quick way to manage structured data that non-technical team members could also access directly.
- **Decision:** Use Airtable REST API as the sole data store. Express server acts as a proxy.
- **Consequences:** No local database to manage. Airtable rate limits apply (5 req/sec). Schema changes happen in Airtable UI, not in code. Drizzle ORM is configured but unused in production routes.

### 002 -- Sample data fallback

- **Context:** Local development and demo access should work without Airtable credentials.
- **Decision:** Server detects failed Airtable connection on startup and falls back to hardcoded sample data.
- **Consequences:** Developers can run locally without secrets. Risk of silently masking real connection issues.

### 003 -- Netlify Functions for API hosting

- **Context:** Needed serverless hosting that could serve both the SPA and the Express API.
- **Decision:** Wrap Express in a Netlify Function (`netlify/functions/api.mts`). Vite builds the SPA separately.
- **Consequences:** No persistent server process. Cold starts possible. API routes proxied via Netlify redirects.

### 004 -- wouter over React Router

- **Context:** Lightweight routing needs for a small number of pages.
- **Decision:** Use wouter (~1.5KB) instead of React Router.
- **Consequences:** Minimal bundle impact. Fewer features than React Router but sufficient for this app.

### 005 -- Express 5

- **Context:** Starting a new project, opted for the latest Express version.
- **Decision:** Use Express v5 (pre-release).
- **Consequences:** Some middleware and patterns differ from v4 docs. Smaller ecosystem of v5-specific guidance.

---

*Add new decisions at the bottom. Number sequentially.*

---

## 2026-07-12/13 — Website publishing lives here, media processing lives in the website repo's CI

- **Context:** One-click publishing for sermons (light) and recap edits (heavy: ffmpeg + 340MB files, impossible in a 26s serverless function).
- **Decision:** Sermons: `shared/send-to-website.ts` imported by BOTH API layers commits the markdown via GitHub contents API. Recap edits: `POST /api/edits/:id/publish` fires `repository_dispatch`; the `publish-recap` Action on `c7sharp9/pfc-website` runs the whole pipeline in CI.
- **Consequences:** Dashboard needs only `GITHUB_TOKEN` (fine-grained, contents:write on pfc-website, expires ~2027-07). Airtable stays the production source of truth; the site repo is the website source of truth.

---

## 2026-07-13 — Description fields: manual/auto x short/long, manual wins

- **Context:** A single description field couldn't separate AI taglines, human YouTube long-texts, and generated long copy; regeneration overwrote human edits.
- **Decision:** Four fields per record (short/long x generated/manual). `send-to-website.ts` reads `manual || generated`. Short capped at 125 chars, enforced in the UI with a live counter. All field names say "short" or "long".
- **Consequences:** Migrated 27 sermon records' old `Description` -> `Manual Long Description` (the imported YouTube texts are long, not short). Generation can now run without clobbering human copy. Website story: `~/Code/pfc-website/memory/project_description_system.md`.

---

## 2026-07-14 — Sermon Prepare: one button drafts descriptions AND moment quotes

- **Context:** Descriptions and quotes were being written/curated by hand in-session. Wanted the machine to draft, human to review — the same manual-wins model as descriptions.
- **Decision:** A **Prepare with AI** button on the sermon page (`POST /api/sermons/:id/prepare`, both layers → `prepare-sermon` dispatch) runs `tools/prepare-sermon.py` in the website repo's CI: fetch transcript → Claude drafts short+long descriptions into the AI fields → Claude extracts near-verbatim moment quotes (15 service / 10 podcast, timecoded, speaker-attributed) into the Quotes table. Writes ONLY to Airtable; no video processing (sermons are YouTube).
- **Consequences:** Review workspaces (Descriptions, Website Quotes) become the human layer. Quotes seed `On Website=true` (opt-out: de-select the few you don't want). Idempotent: descriptions overwrite AI fields; quotes seed only when none exist for the date.

## 2026-07-14 — Whisper on the Drive audio, not YouTube captions (CI reality)

- **Context:** Fresh services have no Descript transcript for a day; the YouTube fallback can't run in CI (YouTube bot-blocks GitHub's datacenter IPs, and we never use cookies — see `feedback_no_browser_cookies`).
- **Decision:** Transcript waterfall = Drive/Descript first, else **OpenAI Whisper** on the Drive Audio URL (download → ffmpeg 16kHz mono → whisper-1 verbose_json → `[M:SS]` transcript; chunks audio >24MB). Reused the existing OpenAI key. The Prepare button gates on Transcription URL OR Audio URL.
- **Consequences:** Prepare works same-day off the audio (no waiting on Descript), reliably in CI. Whisper transcript stored in a new `AI Service Transcript` field (not verbatim to Descript — kept separate from the Descript transcript that drives Descript text-editing). YouTube retired from the pipeline.

## 2026-07-14 — Per-corpus review workspaces (the "review → revise → send" pattern)

- **Context:** Reviewing AI-drafted content one sermon-page-at-a-time is slow.
- **Decision:** Dedicated pages that list a whole corpus with inline edit + per-item send: **Website Quotes** (/website-quotes) for moments, **Descriptions** (/descriptions) for copy. Shared shape: collapsible items, unreviewed-first, Reviewed status, Send publishes + marks reviewed, an "Unpublished" cue for edited-but-unsent items.
- **Consequences:** The Descriptions page is an accordion (one open at a time, boxes fit-to-content). Edits write to Manual fields; a session-scoped dirty set drives the Unpublished badge.

## 2026-07-14 — Skip Website scope flag

- **Context:** Only 2026 sermons + any with a recap belong on the new site; the other ~311 shouldn't nag for descriptions or be sent.
- **Decision:** A `Skip Website` checkbox (auto-applied to the 311 out-of-scope: pre-2026 with no recap; recaps match by broadcast date). New sermons default OFF (on the website). The Descriptions page hides skipped from All/Needs review/Missing, with a Skipped tab.
- **Consequences:** The real "Missing" backlog dropped from 342 to 32 in-scope sermons.

## 2026-07-14 — 4-state field status colors + AI/Manual labels

- **Context:** Hard to tell at a glance what a record still needs.
- **Decision:** One `fieldRing()` helper: green = filled, grey = fine empty, yellow = wanted (not required), red = required-and-missing. Generated fields labeled "AI …" to pair with "Manual …".
- **Consequences:** A finished record reads as a wall of green; the page fills in as work gets done.
