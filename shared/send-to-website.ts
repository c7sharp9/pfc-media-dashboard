// Send a sermon record to the PFC website (c7sharp9/pfc-website).
//
// Builds the sermon markdown from the Airtable record and commits it to the
// site repo via the GitHub contents API. The website repo auto-deploys on
// push, so the page is live ~30s after a successful send.
//
// Shared by BOTH API layers (server/routes.ts and netlify/functions/api.mts)
// so the logic cannot diverge. Requires env:
//   GITHUB_TOKEN  - token with contents:write on c7sharp9/pfc-website
//   PFC_SITE_URL  - optional; page URL base (defaults to the Netlify preview)

const REPO = "c7sharp9/pfc-website";
const BRANCH = "main";

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

// "2026-07-05" -> "july-5-2026" (the site's slug convention, which also
// preserved the old WordPress URLs during migration).
export function dateToSlug(isoDate: string): string {
  const m = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  return `${MONTHS[parseInt(m[2], 10) - 1]}-${parseInt(m[3], 10)}-${m[1]}`;
}

// Accepts youtu.be/ID, youtube.com/watch?v=ID, /live/ID, /embed/ID, or a raw ID.
export function extractYouTubeId(url: string): string {
  if (!url) return "";
  const s = url.trim();
  if (/^[A-Za-z0-9_-]{6,20}$/.test(s) && !s.includes(".")) return s;
  const patterns = [
    /youtu\.be\/([A-Za-z0-9_-]{6,20})/,
    /[?&]v=([A-Za-z0-9_-]{6,20})/,
    /\/live\/([A-Za-z0-9_-]{6,20})/,
    /\/embed\/([A-Za-z0-9_-]{6,20})/,
    /\/shorts\/([A-Za-z0-9_-]{6,20})/,
  ];
  for (const p of patterns) {
    const m = s.match(p);
    if (m) return m[1];
  }
  return "";
}

export interface SendResult {
  status: "created" | "updated" | "unchanged";
  slug: string;
  pageUrl: string;
}

// The three publishable pieces of a message page are sent INDEPENDENTLY, by
// different people at different times: the person who cuts the video sends the
// sermon as soon as it's ready, without waiting on description or moment
// approval. Each send rewrites only the keys it owns and leaves the rest of the
// file exactly as it found it.
//   "sermon"       -> the video + its identity
//   "descriptions" -> the copy (approved separately)
//   "all"          -> both (the original combined behaviour)
// Moments live in `pullQuotes` and are owned by send-quotes-to-website.ts.
export type SendMode = "all" | "sermon" | "descriptions";

const SERMON_KEYS = ["title", "date", "youtube", "fullService", "broadcast"];
const DESCRIPTION_KEYS = ["description", "longDescription"];
const ALL_KEYS = [...SERMON_KEYS, ...DESCRIPTION_KEYS];

function keysFor(mode: SendMode): string[] {
  if (mode === "sermon") return SERMON_KEYS;
  if (mode === "descriptions") return DESCRIPTION_KEYS;
  return ALL_KEYS;
}

// Split existing front matter into ordered per-key blocks. Block-aware:
// indented continuation lines (e.g. the "- time:/text:" items of a pullQuotes
// list) belong to the key above them, so they travel with it -- a line-by-line
// filter silently drops them and corrupts multi-line YAML.
export function parseFrontMatterBlocks(
  existingMarkdown: string
): { key: string; lines: string[] }[] {
  const m = existingMarkdown.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return [];
  const blocks: { key: string; lines: string[] }[] = [];
  let current: { key: string; lines: string[] } | null = null;
  for (const line of m[1].split("\n")) {
    const key = line.match(/^([A-Za-z][A-Za-z0-9_-]*):/)?.[1];
    if (key) {
      current = { key, lines: [line] };
      blocks.push(current);
    } else if (current) {
      current.lines.push(line);
    }
  }
  return blocks;
}

