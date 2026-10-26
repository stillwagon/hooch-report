import { useState } from "react";
import { GAUGES, SECTION_LABEL, LINKS, directionsUrl } from "../data/river.js";
import { HATCHES } from "../data/flies.js";
import { latest, baseFlow, isFresh } from "../lib/series.js";
import { genThreshold } from "../lib/generation.js";
import { turbidityClarity, ECOLI_TURBIDITY_FLAG } from "../lib/scoring.js";
import { bestWindow, wxIcon, wxText } from "../lib/weather.js";
import { pulseAlarmParams, openAlarm } from "../lib/ics.js";
import { travelCalibrated, spotLag } from "../lib/travel.js";
import { WORKER_URL } from "../fetchers/server.js";
import { T, MONO, SERIF, scoreColor, clarityColor, flowColor, ft, fmtLag } from "./theme.js";

const H2 = ({ children, right }) => <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
  <div style={{ fontSize: 15, fontWeight: 700, fontFamily: SERIF, color: T.gold, letterSpacing: 0.5 }}>{children}</div>{right}</div>;
const btn = (c = T.sage) => ({ background: c + "22", border: `1px solid ${c}55`, borderRadius: 6, color: c, fontSize: 12, padding: "6px 10px", cursor: "pointer", fontWeight: 700, textDecoration: "none", display: "inline-block" });

export function Logo() {
  return <svg viewBox="0 0 180 40" width={140} style={{ display: "block" }} role="img" aria-label="Hooch Report"><rect x="1" y="1" width="178" height="38" rx="4" fill="none" stroke={T.gold} strokeWidth="1" /><path d="M 8,28 Q 25,24 40,28 Q 55,32 70,27 Q 85,22 100,28" fill="none" stroke={T.river} strokeWidth="1.2" opacity="0.5" /><text x="90" y="18" textAnchor="middle" fontFamily={SERIF} fontSize="14" fontWeight="700" fill={T.cream} letterSpacing="3">HOOCH</text><text x="90" y="30" textAnchor="middle" fontFamily={SERIF} fontSize="8" fill={T.gold} letterSpacing="4">REPORT</text></svg>;
}

export function DamStatus({ gauges, detected, events, now }) {
  const ser = gauges.bufordDam?.discharge;
  const l = latest(ser);
  const base = baseFlow(ser, +now);
  const ongoing = detected.find(d => d.ongoing);
  const lastDone = [...detected].reverse().find(d => !d.ongoing);
  const next = events.find(e => e.start > now);
  const stale = l && +now - l.t > 90 * 60000;
  const gen = !!ongoing || (l && l.v >= genThreshold(base));
  const c = gen ? T.sienna : T.ok;
  let sub = "Loading…";
  if (l) sub = gen ? `Since ${ongoing ? ft(ongoing.start) : "?"}${ongoing?.end ? ` · ends ~${ft(ongoing.end)}` : ""}` : (lastDone ? `Last release ended ${ft(lastDone.end)}` : "No release in the past week");
  if (stale) sub += ` · gauge ${Math.round((+now - l.t) / 60000)}m old`;
  return <div style={{ padding: "10px 16px", borderRadius: 10, background: gen ? "#2a1a0f" : T.card, border: `1px solid ${gen ? T.sienna + "55" : T.border}`, marginBottom: 20 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: c }}>{gen ? "⚡ Buford generating" : "🌊 Buford at base flow"}</div>
        <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{sub}</div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: c, fontFamily: MONO }}>{l ? Math.round(l.v) : "—"}</div>
        <div style={{ fontSize: 10, color: T.muted }}>cfs{base ? ` · base ${Math.round(base)}` : ""}</div>
      </div>
    </div>
    {next && <div style={{ fontSize: 11, color: T.warn, marginTop: 6 }}>Next scheduled: {next.start.toDateString() === now.toDateString() ? "" : next.start.toLocaleDateString("en-US", { weekday: "short" }) + " "}{ft(next.start)}–{ft(next.end)}</div>}
  </div>;
}

