// Append-only activity log for a Sermon or Edit record.
//
// Every action worth noticing gets a timestamped line: the dashboard writes one
// when a button dispatches, and the CI scripts write one when the work actually
// lands. A dispatch with no follow-up line is therefore visibly stuck, which is
// the whole point -- a job that never ran used to look identical to one that
// was still running.
//
// Stored in a plain "Activity" long-text field (newest first) rather than a
// separate table: it stays readable in Airtable itself, needs no joins, and the
// volume here is a handful of lines per record.
//
// Shared by BOTH API layers so the format cannot drift.

export const SERMON_TABLE = "tbls5szdfaZtJrCfe";
export const EDITS_TABLE = "tblMWVa6ZJxGafti2";

const BASE_ID = "appsXqsMSCaQAOxoc";
const MAX_LINES = 40; // keep the field readable; oldest entries fall off

// "Aug 6, 6:52 PM" in church time, so timestamps match when staff were working.
export function stamp(d: Date = new Date()): string {
  return d.toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function prependEntry(existing: string, message: string, at: Date = new Date()): string {
  const line = `${stamp(at)}  ${message}`;
  const lines = (existing || "").split("\n").filter((l) => l.trim());
  return [line, ...lines].slice(0, MAX_LINES).join("\n");
}

/**
 * Append a line to a record's Activity field. Best-effort: logging must never
 * break the action it is describing, so callers can ignore failures.
 */
export async function logActivity(
  table: string,
  recordId: string,
  message: string,
  pat: string
): Promise<void> {
  const url = `https://api.airtable.com/v0/${BASE_ID}/${table}/${recordId}`;
  const headers = {
    Authorization: `Bearer ${pat}`,
    "Content-Type": "application/json",
  };
  // NB: Airtable rejects fields[] on a single-record GET (list endpoints only),
  // so fetch the whole record.
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`activity read ${res.status}`);
  const rec = await res.json();
  const next = prependEntry(rec?.fields?.["Activity"] || "", message);
  const put = await fetch(url, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ fields: { Activity: next } }),
  });
  if (!put.ok) throw new Error(`activity write ${put.status}`);
}

/** Fire-and-forget wrapper: never throws, never blocks the caller's response. */
export function logActivitySafe(
  table: string,
  recordId: string,
  message: string,
  pat: string
): Promise<void> {
  return logActivity(table, recordId, message, pat).catch(() => {});
}
