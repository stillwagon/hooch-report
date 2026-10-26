// Scoring: day (headline + fish/you subscores), clarity, flow status, spot ranking.
import { SPOTS, isDelayedHarvest } from "../data/river.js";
import { valueAt, latest, baseFlow, trendAt, isFresh, MIN } from "./series.js";
import { spotLag, spotTailLag, flowGaugeFor, turbidityGaugeFor } from "./travel.js";
import { pulseWindows, stateAt, highFraction } from "./pulse.js";

const clamp = s => Math.max(0, Math.min(10, s));
const isFreezingPrecip = wx => wx === 56 || wx === 57 || wx === 66 || wx === 67 || (wx >= 71 && wx <= 77);

// Headline day score (user rule: freezing feels-like + wind > 15 mph + freezing
// precipitation must land below 4; penalties compound).
export function scoreDay(d) {
  let s = 5; const fm = d.feelsMax;
  if (fm >= 45 && fm <= 62) s += 2; else if (fm >= 38 && fm <= 70) s += 1; else if (fm < 25) s -= 4; else if (fm < 32) s -= 3; else if (fm < 38) s -= 1.5;
  if (d.wind <= 7) s += 2; else if (d.wind <= 10) s += 1; else if (d.wind > 15 && d.wind <= 20) s -= 3; else if (d.wind > 20) s -= 5;
  if (d.cloud >= 60 && d.cloud <= 90 && d.precip < 0.2) s += 1.5;
  if (d.precip > 1) s -= 4; else if (d.precip > 0.5) s -= 3; else if (d.precip > 0.25) s -= 1.5;
  if (d.wx >= 95) s -= 4; else if (isFreezingPrecip(d.wx)) s -= 3;
  if (d.p24 > 1.5) s -= 3; else if (d.p24 > 0.75) s -= 2; else if (d.p24 > 0.3) s -= 1;
  if (d.p48 > 2.5) s -= 2; else if (d.p48 > 1.5) s -= 1;
  if (fm < 35 && d.wind > 15) s -= 2;
  if (fm < 32 && d.precip > 0.1) s -= 2;
  if (isFreezingPrecip(d.wx) && d.wind > 12) s -= 2;
  return clamp(s);
}

// "You": how the day feels to stand in the river.
export function comfortScore(d) {
  let s = 5; const fm = d.feelsMax;
  if (fm >= 45 && fm <= 70) s += 2.5; else if (fm >= 38 && fm <= 80) s += 1; else if (fm < 25) s -= 4; else if (fm < 32) s -= 3; else if (fm < 38) s -= 1.5; else if (fm > 90) s -= 1.5;
  if (d.wind <= 7) s += 2; else if (d.wind <= 10) s += 1; else if (d.wind > 15 && d.wind <= 20) s -= 2.5; else if (d.wind > 20) s -= 4;
  if (d.precip > 1) s -= 4; else if (d.precip > 0.5) s -= 3; else if (d.precip > 0.25) s -= 1.5; else if (d.precip > 0.05) s -= 0.5;
  if (d.wx >= 95) s -= 4; else if (isFreezingPrecip(d.wx)) s -= 3;
  if (fm < 35 && d.wind > 15) s -= 2;
  if (fm < 32 && d.precip > 0.1) s -= 2;
  return clamp(s);
}

// "Fish": will they eat? The tailwater runs in the 50s year-round, so air
// temperature matters little; light, clouds and clarity matter a lot.
export function fishScore(d) {
  let s = 6;
  if (d.cloud >= 60 && d.cloud <= 90 && d.precip < 0.2) s += 2; else if (d.cloud >= 40) s += 0.5;
  if (d.precip > 0.02 && d.precip <= 0.25) s += 0.5; else if (d.precip > 0.5) s -= 1;
  if (d.p24 > 1.5) s -= 4; else if (d.p24 > 0.75) s -= 3; else if (d.p24 > 0.3) s -= 1.5;
  if (d.p48 > 2.5) s -= 2; else if (d.p48 > 1.5) s -= 1;
  if (d.feelsMax < 25) s -= 1;
  if (d.tempMax > 90) s -= 0.5;
  if (d.wind > 20) s -= 1.5; else if (d.wind > 15) s -= 0.5;
  if (d.wx >= 95) s -= 1;
  return clamp(s);
}

export function condKey(d, clarityText) {
  if (clarityText && clarityText !== "Clear" && clarityText !== "Clearing") return "stained";
  if (d.p24 > 0.3 || d.precip > 0.2) return "stained";
  if (d.feelsMax < 38) return "cold";
  if (d.cloud >= 60) return "overcast";
  return "sunny";
}

