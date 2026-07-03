import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// Only these columns may be written by callers; strings are length-capped.
const ALERT_FIELDS = [
  "user_email", "user_id", "ip_address", "country", "country_code",
  "isp", "is_vpn", "is_proxy", "alert_type", "reason", "created_at",
];

// Per-instance Slack limiter (edge isolates are ephemeral; DB count below is
// the durable limit for alert inserts).
const slackSends = new Map<string, number[]>();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  try {
    // Require a real logged-in user — the public anon key alone is not enough.
    const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: userData, error: userErr } = await sb.auth.getUser(jwt);
    if (userErr || !userData?.user) return json({ error: "unauthorized" }, 401);
    const user = userData.user;

    let body: { alert_data?: Record<string, unknown>; slack_msg?: unknown };
    try {
      body = await req.json();
    } catch {
      return json({ error: "bad json" }, 400);
    }
    const { alert_data, slack_msg } = body || {};

    // Rate limit: max 5 alert inserts per user per 15 minutes (durable, DB-backed).
    const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { count } = await sb.from("login_alerts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id).gte("created_at", since);
    if ((count ?? 0) >= 5) return json({ error: "rate limited" }, 429);

    let dbOk = true, slackOk = false, slackStatus = 0;

    if (alert_data && typeof alert_data === "object") {
      const clean: Record<string, unknown> = {};
      for (const k of ALERT_FIELDS) {
        if (k in alert_data) {
          let v = (alert_data as Record<string, unknown>)[k];
          if (typeof v === "string") v = v.slice(0, 300);
          clean[k] = v;
        }
      }
      // Bind identity to the verified caller, not client-supplied values.
      clean.user_id = user.id;
      clean.user_email = user.email ?? clean.user_email;
      const { error } = await sb.from("login_alerts").insert(clean);
      dbOk = !error;
    }

    const WEBHOOK = Deno.env.get("SLACK_WEBHOOK_URL") || "";
    if (slack_msg && typeof slack_msg === "string" && WEBHOOK) {
      // Per-instance Slack limit: 5 per user per 15 min.
      const now = Date.now();
      const sent = (slackSends.get(user.id) || []).filter((t) => now - t < 15 * 60 * 1000);
      if (sent.length >= 5) return json({ error: "rate limited" }, 429);
      sent.push(now);
      slackSends.set(user.id, sent);
      const r = await fetch(WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: slack_msg.slice(0, 1500) }),
      });
      slackOk = r.ok;
      slackStatus = r.status;
    }

    return json({ db: dbOk, slack: slackOk, slackStatus });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
