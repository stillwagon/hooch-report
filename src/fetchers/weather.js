// Open-Meteo, one call for all three river sections.
import { WX_POINTS, SECTIONS } from "../data/river.js";

export function weatherUrl() {
  const pts = SECTIONS.map(s => WX_POINTS[s]);
  const q = new URLSearchParams({
    latitude: pts.map(p => p.lat).join(","),
    longitude: pts.map(p => p.lon).join(","),
    current: "temperature_2m,apparent_temperature,precipitation,wind_speed_10m,weather_code,cloud_cover",
    hourly: "temperature_2m,apparent_temperature,precipitation,precipitation_probability,wind_speed_10m,cloud_cover,weather_code",
    daily: "temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_sum,wind_speed_10m_max,weather_code,sunrise,sunset",
    temperature_unit: "fahrenheit", wind_speed_unit: "mph", precipitation_unit: "inch",
    timezone: "America/New_York", forecast_days: "7", past_days: "2",
  });
  return `https://api.open-meteo.com/v1/forecast?${q}`;
}

// Returns { upper, mid, lower } raw responses, or null.
export async function fetchWeather() {
  try {
    const r = await fetch(weatherUrl());
    if (!r.ok) return null;
    const j = await r.json();
    const arr = Array.isArray(j) ? j : [j];
    return Object.fromEntries(SECTIONS.map((s, i) => [s, arr[i] ?? arr[0]]));
  } catch { return null; }
}
