// Release pulse at a spot.
// High water lasts from (release start + lag) until (release end + tail lag).
// The falling limb follows for FALLING_MIN, then the spot is back at base.
import { MIN } from "./series.js";

export const FALLING_MIN = 120;

// events: [{ start: Date, end: Date|null }]. end null = still releasing, end unknown.
export function pulseWindows(events, lagMin, tailLagMin = lagMin, now = new Date()) {
  return events.map(e => {
    const arrive = new Date(+e.start + lagMin * MIN);
    const openEnded = !e.end;
    // Unknown end: still releasing, so water stays high at least until
    // "now + tail lag" (plus one gauge interval, so it never reads as receding).
    const endRef = e.end ? +e.end : Math.max(+now + 15 * MIN, +e.start);
    const recede = new Date(endRef + tailLagMin * MIN);
    return { arrive, recede, fallingEnd: new Date(+recede + FALLING_MIN * MIN), openEnded, event: e };
  }).sort((a, b) => a.arrive - b.arrive);
}

// State at time t: high | falling | incoming | clear.
export function stateAt(windows, t = new Date()) {
  const high = windows.find(w => t >= w.arrive && t < w.recede);
  if (high) return { state: "high", window: high };
  const next = windows.find(w => w.arrive > t);
  const falling = windows.find(w => t >= w.recede && t < w.fallingEnd);
  if (falling && !(next && next.arrive - t < 30 * MIN)) return { state: "falling", window: falling, next };
  if (next) return { state: "incoming", window: next, minsUntil: Math.round((next.arrive - t) / MIN) };
  return { state: "clear" };
}

// Fraction of [from, to] spent under high water.
export function highFraction(windows, from, to) {
  const span = to - from;
  if (span <= 0) return 0;
  let covered = 0;
  for (const w of windows) {
    const a = Math.max(+from, +w.arrive), b = Math.min(+to, +w.recede);
    if (b > a) covered += b - a;
  }
  return Math.min(1, covered / span);
}
