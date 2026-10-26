// Print before/after day scores for the saved sample days.
// Run after any scoring change: npm run fixtures
import { readFileSync } from "node:fs";
import { scoreDay, fishScore, comfortScore } from "../src/lib/scoring.js";
import { scoreDayV10 } from "./v10-score.mjs";

const days = JSON.parse(readFileSync(new URL("../test/fixtures/days.json", import.meta.url)));
const rows = Object.entries(days).filter(([k]) => !k.startsWith("_")).map(([name, d]) => ({
  day: name, v10: scoreDayV10(d).toFixed(1), v11: scoreDay(d).toFixed(1), fish: fishScore(d).toFixed(1), you: comfortScore(d).toFixed(1),
}));
console.log("| Day | v10 | v11 headline | Fish | You |\n|---|---|---|---|---|");
for (const r of rows) console.log(`| ${r.day} | ${r.v10} | ${r.v11} | ${r.fish} | ${r.you} |`);
