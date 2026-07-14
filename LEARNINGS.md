# Learnings -- PFC Media Dashboard

Capture things learned during development -- bugs, surprises, useful patterns, things to remember.

## Format

```
### YYYY-MM-DD -- Short title
What happened, what was learned, what to do differently next time.
```

---

*Add entries as you go. Most recent at the top.*

### 2026-07-12 -- The two-API-layer gotcha has a cure: shared modules

The documented failure mode (route added to Express but not the Netlify function, or vice versa)
stops existing when the logic lives once in `shared/` and both layers import it —
`send-to-website.ts` is the pattern to copy for any future cross-layer feature.

### 2026-07-12 -- Fine-grained GitHub PATs default to Metadata-only

A fresh fine-grained token "with access to the repo" still 403s on contents until
Contents: Read and write is explicitly added under Repository permissions. The token
can be edited in place after creation (same value, new permissions).

### 2026-07-14 — YouTube can't be scraped from CI; Whisper on the audio is the fix

yt-dlp works from a residential IP but GitHub's datacenter IPs get "Sign in to
confirm you're not a bot" — and cookies are off-limits. Player-client extractor
args didn't help. The durable answer for CI transcription is OpenAI Whisper on
the Drive audio (ffmpeg to 16kHz mono keeps it under the 25MB cap; verbose_json
gives segment timecodes). Bonus: available same-day, before Descript finishes.

### 2026-07-14 — claude-sonnet-5 emits a thinking block that counts against max_tokens

The quote-extraction call intermittently returned no text block (StopIteration)
because the model spent the whole 3000-token budget thinking. Budget generously
(quotes call = 8000) and extract the text block defensively with a clear error.

### 2026-07-14 — Airtable date fields need DATESTR() in filterByFormula

`{Service Date}='2026-07-12'` never matches a DATE-typed field, so the quote
"skip if any exist" guard silently reseeded duplicates on every re-run. Use
`DATESTR({Service Date})='...'`. Same gotcha already bit the sermon by-date
lookups — worth grepping for any raw `{...date...}='...'` comparisons.

### 2026-07-14 — Edit-then-Send race: flush pending saves before publishing

Descriptions save on blur (async PATCH); the Send button fired instantly, so
send-to-website could read the pre-edit value and return "unchanged" — the edit
never reached the site. Fix: Send blurs the active field, then waits for all
in-flight patches (tracked via a ref counter) to settle before publishing. The
"Unpublished" badge is the visible backstop.

### 2026-07-14 — Char-cap truncation clips quote coverage; YouTube VTT is ~3x verbose

Feeding Claude only the first N chars of a transcript clustered all quotes in the
first third of the message. Raise the budget to cover the whole transcript
(quotes 200k, desc 80k). YouTube's per-cue caption format is ~3x more verbose
than Drive prose, so the same char cap clips it much harder.
