// Measure pulse travel times from gauge history: for each isolated Buford release,
// find when the rise (and fall) crosses half its height at each downstream gauge.
import { percentile, valueAt, MIN } from "./series.js";

const median = a => percentile(a, 50);

// Releases over a long window, with a threshold from the whole window's base.
export function findReleases(buford) {
  const base = percentile(buford.map(x => x.v), 15);
  const thr = Math.max(base * 2, base + 800);
  const out = []; let run = null;
  for (const x of buford) {
    if (x.v >= thr) { if (!run) run = { start: x.t, peak: x.v }; run.peak = Math.max(run.peak, x.v); run.last = x.t; }
    else if (run) { out.push({ ...run, end: x.t }); run = null; }
  }
  return out.filter(r => r.end - r.start >= 45 * MIN).map(r => ({ ...r, base }));
}

const firstWhere = (s, from, to, pred) => s.find(x => x.t >= from && x.t <= to && pred(x.v))?.t ?? null;
const vals = (s, from, to) => s.filter(x => x.t >= from && x.t <= to).map(x => x.v);

// Half-height crossing times of one release at Buford.
function bufordHalf(buford, r) {
  const pre = valueAt(buford, r.start, 30) ?? r.base;
  const half = pre + (r.peak - pre) / 2;
  return {
    rise: firstWhere(buford, r.start - 30 * MIN, r.end, v => v >= half),
    fall: firstWhere(buford, r.last, r.end + 120 * MIN, v => v < half),
  };
}

// guessLag: prior estimate in minutes, used only to bound the search windows.
export function measureLag(buford, gauge, releases, guessLag) {
  const L = guessLag * MIN;
  const gBase = percentile(gauge.map(x => x.v), 15);
  const rises = [], falls = [];
  releases.forEach((r, i) => {
    const prev = releases[i - 1], next = releases[i + 1];
    // Skip releases whose neighbors' pulses overlap this one at the gauge.
    if (prev && prev.end + 1.3 * L + 2 * 60 * MIN > r.start + 0.5 * L) return;
    if (next && next.start < r.end + 3 * 60 * MIN) return;
    const pre = Math.min(...vals(gauge, r.start, r.start + 0.5 * L).concat(Infinity));
    if (!Number.isFinite(pre) || pre > 2 * gBase) return; // storm flow, skip
    const winEnd = r.end + 1.8 * L + 4 * 60 * MIN;
    const peak = Math.max(...vals(gauge, r.start + 0.4 * L, winEnd));
    const riseAmt = peak - pre;
    if (!(riseAmt > Math.max(250, 0.3 * pre))) return;
    const b = bufordHalf(buford, r);
    const half = pre + riseAmt / 2;
    const tr = firstWhere(gauge, r.start + 0.4 * L, winEnd, v => v >= half);
    if (tr && b.rise) rises.push((tr - b.rise) / MIN);
    const tf = tr && firstWhere(gauge, Math.max(tr, r.end + 0.4 * L), winEnd + 6 * 60 * MIN, v => v < half);
    if (tf && b.fall) falls.push((tf - b.fall) / MIN);
  });
  const summary = a => a.length ? { median: Math.round(median(a)), p25: Math.round(percentile(a, 25)), p75: Math.round(percentile(a, 75)), n: a.length } : { n: 0 };
  return { rise: summary(rises), fall: summary(falls) };
}
