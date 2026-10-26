// Calendar alarm for a pulse arrival. The phone's calendar fires the alert even when
// the browser is suspended, which web timers and GPS cannot do on a locked iPhone.

const stamp = d => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = s => String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

export function buildIcs({ start, end, title, description = "", location = "", alarmMin = 30, uid }) {
  const e = end ?? new Date(+start + 30 * 60000);
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Hooch Report//v11//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid ?? `${stamp(start)}-${Math.random().toString(36).slice(2)}@hooch-report`}`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(e)}`,
    `SUMMARY:${esc(title)}`,
    description && `DESCRIPTION:${esc(description)}`,
    location && `LOCATION:${esc(location)}`,
    "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(title)}`, `TRIGGER:-PT${alarmMin}M`, "END:VALARM",
    "BEGIN:VALARM", "ACTION:AUDIO", `TRIGGER:-PT${alarmMin}M`, "END:VALARM",
    "END:VEVENT", "END:VCALENDAR",
  ].filter(Boolean).join("\r\n") + "\r\n";
}

const hm = d => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

export function pulseAlarmParams(spot, w) {
  return {
    start: w.arrive,
    end: w.recede,
    title: `Pulse at ${spot.name} — get out`,
    description: `Buford release reaches ${spot.name} about ${hm(w.arrive)}. High water until ~${hm(w.recede)}` +
      `${w.openEnded ? " or later (release end unknown)" : ""}. Travel times are estimates; leave margin.`,
    location: `${spot.lat},${spot.lon}`,
    uid: `pulse-${+w.arrive}-${spot.rm}@hooch-report`,
  };
}

// Open the event in the phone's calendar. iOS Safari offers "Add to Calendar" for a
// text/calendar response, so a Worker URL is the most reliable path; data: URL is the fallback.
export function openAlarm(params, workerUrl) {
  if (workerUrl) {
    const q = new URLSearchParams({ start: params.start.toISOString(), end: params.end.toISOString(), title: params.title, desc: params.description, loc: params.location, uid: params.uid });
    window.location.href = `${workerUrl.replace(/\/$/, "")}/alarm.ics?${q}`;
    return;
  }
  const a = document.createElement("a");
  a.href = "data:text/calendar;charset=utf-8," + encodeURIComponent(buildIcs(params));
  a.download = "hooch-pulse.ics";
  document.body.appendChild(a); a.click(); a.remove();
}
