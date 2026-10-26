import { describe, it, expect } from "vitest";
import { parseOgc, parseLegacy, ogcUrl } from "../src/fetchers/usgs.js";

describe("USGS parsing", () => {
  it("reads the Water Data API GeoJSON", () => {
    const j = { type: "FeatureCollection", features: [
      { type: "Feature", properties: { time: "2026-11-01T12:15:00+00:00", value: "655", unit_of_measure: "ft^3/s", parameter_code: "00060" } },
      { type: "Feature", properties: { time: "2026-11-01T12:00:00+00:00", value: "650" } },
    ] };
    const s = parseOgc(j);
    expect(s.map(x => x.v)).toEqual([650, 655]);
  });
  it("reads legacy NWIS JSON across sites and params", () => {
    const j = { value: { timeSeries: [
      { sourceInfo: { siteCode: [{ value: "02334430" }] }, variable: { variableCode: [{ value: "00060" }] }, values: [{ value: [{ dateTime: "2026-11-01T08:00:00.000-04:00", value: "620" }] }] },
      { sourceInfo: { siteCode: [{ value: "02335000" }] }, variable: { variableCode: [{ value: "63680" }] }, values: [{ value: [{ dateTime: "2026-11-01T08:00:00.000-04:00", value: "-999999" }, { dateTime: "2026-11-01T08:15:00.000-04:00", value: "4.2" }] }] },
    ] } };
    const out = parseLegacy(j);
    expect(out.bufordDam.discharge[0].v).toBe(620);
    expect(out.norcross.turbidity).toHaveLength(1);
  });
  it("builds the OGC query", () => {
    const u = new URL(ogcUrl("https://api.waterdata.usgs.gov/ogcapi/v0", "02334430", "00060", "P8D"));
    expect(u.pathname).toBe("/ogcapi/v0/collections/continuous/items");
    expect(u.searchParams.get("monitoring_location_id")).toBe("USGS-02334430");
    expect(u.searchParams.get("time")).toBe("P8D");
  });
});
