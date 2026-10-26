// Server-side data:
//  - ./data/*.json is written by scripts/fetch-data.mjs in the deploy workflow.
//  - The optional Worker (worker/) caches gauges and serves calendar alarms. Set
//    VITE_WORKER_URL at build time (repo variable WORKER_URL). Works without it.
import { LINKS } from "../data/river.js";
import { parseStockingLines } from "../lib/stocking.js";

export const WORKER_URL = (import.meta.env?.VITE_WORKER_URL || "").replace(/\/$/, "");

async function getJson(url, ms = 15000) {
  const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), ms);
  try { const r = await fetch(url, { signal: ctl.signal }); if (!r.ok) throw new Error(r.status); return await r.json(); }
  finally { clearTimeout(tm); }
}

// Worker caches the USGS series server-side, so the phone makes one request.
// Series come back as [[t, v], ...].
export async function fetchWorkerGauges() {
  if (!WORKER_URL) return null;
  try {
    const j = await getJson(`${WORKER_URL}/gauges`);
    const data = {};
    for (const [k, fields] of Object.entries(j.gauges ?? {}))
      for (const [f, rows] of Object.entries(fields)) (data[k] ??= {})[f] = rows.map(([t, v]) => ({ t, v }));
    return Object.keys(data).length ? { data, source: `USGS via worker (${j.source ?? "cached"})` } : null;
  } catch { return null; }
}

const sameOrigin = name => getJson(`./data/${name}`).catch(() => null);

export const fetchExtras = () => sameOrigin("extras.json");

// Stocking: parsed in GitHub Actions on a schedule. If that file is missing or more
// than 3 days old, try public CORS proxies and parse the PDF in the browser
// (unpdf is loaded only when needed).
export async function fetchStocking() {
  const pre = await sameOrigin("stocking.json");
  if (pre?.ok && Date.now() - pre.fetchedAt < 3 * 86400000) return { ...pre, via: "build" };
  const u = encodeURIComponent(LINKS.stockingPdf);
  const proxies = [`https://corsproxy.io/?url=${u}`, `https://api.allorigins.win/raw?url=${u}`, `https://api.codetabs.com/v1/proxy?quest=${u}`];
  for (const px of proxies) {
    try {
      const r = await fetch(px); if (!r.ok) continue;
      const bytes = new Uint8Array(await r.arrayBuffer());
      if (String.fromCharCode(...bytes.slice(0, 5)) !== "%PDF-") continue;
      const { pdfToLines } = await import("../lib/pdfLines.js");
      return { ...parseStockingLines(await pdfToLines(bytes)), via: "browser", fetchedAt: Date.now() };
    } catch { /* next proxy */ }
  }
  return pre?.ok ? { ...pre, via: "build (stale)" } : { ok: false, secs: [], stockDates: {}, lines: [] };
}
