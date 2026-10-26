// Time series helpers. A series is [{ t: epochMs, v: number }] sorted by t ascending.

export const MIN = 60000, HOUR = 3600000, DAY = 86400000;

export function latest(series) {
  return series?.length ? series[series.length - 1] : null;
}

// Value at time t: last sample at or before t, if it is within `maxGapMin` of t.
export function valueAt(series, t, maxGapMin = 45) {
  if (!series?.length) return null;
  let lo = 0, hi = series.length - 1, idx = -1;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (series[mid].t <= t) { idx = mid; lo = mid + 1; } else hi = mid - 1; }
  if (idx < 0) return null;
  return t - series[idx].t <= maxGapMin * MIN ? series[idx].v : null;
}

export function percentile(values, p) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const i = Math.min(s.length - 1, Math.max(0, Math.round((p / 100) * (s.length - 1))));
  return s[i];
}

// Recent base flow: 15th percentile of the last 7 days. Releases and storms sit above it.
export function baseFlow(series, now = Date.now(), days = 7) {
  if (!series?.length) return null;
  const vals = series.filter(x => x.t >= now - days * DAY && x.t <= now).map(x => x.v);
  return vals.length >= 8 ? percentile(vals, 15) : null;
}

// Change over the last `windowMin` minutes ending at t, as a fraction of base.
export function trendAt(series, t, base, windowMin = 90) {
  const a = valueAt(series, t - windowMin * MIN, windowMin), b = valueAt(series, t);
  if (a == null || b == null || !base) return "steady";
  const d = (b - a) / base;
  if (d > 0.3) return "rising";
  if (d < -0.3) return "falling";
  return "steady";
}

export function isFresh(series, now = Date.now(), maxAgeMin = 180) {
  const l = latest(series);
  return !!l && now - l.t <= maxAgeMin * MIN;
}
