// Hooch Report worker (optional): caches USGS gauges so the phone makes one request,
// and serves calendar alarms as text/calendar (most reliable "Add to Calendar" on iOS).
// Stocking, BacteriALERT and the USACE probe run in GitHub Actions instead
// (scripts/fetch-data.mjs), which has no CPU limit for PDF parsing.
import { fetchGauges } from "../../src/fetchers/usgs.js";
import { buildIcs } from "../../src/lib/ics.js";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS" };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "public, max-age=120" } });

const getKV = async (env, k) => { const v = await env.HOOCH.get(k); return v ? JSON.parse(v) : null; };
const putKV = (env, k, v) => env.HOOCH.put(k, JSON.stringify(v));

async function refreshGauges(env) {
  const { data, source } = await fetchGauges();
  if (!source) return null;
  const gauges = {};
  for (const [k, fields] of Object.entries(data))
    for (const [f, s] of Object.entries(fields)) (gauges[k] ??= {})[f] = s.map(x => [x.t, x.v]);
  const rec = { gauges, source, at: Date.now() };
  await putKV(env, "gauges", rec);
  return rec;
}

const runAll = env => refreshGauges(env).catch(() => null);

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runAll(env));
  },

  async fetch(req, env, ctx) {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
    if (req.method !== "GET") return json({ error: "method" }, 405);
    const url = new URL(req.url);

    switch (url.pathname) {
      case "/gauges": {
        let rec = await getKV(env, "gauges");
        if (!rec || Date.now() - rec.at > 20 * 60000) rec = (await refreshGauges(env)) ?? rec;
        return rec ? json(rec) : json({ error: "unavailable" }, 503);
      }
      case "/refresh": {
        ctx.waitUntil(runAll(env));
        return json({ ok: true });
      }
      case "/alarm.ics": {
        const p = url.searchParams;
        const start = new Date(p.get("start")), end = new Date(p.get("end"));
        if (isNaN(start) || isNaN(end)) return json({ error: "start/end" }, 400);
        const cut = (s, n) => (s ?? "").slice(0, n);
        const ics = buildIcs({ start, end, title: cut(p.get("title"), 120) || "Pulse arriving", description: cut(p.get("desc"), 500), location: cut(p.get("loc"), 60), uid: cut(p.get("uid"), 80) || undefined });
        return new Response(ics, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'inline; filename="hooch-pulse.ics"' } });
      }
      default:
        return json({ endpoints: ["/gauges", "/refresh", "/alarm.ics"] });
    }
  },
};