export function WeekBar({ forecast, sel, best, onSelect }) {
  return <div style={{ display: "flex", gap: 6, marginBottom: 24, overflowX: "auto", paddingBottom: 4 }}>
    {forecast.slice(0, 7).map(d => {
      const active = sel?.dateStr === d.dateStr;
      return <button key={d.dateStr} onClick={() => onSelect(d)} style={{ flex: "0 0 auto", width: 62, padding: "10px 4px", textAlign: "center", cursor: "pointer", borderRadius: 10, position: "relative", background: active ? T.card : "transparent", border: active ? `1.5px solid ${T.gold}55` : "1.5px solid transparent", color: T.cream }}>
        {best?.dateStr === d.dateStr && <div style={{ position: "absolute", top: 2, right: 6, fontSize: 9, color: T.ok }}>★</div>}
        <div style={{ fontSize: 11, fontWeight: 600, color: active ? T.cream : T.muted }}>{d.isToday ? "Today" : d.dayName}</div>
        <div style={{ fontSize: 22, margin: "2px 0" }}>{wxIcon(d.wx)}</div>
        <div style={{ fontSize: 11, fontFamily: MONO }}>{Math.round(d.feelsMax)}°</div>
        <div style={{ height: 3, borderRadius: 2, background: T.border, marginTop: 4, overflow: "hidden" }}><div style={{ height: "100%", width: `${d.score * 10}%`, background: scoreColor(d.score) }} /></div>
      </button>;
    })}
  </div>;
}

const VERDICT = s => s >= 7 ? ["Great fishing day", "Conditions are in your favor."] : s >= 5 ? ["Decent — worth going", "Pick your spot carefully."] : s >= 3 ? ["Marginal", "Tough conditions. Only if you need the fix."] : ["Stay home", "Tie flies instead."];

export function DayHero({ day, top }) {
  const [v, vsub] = VERDICT(day.score);
  const w = day.sections?.[day.bestSec] ?? day;
  const cl = top?.cl?.t;
  const Sub = ({ label, val }) => <div style={{ textAlign: "center" }}>
    <div style={{ fontSize: 18, fontWeight: 700, fontFamily: MONO, color: scoreColor(val) }}>{val.toFixed(1)}</div>
    <div style={{ fontSize: 10, color: T.muted, textTransform: "uppercase", letterSpacing: 1 }}>{label}</div></div>;
  return <>
    <div style={{ textAlign: "center", marginBottom: 16 }}>
      <div style={{ fontSize: 56, fontWeight: 800, fontFamily: MONO, color: scoreColor(day.score), lineHeight: 1 }}>{day.score.toFixed(1)}</div>
      <div style={{ fontSize: 20, fontWeight: 700, fontFamily: SERIF, marginTop: 6 }}>{v}</div>
      <div style={{ fontSize: 13, color: T.creamDim, marginTop: 2 }}>{day.isToday ? "Today" : `${day.dayName} ${day.dateLabel}`} · {wxText(w.wx)} · Feels {Math.round(w.feelsMax)}°</div>
      <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{vsub}</div>
    </div>
    <div style={{ display: "flex", justifyContent: "center", gap: 28, marginBottom: 6 }}>
      <Sub label="Fish" val={w.fish} /><Sub label="You" val={w.comfort} />
    </div>
    <div style={{ fontSize: 11, color: T.muted, textAlign: "center", marginBottom: 16 }}>
      {Object.entries(day.sections ?? {}).map(([s, x]) => <span key={s} style={{ margin: "0 6px" }}>{SECTION_LABEL[s]} <span style={{ fontFamily: MONO, color: scoreColor(x.score) }}>{x.score.toFixed(1)}</span></span>)}
    </div>
    <div style={{ display: "flex", justifyContent: "space-around", marginBottom: 20, padding: "14px 0", borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}` }}>
      {[{ l: "Feels", v: `${Math.round(w.feelsMax)}°`, c: w.feelsMax < 35 ? T.danger : T.cream },
        { l: "Wind", v: `${Math.round(w.wind)}mph`, c: w.wind > 15 ? T.danger : T.cream },
        { l: "Rain", v: w.precip > 0 ? `${w.precip.toFixed(2)}"` : "Dry", c: w.precip > 0.5 ? T.danger : T.cream },
        { l: top?.cl?.measured ? "Water (meas.)" : "Water", v: cl ?? "—", c: clarityColor(cl) }].map(({ l, v, c }) =>
        <div key={l} style={{ textAlign: "center" }}><div style={{ fontSize: 16, fontWeight: 700, fontFamily: MONO, color: c }}>{v}</div><div style={{ fontSize: 10, color: T.muted, textTransform: "uppercase", letterSpacing: 1, marginTop: 2 }}>{l}</div></div>)}
    </div>
  </>;
}

