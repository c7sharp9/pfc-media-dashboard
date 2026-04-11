import type { Express } from "express";
import { createServer, type Server } from "http";

const AIRTABLE_PAT = process.env.AIRTABLE_PAT || "";
const BASE_ID = "appsXqsMSCaQAOxoc";
const SERMON_TABLE = "tbls5szdfaZtJrCfe";
const EDITS_TABLE = "tblMWVa6ZJxGafti2";
const WORKFLOW_TABLE = "tblBDeWClUOWbI0VL";

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

  // ---- EDITS ----

  app.get("/api/edits", async (_req, res) => {
    try {
      if (useSampleData) {
        return res.json(SAMPLE_EDITS);
      }
      const params = "sort%5B0%5D%5Bfield%5D=Broadcast%20Date&sort%5B0%5D%5Bdirection%5D=desc";
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
      await fetch(url, { method: "DELETE", headers });
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
