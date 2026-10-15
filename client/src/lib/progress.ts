import type { Sermon } from "@shared/schema";

// Two owners, two bars. MEDIA is everything the editor does (files, YouTube,
// Facebook, the sermon page itself, verified live). AI is the content track
// (transcript, descriptions, moments). The transcript link counts only on the
// AI side: it's made by the Descript button, not uploaded by hand.
function pct(steps: boolean[]) {
  return Math.round((steps.filter(Boolean).length / steps.length) * 100);
}

export function mediaProgress(sermon: Sermon): number {
  const f = sermon.fields;
  const site = [!!f["Sermon URL"], !!f["Website Done"]];
  if (f["Platform"] === "Sunday") {
    return pct([
      !!f["Video URL"],
      !!(f["Trimmed Video URL"] && f["Audio URL"]),
      !!f["YouTube Trimmed URL"],
      !!f["YouTube Hidden"],
      !!f["Facebook Done"],
      ...site,
    ]);
  }
  if (f["Platform"] === "Wednesday") {
    return pct([
      !!f["Video URL"],
      !!f["Audio URL"],
      !!(f["Facebook Done"] && f["Wednesday YouTube Trimmed"]),
      !!f["Wednesday YouTube Link"],
      ...site,
    ]);
  }
  return 0;
}

export function aiProgress(sermon: Sermon): number {
  const f = sermon.fields;
  if (!f["Platform"]) return 0;
  return pct([
    !!(f["Transcription URL"] || "").trim(),
    !!f["Descriptions Sent"],
    !!f["Moments Sent"],
  ]);
}
