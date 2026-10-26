// Pulse travel times. Uses calibrated gauge lags (src/data/travel.js) when present,
// interpolated by river mile; otherwise the per-spot estimates in SPOTS.
import { GAUGES } from "../data/river.js";
import travel from "../data/travel.js";

export function gaugeLag(key, t = travel) {
  return t.gaugeLagMin?.[key] ?? GAUGES[key].lag;
}

// Tail (end-of-release) lag. Defaults to the front lag: high water lasts until
// generation end + travel time.
export function gaugeTailLag(key, t = travel) {
  return t.gaugeTailLagMin?.[key] ?? gaugeLag(key, t);
}

function interpByRm(rm, pick, t) {
  const pts = Object.keys(GAUGES).map(k => ({ rm: GAUGES[k].rm, lag: pick(k, t) })).sort((a, b) => b.rm - a.rm);
  if (rm >= pts[0].rm) return pts[0].lag;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    if (rm <= a.rm && rm >= b.rm) return Math.round(a.lag + ((a.rm - rm) / (a.rm - b.rm)) * (b.lag - a.lag));
  }
  // Below the last gauge: extrapolate with the last segment's rate.
  const a = pts[pts.length - 2], b = pts[pts.length - 1];
  return Math.round(b.lag + ((b.rm - rm) / (a.rm - b.rm)) * (b.lag - a.lag));
}

export function spotLag(sp, t = travel) {
  return t.calibrated ? interpByRm(sp.rm, gaugeLag, t) : sp.pulse;
}

export function spotTailLag(sp, t = travel) {
  return t.calibrated ? interpByRm(sp.rm, gaugeTailLag, t) : sp.pulse;
}

export const travelCalibrated = () => !!travel.calibrated;

// Which gauge best describes flow at this spot right now, and how far back to look.
// Prefer the nearest gauge upstream (shift >= 0: read it `shift` minutes ago).
// A gauge slightly downstream (within 30 min) is read at its latest value.
export function flowGaugeFor(sp, t = travel) {
  const lag = spotLag(sp, t);
  let best = null;
  for (const k of Object.keys(GAUGES)) {
    const shift = lag - gaugeLag(k, t);
    if (shift < -30) continue;
    if (!best || Math.abs(shift) < Math.abs(best.shift)) best = { key: k, shift: Math.max(0, shift) };
  }
  return best;
}

// Gauge with turbidity for a spot's section (upper river has none).
export function turbidityGaugeFor(sp) {
  if (sp.sec === "mid") return "norcross";
  if (sp.sec === "lower") return sp.rm < 305 ? "atlanta" : "powersFerry";
  return null;
}
