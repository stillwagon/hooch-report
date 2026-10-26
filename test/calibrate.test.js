import { describe, it, expect } from "vitest";
import { findReleases, measureLag } from "../src/lib/calibrate.js";
import { series, releaseFlow } from "./helpers.js";

describe("travel-time calibration", () => {
  // 30 days, a 3-hour release every other afternoon. True lag 300 min (rise) / 340 (fall).
  const t0 = new Date(2026, 8, 1);
  const rel = Array.from({ length: 15 }, (_, i) => ({ start: new Date(+t0 + (2 * i + 1) * 864e5 + 14 * 36e5), end: new Date(+t0 + (2 * i + 1) * 864e5 + 17 * 36e5), cfs: 5000 }));
  const to = new Date(+t0 + 31 * 864e5);
  const buford = series(t0, to, releaseFlow(600, rel));
  // Downstream: delayed and stretched (tail +40 min), higher base from tributaries.
  const down = series(t0, to, t => {
    for (const r of rel) if (t >= +r.start + 300 * 60000 && t < +r.end + 340 * 60000) return 4200;
    return 1100;
  });

  it("finds the releases", () => {
    expect(findReleases(buford)).toHaveLength(15);
  });
  it("recovers rise and fall lags within one sample", () => {
    const m = measureLag(buford, down, findReleases(buford), 330);
    expect(m.rise.n).toBeGreaterThanOrEqual(10);
    expect(Math.abs(m.rise.median - 300)).toBeLessThanOrEqual(15);
    expect(Math.abs(m.fall.median - 340)).toBeLessThanOrEqual(15);
  });
});
