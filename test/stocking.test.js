import { describe, it, expect } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { parseStockingLines } from "../src/lib/stocking.js";
import { pdfToLines } from "../src/lib/pdfLines.js";

const SAMPLE = [
  "Weekly Trout Stocking Report 10/26/2026 - 10/30/2026",
  "County Waterbody Date",
  "Forsyth Chattahoochee River - Buford Dam Tailwater 10/27/2026",
  "White Chattahoochee River - Helen 10/27/2026",
  "Fulton Chattahoochee River - Delayed Harvest (Morgan Falls to Paces Mill) 10/29/2026",
  "Rabun Tallulah River 10/28/2026",
];

describe("stocking parser", () => {
  it("finds tailwater sections and skips the headwaters", () => {
    const r = parseStockingLines(SAMPLE, new Date(2026, 9, 26));
    expect(r.secs.sort()).toEqual(["lower", "upper"]);
    expect(r.stockDates).toEqual({ upper: "Tue", lower: "Thu" });
    expect(r.range).toBe("10/26/2026 – 10/30/2026");
    expect(r.lines).toHaveLength(2);
  });

  it("extracts text from a real (compressed) PDF", async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const page = doc.addPage([612, 792]);
    // Table-like layout: cells drawn separately on the same row.
    SAMPLE.forEach((line, i) => {
      const [first, ...rest] = line.split(" ");
      page.drawText(first, { x: 40, y: 740 - i * 20, size: 10, font });
      page.drawText(rest.join(" "), { x: 120, y: 740 - i * 20, size: 10, font });
    });
    const bytes = await doc.save({ useObjectStreams: true });
    // A raw-byte scan (v10's approach) finds nothing in the compressed stream.
    expect(Buffer.from(bytes).toString("latin1").toLowerCase().includes("morgan falls")).toBe(false);
    const lines = await pdfToLines(bytes);
    const r = parseStockingLines(lines, new Date(2026, 9, 26));
    expect(r.secs.sort()).toEqual(["lower", "upper"]);
  });
});
