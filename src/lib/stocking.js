// GA DNR weekly stocking report → which tailwater sections were stocked.
// Works on text lines extracted from the PDF (see pdfLines.js), never raw bytes.

const SECTION_KEYS = {
  upper: ["buford dam", "lower pool", "bowman", "highway 20", "hwy 20", "hwy. 20", "settles", "tailwater"],
  mid: ["mcginnis", "abbott", "medlock", "jones bridge", "jones br", "island ford", "holcomb"],
  lower: ["morgan falls", "johnson ferry", "johnson fy", "cochran", "powers", "paces", "delayed harvest", " dh"],
};
// Chattahoochee waters that are not the Buford tailwater.
const EXCLUDE = ["helen", "white county", "white co", "habersham", "wma", "upper chattahoochee", "headwater", "smith creek", "robertstown"];
const COUNTY_FALLBACK = { forsyth: "upper", cobb: "lower" };

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DATE_RE = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/;

function parseDate(m, ref) {
  let y = m[3] ? +m[3] : ref.getFullYear();
  if (y < 100) y += 2000;
  return new Date(y, +m[1] - 1, +m[2]);
}

export function parseStockingLines(lines, ref = new Date()) {
  const text = lines.join("\n");
  const range = text.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})\s*(?:-|–|to|through)\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
  const secs = new Set(), stockDates = {}, matched = [];
  for (const raw of lines) {
    const line = " " + raw.toLowerCase().replace(/\s+/g, " ") + " ";
    if (!line.includes("chattahoochee") && !SECTION_KEYS.lower.slice(0, 5).some(k => line.includes(k))) continue;
    if (EXCLUDE.some(k => line.includes(k))) continue;
    let found = Object.keys(SECTION_KEYS).filter(s => SECTION_KEYS[s].some(k => line.includes(k)));
    if (!found.length) {
      const c = Object.keys(COUNTY_FALLBACK).find(k => line.includes(k));
      if (c) found = [COUNTY_FALLBACK[c]];
    }
    matched.push({ line: raw.trim(), secs: found });
    const dm = raw.match(DATE_RE);
    for (const s of found) {
      secs.add(s);
      if (dm && !stockDates[s]) stockDates[s] = DAY[parseDate(dm, ref).getDay()];
    }
  }
  return { secs: [...secs], stockDates, range: range ? `${range[1]} – ${range[2]}` : null, lines: matched, ok: true };
}
