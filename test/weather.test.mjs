import test from "node:test";
import assert from "node:assert/strict";
import {
  activityScore,
  aqiInfo,
  displayTemperature,
  makeAirUrl,
  makeWeatherUrl,
  weatherInfo,
  weekInsight,
  windDirection,
} from "../weather.js";

test("temperature display converts Celsius to Fahrenheit", () => {
  assert.equal(displayTemperature(20, "c"), "20°");
  assert.equal(displayTemperature(20, "f"), "68°");
});

test("weather and wind codes have human-readable labels", () => {
  assert.deepEqual(weatherInfo(95), { label: "Thunderstorm", cn: "雷暴", kind: "storm" });
  assert.equal(weatherInfo(999).kind, "cloud");
  assert.equal(windDirection(225), "SW");
});

test("AQI thresholds map to useful health bands", () => {
  assert.equal(aqiInfo(50).label, "Good");
  assert.equal(aqiInfo(51).label, "Moderate");
  assert.equal(aqiInfo(151).label, "Unhealthy");
});

test("API URLs request Nanjing live, hourly, and daily data", () => {
  const weather = new URL(makeWeatherUrl());
  const air = new URL(makeAirUrl());
  assert.equal(weather.hostname, "api.open-meteo.com");
  assert.equal(weather.searchParams.get("timezone"), "Asia/Shanghai");
  assert.match(weather.searchParams.get("current"), /temperature_2m/);
  assert.match(weather.searchParams.get("hourly"), /precipitation_probability/);
  assert.match(weather.searchParams.get("daily"), /sunrise/);
  assert.equal(air.hostname, "air-quality-api.open-meteo.com");
  assert.match(air.searchParams.get("current"), /us_aqi/);
});

test("activity scores respond to severe conditions", () => {
  const pleasant = { current: { temperature_2m: 22, wind_speed_10m: 5, weather_code: 0 }, daily: { precipitation_probability_max: [0] } };
  const storm = { current: { temperature_2m: 36, wind_speed_10m: 40, weather_code: 95 }, daily: { precipitation_probability_max: [100] } };
  const air = { current: { us_aqi: 40 } };
  assert.ok(activityScore("mountain", pleasant, air) > activityScore("mountain", storm, air));
});

test("week insight detects rain-led weeks", () => {
  const message = weekInsight({
    time: ["2026-07-13", "2026-07-14", "2026-07-15", "2026-07-16", "2026-07-17", "2026-07-18", "2026-07-19"],
    precipitation_probability_max: [80, 70, 60, 55, 20, 10, 5],
    temperature_2m_max: [30, 29, 31, 30, 32, 31, 30],
  });
  assert.match(message, /water-led week/i);
});
