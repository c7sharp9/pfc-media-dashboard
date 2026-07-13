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
