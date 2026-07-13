export const NANJING = Object.freeze({
  latitude: 32.0603,
  longitude: 118.7969,
  timezone: "Asia/Shanghai",
  name: "Nanjing",
});

export const WMO = Object.freeze({
  0: ["Clear sky", "晴", "clear"],
  1: ["Mainly clear", "大致晴朗", "clear"],
  2: ["Partly cloudy", "局部多云", "cloud"],
  3: ["Overcast", "阴", "cloud"],
  45: ["Fog", "雾", "fog"],
  48: ["Rime fog", "雾凇", "fog"],
  51: ["Light drizzle", "小毛毛雨", "rain"],
  53: ["Drizzle", "毛毛雨", "rain"],
  55: ["Dense drizzle", "强毛毛雨", "rain"],
  56: ["Freezing drizzle", "冻毛毛雨", "rain"],
  57: ["Dense freezing drizzle", "强冻毛毛雨", "rain"],
  61: ["Light rain", "小雨", "rain"],
  63: ["Rain", "中雨", "rain"],
  65: ["Heavy rain", "大雨", "rain"],
  66: ["Freezing rain", "冻雨", "rain"],
  67: ["Heavy freezing rain", "强冻雨", "rain"],
  71: ["Light snow", "小雪", "snow"],
  73: ["Snow", "中雪", "snow"],
  75: ["Heavy snow", "大雪", "snow"],
  77: ["Snow grains", "米雪", "snow"],
  80: ["Light showers", "小阵雨", "rain"],
  81: ["Showers", "阵雨", "rain"],
  82: ["Heavy showers", "强阵雨", "rain"],
  85: ["Snow showers", "阵雪", "snow"],
  86: ["Heavy snow showers", "强阵雪", "snow"],
  95: ["Thunderstorm", "雷暴", "storm"],
  96: ["Storm with hail", "雷暴伴冰雹", "storm"],
  99: ["Severe hailstorm", "强雷暴伴冰雹", "storm"],
});

export function weatherInfo(code = 0) {
  const [label, cn, kind] = WMO[Number(code)] || ["Changeable", "天气多变", "cloud"];
  return { label, cn, kind };
}

export function toFahrenheit(celsius) {
  return (Number(celsius) * 9) / 5 + 32;
}

export function displayTemperature(value, unit = "c") {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "--°";
  const converted = unit === "f" ? toFahrenheit(value) : Number(value);
  return `${Math.round(converted)}°`;
}

export function windDirection(degrees) {
  if (degrees === null || degrees === undefined || Number.isNaN(Number(degrees))) return "—";
  const points = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return points[Math.round(Number(degrees) / 45) % 8];
}

export function aqiInfo(value) {
  const aqi = Number(value);
  if (Number.isNaN(aqi)) return { label: "Unavailable", tone: "unknown", guidance: "Air-quality data is temporarily unavailable." };
  if (aqi <= 50) return { label: "Good", tone: "good", guidance: "Air is inviting. A long walk is a good idea." };
  if (aqi <= 100) return { label: "Moderate", tone: "moderate", guidance: "Most people can enjoy the outdoors as usual." };
  if (aqi <= 150) return { label: "Sensitive", tone: "sensitive", guidance: "Sensitive groups may prefer a gentler outdoor pace." };
  if (aqi <= 200) return { label: "Unhealthy", tone: "unhealthy", guidance: "Keep outdoor activity brief and choose indoor plans." };
  if (aqi <= 300) return { label: "Very unhealthy", tone: "very-unhealthy", guidance: "Avoid strenuous outdoor activity today." };
  return { label: "Hazardous", tone: "hazardous", guidance: "Stay indoors and keep windows closed where possible." };
}

export function uvInfo(value) {
  const uv = Number(value);
  if (Number.isNaN(uv)) return "Unavailable";
  if (uv < 3) return "Low — gentle light";
  if (uv < 6) return "Moderate — use protection";
  if (uv < 8) return "High — seek midday shade";
  if (uv < 11) return "Very high — limit exposure";
  return "Extreme — avoid midday sun";
}

export function visibilityInfo(metres) {
  const km = Number(metres) / 1000;
  if (!Number.isFinite(km)) return "Unavailable";
  if (km >= 20) return "Crisp long-distance views";
  if (km >= 10) return "Clear across the city";
  if (km >= 5) return "Softened urban horizon";
  return "Haze or fog nearby";
}

export function buildWeatherStory(current, today, unit = "c") {
  if (!current) return "A live portrait of weather moving across Nanjing.";
  const { kind } = weatherInfo(current.weather_code);
  const hour = new Date(`${current.time}:00+08:00`).getUTCHours();
  const phase = current.is_day ? (hour < 4 ? "morning" : hour < 10 ? "afternoon" : "evening") : "night";
  const starts = {
    clear: `A bright ${phase} settles over the city walls`,
    cloud: `Cloud layers soften Nanjing’s ${phase} light`,
    fog: `A veil of mist is resting over the city`,
    rain: `Rain is tracing the tiled roofs and plane trees`,
    storm: `Charged skies are moving across the Yangtze`,
    snow: `Snow is quieting the streets of Nanjing`,
  };
  const wind = Number(current.wind_speed_10m) >= 25
    ? ", with a brisk wind in the streets."
    : Number(current.wind_speed_10m) >= 12
      ? ", carried by a light urban breeze."
      : ", with barely a stir in the air.";
  const range = today
    ? ` Today moves between ${displayTemperature(today.min, unit)} and ${displayTemperature(today.max, unit)}.`
    : "";
  return `${starts[kind] || starts.cloud}${wind}${range}`;
}

