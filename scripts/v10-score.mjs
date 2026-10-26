// v10's scoreDay, verbatim, for before/after comparison only.
export function scoreDayV10(d) {
  let s = 5; const fm = d.feelsMax;
  if (fm >= 45 && fm <= 62) s += 2; else if (fm >= 38 && fm <= 70) s += 1; else if (fm < 25) s -= 4; else if (fm < 32) s -= 3; else if (fm < 38) s -= 1.5;
  if (d.wind <= 7) s += 2; else if (d.wind <= 10) s += 1; else if (d.wind > 15 && d.wind <= 20) s -= 3; else if (d.wind > 20) s -= 5;
  if (d.cloud >= 60 && d.cloud <= 90 && d.precip < 0.2) s += 1.5;
  if (d.precip > 1) s -= 4; else if (d.precip > 0.5) s -= 3; else if (d.precip > 0.25) s -= 1.5;
  if (d.wx >= 95) s -= 4; else if (d.wx >= 71 && d.wx <= 77) s -= 3; else if (d.wx >= 66 && d.wx <= 67) s -= 3;
  if (d.p24 > 1.5) s -= 3; else if (d.p24 > 0.75) s -= 2; else if (d.p24 > 0.3) s -= 1;
  if (d.p48 > 2.5) s -= 2; else if (d.p48 > 1.5) s -= 1;
  if (fm < 35 && d.wind > 15) s -= 2; if (fm < 32 && d.precip > 0.1) s -= 2;
  if (d.wx >= 66 && d.wx <= 77 && d.wind > 12) s -= 2;
  return Math.max(0, Math.min(10, s));
}