export function HourlyStrip({ hourly, day, sec }) {
  if (!hourly.length) return null;
  const bw = bestWindow(hourly);
  const hl = h => h === 12 ? "12p" : h < 12 ? `${h}a` : `${h - 12}p`;
  return <div style={{ marginBottom: 24 }}>
    <H2 right={bw && <div style={{ fontSize: 11, color: T.ok, fontFamily: MONO }}>{hl(hourly[bw.start].hour)}–{hl(hourly[bw.end].hour)} · {bw.len}hr</div>}>Hourly Window <span style={{ fontSize: 11, color: T.muted, fontFamily: "'DM Sans'" }}>({SECTION_LABEL[sec]})</span></H2>
    <div style={{ display: "flex", gap: 2, overflowX: "auto" }}>
      {hourly.map((h, i) => <div key={i} style={{ flex: "0 0 auto", width: 28, textAlign: "center" }}>
        <div style={{ fontSize: 10, color: T.muted, fontFamily: MONO }}>{hl(h.hour)}</div>
        <div style={{ height: 40, display: "flex", alignItems: "flex-end", justifyContent: "center", marginTop: 2 }}>
          <div style={{ width: 16, height: `${Math.max(h.score * 10, 4)}%`, background: scoreColor(h.score), borderRadius: 2, opacity: bw && i >= bw.start && i <= bw.end ? 1 : 0.5 }} /></div>
        <div style={{ fontSize: 10, fontFamily: MONO, marginTop: 2 }}>{Math.round(h.temp)}°</div>
      </div>)}
    </div>
    {day.sunrise && <div style={{ fontSize: 10, color: T.muted, textAlign: "center", marginTop: 4, fontFamily: MONO }}>🌅 {ft(day.sunrise)} · 🌇 {ft(day.sunset)}</div>}
  </div>;
}

export function AlarmButton({ sp, window }) {
  if (!window || window.arrive <= new Date()) return null;
  return <button onClick={e => { e.stopPropagation(); openAlarm(pulseAlarmParams(sp, window), WORKER_URL); }} style={btn(T.warn)}>⏰ Set alarm · {ft(new Date(+window.arrive - 30 * 60000))}</button>;
}