// Modeled clarity from rainfall (used for the upper river, and for future days).
const SEC_MULT = { upper: 1, mid: 1.3, lower: 1.6 };
export function modelClarity(p24, p48, sec = "upper") {
  const m = SEC_MULT[sec] ?? 1; p24 *= m; p48 *= m;
  if (p48 < 0.05 && p24 < 0.05) return "Clear";
  if (p24 > 1) return "Blown"; if (p24 > 0.5) return "Muddy"; if (p24 > 0.2) return "Stained";
  if (p48 > 1) return "Stained"; if (p48 > 0.3) return "Clearing";
  return "Clear";
}

// Measured clarity from turbidity (FNU). Thresholds are a starting point; tune with trips.
export function turbidityClarity(fnu) {
  if (fnu == null) return null;
  if (fnu <= 8) return "Clear";
  if (fnu <= 20) return "Clearing";
  if (fnu <= 50) return "Stained";
  if (fnu <= 150) return "Muddy";
  return "Blown";
}

// Above this, BacteriALERT estimates usually exceed the EPA swimming guideline.
// This is a rough flag from turbidity, not the program's own estimate.
export const ECOLI_TURBIDITY_FLAG = 30;

// Flow relative to the gauge's own recent base flow.
export function flowStatus(ratio) {
  if (ratio == null) return { t: "Flow TBD", s: 5, level: "unknown" };
  if (ratio <= 1.3) return { t: "At base", s: 10, level: "base" };
  if (ratio <= 1.8) return { t: "Slightly up", s: 7, level: "up" };
  if (ratio <= 3) return { t: "Up", s: 3, level: "high" };
  return { t: `${Math.round(ratio)}× base`, s: 0, level: "blown" };
}

const ft = d => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
const sameDay = (a, b) => a.toDateString() === b.toDateString();

// Clarity for a spot on a given day.
export function spotClarity(sp, day, gauges, now) {
  const w = day.sections?.[sp.sec] ?? day;
  const modeled = modelClarity(w.p24, w.p48, sp.sec);
  const tg = turbidityGaugeFor(sp);
  const turb = tg ? gauges?.[tg]?.turbidity : null;
  const fnu = turb && isFresh(turb, +now) ? latest(turb).v : null;
  const measured = turbidityClarity(fnu);
  if (day.isToday && measured) return { t: measured, measured: true, fnu };
  // Tomorrow: if it's muddy now and no new rain, it's still clearing.
  if (measured && (measured === "Muddy" || measured === "Blown") && modeled === "Clear" && (day.date - now) < 2 * 86400000) return { t: "Clearing", measured: false, fnu };
  return { t: modeled, measured: false, fnu };
}

