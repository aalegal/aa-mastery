// Structured job-feed backstop: queries JSearch (RapidAPI) + Adzuna, normalizes
// to lead shape, and POSTs to job-scan-ingest (which dedupes + pings Slack).
// Protected by the same JOB_INGEST_TOKEN as the ingest function.

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const QUERIES = [
  "document review attorney remote",
  "eDiscovery paralegal remote",
  "document review attorney new york",
  "managed review attorney remote",
  "privilege review contract attorney",
];

// Only keep genuine review/eDiscovery roles — these feeds return broad results.
const KEEP = /(document review|doc review|e-?discovery|privilege review|managed review|litigation support)/i;

const PUBLISHER_MAP: Record<string, string> = {
  indeed: "indeed", linkedin: "linkedin", glassdoor: "glassdoor",
  ziprecruiter: "ziprecruiter", "ziprecruiter.com": "ziprecruiter",
};
function mapSource(publisher?: string): string {
  const p = (publisher || "").toLowerCase();
  for (const k in PUBLISHER_MAP) if (p.includes(k)) return PUBLISHER_MAP[k];
  return "other";
}

async function fromJSearch(key: string): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  for (const q of QUERIES) {
    try {
      const url = `https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(q + " remote")}&page=1&num_pages=1&country=us&date_posted=month`;
      const r = await fetch(url, {
        headers: { "X-RapidAPI-Key": key, "X-RapidAPI-Host": "jsearch.p.rapidapi.com" },
      });
      if (!r.ok) continue;
      const j = await r.json();
      for (const d of j.data ?? []) {
        const title = d.job_title || "";
        if (!KEEP.test(title) && !KEEP.test(d.job_description || "")) continue;
        const pay = d.job_min_salary && d.job_max_salary
          ? `$${d.job_min_salary}-${d.job_max_salary}` : null;
        out.push({
          title,
          company: d.employer_name || null,
          source: mapSource(d.job_publisher),
          url: d.job_apply_link || null,
          pay,
          location: [d.job_city, d.job_state].filter(Boolean).join(", ") || (d.job_is_remote ? "Remote" : null),
          description: (d.job_description || "").slice(0, 300),
          posted_date: (d.job_posted_at_datetime_utc || "").slice(0, 10) || null,
        });
      }
    } catch (_) { /* skip this query */ }
  }
  return out;
}

async function fromAdzuna(appId: string, appKey: string): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  for (const q of QUERIES) {
    try {
      const url = `https://api.adzuna.com/v1/api/jobs/us/search/1?app_id=${appId}&app_key=${appKey}` +
        `&what=${encodeURIComponent(q)}&results_per_page=50&content-type=application/json`;
      const r = await fetch(url);
      if (!r.ok) continue;
      const j = await r.json();
      for (const d of j.results ?? []) {
        const title = d.title || "";
        if (!KEEP.test(title) && !KEEP.test(d.description || "")) continue;
        const pay = d.salary_min && d.salary_max
          ? `$${Math.round(d.salary_min)}-${Math.round(d.salary_max)}/yr` : null;
        out.push({
          title: title.replace(/<[^>]*>/g, ""),
          company: d.company?.display_name || null,
          source: "other",
          url: d.redirect_url || null,
          pay,
          location: d.location?.display_name || null,
          description: (d.description || "").replace(/<[^>]*>/g, "").slice(0, 300),
          posted_date: (d.created || "").slice(0, 10) || null,
        });
      }
    } catch (_) { /* skip this query */ }
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  const token = req.headers.get("x-ingest-token");
  if (!token || token !== Deno.env.get("JOB_INGEST_TOKEN")) {
    return json({ error: "unauthorized" }, 401);
  }

  const rapid = Deno.env.get("RAPIDAPI_KEY") || "";
  const adzunaId = Deno.env.get("ADZUNA_APP_ID") || "";
  const adzunaKey = Deno.env.get("ADZUNA_APP_KEY") || "";

  const providers: Record<string, number> = {};
  let leads: Record<string, unknown>[] = [];
  if (rapid) { const j = await fromJSearch(rapid); providers.jsearch = j.length; leads = leads.concat(j); }
  if (adzunaId && adzunaKey) { const a = await fromAdzuna(adzunaId, adzunaKey); providers.adzuna = a.length; leads = leads.concat(a); }

  if (!leads.length) return json({ providers, fetched: 0, forwarded: 0, note: "no leads (check API keys/coverage)" });

  // Forward to job-scan-ingest, which dedupes + Slacks.
  const ingestUrl = Deno.env.get("SUPABASE_URL")! + "/functions/v1/job-scan-ingest";
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const r = await fetch(ingestUrl, {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + anon,
      "x-ingest-token": Deno.env.get("JOB_INGEST_TOKEN")!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ leads }),
  });
  const ingest = await r.json().catch(() => ({}));
  return json({ providers, fetched: leads.length, ingest });
});
