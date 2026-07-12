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

// Front-matter keys this integration owns. Anything else already in the file
// (legacyAudio, rebroadcast, visible, speaker, ...) is preserved verbatim so
// a send never destroys archive data it doesn't know about.
const MANAGED_KEYS = ["title", "date", "youtube", "fullService", "broadcast"];

// Pull the raw front-matter lines for keys we don't manage.
export function unmanagedFrontMatterLines(existingMarkdown: string): string[] {
  const m = existingMarkdown.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return [];
  return m[1]
    .split("\n")
    .filter((line) => {
      const key = line.match(/^([A-Za-z][A-Za-z0-9_-]*):/)?.[1];
      return key ? !MANAGED_KEYS.includes(key) : false;
    });
}

// Validate the record and build the markdown. Throws with a friendly message
// listing anything missing.
export function buildSermonMarkdown(
  fields: Record<string, any>,
  extraLines: string[] = []
): {
  slug: string;
  markdown: string;
} {
  const isSunday = fields["Platform"] === "Sunday";
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

  if (!date) missing.push("Service date");
  if (!title) missing.push("Title");
  if (!youtube)
    missing.push(isSunday ? "YouTube Trimmed URL" : "Wednesday YouTube Link");

  if (missing.length) {
    throw new Error(`Missing before sending: ${missing.join(", ")}`);
  }

  const slug = dateToSlug(date);
  if (!slug) throw new Error(`Service date "${date}" is not YYYY-MM-DD.`);

  const broadcast = isSunday
    ? "Prophetic Fulfillment Church"
    : "Pulling on Heaven Podcast";

  const lines = [
    "---",
    `title: "${title.replace(/"/g, "'")}"`,
    `date: ${date.slice(0, 10)}`,
    `youtube: "${youtube}"`,
  ];
  if (fullService) lines.push(`fullService: "${fullService}"`);
  lines.push(`broadcast: "${broadcast}"`);
  lines.push(...extraLines);
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
  fields: Record<string, any>
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

  const { slug } = buildSermonMarkdown(fields); // validates + slug
  const filePath = `src/sermons/${slug}.md`;
  const pageUrl = `${siteUrl}/sermons/${slug}/`;

  // Does the file already exist? (need its sha to update; also lets us no-op
  // and preserve front-matter keys we don't manage, like legacyAudio)
  const getRes = await githubFetch(
    token,
    `/repos/${REPO}/contents/${filePath}?ref=${BRANCH}`
  );

  let sha: string | undefined;
  let currentContent = "";
  let extraLines: string[] = [];
  if (getRes.ok) {
    const existing = await getRes.json();
    sha = existing.sha;
    currentContent = Buffer.from(
      (existing.content || "").replace(/\n/g, ""),
      "base64"
    ).toString("utf-8");
    extraLines = unmanagedFrontMatterLines(currentContent);
  } else if (getRes.status !== 404) {
    const text = await getRes.text();
    throw new Error(`GitHub error ${getRes.status}: ${text}`);
  }

  const { markdown } = buildSermonMarkdown(fields, extraLines);
  if (sha && currentContent === markdown) {
    return { status: "unchanged", slug, pageUrl };
  }
  const encoded = Buffer.from(markdown, "utf-8").toString("base64");

  const putRes = await githubFetch(token, `/repos/${REPO}/contents/${filePath}`, {
    method: "PUT",
    body: JSON.stringify({
      message: `${sha ? "Update" : "Add"} sermon: ${fields["Title"]} (${fields["Service"]}) via dashboard`,
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
