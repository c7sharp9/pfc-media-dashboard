# Roadmap -- PFC Media Dashboard

## Current State

Dashboard tracks sermons, edits, and workflow steps via Airtable; deployed on Netlify.
Full content pipeline is live: **Prepare with AI** drafts short+long descriptions and
near-verbatim moment quotes (15 service / 10 podcast) from the transcript into Airtable;
two review workspaces (**Website Quotes**, **Descriptions**) run the review → revise → send
loop. Transcripts come from Descript, else **OpenAI Whisper** on the Drive audio (works in
CI, same-day). Both website bridges are live: sermon Send-to-Website (direct commit) and
recap two-stage Prepare → Send (GitHub Action). `Skip Website` keeps the ~311 out-of-scope
messages out of the way (only 2026 + recap-linked sermons are on the new site).

## Dated next steps

- [ ] [2026-07-14] Run Prepare on the **32 in-scope sermons still missing a short description** (Descriptions page → Missing tab).
- [ ] [2026-07-14] Consider a **dedicated OpenAI + Anthropic key** for the site repo's CI — currently reusing keys from other projects (pulling-stills / virtual-set).
- [ ] [2026-07-14] Optional: make recap-publish **auto-unskip** its sermon (a recap means the message belongs on the site); persist the "Unpublished" cue beyond the session.
- [ ] [2026-07-13] At garyzamora.com DNS cutover: set `PFC_SITE_URL=https://garyzamora.com` in Netlify env (write-back URLs point at the preview).
- [ ] [2026-07-13] ~2027-07: `GITHUB_TOKEN` (fine-grained PAT) expires — mint a new one + `netlify env:set`.

## Near Term

- [ ] Authentication / role-based access (editors vs. admin)
- [ ] Dashboard overview page with stats (sermons processed this month, pending edits)
- [ ] Self-serve **Generate/Regenerate** quotes button in the UI (the CI key is now in place)
- [ ] Bulk status updates for edits

## Medium Term

- [ ] Notifications when edit status changes
- [ ] Calendar view for upcoming services
- [ ] Descript API integration for the transcript/edit round-trip (its own design session)
- [ ] Migrate from Airtable to local SQLite (Drizzle ORM is already configured)

## Long Term

- [ ] Mobile-optimized editing workflow
- [ ] Analytics on publishing turnaround times

---

*Update this file as priorities shift. Date each major change.*
