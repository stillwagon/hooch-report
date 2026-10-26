import { describe, it, expect } from "vitest";
import days from "./fixtures/days.json";
import { rankSpots } from "../src/lib/scoring.js";
import { detectReleases, mergeSchedule } from "../src/lib/generation.js";
import { series, releaseFlow } from "./helpers.js";

const at = (h, m = 0) => new Date(2026, 10, 1, h, m);
const weekAgo = new Date(+at(0) - 7 * 864e5);

// Release from 7:00 still running at 10:00 (now). Norcross sees it 330 min later.
const NOW = at(10);
const rel = [{ start: at(7), end: at(14), cfs: 5200 }];
const gauges = {
  bufordDam: { discharge: series(weekAgo, NOW, releaseFlow(620, rel)), temp: [{ t: +NOW, v: 11 }] },
  norcross: { discharge: series(weekAgo, NOW, releaseFlow(900, [{ ...rel[0], cfs: 4800 }], 330)), turbidity: [{ t: +NOW, v: 4 }] },
};
const day = { date: NOW, isToday: true, ...days["bwo-perfect"] };

describe("ranking during a detected release", () => {
  const events = mergeSchedule([], detectReleases(gauges.bufordDam.discharge, +NOW));
  const r = rankSpots({ day, gauges, events, now: NOW });
  const by = n => r.find(s => s.name === n);

  it("upper spots are in the pulse", () => {
    expect(by("Hwy 20").pulse.state).toBe("high");
    expect(by("Hwy 20").reasons[0]).toMatch(/High water/);
  });
  it("an ongoing release is detected as open-ended", () => {
    expect(events[0]).toMatchObject({ source: "detected", ongoing: true, end: null });
  });
  it("Hwy 20 after the release ends is the falling limb, not high water", () => {
    const done = mergeSchedule([], [{ start: at(7), end: at(9), ongoing: false, source: "detected" }]);
    const r2 = rankSpots({ day, gauges: {}, events: done, now: at(10, 30) });
    expect(r2.find(s => s.name === "Hwy 20").pulse.state).toBe("falling");
  });
  it("Jones Br. sees the pulse coming", () => {
    expect(by("Jones Br.").pulse.state).toBe("incoming");
  });
  it("high-water spots rank below quiet ones", () => {
    expect(by("Hwy 20").score).toBeLessThan(by("Island Ford").score);
  });
  it("uses measured turbidity on the mid river", () => {
    expect(by("Jones Br.").cl).toMatchObject({ t: "Clear", measured: true });
  });
});
