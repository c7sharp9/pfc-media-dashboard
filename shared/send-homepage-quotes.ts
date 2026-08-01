// Send the Homepage-tagged quotes to the PFC website's home page carousel.
//
// The homepage rotates through src/_data/quotes.json in c7sharp9/pfc-website
// (see index.njk's #quote-stage). This module rewrites that file from the
// Airtable quotes tagged "Homepage Quote" -- the whole file, every send, so
// re-sending after tag changes replaces the live set (idempotent when nothing
// changed). The site auto-deploys from main.
//
// Shared by BOTH API layers (server/routes.ts and netlify/functions/api.mts)
// so the logic cannot diverge. Requires env: GITHUB_TOKEN.

const REPO = "c7sharp9/pfc-website";
const BRANCH = "main";
const FILE_PATH = "src/_data/quotes.json";

export interface SendHomepageQuotesResult {
  status: "updated" | "unchanged";
  count: number;
}

// One normalization for both sending and comparing: strip rich-text tags,
// collapse whitespace.
export function cleanQuoteText(s: string): string {
  return (s || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

// Match the hand-written style of the existing file: one { "text": ... } per line.
export function buildQuotesJson(texts: string[]): string {
  if (texts.length === 0) return "[]\n";
  const lines = texts.map((t) => `  { "text": ${JSON.stringify(t)} }`);
  return `[\n${lines.join(",\n")}\n]\n`;
}

async function githubFetch(
  token: string,
  path: string,
  options?: RequestInit
): Promise<Response> {
  return fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });
}

function requireToken(): string {
  const token = process.env.GITHUB_TOKEN || "";
  if (!token) {
    throw new Error(
      "GITHUB_TOKEN is not configured on the server. Add it to the environment to enable Send to Website."
    );
  }
  return token;
}

async function getLiveFile(token: string): Promise<{ texts: string[]; sha: string; raw: string }> {
  const res = await githubFetch(token, `/repos/${REPO}/contents/${FILE_PATH}?ref=${BRANCH}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub error ${res.status}: ${text}`);
  }
  const file = await res.json();
  const raw = Buffer.from((file.content || "").replace(/\n/g, ""), "base64").toString("utf-8");
  let texts: string[] = [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      texts = parsed
        .filter((q: any) => q && q.visible !== false && typeof q.text === "string")
        .map((q: any) => cleanQuoteText(q.text));
    }
  } catch {
    // Unparseable file: treat as empty; the next send rewrites it cleanly.
  }
  return { texts, sha: file.sha, raw };
}

// What the homepage carousel currently shows (for the dashboard's sync check).
export async function fetchLiveHomepageQuotes(): Promise<string[]> {
  const token = requireToken();
  const { texts } = await getLiveFile(token);
  return texts;
}

// Replace the carousel's quote set. Caller supplies already-chosen texts
// (Final wins over Original) in display order.
export async function sendHomepageQuotes(
  texts: string[]
): Promise<SendHomepageQuotesResult> {
  const token = requireToken();
  const cleaned = texts.map(cleanQuoteText).filter(Boolean);

  const { sha, raw } = await getLiveFile(token);
  const next = buildQuotesJson(cleaned);
  if (next === raw) {
    return { status: "unchanged", count: cleaned.length };
  }

  const putRes = await githubFetch(token, `/repos/${REPO}/contents/${FILE_PATH}`, {
    method: "PUT",
    body: JSON.stringify({
      message: `Update homepage quotes (${cleaned.length}) via dashboard`,
      content: Buffer.from(next, "utf-8").toString("base64"),
      branch: BRANCH,
      sha,
    }),
  });
  if (!putRes.ok) {
    const text = await putRes.text();
    throw new Error(`GitHub error ${putRes.status}: ${text}`);
  }

  return { status: "updated", count: cleaned.length };
}
