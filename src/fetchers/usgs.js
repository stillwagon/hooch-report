// USGS gauge data.
// Primary: the modernized Water Data OGC API (api.waterdata.usgs.gov).
// Fallback: legacy waterservices.usgs.gov, until it is decommissioned (Feb 2027).
// Output: { [gaugeKey]: { discharge: Series, temp: Series, turbidity: Series } }
import { GAUGES, PARAM } from "../data/river.js";

const OGC_BASES = ["https://api.waterdata.usgs.gov/ogcapi/v0", "https://api.waterdata.usgs.gov/ogcapi/v1"];
const LEGACY = "https://waterservices.usgs.gov/nwis/iv/";
const KEY_BY_PARAM = { [PARAM.discharge]: "discharge", [PARAM.temp]: "temp", [PARAM.turbidity]: "turbidity" };
// Discharge needs a week for base flow; temperature and turbidity only need the latest.
const PERIOD = { [PARAM.discharge]: "P8D", [PARAM.temp]: "PT12H", [PARAM.turbidity]: "PT12H" };

const BASE_PREF = "hooch:usgsBase";
const getPref = () => { try { return localStorage.getItem(BASE_PREF); } catch { return null; } };
const setPref = v => { try { localStorage.setItem(BASE_PREF, v); } catch { /* private mode */ } };

const toSeries = rows => rows
  .map(r => ({ t: Date.parse(r.time), v: parseFloat(r.value) }))
  .filter(x => Number.isFinite(x.t) && Number.isFinite(x.v) && x.v > -999)
  .sort((a, b) => a.t - b.t);

// GeoJSON FeatureCollection from /collections/continuous/items
export function parseOgc(json) {
  return toSeries((json?.features ?? []).map(f => f.properties ?? {}));
}

// Legacy NWIS IV JSON (possibly many sites/params in one response)
export function parseLegacy(json) {
  const out = {};
  for (const ts of json?.value?.timeSeries ?? []) {
    const site = ts.sourceInfo?.siteCode?.[0]?.value;
    const p = ts.variable?.variableCode?.[0]?.value;
    const key = Object.keys(GAUGES).find(k => GAUGES[k].id === site);
    const field = KEY_BY_PARAM[p];
    if (!key || !field) continue;
    const rows = (ts.values ?? []).flatMap(v => v.value ?? []).map(v => ({ time: v.dateTime, value: v.value }));
    const s = toSeries(rows);
    if (s.length) (out[key] ??= {})[field] = s;
  }
  return out;
}

async function getJson(url, ms = 15000) {
  const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), ms);
  try { const r = await fetch(url, { signal: ctl.signal }); if (!r.ok) throw new Error(`${r.status} ${url}`); return await r.json(); }
  finally { clearTimeout(tm); }
}

export function ogcUrl(base, siteId, param, period) {
  const q = new URLSearchParams({ f: "json", monitoring_location_id: `USGS-${siteId}`, parameter_code: param, time: period, limit: "10000", skipGeometry: "true" });
  return `${base}/collections/continuous/items?${q}`;
}

async function fetchOgc(base) {
  const out = {};
  const jobs = Object.entries(GAUGES).flatMap(([key, g]) => g.params.map(p => ({ key, g, p })));
  let ok = 0;
  await Promise.all(jobs.map(async ({ key, g, p }) => {
    try {
      const s = parseOgc(await getJson(ogcUrl(base, g.id, p, PERIOD[p])));
      if (s.length) { (out[key] ??= {})[KEY_BY_PARAM[p]] = s; ok++; }
    } catch { /* one missing series is fine */ }
  }));
  if (!ok) throw new Error("OGC API returned no data");
  return out;
}

async function fetchLegacy() {
  const sites = Object.values(GAUGES).map(g => g.id).join(",");
  const params = Object.values(PARAM).join(",");
  return parseLegacy(await getJson(`${LEGACY}?format=json&sites=${sites}&parameterCd=${params}&period=P8D&siteStatus=all`));
}

// Returns { data, source }.
export async function fetchGauges() {
  const pref = getPref();
  const order = [...OGC_BASES, "legacy"].sort((a, b) => (b === pref) - (a === pref));
  for (const base of order) {
    try {
      const data = base === "legacy" ? await fetchLegacy() : await fetchOgc(base);
      if (Object.keys(data).length) { setPref(base); return { data, source: base === "legacy" ? "USGS legacy" : "USGS Water Data API" }; }
    } catch { /* try next */ }
  }
  return { data: {}, source: null };
}
