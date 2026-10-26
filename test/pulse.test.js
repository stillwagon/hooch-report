import { describe, it, expect } from "vitest";
import { pulseWindows, stateAt, highFraction } from "../src/lib/pulse.js";

const at = (h, m = 0) => new Date(2026, 10, 1, h, m);

describe("pulse windows", () => {
  // 4-hour release, 7:00–11:00, spot 390 min downstream (Jones Br. estimate).
  const w = pulseWindows([{ start: at(7), end: at(11) }], 390);

  it("is high from arrival until generation end + travel time", () => {
    expect(w[0].arrive).toEqual(at(13, 30));
    expect(w[0].recede).toEqual(at(17, 30));
    // v10 bug: 90 minutes after arrival it called this "falling limb — prime time".
    expect(stateAt(w, at(15)).state).toBe("high");
    expect(stateAt(w, at(17, 15)).state).toBe("high");
  });
  it("falling limb starts after the tail passes", () => {
    expect(stateAt(w, at(18)).state).toBe("falling");
    expect(stateAt(w, at(20)).state).toBe("clear");
  });
  it("counts down before arrival", () => {
    const s = stateAt(w, at(12, 45));
    expect(s.state).toBe("incoming");
    expect(s.minsUntil).toBe(45);
  });
  it("treats an ongoing release as high until at least now + lag", () => {
    const now = at(9);
    const ow = pulseWindows([{ start: at(7), end: null }], 50, 50, now);
    expect(ow[0].openEnded).toBe(true);
    expect(ow[0].recede).toEqual(at(10, 5)); // now + 15 min + lag
    expect(stateAt(pulseWindows([{ start: at(7), end: null }], 0, 0, now), now).state).toBe("high");
  });
  it("measures how much of the day is under high water", () => {
    expect(highFraction(w, at(7), at(19))).toBeCloseTo(4 / 12, 3);
  });
});
