import type { Context } from "@netlify/functions";

const AIRTABLE_PAT = process.env.AIRTABLE_PAT || "";
const BASE_ID = "appsXqsMSCaQAOxoc";
const SERMON_TABLE = "tbls5szdfaZtJrCfe";
const EDITS_TABLE = "tblMWVa6ZJxGafti2";
const WORKFLOW_TABLE = "tblBDeWClUOWbI0VL";

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

    // GET /edits
    if (path === "/edits" && req.method === "GET") {
      const params = "sort%5B0%5D%5Bfield%5D=Broadcast%20Date&sort%5B0%5D%5Bdirection%5D=desc";
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
      await fetch(
        `https://api.airtable.com/v0/${BASE_ID}/${EDITS_TABLE}/${editMatch[1]}`,
        { method: "DELETE", headers }
      );
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