export function rankSpots({ day, gauges = {}, events = [], stock = null, now = new Date() }) {
  const date = day.date;
  const mo = date.getMonth() + 1, isDH = isDelayedHarvest(date), isW = date.getDay() === 0 || date.getDay() === 6;
  const dayEvents = day.isToday ? events : events.filter(e => sameDay(e.start, date) || (e.end && sameDay(e.end, date)));

  return SPOTS.map(sp => {
    const w = day.sections?.[sp.sec] ?? day;
    const ck = condKey(w);
    const lag = spotLag(sp), tail = spotTailLag(sp);

    // Flow at the spot now (today only): nearest upstream gauge, read `shift` minutes ago.
    let flow = { ratio: null, cfs: null, gauge: null, trend: "steady" };
    if (day.isToday) {
      const fg = flowGaugeFor(sp);
      const ser = gauges[fg.key]?.discharge;
      const at = +now - fg.shift * MIN;
      const cfs = valueAt(ser, at, 90);
      const base = baseFlow(ser, +now);
      if (cfs != null && base) flow = { cfs, base, ratio: cfs / base, gauge: fg.key, shift: fg.shift, trend: trendAt(ser, at, base) };
    }
    let st = flowStatus(flow.ratio);
    let score = st.s + sp.q * 0.3;

    const cl = spotClarity(sp, day, gauges, now);
    if (cl.t === "Clear") score += 2; else if (cl.t === "Clearing") score += 1; else if (cl.t === "Stained") score -= 1; else score -= 3;

    // Water temperature (trout optimum 50–65°F).
    const tSeries = gauges[flow.gauge ?? (sp.sec === "upper" ? "bufordDam" : sp.sec === "mid" ? "norcross" : "powersFerry")]?.temp
      ?? gauges.atlanta?.temp;
    const tc = isFresh(tSeries, +now, 360) ? latest(tSeries).v : null;
    const waterTemp = tc != null ? tc * 9 / 5 + 32 : null;
    if (waterTemp != null) {
      if (waterTemp >= 50 && waterTemp <= 65) score += 1.5;
      else if (waterTemp >= 42 && waterTemp < 50) score += 0.5;
      else if (waterTemp > 65 && waterTemp <= 68) score -= 0.5;
      else if (waterTemp > 68 && waterTemp <= 72) score -= 2;
      else if (waterTemp > 72) score -= 4;
      else if (waterTemp < 38) score -= 2;
      if (sp.sec === "upper" && mo >= 6 && mo <= 9 && waterTemp < 60) score += 1;
    }

    const stockedSecs = stock?.secs ?? [];
    if (stockedSecs.includes(sp.sec)) score += 2;
    if (isDH && sp.sec === "lower") score += 1.5;
    if (isW && sp.name === "Jones Br.") score -= 2;
    if (isW && sp.name === "Settles Br.") score += 1;
    if (ck === "overcast" && sp.name === "Hwy 20") score += 1.5;
    if (ck === "stained" && sp.sec === "upper") score += 1;
    if (ck === "cold" && sp.name === "Bowmans Is.") score += 1;

    // Release pulses.
    // Today: keep only pulses that still matter (not yet past their falling limb).
    const windows = pulseWindows(dayEvents, lag, tail, now).filter(w => !day.isToday || w.fallingEnd > now);
    let pulse = null, pulseNote = null;
    if (day.isToday && windows.length) {
      pulse = stateAt(windows, now);
      const wnd = pulse.window;
      if (pulse.state === "high") {
        if (st.level !== "blown" && st.level !== "high") { score -= st.s; st = { t: "Pulse", s: 0, level: "blown" }; }
        pulseNote = wnd.openEnded ? "High water — release still running" : `High water — drops ~${ft(wnd.recede)}`;
      } else if (pulse.state === "falling") {
        // Trust the gauge: if flow is still high, it is not prime time yet.
        if (st.level !== "blown" && st.level !== "high") { score += 1; pulseNote = "Falling limb — prime time"; }
      } else if (pulse.state === "incoming") {
        const m = pulse.minsUntil;
        if (m > 240) { score += 2; pulseNote = `${Math.round(m / 60)}hr window — pulse ${ft(wnd.arrive)}`; }
        else if (m > 120) { score += 1; pulseNote = `${Math.round(m / 60)}hr window — pulse ${ft(wnd.arrive)}`; }
        else if (m > 60) pulseNote = `${m}m window — pulse ${ft(wnd.arrive)}`;
        else if (m > 30) { score -= 1; pulseNote = `${m}m before pulse — fish fast`; }
        else { score -= 3; pulseNote = "Pulse arriving — get out"; }
      }
    } else if (!day.isToday && windows.length) {
      const d0 = new Date(date); d0.setHours(7, 0, 0, 0);
      const d1 = new Date(date); d1.setHours(19, 0, 0, 0);
      const frac = highFraction(windows, d0, d1);
      score -= 5 * frac;
      const first = windows.find(x => x.recede > d0 && x.arrive < d1);
      if (first) pulseNote = `High ${ft(first.arrive)}–${ft(first.recede)}`;
    }

    const reasons = [];
    if (pulseNote) reasons.push(pulseNote);
    if (st.level === "base" || st.level === "up") reasons.push(st.t === "At base" ? "Base flow" : st.t);
    else if (!pulseNote && (st.level === "high" || st.level === "blown")) reasons.push(`High flow (${st.t})`);
    if (cl.t === "Clear") reasons.push(cl.measured ? "Clear (measured)" : "Clear water");
    else if (cl.t === "Clearing") reasons.push("Clearing");
    if (waterTemp != null) {
      if (waterTemp > 68) reasons.push(`Water ${Math.round(waterTemp)}°F — too warm`);
      else if (waterTemp >= 50 && waterTemp <= 65) reasons.push(`Water ${Math.round(waterTemp)}°F`);
    }
    const sd = stock?.stockDates?.[sp.sec];
    if (stockedSecs.includes(sp.sec)) reasons.push(sd ? `Stocked ${sd}` : "Stocked this week");
    if (ck === "overcast" && sp.name === "Hwy 20") reasons.push("Best hatch water");
    if (isDH && sp.sec === "lower") reasons.push("DH season");
    if (isW && sp.name === "Settles Br.") reasons.push("Quieter weekends");

    return { ...sp, lag, tail, flow, st, cl, waterTemp, windows, pulse, score: Math.max(0, score), reasons };
  }).sort((a, b) => b.score - a.score);
}

