// Send a sermon's approved quotes to the PFC website (c7sharp9/pfc-website).
//
// Rewrites ONLY the pullQuotes block in src/sermons/<slug>.md, preserving all
// other front matter verbatim. Clicking again after edits replaces the live
// set, so this button is also the "update" button. Quotes render on the
// message page as the "Moments from this message" cards.
//
// Shared by BOTH API layers (server/routes.ts and netlify/functions/api.mts)
// so the logic cannot diverge. Requires env: GITHUB_TOKEN, PFC_SITE_URL (opt).

import { dateToSlug } from "./send-to-website";

const REPO = "c7sharp9/pfc-website";
const BRANCH = "main";

export interface PublishQuote {
  time: string; // "3:35" or "1:04:40"
  text: string;
}

export interface SendQuotesResult {
  status: "updated" | "unchanged" | "removed";
  slug: string;
  pageUrl: string;
  count: number;
}

// "1:04:40" -> seconds, for sorting. Bad values sort last, never throw.
export function timecodeSeconds(tc: string): number {
  const parts = (tc || "").trim().split(":").map((p) => parseInt(p, 10));
  if (parts.some((n) => Number.isNaN(n)) || parts.length === 0) return Infinity;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

// Build the pullQuotes front-matter block (sorted by timecode).
export function buildPullQuotesBlock(quotes: PublishQuote[]): string {
  const sorted = [...quotes].sort(
    (a, b) => timecodeSeconds(a.time) - timecodeSeconds(b.time)
  );
  const lines = ["pullQuotes:"];
  for (const q of sorted) {
    const text = q.text.trim().replace(/\s+/g, " ").replace(/"/g, "'");
    lines.push(`  - time: "${(q.time || "").trim()}"`);
    lines.push(`    text: "${text}"`);
  }
  return lines.join("\n");
}

// Replace (or insert/remove) the pullQuotes block inside the front matter.
export function replacePullQuotes(markdown: string, block: string): string {
  const fm = markdown.match(/^---\n([\s\S]*?)\n---/);
  if (!fm) throw new Error("Sermon file has no front matter.");
  // Strip any existing pullQuotes block (the key line + its indented items).
  const kept: string[] = [];
  let inBlock = false;
  for (const line of fm[1].split("\n")) {
    const key = line.match(/^([A-Za-z][A-Za-z0-9_-]*):/)?.[1];
    if (key) inBlock = key === "pullQuotes";
    if (!inBlock) kept.push(line);
  }
  if (block) kept.push(block);
  return markdown.replace(fm[0], `---\n${kept.join("\n")}\n---`);
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

// Commit the quotes. The sermon page must already exist on the site (send the
// sermon itself first). An empty quotes array REMOVES the section.
export async function sendQuotesToWebsite(
  serviceDate: string,
  title: string,
  quotes: PublishQuote[]
): Promise<SendQuotesResult> {
  const token = process.env.GITHUB_TOKEN || "";
  if (!token) {
    throw new Error(
      "GITHUB_TOKEN is not configured on the server. Add it to the environment to enable Send to Website."
    );
  }
  const siteUrl = (
    process.env.PFC_SITE_URL || "https://pfc-preview-gz.netlify.app"
  ).replace(/\/$/, "");

  const slug = dateToSlug(serviceDate);
  if (!slug) throw new Error(`Service date "${serviceDate}" is not YYYY-MM-DD.`);
  const filePath = `src/sermons/${slug}.md`;
  const pageUrl = `${siteUrl}/sermons/${slug}/`;

  const getRes = await githubFetch(
    token,
    `/repos/${REPO}/contents/${filePath}?ref=${BRANCH}`
  );
  if (getRes.status === 404) {
    throw new Error(
      "This message isn't on the website yet. Use Send to Website on the sermon first, then send its quotes."
    );
  }
  if (!getRes.ok) {
    const text = await getRes.text();
    throw new Error(`GitHub error ${getRes.status}: ${text}`);
  }
  const existing = await getRes.json();
  const current = Buffer.from(
    (existing.content || "").replace(/\n/g, ""),
    "base64"
  ).toString("utf-8");

  const block = quotes.length ? buildPullQuotesBlock(quotes) : "";
  const next = replacePullQuotes(current, block);
  if (next === current) {
    return { status: "unchanged", slug, pageUrl, count: quotes.length };
  }

  const putRes = await githubFetch(token, `/repos/${REPO}/contents/${filePath}`, {
    method: "PUT",
    body: JSON.stringify({
      message: quotes.length
        ? `Update quotes (${quotes.length}) for ${title || slug} via dashboard`
        : `Remove quotes for ${title || slug} via dashboard`,
      content: Buffer.from(next, "utf-8").toString("base64"),
      branch: BRANCH,
      sha: existing.sha,
    }),
  });
  if (!putRes.ok) {
    const text = await putRes.text();
    throw new Error(`GitHub error ${putRes.status}: ${text}`);
  }

  return {
    status: quotes.length ? "updated" : "removed",
    slug,
    pageUrl,
    count: quotes.length,
  };
}
