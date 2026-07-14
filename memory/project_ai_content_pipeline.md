---
name: AI Content Pipeline — Prepare drafts, humans review
description: The "Prepare with AI" pipeline (descriptions + moment quotes via Whisper) and the review workspaces that go with it, built 2026-07-13/14.
type: project
---

## What we built

A one-button content pipeline for PFC's messages. On any sermon, **Prepare with AI**
now fetches the transcript, has Claude draft the short + long website descriptions, and
extracts 15 (service) or 10 (podcast) near-verbatim "moment" quotes with timecodes and
speaker attribution — all written to Airtable as drafts. Two dedicated review pages
(**Website Quotes** and **Descriptions**) let Jonathan churn through the drafts with the
same review → revise → send rhythm. Recaps got a matching two-stage flow (Prepare →
review → Send). A `Skip Website` flag keeps the ~311 out-of-scope old messages from
cluttering the work.

## Why it mattered

Before this, Jonathan (with Claude in the chat) hand-wrote every description and
hand-curated every quote, one message at a time. That doesn't scale to a back catalog,
and it made "keeping the site fed" a chore. Now the machine drafts and Jonathan reviews —
he even hit the delightful problem of *running out of items to review*. The pipeline
refills the queue for him.

## How we got there — the story

We started from the description system already in place (manual/auto × short/long, manual
wins at publish) and the Website Quotes review workspace. The first automation was recaps:
their existing publish Action already produced a transcript from Cloudflare Stream, so we
split it into **Prepare** (Stream + transcript + Claude-drafted descriptions into the AI
fields) and **Send** (writes the site page, reusing the prepared Stream video). That gave
us the review-before-publish shape and killed a re-send bug that used to orphan Stream
videos.

Then sermons. Sermons are YouTube-based (no Stream upload), so Prepare is lighter: just
transcript → Claude drafts descriptions **and** moment quotes. The catch was the
transcript. Descript transcripts (on Google Drive) are best — real punctuation, timecodes,
speaker labels — but they aren't ready for a day after a service. The obvious fallback was
YouTube auto-captions… which **cannot be fetched from GitHub Actions**: YouTube bot-blocks
datacenter IPs with "Sign in to confirm you're not a bot," and using cookies is off the
table (Jonathan's rule). Our own laptop fetches them fine (residential IP), so we briefly
had a "run it locally for fresh services" workaround — but that's not self-serve.

The real fix came from a question Jonathan asked: *can we use Whisper?* We already had an
OpenAI key (from the virtual-set work). So the waterfall became **Descript → OpenAI Whisper
on the Drive audio**: download the audio, ffmpeg it down to 16kHz mono (keeps it under the
25MB cap), send to whisper-1, and build a `[M:SS]` timecoded transcript from the segments.
Whisper works *in CI*, is usually available *same-day* (the audio lands before Descript
finishes), and is higher quality than YouTube captions. YouTube got retired from the
pipeline entirely. A 55-minute service transcribes in ~2.5 minutes.

With generation working, we built the **Descriptions** review page as the sibling of
Website Quotes: a card per in-scope sermon, edit inline (writes to the Manual field so
re-Prepare never clobbers you), AI-draft peek + revert, per-card Send. Jonathan then
sharpened it into an accordion (one open at a time, boxes fit-to-content), added a Reviewed
tab, and — critically — a `Skip Website` scope flag. Only 2026 sermons plus any with a
recap belong on the new site; everything else (311 of 391) got auto-skipped, shrinking the
"Missing descriptions" backlog from a scary 342 to a real 32.

The bugs were all found on real data, which is the good kind of finding. Quotes clustered
in the first third of long messages until we stopped truncating the transcript. sonnet-5's
*thinking* tokens ate the response budget until we raised it. An Airtable date-filter
quirk (`{Service Date}='...'` never matches a date field) silently double-seeded quotes.
And the one Jonathan caught himself: he edited a description and it "didn't hit the
website" — because editing saves to Airtable but only publishes on Send, and a race let
Send read the pre-edit value. We fixed the race (Send flushes pending saves first) and
added an amber "Unpublished" badge so an unsent edit can't hide.

## Gotchas + lessons

- **YouTube is unusable from CI** (datacenter bot-block, no cookies). Whisper-on-audio is
  the durable transcription path; ffmpeg to 16kHz mono fits the 25MB Whisper limit.
- **claude-sonnet-5 thinking counts against `max_tokens`** — budget 8000 for the
  quote-extraction call or the text block gets cut off (StopIteration).
- **Airtable DATE fields need `DATESTR()`** in `filterByFormula`; a raw `=` string compare
  silently matches nothing.
- **Edit saves ≠ publish.** Descriptions save on blur but only go live on Send; flush
  pending saves before sending, and show an Unpublished cue.
- **Don't char-cap the transcript** for extraction, or quotes bunch up toward the front.
- **`Skip Website` first** turned an unusable 342-item backlog into an actionable 32.
- Reused API keys (OpenAI from virtual-set, Anthropic from pulling-stills) — fine for now,
  worth dedicated keys for the site repo later.

## Commits

Dashboard `3deb44b → da2d653` (this sprint's arc: description system → quotes review split
→ edits redesign → recap two-stage → sermon Prepare → Whisper → Descriptions page → Skip
Website → accordion + Unpublished cue). Website repo: `prepare-sermon.py`,
`prepare-sermon.yml`, the two-stage `publish-recap.yml`, and the Whisper transcript path.

## What's next for this thread

- Run Prepare on the **32 in-scope sermons still missing a short description**.
- Consider **dedicated OpenAI + Anthropic keys** for the site repo's CI.
- Optional polish: recap-publish auto-unskips its sermon; persist the Unpublished cue
  beyond the session; a self-serve Generate/Regenerate quotes button.

## Next-session prompt

*"Let's keep working the PFC content pipeline — run Prepare on the sermons still missing
descriptions, and pick up the dashboard polish (dedicated CI keys, auto-unskip on recap
publish, self-serve regenerate)."*

## Related files

- `CLAUDE.md` — Sermon Prepare, Website Quotes, Descriptions review, Skip Website sections
- `ROADMAP.md` — dated next steps
- `~/Code/pfc-website/memory/project_description_system.md` — the description-fields origin story
- `~/Code/pfc-website/tools/prepare-sermon.py` — the generation pipeline
