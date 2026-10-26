// Synthetic gauge series for tests and the offline preview.
export const MIN = 60000;

// 15-minute samples from `from` to `to`; fn(t) gives the value.
export function series(from, to, fn) {
  const out = [];
  for (let t = +from; t <= +to; t += 15 * MIN) out.push({ t, v: fn(t) });
  return out;
}

// Buford-style flow: base, with step releases [{start, end, cfs}].
export const releaseFlow = (base, releases, lagMin = 0) => t => {
  for (const r of releases) if (t >= +r.start + lagMin * MIN && t < +r.end + lagMin * MIN) return r.cfs;
  return base;
};
