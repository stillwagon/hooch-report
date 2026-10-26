import { describe, it, expect } from "vitest";
import { detectReleases, mergeSchedule } from "../src/lib/generation.js";
import { series, releaseFlow } from "./helpers.js";

const at = (d, h, m = 0) => new Date(2026, 10, d, h, m);

describe("release detection", () => {
  const rel = [{ start: at(1, 7), end: at(1, 11), cfs: 5200 }, { start: at(3, 14), end: at(3, 16), cfs: 3600 }];
  const s = series(at(1, 0), at(4, 0), releaseFlow(620, rel));
  // Prepend a quiet week so base flow is well defined.
  const quiet = series(new Date(+at(1, 0) - 7 * 864e5), new Date(+at(1, 0) - 15 * 60000), () => 610);
  const all = [...quiet, ...s];

  it("finds each release with conservative edges", () => {
    const d = detectReleases(all, +at(4, 0));
    expect(d).toHaveLength(2);
    expect(d[0].start).toEqual(at(1, 6, 45)); // last sample before the jump
    expect(d[0].end).toEqual(at(1, 11));      // first sample back at base
    expect(d[0].ongoing).toBe(false);
  });
  it("flags a release still running", () => {
    const cut = all.filter(x => x.t <= +at(3, 15));
    const d = detectReleases(cut, +at(3, 15));
    expect(d.at(-1).ongoing).toBe(true);
    expect(d.at(-1).end).toBeNull();
  });
  it("ignores a single noisy sample", () => {
    const noisy = all.map(x => x.t === +at(2, 3) ? { ...x, v: 1500 } : x);
    expect(detectReleases(noisy, +at(4, 0))).toHaveLength(2);
  });
});

describe("merging with manual entries", () => {
  it("detected release replaces the matching manual entry but keeps its planned end", () => {
    const manual = [{ id: 1, start: at(1, 7), end: at(1, 12) }, { id: 2, start: at(2, 14), end: at(2, 18) }];
    const detected = [{ start: at(1, 6, 45), end: null, ongoing: true, source: "detected" }];
    const m = mergeSchedule(manual, detected);
    expect(m).toHaveLength(2);
    expect(m[0].source).toBe("detected");
    expect(m[0].end).toEqual(at(1, 12));
    expect(m[1].source).toBe("manual");
  });
});
