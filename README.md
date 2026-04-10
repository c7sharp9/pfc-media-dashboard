---
name: PFC Media Dashboard
type: Code
audience: Internal
status: Living
repo: c7sharp9/pfc-media-dashboard
live_url: https://pfc-media-dashboard.netlify.app
deploys_via: Netlify
stack: [React, Express, Drizzle, SQLite, Tailwind]
---

# PFC Media Dashboard

Internal dashboard for managing People of Faith Church media operations. Tracks sermons from recording through publishing across YouTube, Facebook, and the church website. Manages video edits (clips, recaps, sizzle reels) and provides a reference workflow checklist for the media team.

## Features

- **Sermon Tracker** -- List and detail views for all services (Sunday & Wednesday). Track video URLs, trimmed versions, audio, transcriptions, YouTube uploads, and publishing status across platforms.
- **Edits Manager** -- Track video edits (clips, recaps, sizzle reels) by editor, status, and completion date.
- **Workflow Reference** -- Step-by-step media publishing checklist organized by platform.
- **Share Links** -- Direct links to individual sermon detail pages.

## Quick Start

```bash
npm install
npm run dev
```

Set `AIRTABLE_PAT` in your environment for live Airtable data. Without it, the app runs with sample data.

## Tech Stack

React 18 + Vite frontend, Express 5 API server, Airtable as data store, Tailwind CSS + Radix UI for design, deployed as Netlify Functions.

See [CLAUDE.md](./CLAUDE.md) for full development details.