// Validate the record and build the markdown. Throws with a friendly message
// listing anything missing. Only the keys owned by `mode` are rebuilt from
// Airtable; every other key keeps the exact line(s) already in the file, in the
// original order, so an independent send never disturbs the other pieces.
export function buildSermonMarkdown(
  fields: Record<string, any>,
  existingMarkdown: string = "",
  mode: SendMode = "all"
): {
  slug: string;
  markdown: string;
} {
  const isSunday = fields["Platform"] === "Sunday";
  const owned = keysFor(mode);
  const missing: string[] = [];

  const date = fields["Service"] || "";
  const title = (fields["Title"] || "").trim();
  const ytSource = isSunday
    ? fields["YouTube Trimmed URL"]
    : fields["Wednesday YouTube Link"];
  const youtube = extractYouTubeId(ytSource || "");
  const fullService = isSunday
    ? extractYouTubeId(fields["YouTube Full Service URL"] || "")
    : "";

  // The date is always needed -- it's the slug. Title/video are only required
  // when this send is the one that owns them.
  if (!date) missing.push("Service date");
  if (owned.includes("title") && !title) missing.push("Title");
  if (owned.includes("youtube") && !youtube)
    missing.push(isSunday ? "YouTube Trimmed URL" : "Wednesday YouTube Link");

  if (missing.length) {
    throw new Error(`Missing before sending: ${missing.join(", ")}`);
  }

  const slug = dateToSlug(date);
  if (!slug) throw new Error(`Service date "${date}" is not YYYY-MM-DD.`);

  const broadcast = isSunday
    ? "Prophetic Fulfillment Church"
    : "Pulling on Heaven Podcast";

  // Manual fields win over generated ones when filled.
  const desc = ((fields["Manual Short Description"] || fields["Short Description"]) || "").trim().replace(/\s+/g, " ");
  const longDesc = ((fields["Manual Long Description"] || fields["Long Description"]) || "").trim().replace(/\s+/g, " ");

  const computed: Record<string, string | ""> = {
    title: `title: "${title.replace(/"/g, "'")}"`,
    date: `date: ${date.slice(0, 10)}`,
    youtube: `youtube: "${youtube}"`,
    fullService: fullService ? `fullService: "${fullService}"` : "",
    broadcast: `broadcast: "${broadcast}"`,
    description: desc ? `description: "${desc.replace(/"/g, "'")}"` : "",
    longDescription: longDesc ? `longDescription: "${longDesc.replace(/"/g, "'")}"` : "",
  };

  const existing = parseFrontMatterBlocks(existingMarkdown);
  const existingByKey = new Map(existing.map((b) => [b.key, b.lines]));

  const lines: string[] = ["---"];
  for (const key of ALL_KEYS) {
    if (owned.includes(key)) {
      if (computed[key]) lines.push(computed[key]);
    } else {
      const kept = existingByKey.get(key);
      if (kept) lines.push(...kept);
    }
  }
  // Keys this integration doesn't manage at all (pullQuotes, legacyAudio,
  // rebroadcast, visible, speaker, ...) are preserved verbatim, in order.
  for (const block of existing) {
    if (!ALL_KEYS.includes(block.key)) lines.push(...block.lines);
  }
  lines.push("---", "");

  return { slug, markdown: lines.join("\n") };
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

// Commit the sermon file. Idempotent: if the file already exists with the
// same content, nothing is committed and status is "unchanged".
export async function sendToWebsite(
  fields: Record<string, any>,
  mode: SendMode = "all"
): Promise<SendResult> {
  const token = process.env.GITHUB_TOKEN || "";
  if (!token) {
    throw new Error(
      "GITHUB_TOKEN is not configured on the server. Add it to the environment to enable Send to Website."
    );
  }
  const siteUrl = (
    process.env.PFC_SITE_URL || "https://pfc-preview-gz.netlify.app"
  ).replace(/\/$/, "");

  const { slug } = buildSermonMarkdown(fields, "", mode); // validates + slug
  const filePath = `src/sermons/${slug}.md`;
  const pageUrl = `${siteUrl}/sermons/${slug}/`;

  // Does the file already exist? (need its sha to update; also lets us no-op
  // and keep every key this send doesn't own exactly as it is)
  const getRes = await githubFetch(
    token,
    `/repos/${REPO}/contents/${filePath}?ref=${BRANCH}`
  );

  let sha: string | undefined;
  let currentContent = "";
  if (getRes.ok) {
    const existing = await getRes.json();
    sha = existing.sha;
    currentContent = Buffer.from(
      (existing.content || "").replace(/\n/g, ""),
      "base64"
    ).toString("utf-8");
  } else if (getRes.status !== 404) {
    const text = await getRes.text();
    throw new Error(`GitHub error ${getRes.status}: ${text}`);
  }

  // Descriptions ride on top of a page that already exists -- on their own they
  // can't produce a valid page (no title, no video), so the sermon goes first.
  if (!sha && mode === "descriptions") {
    throw new Error(
      "This message isn't on the website yet. Use Send Sermon first, then send its descriptions."
    );
  }

  const { markdown } = buildSermonMarkdown(fields, currentContent, mode);
  if (sha && currentContent === markdown) {
    return { status: "unchanged", slug, pageUrl };
  }
  const encoded = Buffer.from(markdown, "utf-8").toString("base64");

  const what =
    mode === "descriptions" ? "descriptions" : mode === "sermon" ? "sermon" : "sermon";
  const putRes = await githubFetch(token, `/repos/${REPO}/contents/${filePath}`, {
    method: "PUT",
    body: JSON.stringify({
      message: `${sha ? "Update" : "Add"} ${what}: ${fields["Title"]} (${fields["Service"]}) via dashboard`,
      content: encoded,
      branch: BRANCH,
      ...(sha ? { sha } : {}),
    }),
  });
  if (!putRes.ok) {
    const text = await putRes.text();
    throw new Error(`GitHub error ${putRes.status}: ${text}`);
  }

  return { status: sha ? "updated" : "created", slug, pageUrl };
}
