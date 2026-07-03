import { createClient } from "npm:@supabase/supabase-js@2";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  const token = req.headers.get("x-ingest-token");
  if (!token || token !== Deno.env.get("JOB_INGEST_TOKEN")) {
    return json({ error: "unauthorized" }, 401);
  }
  const raw = await req.text();
  if (raw.length > 512 * 1024) return json({ error: "payload too large" }, 413);
  let body: { leads?: unknown[] };
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "bad json" }, 400);
  }
  const leads = Array.isArray(body.leads) ? body.leads.slice(0, 200) : [];

  const VALID_SOURCES = ["indeed", "craigslist", "linkedin", "glassdoor", "ziprecruiter", "google", "agency", "other"];
  const rows = [];
  for (const raw of leads) {
    const l = raw as Record<string, string>;
    if (!l || !l.title) continue;
    const source = VALID_SOURCES.includes(l.source) ? l.source : "other";
    const norm = [l.title, l.company || "", source].join("|").toLowerCase().replace(/\s+/g, " ").trim();
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(norm));
    const hash = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
    const cap = (v: unknown, n: number) => (typeof v === "string" && v ? v.slice(0, n) : null);
    rows.push({
      title: String(l.title).slice(0, 300),
      company: cap(l.company, 200),
      source,
      url: typeof l.url === "string" && /^https?:\/\//i.test(l.url) ? l.url.slice(0, 500) : null,
      apply_email: cap(l.apply_email, 200),
      pay: cap(l.pay, 100),
      location: cap(l.location, 200),
      description: cap(l.description, 1000),
      posted_date: l.posted_date && /^\d{4}-\d{2}-\d{2}$/.test(l.posted_date) ? l.posted_date : null,
      dedupe_hash: hash,
    });
  }

  let inserted = 0;
  if (rows.length) {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data, error } = await sb.from("job_leads")
      .upsert(rows, { onConflict: "dedupe_hash", ignoreDuplicates: true })
      .select("id,title");
    if (error) return json({ error: error.message }, 500);
    inserted = data?.length ?? 0;

    if (inserted > 0) {
      const hook = Deno.env.get("SLACK_WEBHOOK_URL");
      if (hook) {
        const top = (data ?? []).slice(0, 5).map((d) => "• " + d.title).join("\n");
        const more = inserted > 5 ? `\n…and ${inserted - 5} more` : "";
        const msg = `💼 *${inserted} new job lead${inserted === 1 ? "" : "s"} — AA Mastery Job Scanner*\n${top}${more}\n<https://aa-mastery.vercel.app|Open the admin board>`;
        await fetch(hook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: msg }),
        }).catch(() => {});
      }
    }
  }
  return json({ received: leads.length, inserted });
});
