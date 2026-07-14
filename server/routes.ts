import type { Express } from "express";
import { createServer, type Server } from "http";
import { sendToWebsite } from "../shared/send-to-website";
import { sendQuotesToWebsite } from "../shared/send-quotes-to-website";

const AIRTABLE_PAT = process.env.AIRTABLE_PAT || "";
const BASE_ID = "appsXqsMSCaQAOxoc";
const SERMON_TABLE = "tbls5szdfaZtJrCfe";
const EDITS_TABLE = "tblMWVa6ZJxGafti2";
const WORKFLOW_TABLE = "tblBDeWClUOWbI0VL";
const QUOTES_TABLE = "tbl6fKPmeuqBksu5H";

const headers = {
  Authorization: `Bearer ${AIRTABLE_PAT}`,
  "Content-Type": "application/json",
};

async function airtableFetch(url: string, options?: RequestInit) {
  const res = await fetch(url, {
    ...options,
    headers: { ...headers, ...(options?.headers || {}) },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Airtable error ${res.status}: ${text}`);
  }
  return res.json();
}

// Fetch all records with pagination
async function fetchAllRecords(tableId: string, params: string = "") {
  let allRecords: any[] = [];
  let offset: string | undefined;

  do {
    const sep = params ? "&" : "";
    const offsetParam = offset ? `${sep}offset=${offset}` : "";
    const url = `https://api.airtable.com/v0/${BASE_ID}/${tableId}?${params}${offsetParam}`;
    const data = await airtableFetch(url);
    allRecords = allRecords.concat(data.records || []);
    offset = data.offset;
  } while (offset);

  return allRecords;
}

// Sample data when Airtable is unavailable
const SAMPLE_SERMONS = [
  {
    id: "rec_sample_1",
    fields: {
      "Service": "2026-03-29",
      "Platform": "Sunday",
      "Title": "",
      "Video URL": "",
    },
  },
  {
    id: "rec_sample_2",
    fields: {
      "Service": "2026-03-25",
      "Platform": "Wednesday",
      "Title": "",
      "Video URL": "",
    },
  },
  {
    id: "rec_sample_3",
    fields: {
      "Service": "2026-03-22",
      "Platform": "Sunday",
      "Title": "",
      "Video URL": "",
    },
  },
  {
    id: "rec_sample_4",
    fields: {
      "Service": "2026-03-18",
      "Platform": "Wednesday",
      "Title": "Faith Is Not a Transaction",
      "Video URL": "https://drive.google.com/example",
    },
  },
  {
    id: "rec_sample_5",
    fields: {
      "Service": "2026-03-15",
      "Platform": "Sunday",
      "Title": "Genesis Blessing",
      "Video URL": "https://drive.google.com/example",
      "Sermon URL": "https://pfcchurch.org/sermon/genesis-blessing",
      "Trimmed Video URL": "https://drive.google.com/trimmed",
      "Audio URL": "https://drive.google.com/audio",
      "Transcription URL": "https://docs.google.com/transcription",
      "YouTube Trimmed URL": "https://youtube.com/watch?v=example",
      "YouTube Title": "Genesis Blessing - PFC Sunday Service",
      "YouTube Hidden": true,
      "Facebook Done": true,
      "Website Done": true,
    },
  },
  {
    id: "rec_sample_6",
    fields: {
      "Service": "2026-03-11",
      "Platform": "Wednesday",
      "Title": "Predestination Isn't Your Ending...",
      "Video URL": "https://drive.google.com/example",
      "Sermon URL": "https://pfcchurch.org/sermon/predestination",
      "Transcription URL": "https://docs.google.com/transcription",
      "Facebook Done": true,
      "Website Done": true,
    },
  },
  {
    id: "rec_sample_7",
    fields: {
      "Service": "2026-03-08",
      "Platform": "Sunday",
      "Title": "Walking in Purpose",
      "Video URL": "https://drive.google.com/example",
      "Trimmed Video URL": "https://drive.google.com/trimmed",
      "Audio URL": "https://drive.google.com/audio",
      "Transcription URL": "https://docs.google.com/transcription",
      "YouTube Trimmed URL": "https://youtube.com/watch?v=example2",
      "YouTube Title": "Walking in Purpose - PFC",
      "YouTube Hidden": true,
      "YouTube Full Service URL": "https://youtube.com/watch?v=live-example",
      "Facebook Done": true,
    },
  },
  {
    id: "rec_sample_8",
    fields: {
      "Service": "2026-03-04",
      "Platform": "Wednesday",
      "Title": "The Power of Prayer",
      "Video URL": "https://drive.google.com/example",
      "Transcription URL": "https://docs.google.com/transcription",
    },
  },
  {
    id: "rec_sample_9",
    fields: {
      "Service": "2026-03-01",
      "Platform": "Sunday",
      "Title": "New Mercies Every Morning",
      "Video URL": "https://drive.google.com/example",
      "Trimmed Video URL": "https://drive.google.com/trimmed",
      "Audio URL": "https://drive.google.com/audio",
    },
  },
];

const SAMPLE_EDITS = [
  {
    id: "rec_edit_1",
    fields: {
      "Broadcast Date": "2026-03-15",
      "Title": "Genesis Blessing Recap",
      "Status": "Completed",
      "Type": ["Recap"],
      "Editor Name": "Marcus",
      "Date Completed": "2026-03-17",
      "Video URL": "https://drive.google.com/recap-video",
      "Sermon Link": ["rec_sample_5"],
    },
  },
  {
    id: "rec_edit_2",
    fields: {
      "Broadcast Date": "2026-03-15",
      "Title": "Genesis Blessing - Key Moment Clip",
      "Status": "Ready for Review",
      "Type": ["Clip"],
      "Editor Name": "Danielle",
      "Video URL": "https://drive.google.com/clip-video",
      "Sermon Link": ["rec_sample_5"],
    },
  },
  {
    id: "rec_edit_3",
    fields: {
      "Broadcast Date": "2026-03-08",
      "Title": "Walking in Purpose Sizzle Reel",
      "Status": "In Progress",
      "Type": ["Sizzle"],
      "Editor Name": "Marcus",
    },
  },
  {
    id: "rec_edit_4",
    fields: {
      "Broadcast Date": "2026-03-11",
      "Title": "Predestination Clip",
      "Status": "Revision Needed",
      "Type": ["Clip"],
      "Editor Name": "Danielle",
      "Video URL": "https://drive.google.com/clip2",
      "JA Notes": "Please trim the intro shorter",
    },
  },
];

const SAMPLE_WORKFLOW = [
  { id: "wf1", fields: { "Name": "Upload Full Service to Google Drive", "Platform": "GENERAL", "Notes": "Upload the full service recording to the shared Google Drive folder. Name the file with the date and platform (e.g., 2026-03-15_Sunday_FullService.mp4)." } },
  { id: "wf2", fields: { "Name": "Trim Service Video", "Platform": "GENERAL", "Notes": "Create a trimmed version of the sermon (cut intro/outro). Export as MP4 video and MP3 audio." } },
  { id: "wf3", fields: { "Name": "Transcribe Audio", "Platform": "AI", "Notes": "Upload the audio to Descript for transcription. Export the transcript to a Google Doc in the shared drive." } },
  { id: "wf4", fields: { "Name": "Upload Trimmed Video to YouTube", "Platform": "YouTube", "Notes": "Upload the trimmed sermon video with a descriptive title (e.g., 'Genesis Blessing - PFC Sunday Service - March 15, 2026'). Add to the Sermons playlist." } },
  { id: "wf5", fields: { "Name": "Hide YouTube Live Stream", "Platform": "YouTube", "Notes": "Set the original live stream to 'Unlisted' on YouTube. Save the URL for reference." } },
  { id: "wf6", fields: { "Name": "Update Facebook Video", "Platform": "Facebook", "Notes": "Trim the Facebook live video and update the title with the sermon title and date." } },
  { id: "wf7", fields: { "Name": "Create Website Post", "Platform": "Website", "Notes": "Create a new sermon post on the church website. Include: sermon graphic, MP3 audio file, YouTube embed(s), and transcript link." } },
];

let useSampleData = false;

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Test Airtable connection on startup
  try {
    await airtableFetch(`https://api.airtable.com/v0/${BASE_ID}/${SERMON_TABLE}?maxRecords=1`);
    console.log("Airtable connection successful");
  } catch (err: any) {
    console.log("Airtable connection failed, using sample data:", err.message);
    useSampleData = true;
  }

  // ---- SERMONS ----

  // Paginated sermons: ?pageSize=N&cursor=OFFSET_TOKEN
  app.get("/api/sermons", async (req, res) => {
    try {
      if (useSampleData) {
        return res.json({ records: SAMPLE_SERMONS, nextCursor: null });
      }
      const pageSize = Math.min(parseInt(req.query.pageSize as string) || 20, 100);
      const cursor = req.query.cursor as string | undefined;
      const sortParam = "sort%5B0%5D%5Bfield%5D=Service&sort%5B0%5D%5Bdirection%5D=desc";
      const cursorParam = cursor ? `&offset=${encodeURIComponent(cursor)}` : "";
      const url = `https://api.airtable.com/v0/${BASE_ID}/${SERMON_TABLE}?${sortParam}&pageSize=${pageSize}${cursorParam}`;
      const data = await airtableFetch(url);
      res.json({
        records: data.records || [],
        nextCursor: data.offset || null,
      });
    } catch (err: any) {
      console.error("Error fetching sermons:", err.message);
      res.json({ records: SAMPLE_SERMONS, nextCursor: null });
    }
  });

  // Text search: title or date fragment, newest first (sermons list search box)
  app.get("/api/sermons/find", async (req, res) => {
    try {
      const q = String(req.query.q || "").trim().toLowerCase().replace(/'/g, "\\'");
      if (!q) return res.json({ records: [] });
      if (useSampleData) {
        return res.json({ records: SAMPLE_SERMONS.filter((s) =>
          (s.fields["Title"] || "").toLowerCase().includes(q)) });
      }
      const formula = encodeURIComponent(
        `OR(SEARCH('${q}', LOWER({Title}&'')), SEARCH('${q}', DATESTR({Service})&''))`
      );
      const url = `https://api.airtable.com/v0/${BASE_ID}/${SERMON_TABLE}?filterByFormula=${formula}&maxRecords=30&sort%5B0%5D%5Bfield%5D=Service&sort%5B0%5D%5Bdirection%5D=desc`;
      const data = await airtableFetch(url);
      res.json({ records: data.records || [] });
    } catch (err: any) {
      console.error("Error finding sermons:", err.message);
      res.json({ records: [] });
    }
  });

  // Search sermons by date + platform (for linking edits)
  app.get("/api/sermons/search", async (req, res) => {
    try {
      const date = req.query.date as string;
      const platform = req.query.platform as string;
      if (!date) {
        return res.json({ records: [] });
      }
      if (useSampleData) {
        const found = SAMPLE_SERMONS.filter(
          (s) => s.fields["Service"] === date && (!platform || s.fields["Platform"] === platform)
        );
        return res.json({ records: found });
      }
      // Use DATESTR() for Airtable date field comparison
      const datePart = `DATESTR({Service})='${date}'`;
      const formula = platform
        ? encodeURIComponent(`AND(${datePart},{Platform}='${platform}')`)
        : encodeURIComponent(datePart);
      const url = `https://api.airtable.com/v0/${BASE_ID}/${SERMON_TABLE}?filterByFormula=${formula}&maxRecords=5`;
      const data = await airtableFetch(url);
      res.json({ records: data.records || [] });
    } catch (err: any) {
      console.error("Error searching sermons:", err.message);
      res.json({ records: [] });
    }
  });

  // Batch lookup: sermons for a set of service dates (for edits page group headers)
  app.get("/api/sermons/by-dates", async (req, res) => {
    try {
      const datesParam = (req.query.dates as string) || "";
      const dates = datesParam
        .split(",")
        .map((d) => d.trim())
        .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
        .slice(0, 60);
      if (dates.length === 0) {
        return res.json({ records: [] });
      }
      if (useSampleData) {
        const found = SAMPLE_SERMONS.filter((s) => dates.includes(s.fields["Service"]));
        return res.json({ records: found });
      }
      const formula = `OR(${dates.map((d) => `DATESTR({Service})='${d}'`).join(",")})`;
      const url = `https://api.airtable.com/v0/${BASE_ID}/${SERMON_TABLE}?filterByFormula=${encodeURIComponent(formula)}`;
      const data = await airtableFetch(url);
      res.json({ records: data.records || [] });
    } catch (err: any) {
      console.error("Error fetching sermons by dates:", err.message);
      res.json({ records: [] });
    }
  });

  app.get("/api/sermons/:id", async (req, res) => {
    try {
      if (useSampleData) {
        const found = SAMPLE_SERMONS.find(s => s.id === req.params.id);
        return res.json(found || { id: req.params.id, fields: {} });
      }
      const url = `https://api.airtable.com/v0/${BASE_ID}/${SERMON_TABLE}/${req.params.id}`;
      const data = await airtableFetch(url);
      res.json(data);
    } catch (err: any) {
      console.error("Error fetching sermon:", err.message);
      const found = SAMPLE_SERMONS.find(s => s.id === req.params.id);
      res.json(found || { id: req.params.id, fields: {} });
    }
  });

  app.patch("/api/sermons/:id", async (req, res) => {
    try {
      if (useSampleData) {
        const found = SAMPLE_SERMONS.find(s => s.id === req.params.id);
        if (found) {
          Object.assign(found.fields, req.body);
        }
        return res.json(found || { id: req.params.id, fields: req.body });
      }
      const url = `https://api.airtable.com/v0/${BASE_ID}/${SERMON_TABLE}/${req.params.id}`;
      const data = await airtableFetch(url, {
        method: "PATCH",
        body: JSON.stringify({ fields: req.body }),
      });
      res.json(data);
    } catch (err: any) {
      console.error("Error updating sermon:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/sermons", async (req, res) => {
    try {
      if (useSampleData) {
        const newSermon = { id: `rec_sample_${Date.now()}`, fields: req.body };
        SAMPLE_SERMONS.unshift(newSermon);
        return res.json(newSermon);
      }
      const url = `https://api.airtable.com/v0/${BASE_ID}/${SERMON_TABLE}`;
      const data = await airtableFetch(url, {
        method: "POST",
        body: JSON.stringify({ fields: req.body }),
      });
      res.json(data);
    } catch (err: any) {
      console.error("Error creating sermon:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // Send a sermon to the PFC website: commit src/sermons/<slug>.md to the
  // site repo (auto-deploys), then record the page URL back on the record.
  // Quotes for a service date (manual + AI together, sorted by Airtable order)
  app.get("/api/quotes", async (req, res) => {
    try {
      if (useSampleData) return res.json({ records: [] });
      const date = String(req.query.date || "");
      if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ error: "date must be YYYY-MM-DD" });
      }
      // With a date: that service's quotes. Without: the whole table (paged
      // through Airtable offsets) for the Quotes browsing page.
      const base = `https://api.airtable.com/v0/${BASE_ID}/${QUOTES_TABLE}?pageSize=100` +
        (date ? `&filterByFormula=${encodeURIComponent(`DATESTR({Service Date})='${date}'`)}` : "");
      let records: any[] = [];
      let offset: string | undefined;
      do {
        const data = await airtableFetch(base + (offset ? `&offset=${offset}` : ""));
        records = records.concat(data.records || []);
        offset = data.offset;
      } while (offset && records.length < 2000);
      res.json({ records });
    } catch (err: any) {
      console.error("Error fetching quotes:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/quotes/:id", async (req, res) => {
    try {
      if (useSampleData) {
        return res.status(503).json({ error: "Airtable is not connected (sample data mode)." });
      }
      const url = `https://api.airtable.com/v0/${BASE_ID}/${QUOTES_TABLE}/${req.params.id}`;
      const data = await airtableFetch(url, {
        method: "PATCH",
        body: JSON.stringify({ fields: req.body || {} }),
      });
      res.json(data);
    } catch (err: any) {
      console.error("Error updating quote:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/quotes/:id", async (req, res) => {
    try {
      if (useSampleData) {
        return res.status(503).json({ error: "Airtable is not connected (sample data mode)." });
      }
      const data = await airtableFetch(
        `https://api.airtable.com/v0/${BASE_ID}/${QUOTES_TABLE}/${req.params.id}`,
        { method: "DELETE" }
      );
      res.json(data);
    } catch (err: any) {
      console.error("Error deleting quote:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // Publish the checked quotes for this sermon's date to the website page.
  // Re-clicking replaces the live set (this is also the "update" button).
  app.post("/api/sermons/:id/send-quotes", async (req, res) => {
    try {
      if (useSampleData) {
        return res.status(503).json({ error: "Airtable is not connected (sample data mode)." });
      }
      const recUrl = `https://api.airtable.com/v0/${BASE_ID}/${SERMON_TABLE}/${req.params.id}`;
      const record = await airtableFetch(recUrl);
      const date = (record.fields?.["Service"] || "").slice(0, 10);
      const formula = encodeURIComponent(`AND(DATESTR({Service Date})='${date}',{On Website}=1)`);
      const qUrl = `https://api.airtable.com/v0/${BASE_ID}/${QUOTES_TABLE}?filterByFormula=${formula}&pageSize=100`;
      const qData = await airtableFetch(qUrl);
      // Final wins over Original; strip rich-text artifacts from Final.
      const quotes = (qData.records || []).map((r: any) => ({
        time: r.fields["Video Timecode"] || "",
        text: String(r.fields["Quote Final"] || r.fields["Quote Original"] || "")
          .replace(/<[^>]+>/g, "").trim(),
        speaker: r.fields["Speaker"] || "",
      })).filter((q: any) => q.text);
      const result = await sendQuotesToWebsite(date, record.fields?.["Title"] || "", quotes);
      // A send IS the review: mark every quote for this date reviewed
      // (including the unchecked ones -- leaving them off was the decision).
      const allFormula = encodeURIComponent(`AND(DATESTR({Service Date})='${date}',{Reviewed}=0)`);
      const allData = await airtableFetch(
        `https://api.airtable.com/v0/${BASE_ID}/${QUOTES_TABLE}?filterByFormula=${allFormula}&pageSize=100&fields%5B%5D=Reviewed`
      );
      const toMark = (allData.records || []).map((r: any) => ({ id: r.id, fields: { Reviewed: true } }));
      for (let i = 0; i < toMark.length; i += 10) {
        await airtableFetch(`https://api.airtable.com/v0/${BASE_ID}/${QUOTES_TABLE}`, {
          method: "PATCH",
          body: JSON.stringify({ records: toMark.slice(i, i + 10) }),
        });
      }
      res.json(result);
    } catch (err: any) {
      console.error("Error sending quotes to website:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/sermons/:id/send-to-website", async (req, res) => {
    try {
      if (useSampleData) {
        return res.status(503).json({ error: "Airtable is not connected (sample data mode)." });
      }
      const url = `https://api.airtable.com/v0/${BASE_ID}/${SERMON_TABLE}/${req.params.id}`;
      const record = await airtableFetch(url);
      const result = await sendToWebsite(record.fields || {});
      if (result.status !== "unchanged" || record.fields?.["Sermon URL"] !== result.pageUrl) {
        await airtableFetch(url, {
          method: "PATCH",
          body: JSON.stringify({ fields: { "Sermon URL": result.pageUrl } }),
        });
      }
      res.json(result);
    } catch (err: any) {
      console.error("Error sending sermon to website:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ---- EDITS ----

  app.get("/api/edits", async (req, res) => {
    try {
      const date = req.query.date as string | undefined;
      if (useSampleData) {
        const records = date
          ? SAMPLE_EDITS.filter((e) => e.fields["Broadcast Date"] === date)
          : SAMPLE_EDITS;
        return res.json(records);
      }
      let params = "sort%5B0%5D%5Bfield%5D=Broadcast%20Date&sort%5B0%5D%5Bdirection%5D=desc";
      if (date) {
        params += `&filterByFormula=${encodeURIComponent(`DATESTR({Broadcast Date})='${date}'`)}`;
      }
      const records = await fetchAllRecords(EDITS_TABLE, params);
      res.json(records);
    } catch (err: any) {
      console.error("Error fetching edits:", err.message);
      res.json(SAMPLE_EDITS);
    }
  });

  app.get("/api/edits/:id", async (req, res) => {
    try {
      if (useSampleData) {
        const found = SAMPLE_EDITS.find(e => e.id === req.params.id);
        return res.json(found || { id: req.params.id, fields: {} });
      }
      const url = `https://api.airtable.com/v0/${BASE_ID}/${EDITS_TABLE}/${req.params.id}`;
      const data = await airtableFetch(url);
      res.json(data);
    } catch (err: any) {
      console.error("Error fetching edit:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/edits/:id", async (req, res) => {
    try {
      if (useSampleData) {
        const found = SAMPLE_EDITS.find(e => e.id === req.params.id);
        if (found) Object.assign(found.fields, req.body);
        return res.json(found || { id: req.params.id, fields: req.body });
      }
      const url = `https://api.airtable.com/v0/${BASE_ID}/${EDITS_TABLE}/${req.params.id}`;
      const data = await airtableFetch(url, {
        method: "PATCH",
        body: JSON.stringify({ fields: req.body }),
      });
      res.json(data);
    } catch (err: any) {
      console.error("Error updating edit:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // Recap pipeline triggers on the pfc-website GitHub Action.
  // prepare = stage 1 (Stream + transcript + AI draft descriptions, no page);
  // publish = stage 2 (site page; reuses the prepared Stream ID).
  const dispatchRecap = async (eventType: string, editId: string) => {
    const token = process.env.GITHUB_TOKEN || "";
    if (!token) throw new Error("GITHUB_TOKEN is not configured on the server.");
    const gh = await fetch("https://api.github.com/repos/c7sharp9/pfc-website/dispatches", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ event_type: eventType, client_payload: { editId } }),
    });
    if (gh.status !== 204) {
      throw new Error(`GitHub dispatch failed (${gh.status}): ${await gh.text()}`);
    }
  };

  app.post("/api/edits/:id/publish", async (req, res) => {
    try {
      await dispatchRecap("publish-recap", req.params.id);
      res.json({ ok: true });
    } catch (err: any) {
      console.error("Error publishing recap:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/sermons/:id/prepare", async (req, res) => {
    try {
      const token = process.env.GITHUB_TOKEN || "";
      if (!token) return res.status(503).json({ error: "GITHUB_TOKEN is not configured on the server." });
      // Prepare runs in CI, where YouTube captions can't be fetched (datacenter
      // IP block). So it needs the Descript transcript to already be in Airtable.
      if (!useSampleData) {
        const rec = await airtableFetch(`https://api.airtable.com/v0/${BASE_ID}/${SERMON_TABLE}/${req.params.id}`);
        if (!(rec?.fields?.["Transcription URL"] || "").trim()) {
          return res.status(422).json({
            error: "No transcript yet. Prepare needs the Descript transcription (the Transcription URL field) — it usually lands within a day of the service. Re-run once it's in.",
          });
        }
      }
      const gh = await fetch("https://api.github.com/repos/c7sharp9/pfc-website/dispatches", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ event_type: "prepare-sermon", client_payload: { sermonId: req.params.id } }),
      });
      if (gh.status !== 204) {
        return res.status(502).json({ error: `GitHub dispatch failed (${gh.status}): ${await gh.text()}` });
      }
      res.json({ ok: true });
    } catch (err: any) {
      console.error("Error preparing sermon:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/edits/:id/prepare", async (req, res) => {
    try {
      await dispatchRecap("prepare-recap", req.params.id);
      res.json({ ok: true });
    } catch (err: any) {
      console.error("Error preparing recap:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/edits", async (req, res) => {
    try {
      if (useSampleData) {
        const newEdit = { id: `rec_edit_${Date.now()}`, fields: req.body };
        SAMPLE_EDITS.unshift(newEdit as any);
        return res.json(newEdit);
      }
      const url = `https://api.airtable.com/v0/${BASE_ID}/${EDITS_TABLE}`;
      const data = await airtableFetch(url, {
        method: "POST",
        body: JSON.stringify({ fields: req.body }),
      });
      res.json(data);
    } catch (err: any) {
      console.error("Error creating edit:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/edits/:id", async (req, res) => {
    try {
      if (useSampleData) {
        const idx = SAMPLE_EDITS.findIndex(e => e.id === req.params.id);
        if (idx >= 0) SAMPLE_EDITS.splice(idx, 1);
        return res.json({ success: true });
      }
      const url = `https://api.airtable.com/v0/${BASE_ID}/${EDITS_TABLE}/${req.params.id}`;
      const delRes = await fetch(url, { method: "DELETE", headers });
      if (!delRes.ok) {
        const text = await delRes.text();
        throw new Error(`Airtable error ${delRes.status}: ${text}`);
      }
      res.json({ success: true });
    } catch (err: any) {
      console.error("Error deleting edit:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ---- WORKFLOW ----

  app.get("/api/workflow", async (_req, res) => {
    try {
      if (useSampleData) {
        return res.json(SAMPLE_WORKFLOW);
      }
      const records = await fetchAllRecords(WORKFLOW_TABLE);
      res.json(records);
    } catch (err: any) {
      console.error("Error fetching workflow:", err.message);
      res.json(SAMPLE_WORKFLOW);
    }
  });

  return httpServer;
}
