// localStorage wrappers. Every access is guarded: private mode or cleared storage
// must never break the app.

const read = (k, fallback) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch { return fallback; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* quota or private mode */ } };

const SCHED = "hooch:schedule:v11";
const CACHE = "hooch:cache:v11";

// Manual dam schedule entries. Entries more than 2 days old are dropped.
export function loadSchedule() {
  const cutoff = Date.now() - 2 * 86400000;
  return read(SCHED, [])
    .map(e => ({ ...e, start: new Date(e.start), end: new Date(e.end) }))
    .filter(e => +e.end > cutoff);
}
export const saveSchedule = list => write(SCHED, list.map(e => ({ id: e.id, start: e.start.toISOString(), end: e.end.toISOString() })));

// Last-known data, shown when the network is weak.
export const loadCache = () => read(CACHE, null);
export const saveCache = c => write(CACHE, c);
