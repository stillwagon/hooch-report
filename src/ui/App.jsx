import { useState, useEffect, useCallback, useMemo } from "react";
import { SPOTS } from "../data/river.js";
import { fetchGauges } from "../fetchers/usgs.js";
import { fetchWeather } from "../fetchers/weather.js";
import { fetchWorkerGauges, fetchExtras, fetchStocking } from "../fetchers/server.js";
import { buildForecast, buildHourly } from "../lib/weather.js";
import { rankSpots, condKey } from "../lib/scoring.js";
import { detectReleases, mergeSchedule } from "../lib/generation.js";
import { pulseWindows, stateAt } from "../lib/pulse.js";
import { spotLag, spotTailLag } from "../lib/travel.js";
import { loadSchedule, saveSchedule, loadCache, saveCache } from "./store.js";
import { T, GLOBAL_CSS, ft, MONO } from "./theme.js";
import { Logo, DamStatus, WeekBar, DayHero, HourlyStrip, SpotList, Flies, Schedule, WaterPanel, Stocking, Menu } from "./components.jsx";

const REFRESH_MS = 10 * 60 * 1000;

// Cached series are stored as-is ({t, v}); dates in schedule are revived in store.js.
export default function App() {
  const cached = useMemo(loadCache, []);
  const [gauges, setGauges] = useState(cached?.gauges ?? {});
  const [gaugeSource, setGaugeSource] = useState(cached?.gaugeSource ?? null);
  const [wx, setWx] = useState(cached?.wx ?? null);
  const [stock, setStock] = useState(cached?.stock ?? null);
  const [extras, setExtras] = useState(cached?.extras ?? null);
  const [refreshedAt, setRefreshedAt] = useState(cached?.at ? new Date(cached.at) : null);
  const [stale, setStale] = useState(!!cached);
  const [loading, setLoading] = useState(true);
  const [manual, setManual] = useState(loadSchedule);
  const [sel, setSel] = useState(null);
  const [menu, setMenu] = useState(null); // null | "root" | "onriver" | "gauges"
  const [onRiver, setOnRiver] = useState(false);
  const [gpsPos, setGpsPos] = useState(null);
  const [now, setNow] = useState(new Date());

  const load = useCallback(async () => {
    setLoading(true);
    const [g, w, s, x] = await Promise.all([
      fetchWorkerGauges().then(r => r ?? fetchGauges()),
      fetchWeather(),
      fetchStocking(),
      fetchExtras(),
    ]);
    const next = { ...(loadCache() ?? {}) };
    let fresh = 0;
    if (g?.source) { setGauges(g.data); setGaugeSource(g.source); next.gauges = g.data; next.gaugeSource = g.source; fresh++; }
    if (w) { setWx(w); next.wx = w; fresh++; }
    if (s?.ok) { setStock(s); next.stock = s; } else setStock(prev => prev ?? s);
    if (x) { setExtras(x); next.extras = x; }
    if (fresh) { next.at = Date.now(); saveCache(next); setRefreshedAt(new Date()); }
    setStale(fresh < 2);
    setNow(new Date());
    setLoading(false);
  }, []);

  useEffect(() => { load(); const iv = setInterval(load, REFRESH_MS); return () => clearInterval(iv); }, [load]);
  // Reload when the app comes back to the foreground (iOS suspends timers in the background).
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [load]);
  useEffect(() => { const iv = setInterval(() => setNow(new Date()), onRiver ? 15000 : 60000); return () => clearInterval(iv); }, [onRiver]);
  useEffect(() => saveSchedule(manual), [manual]);

  useEffect(() => {
    if (!onRiver || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(p => setGpsPos({ lat: p.coords.latitude, lon: p.coords.longitude }), () => {}, { enableHighAccuracy: true, maximumAge: 30000 });
    return () => navigator.geolocation.clearWatch(id);
  }, [onRiver]);

  const forecast = useMemo(() => buildForecast(wx, now), [wx, now.toDateString()]);
  const day = forecast.find(d => d.dateStr === sel) ?? forecast.find(d => d.isToday) ?? forecast[0];
  const detected = useMemo(() => detectReleases(gauges.bufordDam?.discharge, +now), [gauges, +now]);
  const events = useMemo(() => mergeSchedule(manual, detected), [manual, detected]);
  const ranked = useMemo(() => day ? rankSpots({ day, gauges, events, stock, now }) : [], [day, gauges, events, stock, now]);
  const top = ranked[0];
  const sec = top?.sec ?? day?.bestSec ?? "mid";
  const hourly = day && wx ? buildHourly(wx[sec], day) : [];
  const ck = day ? condKey(day.sections?.[sec] ?? day, top?.cl?.t) : "sunny";
  const best = forecast.filter(d => !d.isToday).reduce((b, d) => !b || d.score > b.score ? d : b, null);

  const onRiverInfo = useMemo(() => {
    if (!onRiver || !gpsPos) return null;
    const near = SPOTS.reduce((b, s) => { const d = Math.hypot(gpsPos.lat - s.lat, (gpsPos.lon - s.lon) * 0.83) * 69; return d < b.d ? { d, sp: s } : b; }, { d: Infinity, sp: null });
    const windows = pulseWindows(events, spotLag(near.sp), spotTailLag(near.sp), now);
    return { sp: near.sp, dist: near.d, windows, ...stateAt(windows, now) };
  }, [onRiver, gpsPos, events, now]);

  return <div style={{ minHeight: "100vh", background: `linear-gradient(170deg, ${T.card} 0%, ${T.bg} 30%, ${T.deep} 100%)` }}>
    <style>{GLOBAL_CSS}</style>
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 16px 40px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 0 16px" }}>
        <Logo />
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {onRiver && onRiverInfo && <button onClick={() => setMenu("onriver")} style={{ background: "none", border: `1px solid ${onRiverInfo.state === "high" || (onRiverInfo.state === "incoming" && onRiverInfo.minsUntil <= 30) ? T.danger : T.ok}`, borderRadius: 12, padding: "3px 8px", color: T.cream, fontSize: 11, fontFamily: MONO }}>
            📡 {onRiverInfo.state === "incoming" ? `${onRiverInfo.minsUntil}m` : onRiverInfo.state === "high" ? "HIGH" : "ON"}</button>}
          <span style={{ fontSize: 11, color: stale ? T.warn : T.muted, fontFamily: MONO }}>{refreshedAt ? (stale ? "cached " : "") + ft(refreshedAt) : ""}</span>
          <button aria-label="Refresh" onClick={load} disabled={loading} style={{ background: "none", border: "none", color: T.sage, fontSize: 18, cursor: "pointer", opacity: loading ? 0.3 : 1 }}>↻</button>
          <button aria-label="Menu" onClick={() => setMenu("root")} style={{ background: "none", border: "none", color: T.cream, fontSize: 22, cursor: "pointer" }}>☰</button>
        </div>
      </div>

      <DamStatus gauges={gauges} detected={detected} events={events} now={now} />
      <WeekBar forecast={forecast} sel={day} best={best} onSelect={d => setSel(d.dateStr)} />

      {!day && <div style={{ textAlign: "center", color: T.muted, padding: 40, fontSize: 13 }}>{loading ? "Loading conditions…" : "Weather unavailable. Pull to refresh or try again."}</div>}

      {day && <div key={day.dateStr} style={{ animation: "fadeIn 0.3s ease" }}>
        <DayHero day={day} top={top} />
        <HourlyStrip hourly={hourly} day={day} sec={sec} />
        <SpotList ranked={ranked} day={day} now={now} />
        <Flies day={day} ck={ck} />
        <WaterPanel gauges={gauges} extras={extras} now={now} />
        <Schedule manual={manual} setManual={setManual} events={events} now={now} />
        <Stocking stock={stock} />
      </div>}

      <div style={{ textAlign: "center", fontSize: 10, color: T.muted, paddingTop: 20, borderTop: `1px solid ${T.border}`, lineHeight: 1.8 }}>
        {gaugeSource ?? "USGS"} · Open-Meteo · GA DNR · GA River Guidebook<br />770-945-1466 · GA license + trout stamp · PFD · Fish safe
      </div>
    </div>

    {menu && <Menu page={menu} setPage={setMenu} onRiver={onRiver} setOnRiver={setOnRiver} gpsPos={gpsPos} info={onRiverInfo} gauges={gauges} gaugeSource={gaugeSource} now={now} />}
  </div>;
}

