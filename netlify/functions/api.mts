import type { Context } from "@netlify/functions";
import { sendToWebsite } from "../../shared/send-to-website";
import { sendQuotesToWebsite } from "../../shared/send-quotes-to-website";

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

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
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

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export default async (req: Request, context: Context) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("", { status: 204, headers: corsHeaders });
  }

  const url = new URL(req.url);
  // Strip the Netlify function prefix to get the clean path
  const path = url.pathname.replace("/.netlify/functions/api", "").replace("/api", "") || "/";

  try {
    // ---- SERMONS ----

    // GET /sermons - paginated list
    if (path === "/sermons" && req.method === "GET") {
      const pageSize = Math.min(parseInt(url.searchParams.get("pageSize") || "20"), 100);
      const cursor = url.searchParams.get("cursor") || undefined;
      const sortParam = "sort%5B0%5D%5Bfield%5D=Service&sort%5B0%5D%5Bdirection%5D=desc";
      const cursorParam = cursor ? `&offset=${encodeURIComponent(cursor)}` : "";
      const apiUrl = `https://api.airtable.com/v0/${BASE_ID}/${SERMON_TABLE}?${sortParam}&pageSize=${pageSize}${cursorParam}`;
      const data = await airtableFetch(apiUrl);
      return json({ records: data.records || [], nextCursor: data.offset || null });
    }

    // GET /sermons/find?q= — text search on title/date, newest first
    if (path === "/sermons/find" && req.method === "GET") {
      const q = (url.searchParams.get("q") || "").trim().toLowerCase().replace(/'/g, "\\'");
      if (!q) return json({ records: [] });
      const formula = encodeURIComponent(
        `OR(SEARCH('${q}', LOWER({Title}&'')), SEARCH('${q}', DATESTR({Service})&''))`
      );
      const data = await airtableFetch(
        `https://api.airtable.com/v0/${BASE_ID}/${SERMON_TABLE}?filterByFormula=${formula}&maxRecords=30&sort%5B0%5D%5Bfield%5D=Service&sort%5B0%5D%5Bdirection%5D=desc`
      );
      return json({ records: data.records || [] });
    }

    // GET /sermons/search?date=YYYY-MM-DD&platform=Sunday|Wednesday
    if (path === "/sermons/search" && req.method === "GET") {
      const date = url.searchParams.get("date");
      const platform = url.searchParams.get("platform");
      if (!date) {
        return json({ records: [] });
      }
      const datePart = `DATESTR({Service})='${date}'`;
      const formula = platform
        ? encodeURIComponent(`AND(${datePart},{Platform}='${platform}')`)
        : encodeURIComponent(datePart);
      const apiUrl = `https://api.airtable.com/v0/${BASE_ID}/${SERMON_TABLE}?filterByFormula=${formula}&maxRecords=5`;
      const data = await airtableFetch(apiUrl);
      return json({ records: data.records || [] });
    }

    // GET /sermons/by-dates?dates=a,b,c — batch lookup for edits-page group headers
    if (path === "/sermons/by-dates" && req.method === "GET") {
      const datesParam = url.searchParams.get("dates") || "";
      const dates = datesParam
        .split(",")
        .map((d) => d.trim())
        .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
        .slice(0, 60);
      if (dates.length === 0) {
        return json({ records: [] });
      }
      const formula = `OR(${dates.map((d) => `DATESTR({Service})='${d}'`).join(",")})`;
      const records = await fetchAllRecords(
        SERMON_TABLE,
        `filterByFormula=${encodeURIComponent(formula)}`
      );
      return json({ records });
    }

    // ---- QUOTES ----

    // GET /quotes?date=YYYY-MM-DD — all quotes for a service date
    if (path === "/quotes" && req.method === "GET") {
      const date = url.searchParams.get("date") || "";
      if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return json({ error: "date must be YYYY-MM-DD" }, 400);
      }
      const base = `https://api.airtable.com/v0/${BASE_ID}/${QUOTES_TABLE}?pageSize=100` +
        (date ? `&filterByFormula=${encodeURIComponent(`DATESTR({Service Date})='${date}'`)}` : "");
      let records: any[] = [];
      let offset: string | undefined;
      do {
        const data = await airtableFetch(base + (offset ? `&offset=${offset}` : ""));
        records = records.concat(data.records || []);
        offset = data.offset;
      } while (offset && records.length < 2000);
      return json({ records });
    }

    // PATCH /quotes/:id — update Quote Final / On Website / etc.
    const quoteMatch = path.match(/^\/quotes\/([^/]+)$/);
    if (quoteMatch && req.method === "DELETE") {
      const data = await airtableFetch(
        `https://api.airtable.com/v0/${BASE_ID}/${QUOTES_TABLE}/${quoteMatch[1]}`,
        { method: "DELETE" }
      );
      return json(data);
    }
    if (quoteMatch && req.method === "PATCH") {
      const body = await req.json();
      const data = await airtableFetch(
        `https://api.airtable.com/v0/${BASE_ID}/${QUOTES_TABLE}/${quoteMatch[1]}`,
        { method: "PATCH", body: JSON.stringify({ fields: body }) }
      );
      return json(data);
    }

    // POST /sermons/:id/send-quotes — publish checked quotes to the site page.
    // Re-clicking replaces the live set (this is also the "update" button).
    const sendQuotesMatch = path.match(/^\/sermons\/([^/]+)\/send-quotes$/);
    if (sendQuotesMatch && req.method === "POST") {
      const record = await airtableFetch(
        `https://api.airtable.com/v0/${BASE_ID}/${SERMON_TABLE}/${sendQuotesMatch[1]}`
      );
      const date = (record.fields?.["Service"] || "").slice(0, 10);
      const formula = encodeURIComponent(`AND(DATESTR({Service Date})='${date}',{On Website}=1)`);
      const qData = await airtableFetch(
        `https://api.airtable.com/v0/${BASE_ID}/${QUOTES_TABLE}?filterByFormula=${formula}&pageSize=100`
      );
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
      return json(result);
    }

    // POST /sermons/:id/send-to-website — commit the sermon to the site repo
    const sendMatch = path.match(/^\/sermons\/([^/]+)\/send-to-website$/);
    if (sendMatch && req.method === "POST") {
      const recUrl = `https://api.airtable.com/v0/${BASE_ID}/${SERMON_TABLE}/${sendMatch[1]}`;
      const record = await airtableFetch(recUrl);
      const result = await sendToWebsite(record.fields || {});
      if (result.status !== "unchanged" || record.fields?.["Sermon URL"] !== result.pageUrl) {
        await airtableFetch(recUrl, {
          method: "PATCH",
          body: JSON.stringify({ fields: { "Sermon URL": result.pageUrl } }),
        });
      }
      return json(result);
    }

    // GET /sermons/:id
    const sermonMatch = path.match(/^\/sermons\/(.+)$/);
    if (sermonMatch && req.method === "GET") {
      const data = await airtableFetch(
        `https://api.airtable.com/v0/${BASE_ID}/${SERMON_TABLE}/${sermonMatch[1]}`
      );
      return json(data);
    }

    // PATCH /sermons/:id
    if (sermonMatch && req.method === "PATCH") {
      const body = await req.json();
      const data = await airtableFetch(
        `https://api.airtable.com/v0/${BASE_ID}/${SERMON_TABLE}/${sermonMatch[1]}`,
        { method: "PATCH", body: JSON.stringify({ fields: body }) }
      );
      return json(data);
    }

    // POST /sermons
    if (path === "/sermons" && req.method === "POST") {
      const body = await req.json();
      const data = await airtableFetch(
        `https://api.airtable.com/v0/${BASE_ID}/${SERMON_TABLE}`,
        { method: "POST", body: JSON.stringify({ fields: body }) }
      );
      return json(data);
    }

    // ---- EDITS ----

    // POST /sermons/:id/prepare - draft descriptions + quotes from transcript
    const sermonPrepMatch = path.match(/^\/sermons\/([^/]+)\/prepare$/);
    if (sermonPrepMatch && req.method === "POST") {
      const token = process.env.GITHUB_TOKEN || "";
      if (!token) return json({ error: "GITHUB_TOKEN is not configured on the server." }, 503);
      // Prepare runs in CI where YouTube captions can't be fetched, so it needs
      // the Descript transcript (Transcription URL) already in Airtable.
      const rec = await airtableFetch(`https://api.airtable.com/v0/${BASE_ID}/${SERMON_TABLE}/${sermonPrepMatch[1]}`);
      if (!(rec?.fields?.["Transcription URL"] || "").trim()) {
        return json({
          error: "No transcript yet. Prepare needs the Descript transcription (the Transcription URL field) — it usually lands within a day of the service. Re-run once it's in.",
        }, 422);
      }
      const gh = await fetch("https://api.github.com/repos/c7sharp9/pfc-website/dispatches", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ event_type: "prepare-sermon", client_payload: { sermonId: sermonPrepMatch[1] } }),
      });
      if (gh.status !== 204) {
        return json({ error: `GitHub dispatch failed (${gh.status}): ${await gh.text()}` }, 502);
      }
      return json({ ok: true });
    }

    // POST /edits/:id/prepare - stage 1 of the recap pipeline (no site page)
    const prepareMatch = path.match(/^\/edits\/([^/]+)\/prepare$/);
    if (prepareMatch && req.method === "POST") {
      const token = process.env.GITHUB_TOKEN || "";
      if (!token) return json({ error: "GITHUB_TOKEN is not configured on the server." }, 503);
      const gh = await fetch("https://api.github.com/repos/c7sharp9/pfc-website/dispatches", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ event_type: "prepare-recap", client_payload: { editId: prepareMatch[1] } }),
      });
      if (gh.status !== 204) {
        return json({ error: `GitHub dispatch failed (${gh.status}): ${await gh.text()}` }, 502);
      }
      return json({ ok: true });
    }

    // POST /edits/:id/publish - trigger the pfc-website publish-recap Action
    const publishMatch = path.match(/^\/edits\/([^/]+)\/publish$/);
    if (publishMatch && req.method === "POST") {
      const token = process.env.GITHUB_TOKEN || "";
      if (!token) return json({ error: "GITHUB_TOKEN is not configured on the server." }, 503);
      const gh = await fetch("https://api.github.com/repos/c7sharp9/pfc-website/dispatches", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ event_type: "publish-recap", client_payload: { editId: publishMatch[1] } }),
      });
      if (gh.status !== 204) {
        const text = await gh.text();
        return json({ error: `GitHub dispatch failed (${gh.status}): ${text}` }, 502);
      }
      return json({ ok: true });
    }

    // GET /edits (optionally ?date=YYYY-MM-DD to fetch one service's edits)
    if (path === "/edits" && req.method === "GET") {
      const date = url.searchParams.get("date");
      let params = "sort%5B0%5D%5Bfield%5D=Broadcast%20Date&sort%5B0%5D%5Bdirection%5D=desc";
      if (date) {
        params += `&filterByFormula=${encodeURIComponent(`DATESTR({Broadcast Date})='${date}'`)}`;
      }
      const records = await fetchAllRecords(EDITS_TABLE, params);
      return json(records);
    }

    // GET /edits/:id
    const editMatch = path.match(/^\/edits\/(.+)$/);
    if (editMatch && req.method === "GET") {
      const data = await airtableFetch(
        `https://api.airtable.com/v0/${BASE_ID}/${EDITS_TABLE}/${editMatch[1]}`
      );
      return json(data);
    }

    // PATCH /edits/:id
    if (editMatch && req.method === "PATCH") {
      const body = await req.json();
      const data = await airtableFetch(
        `https://api.airtable.com/v0/${BASE_ID}/${EDITS_TABLE}/${editMatch[1]}`,
        { method: "PATCH", body: JSON.stringify({ fields: body }) }
      );
      return json(data);
    }

    // POST /edits
    if (path === "/edits" && req.method === "POST") {
      const body = await req.json();
      const data = await airtableFetch(
        `https://api.airtable.com/v0/${BASE_ID}/${EDITS_TABLE}`,
        { method: "POST", body: JSON.stringify({ fields: body }) }
      );
      return json(data);
    }

    // DELETE /edits/:id
    if (editMatch && req.method === "DELETE") {
      const delRes = await fetch(
        `https://api.airtable.com/v0/${BASE_ID}/${EDITS_TABLE}/${editMatch[1]}`,
        { method: "DELETE", headers }
      );
      if (!delRes.ok) {
        const text = await delRes.text();
        throw new Error(`Airtable error ${delRes.status}: ${text}`);
      }
      return json({ success: true });
    }

    // ---- WORKFLOW ----

    // GET /workflow
    if (path === "/workflow" && req.method === "GET") {
      const records = await fetchAllRecords(WORKFLOW_TABLE);
      return json(records);
    }

    return json({ error: "Not found" }, 404);
  } catch (err: any) {
    console.error("API error:", err.message);
    return json({ error: err.message }, 500);
  }
};
