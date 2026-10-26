// Turn Open-Meteo responses (one per section) into per-day and per-hour records.
import { SECTIONS } from "../data/river.js";
import { scoreDay, comfortScore, fishScore } from "./scoring.js";

const dayKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function sectionDays(w) {
  if (!w?.daily) return {};
  const out = {};
  w.daily.time.forEach((ds, i) => {
    const P = w.daily.precipitation_sum;
    const p24 = i > 0 ? P[i - 1] ?? 0 : 0;
    const p48 = (i > 1 ? P[i - 2] ?? 0 : 0) + p24;
    const date = new Date(ds + "T12:00:00");
    let cloud = 50;
    if (w.hourly) {
      const cs = [];
      w.hourly.time.forEach((t, hi) => { if (t.startsWith(ds)) { const h = +t.slice(11, 13); if (h >= 7 && h <= 17) cs.push(w.hourly.cloud_cover[hi]); } });
      if (cs.length) cloud = cs.reduce((a, b) => a + b, 0) / cs.length;
    }
    const d = {
      tempMax: w.daily.temperature_2m_max[i], tempMin: w.daily.temperature_2m_min[i],
      feelsMax: w.daily.apparent_temperature_max?.[i] ?? w.daily.temperature_2m_max[i],
      precip: P[i] ?? 0, p24, p48, wind: w.daily.wind_speed_10m_max[i], cloud, wx: w.daily.weather_code[i],
      sunrise: w.daily.sunrise ? new Date(w.daily.sunrise[i]) : null,
      sunset: w.daily.sunset ? new Date(w.daily.sunset[i]) : null,
    };
    out[ds] = { ...d, date, score: scoreDay(d), comfort: comfortScore(d), fish: fishScore(d) };
  });
  return out;
}

// wxBySec: { upper, mid, lower } raw Open-Meteo responses.
// Day score = best section, since you choose where to go.
export function buildForecast(wxBySec, today = new Date()) {
  const per = Object.fromEntries(SECTIONS.map(s => [s, sectionDays(wxBySec?.[s])]));
  const ref = per.mid && Object.keys(per.mid).length ? per.mid : per[SECTIONS.find(s => Object.keys(per[s]).length)] || {};
  const tk = dayKey(today);
  return Object.keys(ref).filter(ds => ds >= tk).map(ds => {
    const sections = Object.fromEntries(SECTIONS.filter(s => per[s][ds]).map(s => [s, per[s][ds]]));
    const bestSec = Object.keys(sections).reduce((b, s) => !b || sections[s].score > sections[b].score ? s : b, null);
    const head = sections[bestSec];
    const date = head.date;
    return {
      ...head, sections, bestSec, dateStr: ds, date,
      dayName: date.toLocaleDateString("en-US", { weekday: "short" }),
      dateLabel: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      isToday: ds === tk,
    };
  });
}

export function buildHourly(w, day) {
  if (!w?.hourly || !day) return [];
  const out = [];
  w.hourly.time.forEach((ts, i) => {
    if (!ts.startsWith(day.dateStr)) return;
    const hour = +ts.slice(11, 13);
    if (hour < 5 || hour > 21) return;
    const temp = w.hourly.apparent_temperature?.[i] ?? w.hourly.temperature_2m[i];
    const precip = w.hourly.precipitation[i] || 0, wind = w.hourly.wind_speed_10m[i] || 0;
    const cloud = w.hourly.cloud_cover[i] ?? 50, wx = w.hourly.weather_code[i] || 0;
    let s = 5;
    if (temp >= 45 && temp <= 62) s += 2; else if (temp >= 38 && temp <= 70) s += 1; else if (temp < 25) s -= 4; else if (temp < 32) s -= 3; else if (temp < 38) s -= 1.5;
    if (wind <= 7) s += 1.5; else if (wind <= 10) s += 0.5; else if (wind > 15 && wind <= 20) s -= 2.5; else if (wind > 20) s -= 4.5;
    if (cloud >= 60 && cloud <= 90 && precip < 0.1) s += 1.5; else if (cloud >= 40 && precip < 0.05) s += 0.5;
    if (precip > 0.25) s -= 3; else if (precip > 0.1) s -= 1.5; else if (precip > 0.02) s -= 0.5;
    if (wx >= 95) s -= 4; else if ((wx >= 66 && wx <= 77) || wx === 56 || wx === 57) s -= 3;
    if (day.sunrise && day.sunset && temp > 35) {
      const sr = day.sunrise.getHours() + day.sunrise.getMinutes() / 60, ss = day.sunset.getHours() + day.sunset.getMinutes() / 60;
      if (Math.abs(hour - sr) < 1.5) s += 1;
      if (Math.abs(hour - ss) < 1.5) s += 1;
    }
    out.push({ time: new Date(ts), hour, temp, precip, wind, cloud, wx, score: Math.max(0, Math.min(10, s)) });
  });
  return out;
}

export function bestWindow(hourly, min = 5) {
  let best = null, start = null, lo = 0;
  const close = end => {
    const len = end - start + 1;
    if (len >= 3 && (!best || len > best.len || (len === best.len && lo > best.min))) best = { start, end, len, min: lo };
  };
  hourly.forEach((h, i) => {
    if (h.score >= min) { if (start === null) { start = i; lo = h.score; } else lo = Math.min(lo, h.score); }
    else if (start !== null) { close(i - 1); start = null; }
  });
  if (start !== null) close(hourly.length - 1);
  return best;
}

export const wxIcon = c => c === 0 ? "☀️" : c <= 3 ? "⛅" : c <= 48 ? "🌫️" : c <= 67 ? "🌧️" : c <= 77 ? "❄️" : c <= 82 ? "🌦️" : c >= 95 ? "⛈️" : "🌤️";
export const wxText = c => c === 0 ? "Clear" : c <= 3 ? "Partly cloudy" : c <= 48 ? "Fog" : (c === 56 || c === 57 || c === 66 || c === 67) ? "Freezing rain" : c <= 67 ? "Rain" : c <= 77 ? "Snow/sleet" : c >= 95 ? "Thunderstorms" : "Showers";