export function SpotList({ ranked, day, now }) {
  const [exp, setExp] = useState(null);
  const [all, setAll] = useState(false);
  return <div style={{ marginBottom: 28 }}>
    <H2>Where to Fish</H2>
    {!day.isToday && <div style={{ fontSize: 11, color: T.muted, marginBottom: 8 }}>Future day: flow is unknown until the dam schedule posts. Ranked on weather, clarity, and stocking{ranked.some(r => r.windows.length) ? ", plus the releases you entered" : ""}.</div>}
    {(all ? ranked : ranked.slice(0, 5)).map((sp, i) => {
      const open = exp === sp.name;
      const fc = flowColor(sp.st.level);
      const nextWin = sp.windows.find(w => w.arrive > now);
      return <div key={sp.name} onClick={() => setExp(open ? null : sp.name)} style={{ padding: "12px 14px", marginBottom: 6, borderRadius: 8, cursor: "pointer", background: i === 0 ? T.card : "transparent", borderLeft: `3px solid ${fc}`, opacity: i >= 5 ? 0.8 : 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: T.muted, fontFamily: MONO, width: 20 }}>{i + 1}</span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{sp.name}</div>
                <div style={{ fontSize: 11, color: T.muted, fontFamily: MONO }}>🚗 {sp.drive}m</div>
              </div>
              <div style={{ fontSize: 11, color: T.creamDim }}>{sp.reasons.slice(0, 3).join(" · ")}</div>
            </div>
          </div>
          <div style={{ textAlign: "right", marginLeft: 8 }}>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: MONO, color: fc }}>{sp.flow.cfs != null ? Math.round(sp.flow.cfs) : "—"}</div>
            <div style={{ fontSize: 10, color: fc }}>{sp.st.t}</div>
          </div>
        </div>
        {open && <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.border}`, fontSize: 12, color: T.creamDim, lineHeight: 1.6 }}>
          <div style={{ marginBottom: 4 }}>{sp.note}</div>
          {sp.reasons.slice(3).filter(r => !r.startsWith("Water ")).length > 0 && <div style={{ color: T.muted }}>{sp.reasons.slice(3).filter(r => !r.startsWith("Water ")).join(" · ")}</div>}
          <div style={{ color: T.muted, fontSize: 11 }}>RM {sp.rm} · Pulse {fmtLag(sp.lag)}{travelCalibrated() ? "" : " (est.)"} · {sp.reg}</div>
          {sp.flow.gauge && <div style={{ color: T.muted, fontSize: 11 }}>Flow from {GAUGES[sp.flow.gauge].name} gauge{sp.flow.shift ? `, ${fmtLag(sp.flow.shift)} ago` : ""} · base {Math.round(sp.flow.base)} cfs · {sp.flow.trend}</div>}
          {sp.cl.fnu != null && <div style={{ color: T.muted, fontSize: 11 }}>Turbidity {sp.cl.fnu.toFixed(1)} FNU</div>}
          {sp.waterTemp != null && <div style={{ color: T.muted, fontSize: 11 }}>Water {Math.round(sp.waterTemp)}°F</div>}
          {sp.windows.map((w, k) => <div key={k} style={{ color: T.warn, fontSize: 11 }}>High water {ft(w.arrive)}–{w.openEnded ? "≥" : ""}{ft(w.recede)} · falling limb to {ft(w.fallingEnd)}</div>)}
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            <a href={directionsUrl(sp)} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={btn(T.river)}>Directions ↗</a>
            <AlarmButton sp={sp} window={nextWin} />
          </div>
        </div>}
      </div>;
    })}
    {ranked.length > 5 && <button onClick={() => setAll(!all)} style={{ width: "100%", background: "transparent", border: `1px dashed ${T.border}`, borderRadius: 6, color: T.sage, fontSize: 12, padding: 8, cursor: "pointer", fontWeight: 600, marginTop: 4 }}>{all ? `▲ Hide bottom ${ranked.length - 5}` : `▼ Show all ${ranked.length} spots`}</button>}
  </div>;
}

const CK_TEXT = { stained: "Stained water — bigger, darker", cold: "Cold front — slow, deep, midday", overcast: "Overcast — prime hatch conditions", sunny: "Bright sun — smaller, deeper" };

export function Flies({ day, ck }) {
  const month = day.date.getMonth() + 1;
  return <div style={{ marginBottom: 28 }}>
    <H2>What to Tie On</H2>
    <div style={{ fontSize: 12, color: T.muted, marginTop: -6, marginBottom: 12 }}>{CK_TEXT[ck]}</div>
    {HATCHES.filter(h => h.mo.includes(month) && h.flies[ck]?.length).slice(0, 4).map(h => <div key={h.name} style={{ marginBottom: 10, paddingLeft: 12, borderLeft: `2px solid ${h.c}` }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: h.c, fontFamily: SERIF }}>{h.name} <span style={{ fontWeight: 400, color: T.muted, fontSize: 11 }}>({h.sz})</span></div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", margin: "4px 0" }}>{h.flies[ck].map(f =>
        <a key={f} href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent("fly fishing " + f.replace(/#\d+[-]?\d*/g, "").trim())}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: T.river, background: T.deep, border: `1px solid ${T.border}`, borderRadius: 4, padding: "3px 8px", textDecoration: "none", fontStyle: "italic" }}>{f} ↗</a>)}</div>
      <div style={{ fontSize: 12, color: T.creamDim, fontStyle: "italic" }}>{h.tips[ck]}</div>
    </div>)}
  </div>;
}

export function WaterPanel({ gauges, extras, now }) {
  const rows = ["norcross", "powersFerry", "atlanta"].map(k => {
    const s = gauges[k]?.turbidity;
    const fnu = isFresh(s, +now) ? latest(s).v : null;
    return { k, fnu, cl: turbidityClarity(fnu), ecoli: extras?.ecoli?.[k] };
  });
  if (rows.every(r => r.fnu == null) && !extras?.ecoli) return null;
  return <div style={{ marginBottom: 24 }}>
    <H2 right={<a href="https://ga.water.usgs.gov/bacteria/" target="_blank" rel="noopener noreferrer" style={{ fontSize: 11 }}>BacteriALERT ↗</a>}>Measured Water</H2>
    {rows.map(r => <div key={r.k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "5px 0", borderBottom: `1px solid ${T.border}` }}>
      <span>{GAUGES[r.k].name}</span>
      <span style={{ fontFamily: MONO }}>
        {r.fnu != null ? <span style={{ color: clarityColor(r.cl) }}>{r.cl} · {r.fnu.toFixed(1)} FNU</span> : <span style={{ color: T.muted }}>no reading</span>}
        {r.ecoli != null ? <span style={{ color: r.ecoli > 235 ? T.danger : T.ok }}> · E. coli ~{Math.round(r.ecoli)}</span>
          : r.fnu != null && r.fnu >= ECOLI_TURBIDITY_FLAG ? <span style={{ color: T.danger }}> · bacteria likely high</span> : null}
      </span>
    </div>)}
    <div style={{ fontSize: 10, color: T.muted, marginTop: 6 }}>{extras?.ecoli ? "E. coli estimates from BacteriALERT (cfu/100 mL; EPA guideline 235)." : "Bacteria flag is a rough turbidity rule; check BacteriALERT before wet wading."} The upper river has no turbidity gauge.</div>
  </div>;
}

export function Schedule({ manual, setManual, events, now }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ day: 0, sh: "7", sm: "00", eh: "9", em: "00" });
  const add = () => {
    const b = new Date(now); b.setHours(0, 0, 0, 0); b.setDate(b.getDate() + +f.day);
    const s = new Date(b), e = new Date(b);
    s.setHours(+f.sh, +f.sm); e.setHours(+f.eh, +f.em);
    if (e <= s) e.setDate(e.getDate() + 1); // overnight release
    setManual(p => [...p, { id: Date.now(), start: s, end: e }]);
    setOpen(false);
  };
  const sel = { background: T.deep, border: `1px solid ${T.border}`, borderRadius: 4, color: T.cream, fontSize: 13, padding: "4px 6px", fontFamily: MONO };
  const hrs = Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{i === 0 ? "12a" : i < 12 ? `${i}a` : i === 12 ? "12p" : `${i - 12}p`}</option>);
  const mins = ["00", "15", "30", "45"].map(v => <option key={v} value={v}>:{v}</option>);
  const visible = events.filter(e => (e.end ?? now) >= new Date(+now - 12 * 3600000));
  return <div style={{ marginBottom: 24, padding: "12px 16px", borderRadius: 8, background: T.card }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>Dam Schedule</div>
        <div style={{ fontSize: 11, color: T.muted }}><a href={LINKS.usace} target="_blank" rel="noopener noreferrer">USACE ↗</a> · <a href={`tel:${LINKS.damPhone}`}>{LINKS.damPhone}</a></div>
      </div>
      <button onClick={() => setOpen(!open)} style={btn()}>{open ? "Cancel" : "+ Add"}</button>
    </div>
    {visible.length > 0 && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>{visible.map(e => {
      const act = e.start <= now && (!e.end || e.end >= now);
      return <div key={(e.id ?? "d") + "" + +e.start} style={{ display: "flex", alignItems: "center", gap: 4, background: act ? T.sienna + "22" : T.deep, border: `1px solid ${act ? T.sienna + "55" : T.border}`, borderRadius: 4, padding: "3px 8px", fontSize: 12, color: act ? T.sienna : T.cream }}>
        <span style={{ fontFamily: MONO }}>{e.start.toDateString() !== now.toDateString() && e.start.toLocaleDateString("en-US", { weekday: "short" }) + " "}{ft(e.start)}–{e.end ? ft(e.end) : "now"}</span>
        <span style={{ fontSize: 10, color: T.muted }}>{e.source === "detected" ? "gauge" : "entered"}</span>
        {e.source === "manual" && <button aria-label="Remove" onClick={() => setManual(p => p.filter(x => x.id !== e.id))} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 14 }}>×</button>}
      </div>;
    })}</div>}
    {open && <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
      <select value={f.day} onChange={e => setF({ ...f, day: e.target.value })} style={sel}>{[0, 1, 2, 3, 4, 5, 6].map(d => { const x = new Date(now); x.setDate(x.getDate() + d); return <option key={d} value={d}>{d === 0 ? "Today" : d === 1 ? "Tomorrow" : x.toLocaleDateString("en-US", { weekday: "short" })}</option>; })}</select>
      <select value={f.sh} onChange={e => setF({ ...f, sh: e.target.value })} style={sel}>{hrs}</select>
      <select value={f.sm} onChange={e => setF({ ...f, sm: e.target.value })} style={sel}>{mins}</select>
      <span style={{ color: T.muted }}>to</span>
      <select value={f.eh} onChange={e => setF({ ...f, eh: e.target.value })} style={sel}>{hrs}</select>
      <select value={f.em} onChange={e => setF({ ...f, em: e.target.value })} style={sel}>{mins}</select>
      <button onClick={add} style={btn(T.ok)}>Add</button>
    </div>}
    <div style={{ fontSize: 10, color: T.muted, marginTop: 8, lineHeight: 1.5 }}>Releases are detected from the Buford gauge automatically. Enter the posted schedule to plan ahead. Lower river sites get the Buford pulse ~12 hr later (Morgan Falls is run-of-river).</div>
  </div>;
}

export function Stocking({ stock }) {
  if (!stock) return null;
  return <div style={{ marginBottom: 20, fontSize: 12, color: T.creamDim, lineHeight: 1.6 }}>
    <span style={{ fontWeight: 600, color: T.gold, fontFamily: SERIF, fontSize: 13 }}>Stocking </span>
    {stock.ok ? (stock.secs.length
      ? <span>Stocked {stock.range ? `(${stock.range})` : "this week"}: <span style={{ color: T.ok }}>{stock.secs.map(s => SECTION_LABEL[s] + (stock.stockDates?.[s] ? ` ${stock.stockDates[s]}` : "")).join(", ")}</span></span>
      : <span style={{ color: T.muted }}>No tailwater stockings in this week's report{stock.range ? ` (${stock.range})` : ""}.</span>)
      : <span style={{ color: T.muted }}>Report unavailable. </span>}
    {" "}<a href={LINKS.stockingPdf} target="_blank" rel="noopener noreferrer">PDF ↗</a>
    {stock.ok && stock.lines?.length > 0 && <details style={{ fontSize: 11, color: T.muted, marginTop: 4 }}><summary>Report lines</summary>{stock.lines.map((l, i) => <div key={i}>{l.line}</div>)}</details>}
  </div>;
}

export function Menu({ page, setPage, onRiver, setOnRiver, gpsPos, info, gauges, gaugeSource, now }) {
  const title = { root: "Menu", onriver: "On-River Mode", gauges: "Live Gauges" }[page];
  return <div style={{ position: "fixed", inset: 0, zIndex: 100 }}>
    <div onClick={() => setPage(null)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)" }} />
    <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "min(320px, 90vw)", background: T.bg, borderLeft: `1px solid ${T.border}`, animation: "slideIn 0.2s ease", overflowY: "auto", padding: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 17, fontWeight: 700, fontFamily: SERIF }}>{title}</div>
        <button onClick={() => setPage(page === "root" ? null : "root")} style={{ background: "none", border: "none", color: T.cream, fontSize: page === "root" ? 22 : 13, cursor: "pointer" }}>{page === "root" ? "×" : "← Back"}</button>
      </div>
      {page === "root" && [{ id: "onriver", icon: "📡", label: onRiver ? "On-River Mode (ON)" : "On-River Mode" }, { id: "gauges", icon: "📊", label: "Live Gauges" }].map(it =>
        <div key={it.id} onClick={() => setPage(it.id)} style={{ display: "flex", gap: 12, padding: "14px 0", borderBottom: `1px solid ${T.border}`, cursor: "pointer", fontSize: 15 }}><span>{it.icon}</span>{it.label}</div>)}
      {page === "onriver" && <OnRiver onRiver={onRiver} setOnRiver={setOnRiver} gpsPos={gpsPos} info={info} />}
      {page === "gauges" && <Gauges gauges={gauges} source={gaugeSource} now={now} />}
    </div>
  </div>;
}

function OnRiver({ onRiver, setOnRiver, gpsPos, info }) {
  const urgent = info && (info.state === "high" || (info.state === "incoming" && info.minsUntil <= 30));
  return <div>
    <div style={{ fontSize: 12, color: T.creamDim, marginBottom: 12, lineHeight: 1.6 }}>Finds the nearest access point and shows when the next Buford pulse reaches it.</div>
    <div style={{ fontSize: 12, color: T.warn, marginBottom: 14, lineHeight: 1.6, padding: 10, border: `1px solid ${T.warn}55`, borderRadius: 6 }}>The countdown only runs while this screen is on. iPhones pause web pages when locked. <b>Tap "Set alarm"</b> so your calendar alerts you 30 minutes before the pulse, even with the phone in your pocket.</div>
    <button onClick={() => setOnRiver(!onRiver)} style={{ ...btn(onRiver ? T.danger : T.ok), width: "100%", padding: 12, fontSize: 14, marginBottom: 14 }}>{onRiver ? "Turn OFF" : "Turn ON"}</button>
    {onRiver && !gpsPos && <div style={{ fontSize: 12, color: T.warn, textAlign: "center", padding: 8 }}>Acquiring GPS…</div>}
    {info && <div>
      <div style={{ padding: 12, background: T.deep, borderRadius: 6, marginBottom: 8 }}>
        <div style={{ fontSize: 10, color: T.muted, textTransform: "uppercase", letterSpacing: 1 }}>Nearest access</div>
        <div style={{ fontSize: 16, fontWeight: 600, marginTop: 2 }}>{info.sp.name}</div>
        <div style={{ fontSize: 11, color: T.muted }}>{info.dist.toFixed(1)} mi away · pulse lag {fmtLag(spotLag(info.sp))}{travelCalibrated() ? "" : " (est.)"}</div>
      </div>
      <div style={{ padding: 14, background: (urgent ? T.danger : info.state === "incoming" ? T.warn : T.ok) + "22", border: `2px solid ${urgent ? T.danger : info.state === "incoming" ? T.warn : T.ok}`, borderRadius: 8, textAlign: "center" }}>
        {info.state === "incoming" && <>
          <div style={{ fontSize: 11, color: urgent ? T.danger : T.warn, textTransform: "uppercase", letterSpacing: 2, fontWeight: 700 }}>{urgent ? "⚠ Pulse imminent" : "Next pulse"}</div>
          <div style={{ fontSize: 48, fontWeight: 800, fontFamily: MONO, color: urgent ? T.danger : T.warn, lineHeight: 1.1 }}>{info.minsUntil}<span style={{ fontSize: 18 }}>m</span></div>
          <div style={{ fontSize: 12, color: T.creamDim }}>Arrives ~{ft(info.window.arrive)} · high until {info.window.openEnded ? "at least " : "~"}{ft(info.window.recede)}</div>
          {urgent && <div style={{ fontSize: 13, color: T.danger, fontWeight: 700, marginTop: 6 }}>GET OUT OF THE RIVER</div>}
          <div style={{ marginTop: 10 }}><AlarmButton sp={info.sp} window={info.window} /></div>
        </>}
        {info.state === "high" && <>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.danger, textTransform: "uppercase" }}>⚠ Water high</div>
          <div style={{ fontSize: 12, color: T.creamDim, marginTop: 4 }}>{info.window.openEnded ? "Pulse is here and the release is still running." : `Pulse is here. Expected to drop ~${ft(info.window.recede)}.`}</div>
        </>}
        {info.state === "falling" && <div style={{ fontSize: 13, color: T.ok, fontWeight: 600 }}>Falling limb — water dropping since {ft(info.window.recede)}</div>}
        {info.state === "clear" && <div style={{ fontSize: 13, color: T.ok, fontWeight: 600 }}>No release detected or scheduled</div>}
      </div>
      {gpsPos && <div style={{ fontSize: 10, color: T.muted, textAlign: "center", marginTop: 10, fontFamily: MONO }}>📍 {gpsPos.lat.toFixed(4)}, {gpsPos.lon.toFixed(4)}</div>}
    </div>}
    <div style={{ fontSize: 10, color: T.muted, marginTop: 14, lineHeight: 1.6, fontStyle: "italic" }}>Not a substitute for the dam's sirens or the posted schedule. Always have a way out before entering moving water. Wear a PFD.</div>
  </div>;
}

function Gauges({ gauges, source, now }) {
  return <div>
    {Object.entries(GAUGES).map(([k, g]) => {
      const d = gauges[k] ?? {};
      const q = latest(d.discharge), base = baseFlow(d.discharge, +now), tc = latest(d.temp), tu = latest(d.turbidity);
      const ratio = q && base ? q.v / base : null;
      return <div key={k} style={{ padding: "10px 0", borderBottom: `1px solid ${T.border}` }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div><div style={{ fontSize: 14 }}>{g.name}</div><div style={{ fontSize: 10, color: T.muted, fontFamily: MONO }}>{g.id} · RM {g.rm}</div></div>
          <div style={{ textAlign: "right", fontFamily: MONO }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{q ? Math.round(q.v) : "—"} <span style={{ fontSize: 10, color: T.muted }}>cfs</span></div>
            <div style={{ fontSize: 10, color: T.muted }}>{ratio ? `${ratio.toFixed(1)}× base ${Math.round(base)}` : ""}</div>
          </div>
        </div>
        <div style={{ fontSize: 11, color: T.creamDim, fontFamily: MONO, marginTop: 4 }}>
          {tc && `${Math.round(tc.v * 9 / 5 + 32)}°F`}{tu && ` · ${tu.v.toFixed(1)} FNU`}{q && ` · ${ft(q.t)}`}
        </div>
      </div>;
    })}
    <div style={{ fontSize: 10, color: T.muted, marginTop: 12, lineHeight: 1.6 }}>Source: {source ?? "unavailable"}. Pulse travel times: {travelCalibrated() ? "calibrated from USGS history" : "estimates (not yet calibrated)"}.</div>
  </div>;
}
