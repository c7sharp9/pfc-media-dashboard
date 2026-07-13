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
