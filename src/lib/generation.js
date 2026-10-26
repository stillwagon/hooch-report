// Detect Buford Dam releases from the gauge just below the dam, and merge them with
// manually entered (future) schedule entries.
import { baseFlow, MIN } from "./series.js";

export function genThreshold(base) {
  return base == null ? 1500 : Math.max(base * 2, base + 800);
}

// Returns [{ start, end, peak, ongoing, source: "detected" }] (Date objects).
// Start is the last sample below threshold and end the first sample back below it,
// so both edges err toward more time flagged as high water.
export function detectReleases(series, now = Date.now()) {
  if (!series?.length) return [];
  const base = baseFlow(series, now);
  const thr = genThreshold(base);
  const out = [];
  let run = null;
  for (let i = 0; i < series.length; i++) {
    const { t, v } = series[i];
    if (v >= thr) {
      if (!run) run = { startIdx: i, peak: v, n: 0 };
      run.peak = Math.max(run.peak, v); run.n++;
    } else if (run) {
      out.push(close(series, run, i)); run = null;
    }
  }
  if (run) out.push(close(series, run, null));
  return out.filter(r => r.n >= 2 || r.peak >= thr * 1.5).map(({ n, ...r }) => r);

  function close(s, r, endIdx) {
    const start = new Date(r.startIdx > 0 ? s[r.startIdx - 1].t : s[r.startIdx].t);
    const ongoing = endIdx === null;
    // An ongoing release with a stale gauge (>90 min) is still treated as ongoing.
    const end = ongoing ? null : new Date(s[endIdx].t);
    return { start, end, peak: r.peak, n: r.n, ongoing, source: "detected" };
  }
}

const overlaps = (a, b, tolMin = 60) => {
  const tol = tolMin * MIN;
  const aEnd = a.end ? +a.end : Infinity, bEnd = b.end ? +b.end : Infinity;
  return +a.start - tol < bEnd && +b.start - tol < aEnd;
};

// Detected releases win over manual entries they overlap. If a detected release is
// still running and a manual entry gives its planned end, keep that planned end.
export function mergeSchedule(manual, detected) {
  const out = [];
  const used = new Set();
  for (const d of detected) {
    const m = manual.find(x => !used.has(x.id) && overlaps(x, d));
    if (m) used.add(m.id);
    out.push({ ...d, end: d.end ?? (m && m.end > d.start ? m.end : null), plannedEnd: !d.end && !!m });
  }
  for (const m of manual) if (!used.has(m.id)) out.push({ ...m, source: "manual", ongoing: false });
  return out.sort((a, b) => a.start - b.start);
}
