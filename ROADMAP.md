# Roadmap -- PFC Media Dashboard

## Current State

Dashboard tracks sermons, edits, and workflow steps via Airtable; deployed on Netlify. Both
website bridges are live: sermon Send-to-Website (direct commit) and recap Send-to-Website
(GitHub Action pipeline, ~10 min click-to-live). Descriptions + transcripts flow to/from the site.

## Dated next steps

- [ ] [2026-07-13] At garyzamora.com DNS cutover: set `PFC_SITE_URL=https://garyzamora.com` in this site's Netlify env (write-back URLs currently point at the preview).
- [ ] [2026-07-13] ~2027-07: `GITHUB_TOKEN` (fine-grained PAT `pfc-dashboard-send-to-website`) expires — mint a new one + `netlify env:set`.

## Near Term

- [ ] Authentication / role-based access (editors vs. admin)
- [ ] Dashboard overview page with stats (sermons processed this month, pending edits)
- [ ] Filter/search on sermons list
- [ ] Bulk status updates for edits

## Medium Term

- [ ] Notifications when edit status changes
- [ ] Calendar view for upcoming services
- [ ] Integration with YouTube API for automated upload status
- [ ] Migrate from Airtable to local SQLite (Drizzle ORM is already configured)

## Long Term

- [ ] Mobile-optimized editing workflow
- [ ] Automated transcription pipeline
- [ ] Analytics on publishing turnaround times

---

*Update this file as priorities shift. Date each major change.*
