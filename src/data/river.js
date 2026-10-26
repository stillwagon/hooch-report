// River model: gauges, access points, weather points.
// Values marked "estimate" have not been verified against measured data.
// Run `npm run calibrate` (or the Calibrate workflow) to measure pulse lags.

// USGS gauges. `lag` = default minutes for a Buford release to reach the gauge (estimate,
// replaced by src/data/travel.js once calibrated). `rm` = approximate NPS river mile.
export const GAUGES = {
  bufordDam:   { id: "02334430", name: "Buford Dam",   rm: 348.3, lag: 0,   params: ["00060", "00010"] },
  norcross:    { id: "02335000", name: "Norcross",     rm: 331,   lag: 330, params: ["00060", "00010", "63680"] },
  powersFerry: { id: "02335880", name: "Powers Ferry", rm: 305.5, lag: 750, params: ["00060", "00010", "63680"] },
  atlanta:     { id: "02336000", name: "Atlanta",      rm: 302.5, lag: 765, params: ["00060", "00010", "63680"] },
};

export const PARAM = { discharge: "00060", temp: "00010", turbidity: "63680" };

// Drive times from home (Dunwoody), typical off-peak via GA-400 / I-285, in minutes.
// Static on purpose: home is fixed. "Directions" opens Maps for live traffic.
// pulse = estimated minutes from Buford release to arrival (unverified estimate).
export const SPOTS = [
  { name:"Buford Dam",   rm:349, pulse:0,   drive:38, sec:"upper", lat:34.158, lon:-84.077, q:7, reg:"PFD mandatory.", note:"Cold tailwater ~52°F. Midge larvae/pupae dominate." },
  { name:"Bowmans Is.",  rm:348, pulse:20,  drive:38, sec:"upper", lat:34.148, lon:-84.083, q:8, reg:"PFD mandatory above Hwy 20.", note:"Best wading near dam. Gravel bars. Streamer water after cold snaps." },
  { name:"Hwy 20",       rm:346, pulse:50,  drive:36, sec:"upper", lat:34.125, lon:-84.097, q:9, reg:"Artificial lures only upstream to Medlock Br.", note:"Best hatch activity. Euro nymphing productive. Highest insect diversity." },
  { name:"Settles Br.",  rm:344, pulse:100, drive:32, sec:"upper", lat:34.098, lon:-84.110, q:8, reg:"NPS pass required.", note:"Wider, gentler. Pocket water and deep runs. Wild browns + stocked rainbows." },
  { name:"McGinnis",     rm:340, pulse:180, drive:28, sec:"mid",   lat:34.052, lon:-84.098, q:5, reg:"NPS pass required.", note:"Suwanee Creek inflows. Steep banks. Better as float." },
  { name:"Abbotts Br.",  rm:335, pulse:270, drive:25, sec:"mid",   lat:34.025, lon:-84.172, q:6, reg:"Artificial lures only. NPS pass.", note:"Calm, slow water. Good float fishing." },
  { name:"Medlock Br.",  rm:331, pulse:330, drive:20, sec:"mid",   lat:33.996, lon:-84.202, q:6, reg:"Artificial only above; general below.", note:"Southern boundary of artificial section." },
  { name:"Jones Br.",    rm:328, pulse:390, drive:18, sec:"mid",   lat:34.001, lon:-84.235, q:8, reg:"NPS pass ($5/day or $40/yr).", note:"Island shoals — great wading. Crowded weekends. Good dry fly water." },
  { name:"Island Ford",  rm:320, pulse:510, drive:13, sec:"mid",   lat:33.973, lon:-84.264, q:6, reg:"NPS pass required.", note:"NPS HQ. Shallow shoals. Often stained. Indicator nymphing best." },
  { name:"Morgan Falls", rm:313, pulse:720, drive:10, sec:"lower", lat:33.965, lon:-84.382, q:7, reg:"DH Nov 1–May 14: C&R, single-hook artificial.", note:"Morgan Falls is run-of-river; Buford pulse arrives ~12hr after release. Monthly DH stocking." },
  { name:"Johnson Fy.",  rm:311, pulse:730, drive:11, sec:"lower", lat:33.945, lon:-84.404, q:5, reg:"DH regs in designated section.", note:"First access below Morgan Falls." },
  { name:"Powers Is.",   rm:307, pulse:745, drive:13, sec:"lower", lat:33.904, lon:-84.442, q:6, reg:"DH: C&R Nov 1–May 14.", note:"DH section." },
  { name:"Paces Mill",   rm:304, pulse:755, drive:18, sec:"lower", lat:33.870, lon:-84.452, q:4, reg:"NPS pass required.", note:"Last CRNRA takeout." },
];

export const SECTIONS = ["upper", "mid", "lower"];
export const SECTION_LABEL = { upper: "Upper", mid: "Mid", lower: "Lower" };

// One Open-Meteo point per section, near the water.
export const WX_POINTS = {
  upper: { lat: 34.125, lon: -84.097 }, // Hwy 20
  mid:   { lat: 34.001, lon: -84.235 }, // Jones Br.
  lower: { lat: 33.920, lon: -84.430 }, // Powers Is.
};

export const LINKS = {
  usace: "https://spatialdata.usace.army.mil/hydropower/",
  stockingPdf: "https://georgiawildlife.com/sites/default/files/wrd/pdf/trout/Weekly_Stocking_Report.pdf",
  bacteriAlert: "https://www.usgs.gov/centers/south-atlantic-water-science-center/science/bacterialert",
  damPhone: "770-945-1466",
};

export const directionsUrl = sp => `https://maps.apple.com/?daddr=${sp.lat},${sp.lon}&dirflg=d`;

export function isDelayedHarvest(date) {
  const m = date.getMonth() + 1, d = date.getDate();
  return m >= 11 || m <= 4 || (m === 5 && d <= 14);
}