export function activityScore(type, weather, air) {
  const temp = Number(weather?.current?.temperature_2m ?? 22);
  const rain = Number(weather?.daily?.precipitation_probability_max?.[0] ?? 0);
  const wind = Number(weather?.current?.wind_speed_10m ?? 0);
  const code = Number(weather?.current?.weather_code ?? 0);
  const aqi = Number(air?.current?.us_aqi ?? 50);
  const outdoors = Math.max(0, 100 - Math.max(0, Math.abs(temp - 22) * 4) - rain * 0.45 - Math.max(0, wind - 18) * 1.5 - Math.max(0, aqi - 50) * 0.4);
  const stormPenalty = code >= 95 ? 45 : 0;

  const scores = {
    mountain: outdoors - stormPenalty - (wind > 28 ? 15 : 0),
    lake: outdoors - stormPenalty - (rain > 55 ? 10 : 0),
    night: outdoors + (temp > 27 ? 8 : 0) - stormPenalty,
    museum: 58 + rain * 0.35 + Math.max(0, temp - 30) * 2 + Math.max(0, aqi - 100) * 0.25,
  };
  return Math.round(Math.min(99, Math.max(22, scores[type] ?? outdoors)));
}

export function weekInsight(daily, unit = "c") {
  if (!daily?.time?.length) return "The weekly signal is not available yet.";
  const rainDays = daily.precipitation_probability_max.filter((v) => Number(v) >= 50).length;
  const avgHigh = daily.temperature_2m_max.reduce((a, b) => a + Number(b), 0) / daily.temperature_2m_max.length;
  const trend = Number(daily.temperature_2m_max.at(-1)) - Number(daily.temperature_2m_max[0]);
  if (rainDays >= 4) return `A water-led week: rain is favored on ${rainDays} days, with humid intervals between showers.`;
  if (avgHigh >= 32) return `Heat is the headline. Highs average ${displayTemperature(avgHigh, unit)}, making mornings and evenings the softer windows.`;
  if (trend >= 4) return `A warming arc builds through the week, gaining about ${Math.round(trend)}° from start to finish.`;
  if (trend <= -4) return `A cooler current arrives through the week, easing highs by about ${Math.abs(Math.round(trend))}°.`;
  return `A relatively steady week, with ${rainDays || "few"} rain-favored day${rainDays === 1 ? "" : "s"} and a gentle temperature range.`;
}

export function weatherGlyph(kind, isDay = true) {
  const sun = `<circle class="glyph-sun" cx="50" cy="48" r="17"/><g class="glyph-rays"><path d="M50 19v-8M50 85v-8M21 48h-8M87 48h-8M29 27l-6-6M77 75l-6-6M71 27l6-6M23 75l6-6"/></g>`;
  const moon = `<path class="glyph-moon" d="M65 25a27 27 0 1 0 10 48A31 31 0 0 1 65 25Z"/>`;
  const cloud = `<path class="glyph-cloud" d="M25 67h51a14 14 0 0 0 1-28 22 22 0 0 0-41-4 16 16 0 0 0-11 32Z"/>`;
  const drops = `<g class="glyph-drops"><path d="m35 76-5 11M53 76l-5 11M71 76l-5 11"/></g>`;
  const snow = `<g class="glyph-drops"><path d="M34 79v9m-4-5h8M53 79v9m-4-5h8M72 79v9m-4-5h8"/></g>`;
  const storm = `<path class="glyph-bolt" d="m54 70-9 16h9l-4 13 16-20h-9l6-9Z"/>`;
  const fog = `<g class="glyph-fog"><path d="M22 62h56M28 73h45M35 84h34"/></g>`;
  const parts = {
    clear: isDay ? sun : moon,
    cloud: `${isDay ? sun : moon}${cloud}`,
    rain: `${cloud}${drops}`,
    snow: `${cloud}${snow}`,
    storm: `${cloud}${storm}`,
    fog,
  };
  return `<svg viewBox="0 0 100 105" aria-hidden="true">${parts[kind] || parts.cloud}</svg>`;
}

export function makeWeatherUrl() {
  const params = new URLSearchParams({
    latitude: String(NANJING.latitude),
    longitude: String(NANJING.longitude),
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m",
    hourly: "temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,relative_humidity_2m,wind_speed_10m,cloud_cover,visibility",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,sunrise,sunset,daylight_duration,sunshine_duration,uv_index_max,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant",
    timezone: NANJING.timezone,
    forecast_days: "7",
  });
  return `https://api.open-meteo.com/v1/forecast?${params}`;
}

export function makeAirUrl() {
  const params = new URLSearchParams({
    latitude: String(NANJING.latitude),
    longitude: String(NANJING.longitude),
    current: "us_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,uv_index",
    hourly: "us_aqi,pm10,pm2_5,uv_index",
    timezone: NANJING.timezone,
    forecast_days: "5",
  });
  return `https://air-quality-api.open-meteo.com/v1/air-quality?${params}`;
}
