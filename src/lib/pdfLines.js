// Real PDF text extraction (handles compressed streams), grouped into visual lines.
// Shared by the browser fallback and the Cloudflare Worker.
import { getDocumentProxy } from "unpdf";

export async function pdfToLines(bytes) {
  const pdf = await getDocumentProxy(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
  const lines = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const { items } = await page.getTextContent();
    const rows = new Map();
    for (const it of items) {
      if (!it.str?.trim()) continue;
      const y = Math.round(it.transform[5] / 3) * 3; // tolerate small baseline jitter
      if (!rows.has(y)) rows.set(y, []);
      rows.get(y).push({ x: it.transform[4], s: it.str });
    }
    [...rows.entries()].sort((a, b) => b[0] - a[0]).forEach(([, r]) =>
      lines.push(r.sort((a, b) => a.x - b.x).map(c => c.s.trim()).join(" ")));
  }
  return lines;
}
