import { describe, it, expect } from "vitest";
import { SPOTS } from "../src/data/river.js";
import { spotLag, flowGaugeFor, turbidityGaugeFor } from "../src/lib/travel.js";

const spot = n => SPOTS.find(s => s.name === n);

describe("travel times", () => {
  it("uses per-spot estimates until calibrated", () => {
    expect(spotLag(spot("Jones Br."))).toBe(390);
  });
  it("interpolates calibrated gauge lags by river mile", () => {
    const cal = { calibrated: true, gaugeLagMin: { bufordDam: 0, norcross: 300, powersFerry: 700, atlanta: 720 } };
    expect(spotLag(spot("Medlock Br."), cal)).toBe(300);
    const jones = spotLag(spot("Jones Br."), cal);
    expect(jones).toBeGreaterThan(300); expect(jones).toBeLessThan(400);
    expect(spotLag(spot("Paces Mill"), cal)).toBeGreaterThanOrEqual(700);
  });
  it("reads flow from the nearest upstream gauge, time-shifted", () => {
    expect(flowGaugeFor(spot("Hwy 20"))).toEqual({ key: "bufordDam", shift: 50 });
    expect(flowGaugeFor(spot("Jones Br."))).toEqual({ key: "norcross", shift: 60 });
    expect(flowGaugeFor(spot("Morgan Falls")).key).toBe("powersFerry");
    expect(flowGaugeFor(spot("Abbotts Br."))).toEqual({ key: "bufordDam", shift: 270 });
  });
  it("only mid and lower river have turbidity", () => {
    expect(turbidityGaugeFor(spot("Hwy 20"))).toBeNull();
    expect(turbidityGaugeFor(spot("Jones Br."))).toBe("norcross");
    expect(turbidityGaugeFor(spot("Paces Mill"))).toBe("atlanta");
  });
});
