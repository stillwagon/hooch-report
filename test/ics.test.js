import { describe, it, expect } from "vitest";
import { buildIcs, pulseAlarmParams } from "../src/lib/ics.js";

describe("pulse alarm", () => {
  it("alerts 30 minutes before the pulse arrives", () => {
    const w = { arrive: new Date(Date.UTC(2026, 10, 1, 18, 30)), recede: new Date(Date.UTC(2026, 10, 1, 22, 30)), openEnded: false };
    const ics = buildIcs(pulseAlarmParams({ name: "Jones Br.", lat: 34, lon: -84.2, rm: 328 }, w));
    expect(ics).toContain("DTSTART:20261101T183000Z");
    expect(ics).toContain("TRIGGER:-PT30M");
    expect(ics).toContain("SUMMARY:Pulse at Jones Br. — get out");
    expect(ics.split("\r\n").every(l => !l.includes("\n"))).toBe(true);
  });
});
