import { describe, it, expect } from "vitest";
import days from "./fixtures/days.json";
import { scoreDay, fishScore, comfortScore, flowStatus, modelClarity, turbidityClarity, rankSpots } from "../src/lib/scoring.js";
import { buildForecast } from "../src/lib/weather.js";

describe("day score", () => {
  it("freezing + wind > 15 + freezing precip stays below 4", () => {
    expect(scoreDay(days["ice-storm"])).toBeLessThan(4);
    expect(scoreDay(days["freezing-drizzle"])).toBeLessThan(4);
  });
  it("freezing drizzle (WMO 56/57) now counts as freezing precipitation", () => {
    expect(scoreDay(days["light-freezing-drizzle"])).toBeLessThan(scoreDay({ ...days["light-freezing-drizzle"], wx: 61 }));
  });
  it("raw overcast day fishes better than it feels", () => {
    const d = days["raw-overcast-calm"];
    expect(fishScore(d)).toBeGreaterThan(comfortScore(d) + 2);
  });
  it("blown-out water hurts fish score more than comfort", () => {
    const d = days["post-storm"];
    expect(fishScore(d)).toBeLessThan(3);
    expect(comfortScore(d)).toBeGreaterThan(7);
  });
  it("overcast BWO day is near the top", () => {
    expect(scoreDay(days["bwo-perfect"])).toBeGreaterThanOrEqual(9);
  });
});

describe("flow and clarity", () => {
  it("rates flow against the gauge's own base", () => {
    expect(flowStatus(1.1).level).toBe("base");
    expect(flowStatus(1.6).level).toBe("up");
    expect(flowStatus(2.5).level).toBe("high");
    expect(flowStatus(8).t).toBe("8× base");
    expect(flowStatus(null).t).toBe("Flow TBD");
  });
  it("recovers slower downstream", () => {
    expect(modelClarity(0, 0.25, "upper")).toBe("Clear");
    expect(modelClarity(0, 0.25, "lower")).toBe("Clearing");
  });
  it("maps turbidity to clarity", () => {
    expect(turbidityClarity(3)).toBe("Clear");
    expect(turbidityClarity(35)).toBe("Stained");
    expect(turbidityClarity(400)).toBe("Blown");
  });
});

describe("future days", () => {
  it("do not use today's flow", () => {
    const day = { date: new Date(2026, 10, 3, 12), isToday: false, ...days["bwo-perfect"] };
    const r = rankSpots({ day, gauges: {}, events: [], now: new Date(2026, 10, 1, 9) });
    expect(r.every(s => s.st.t === "Flow TBD" && s.flow.cfs === null)).toBe(true);
  });
});

describe("forecast", () => {
  it("scores each section and takes the best", () => {
    const mk = (rain) => ({ daily: { time: ["2026-11-01", "2026-11-02"], temperature_2m_max: [60, 60], temperature_2m_min: [45, 45], apparent_temperature_max: [58, 58], precipitation_sum: [rain, 0], wind_speed_10m_max: [5, 5], weather_code: [3, 3] } });
    const f = buildForecast({ upper: mk(0), mid: mk(1.2), lower: mk(1.2) }, new Date(2026, 10, 1, 8));
    expect(f).toHaveLength(2);
    expect(f[1].bestSec).toBe("upper");
    expect(f[1].sections.lower.score).toBeLessThan(f[1].sections.upper.score);
  });
});
