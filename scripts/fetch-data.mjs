// Runs in GitHub Actions before each build (on push and on a schedule).
// Writes static JSON next to the site so the app reads it same-origin, no CORS:
//   public/data/stocking.json   GA DNR weekly stocking PDF, parsed
//   public/data/extras.json     BacteriALERT E. coli estimates (best effort)
//   public/data/probe.json      What the USACE and BacteriALERT pages return to a server
// Every step is optional; a failure leaves the previous deploy's data out and the app
// falls back to its own sources.
import { mkdirSync, writeFileSync } from "node:fs";
import { parseStockingLines } from "../src/lib/stocking.js";
import { pdfToLines } from "../src/lib/pdfLines.js";
import { LINKS } from "../src/data/river.js";

const OUT = new URL("../public/data/", import.meta.url);
mkdirSync(OUT, { recursive: true });
const save = (name, obj) => writeFileSync(new URL(name, OUT), JSON.stringify(obj, null, 1));
const UA = { "User-Agent": "hooch-report (personal fishing app; github.com/stillwagon/hooch-report)" };
const strip = html => html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");

async function stocking() {
  const r = await fetch(LINKS.stockingPdf, { headers: UA });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const lines = await pdfToLines(new Uint8Array(await r.arrayBuffer()));
  const rec = { ...parseStockingLines(lines), fetchedAt: Date.now(), lineCount: lines.length };
  save("stocking.json", rec);
  return `${rec.lineCount} lines, sections: ${rec.secs.join(", ") || "none"}`;
}

// BacteriALERT's page layout is undocumented: parse best effort, and keep an
// excerpt in probe.json so the parser can be fixed against the real page.
async function bacteria(probe) {
  const url = "https://ga.water.usgs.gov/bacteria/";
  const r = await fetch(url, { headers: UA });
  const text = strip(await r.text());
  probe.bacteria = { url, status: r.status, length: text.length, excerpt: text.slice(0, 4000) };
  const stations = { norcross: /norcross|medlock/i, powersFerry: /powers ferry/i, atlanta: /atlanta|paces ferry/i };
  const ecoli = {};
  for (const [k, re] of Object.entries(stations)) {
    const m = re.exec(text); if (!m) continue;
    const e = text.slice(m.index, m.index + 400).match(/(\d[\d,]*)\s*(?:cfu|CFU|colonies|MPN)/);
    if (e) ecoli[k] = +e[1].replace(/,/g, "");
  }
  save("extras.json", { ecoli: Object.keys(ecoli).length ? ecoli : null, at: Date.now() });
  return Object.keys(ecoli).length ? JSON.stringify(ecoli) : "no values parsed (see probe.json)";
}

// Can a server read the USACE generation schedule? Record what comes back.
async function usace(probe) {
  const r = await fetch(LINKS.usace, { headers: UA });
  const html = await r.text();
  const candidates = [...new Set([...html.matchAll(/["'](\/?[\w./-]*(?:api|json|data|schedule|query|rest)[\w./?=&-]*)["']/gi)].map(m => m[1]))].slice(0, 60);
  probe.usace = { url: LINKS.usace, status: r.status, contentType: r.headers.get("content-type"), length: html.length, mentionsBuford: /buford/i.test(html), candidates, excerpt: strip(html).slice(0, 3000) };
  return `HTTP ${r.status}, ${html.length} bytes, mentions Buford: ${probe.usace.mentionsBuford}, ${candidates.length} candidate data URLs`;
}

const probe = { at: Date.now() };
const results = {};
for (const [name, fn] of Object.entries({ stocking, bacteria: () => bacteria(probe), usace: () => usace(probe) })) {
  try { results[name] = await fn(); } catch (e) { results[name] = `FAILED: ${e.message}`; probe[name] ??= { error: String(e) }; }
}
save("probe.json", probe);
const summary = Object.entries(results).map(([k, v]) => `- **${k}**: ${v}`).join("\n");
console.log(summary);
if (process.env.GITHUB_STEP_SUMMARY) writeFileSync(process.env.GITHUB_STEP_SUMMARY, `### Data fetch\n${summary}\n`, { flag: "a" });
