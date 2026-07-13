import {
  activityScore,
  aqiInfo,
  buildWeatherStory,
  displayTemperature,
  makeAirUrl,
  makeWeatherUrl,
  uvInfo,
  visibilityInfo,
  weatherGlyph,
  weatherInfo,
  weekInsight,
  windDirection,
} from "./weather.js";

const REFRESH_MS = 10 * 60 * 1000;
const CACHE_KEY = "nanjing-atmosphere:last-good-reading:v1";

const state = {
  weather: null,
  air: null,
  unit: localStorage.getItem("nanjing-weather-unit") || "c",
  updatedAt: null,
  refreshAt: Date.now() + REFRESH_MS,
  source: "live",
  selectedHour: 0,
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const setText = (selector, value) => {
  const element = $(selector);
  if (element) element.textContent = value;
};
const icon = (id) => `<svg aria-hidden="true"><use href="#${id}"></use></svg>`;

function currentHourIndex() {
  if (!state.weather?.hourly?.time) return 0;
  const now = state.weather.current?.time;
  const exact = state.weather.hourly.time.indexOf(now);
  if (exact >= 0) return exact;
  const nowMs = Date.parse(`${now}:00+08:00`);
  return Math.max(0, state.weather.hourly.time.findIndex((time) => Date.parse(`${time}:00+08:00`) >= nowMs));
}

function formatHour(iso) {
  const date = new Date(`${iso}:00+08:00`);
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: true, timeZone: "Asia/Shanghai" })
    .format(date)
    .replace(" ", "");
}

function formatDay(iso, options = {}) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: options.long ? "long" : "short",
    month: options.month ? "short" : undefined,
    day: options.month ? "numeric" : undefined,
    timeZone: "Asia/Shanghai",
  }).format(new Date(`${iso}T12:00:00+08:00`));
}

function timeOnly(iso) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Shanghai",
  }).format(new Date(`${iso}:00+08:00`));
}

function fetchWithTimeout(url, timeout = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  return fetch(url, { signal: controller.signal })
    .then((response) => {
      if (!response.ok) throw new Error(`Weather service responded ${response.status}`);
      return response.json();
    })
    .finally(() => clearTimeout(timer));
}

async function loadWeather({ announce = false } = {}) {
  setLoading(true);
  setPipelineStatus("loading");
  try {
    const [weather, air] = await Promise.all([
      fetchWithTimeout(makeWeatherUrl()),
      fetchWithTimeout(makeAirUrl()),
    ]);
    if (!weather.current || !weather.hourly || !weather.daily) throw new Error("Incomplete weather data");
    state.weather = weather;
    state.air = air;
    state.updatedAt = new Date();
    state.refreshAt = Date.now() + REFRESH_MS;
    state.source = "live";
    localStorage.setItem(CACHE_KEY, JSON.stringify({ weather, air, updatedAt: state.updatedAt.toISOString() }));
    render();
    setConnection(true);
    setPipelineStatus("ready");
    if (announce) showToast("The Nanjing sky is up to date");
  } catch (error) {
    const cached = readCache();
    if (cached) {
      state.weather = cached.weather;
      state.air = cached.air;
      state.updatedAt = new Date(cached.updatedAt);
      state.source = "cache";
      render();
      setConnection(false, "Saved reading");
      setPipelineStatus("cached");
      showToast("Network unavailable — showing the last good reading");
    } else {
      showError(error);
      setConnection(false, "Data unavailable");
      setPipelineStatus("error");
    }
  } finally {
    setLoading(false);
  }
}

function readCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY));
  } catch {
    return null;
  }
}

function setLoading(loading) {
  $("#refresh-button")?.classList.toggle("is-spinning", loading);
  $("#refresh-cta")?.classList.toggle("is-loading", loading);
  const loadingScreen = $("#loading-screen");
  if (loading && !state.weather) loadingScreen?.classList.remove("is-hidden");
  if (!loading) loadingScreen?.classList.add("is-hidden");
}

function showError(error) {
  setText("#condition-label", "The sky is out of reach");
  setText("#condition-cn", "暂时无法连接");
  setText("#weather-story", "We could not reach the live weather feed. Check the connection and refresh the sky.");
  showToast(error?.message || "Unable to load live weather");
}

function setConnection(online, label) {
  const pill = $("#connection-pill");
  pill?.classList.toggle("is-offline", !online);
  setText("#connection-label", label || (online ? "Live data" : "Offline"));
}

function setPipelineStatus(status) {
  const statuses = ["weather-node-status", "air-node-status", "story-node-status"];
  statuses.forEach((id, index) => {
    const element = $(`#${id}`);
    element.className = "node-status";
    if (status === "loading") element.classList.add("is-loading");
    if (status === "ready") element.classList.add("is-ready");
    if (status === "cached") element.classList.add(index < 2 ? "is-cached" : "is-ready");
    if (status === "error") element.classList.add("is-error");
  });
}

function render() {
  renderCurrent();
  renderHourly();
  renderWeek();
  renderAtmosphere();
  renderCityPlans();
  updateUnitButtons();
  renderFreshness();
}

function renderCurrent() {
  const { current, daily } = state.weather;
  const info = weatherInfo(current.weather_code);
  const today = { min: daily.temperature_2m_min[0], max: daily.temperature_2m_max[0] };
  const sky = current.is_day ? `${info.kind}-day` : `${info.kind}-night`;
  document.body.dataset.sky = sky;
  document.title = `${displayTemperature(current.temperature_2m, state.unit)} ${info.label} — Nanjing Atmosphere`;

  setText("#hero-temperature", displayTemperature(current.temperature_2m, state.unit));
  setText("#condition-label", info.label);
  setText("#condition-cn", info.cn);
  setText("#weather-story", buildWeatherStory(current, today, state.unit));
  setText("#feels-like", displayTemperature(current.apparent_temperature, state.unit));
  setText("#humidity", `${Math.round(current.relative_humidity_2m)}%`);
  setText("#wind", `${Math.round(current.wind_speed_10m)} km/h`);
  setText("#rain-now", `${Number(current.precipitation).toFixed(1)} mm`);
  setText("#today-range", `${displayTemperature(today.max, state.unit)} / ${displayTemperature(today.min, state.unit)}`);
  $("#weather-glyph").innerHTML = weatherGlyph(info.kind, Boolean(current.is_day));
  $("#weather-orbit").style.setProperty("--humidity", `${current.relative_humidity_2m * 3.6}deg`);
  renderRain(info.kind);
}

function renderRain(kind) {
  const field = $("#rain-field");
  if (!field || field.dataset.kind === kind) return;
  field.dataset.kind = kind;
  field.innerHTML = "";
  if (!["rain", "storm", "snow"].includes(kind)) return;
  const count = kind === "storm" ? 60 : 34;
  for (let i = 0; i < count; i += 1) {
    const drop = document.createElement("i");
    drop.style.setProperty("--x", `${Math.random() * 100}%`);
    drop.style.setProperty("--delay", `${Math.random() * -4}s`);
    drop.style.setProperty("--duration", `${0.8 + Math.random() * 1.2}s`);
    if (kind === "snow") drop.classList.add("snowflake");
    field.append(drop);
  }
}

function next24Hours() {
  const start = currentHourIndex();
  const { hourly } = state.weather;
  return hourly.time.slice(start, start + 24).map((time, offset) => {
    const i = start + offset;
    return {
      time,
      temp: hourly.temperature_2m[i],
      feels: hourly.apparent_temperature[i],
      rain: hourly.precipitation_probability[i] ?? 0,
      amount: hourly.precipitation[i] ?? 0,
      code: hourly.weather_code[i],
      humidity: hourly.relative_humidity_2m[i],
      wind: hourly.wind_speed_10m[i],
      visibility: hourly.visibility[i],
    };
  });
}

function renderHourly() {
  const hours = next24Hours();
  if (!hours.length) return;
  state.selectedHour = Math.min(state.selectedHour, hours.length - 1);
  const min = Math.min(...hours.map((h) => h.temp));
  const max = Math.max(...hours.map((h) => h.temp));
  const width = 1000;
  const height = 280;
  const padX = 36;
  const padY = 48;
  const chartH = height - padY * 2;
  const x = (i) => padX + (i / (hours.length - 1)) * (width - padX * 2);
  const y = (temp) => padY + ((max + 2 - temp) / (max - min + 4)) * chartH;
  const points = hours.map((h, i) => [x(i), y(h.temp)]);
  const path = points.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`).join(" ");
  const area = `${path} L${x(hours.length - 1)},${height - 30} L${x(0)},${height - 30} Z`;
  const grid = [0, 1, 2, 3].map((i) => `<line x1="${padX}" x2="${width - padX}" y1="${padY + (chartH / 3) * i}" y2="${padY + (chartH / 3) * i}" />`).join("");
  const bars = hours.map((h, i) => {
    const barH = Math.max(2, (h.rain / 100) * 54);
    return `<rect class="rain-bar" x="${x(i) - 5}" y="${height - 30 - barH}" width="10" height="${barH}" rx="5" />`;
  }).join("");
  const dots = hours.map((h, i) => `<circle class="temp-dot ${i === state.selectedHour ? "is-selected" : ""}" data-hour="${i}" cx="${x(i)}" cy="${y(h.temp)}" r="${i === state.selectedHour ? 7 : 4}" />`).join("");
  const labels = hours.map((h, i) => i % 3 === 0 ? `<text x="${x(i)}" y="${height - 4}" text-anchor="middle">${i === 0 ? "NOW" : formatHour(h.time)}</text>` : "").join("");

  $("#temperature-chart").innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
      <g class="chart-grid">${grid}</g>
      <path class="temp-area" d="${area}" />
      <g class="rain-bars">${bars}</g>
      <path class="temp-line-shadow" d="${path}" />
      <path class="temp-line" d="${path}" />
      <g class="temp-dots">${dots}</g>
      <g class="chart-labels">${labels}</g>
    </svg>`;

  $("#temperature-chart").onclick = (event) => {
    const dot = event.target.closest("[data-hour]");
    if (dot) selectHour(Number(dot.dataset.hour));
  };

  $("#hour-strip").innerHTML = hours.map((hour, i) => {
    const info = weatherInfo(hour.code);
    return `
      <button class="hour-item ${i === state.selectedHour ? "is-active" : ""}" data-hour="${i}" aria-label="${formatHour(hour.time)}, ${info.label}, ${displayTemperature(hour.temp, state.unit)}">
        <span>${i === 0 ? "Now" : formatHour(hour.time)}</span>
        <span class="mini-glyph">${weatherGlyph(info.kind, Number(hour.time.slice(11, 13)) > 5 && Number(hour.time.slice(11, 13)) < 19)}</span>
        <strong>${displayTemperature(hour.temp, state.unit)}</strong>
        <small>${Math.round(hour.rain)}% rain</small>
      </button>`;
  }).join("");
  $$(".hour-item").forEach((button) => button.addEventListener("click", () => selectHour(Number(button.dataset.hour))));
  updateHourSelection(hours[state.selectedHour]);

  const warmest = hours.reduce((best, hour) => hour.temp > best.temp ? hour : best, hours[0]);
  const wettest = hours.reduce((best, hour) => hour.rain > best.rain ? hour : best, hours[0]);
  setText("#rhythm-summary", `Warmest near ${formatHour(warmest.time)} at ${displayTemperature(warmest.temp, state.unit)}. Rain peaks around ${formatHour(wettest.time)} at ${Math.round(wettest.rain)}%.`);
}

function selectHour(index) {
  state.selectedHour = index;
  $$(".hour-item").forEach((item) => item.classList.toggle("is-active", Number(item.dataset.hour) === index));
  $$(".temp-dot").forEach((dot) => {
    const selected = Number(dot.dataset.hour) === index;
    dot.classList.toggle("is-selected", selected);
    dot.setAttribute("r", selected ? "7" : "4");
  });
  updateHourSelection(next24Hours()[index]);
  $(`.hour-item[data-hour="${index}"]`)?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
}

function updateHourSelection(hour) {
  if (!hour) return;
  setText("#chart-selection", `${formatHour(hour.time)} · ${displayTemperature(hour.temp, state.unit)} · ${Math.round(hour.rain)}% rain · ${Math.round(hour.wind)} km/h wind`);
}

function renderWeek() {
  const { daily } = state.weather;
  const maxOfWeek = Math.max(...daily.temperature_2m_max);
  const minOfWeek = Math.min(...daily.temperature_2m_min);
  $("#forecast-deck").innerHTML = daily.time.map((date, i) => {
    const info = weatherInfo(daily.weather_code[i]);
    const high = daily.temperature_2m_max[i];
    const low = daily.temperature_2m_min[i];
    const left = ((low - minOfWeek) / (maxOfWeek - minOfWeek || 1)) * 45;
    const span = Math.max(18, ((high - low) / (maxOfWeek - minOfWeek || 1)) * 55);
    return `
      <button class="day-card" data-day="${i}" style="--delay:${i * 45}ms" aria-label="Open details for ${formatDay(date, { long: true })}">
        <span class="day-name">${i === 0 ? "Today" : formatDay(date)}</span>
        <span class="day-date">${Number(date.slice(8, 10))}</span>
        <span class="day-glyph">${weatherGlyph(info.kind, true)}</span>
        <span class="day-condition">${info.label}</span>
        <span class="day-temps"><strong>${displayTemperature(high, state.unit)}</strong><small>${displayTemperature(low, state.unit)}</small></span>
        <span class="range-track"><i style="left:${left}%;width:${span}%"></i></span>
        <span class="day-rain">${icon("icon-drop")} ${Math.round(daily.precipitation_probability_max[i])}%</span>
      </button>`;
  }).join("");
  $$(".day-card").forEach((card) => card.addEventListener("click", () => openDay(Number(card.dataset.day))));
  setText("#week-insight", weekInsight(daily, state.unit));
  setText("#week-range", `${displayTemperature(maxOfWeek, state.unit)} / ${displayTemperature(minOfWeek, state.unit)}`);
}

function openDay(index) {
  const { daily } = state.weather;
  const info = weatherInfo(daily.weather_code[index]);
  const sunHours = daily.sunshine_duration[index] / 3600;
  $("#day-dialog-content").innerHTML = `
    <span class="eyebrow">${formatDay(daily.time[index], { long: true, month: true })} · ${info.cn}</span>
    <div class="dialog-title-row">
      <div>
        <h2>${info.label}</h2>
        <p>${displayTemperature(daily.temperature_2m_max[index], state.unit)} high · ${displayTemperature(daily.temperature_2m_min[index], state.unit)} low</p>
      </div>
      <div class="dialog-glyph">${weatherGlyph(info.kind, true)}</div>
    </div>
    <div class="dialog-metrics">
      <div><span>Rain chance</span><strong>${Math.round(daily.precipitation_probability_max[index])}%</strong></div>
      <div><span>Rain total</span><strong>${Number(daily.precipitation_sum[index]).toFixed(1)} mm</strong></div>
      <div><span>Maximum UV</span><strong>${Number(daily.uv_index_max[index]).toFixed(1)}</strong></div>
      <div><span>Max wind</span><strong>${Math.round(daily.wind_speed_10m_max[index])} km/h</strong></div>
    </div>
    <div class="sun-track">
      <span>Sunrise ${timeOnly(daily.sunrise[index])}</span>
      <i><b style="width:${Math.min(100, (sunHours / 14) * 100)}%"></b></i>
      <span>Sunset ${timeOnly(daily.sunset[index])}</span>
    </div>
    <p class="dialog-note">${sunHours.toFixed(1)} forecast sunshine hours · dominant wind ${windDirection(daily.wind_direction_10m_dominant[index])}</p>`;
  $("#day-dialog").showModal();
}

function renderAtmosphere() {
  const air = state.air?.current || {};
  const weather = state.weather;
  const currentIndex = currentHourIndex();
  const visibility = weather.hourly.visibility[currentIndex];
  const uv = air.uv_index ?? weather.daily.uv_index_max[0];
  const aqi = aqiInfo(air.us_aqi);
  setText("#aqi-value", Number.isFinite(Number(air.us_aqi)) ? Math.round(air.us_aqi) : "--");
  setText("#aqi-label", aqi.label);
  setText("#air-guidance", aqi.guidance);
  $("#air-orb").dataset.aqi = aqi.tone;
  setText("#visibility", `${(visibility / 1000).toFixed(1)} km`);
  setText("#visibility-note", visibilityInfo(visibility));
  setText("#uv-index", Number(uv).toFixed(1));
  setText("#uv-note", uvInfo(uv));
  setText("#pm25", Number.isFinite(Number(air.pm2_5)) ? Number(air.pm2_5).toFixed(1) : "--");
  setText("#pressure", Math.round(weather.current.pressure_msl));
}

function renderCityPlans() {
  const plans = [
    { type: "mountain", index: "01", cn: "紫金山", title: "Purple Mountain climb", meta: "Trail · 2–3 hours", note: "Best in dry, clear air with a quiet wind.", accent: "#d8ff75" },
    { type: "lake", index: "02", cn: "玄武湖", title: "Xuanwu Lake loop", meta: "Walk · 70 minutes", note: "A soft route for mild temperatures and open skies.", accent: "#94d9ff" },
    { type: "night", index: "03", cn: "秦淮河", title: "Qinhuai after dark", meta: "Night · 90 minutes", note: "Comes alive when the day cools and rain eases.", accent: "#ffbd73" },
    { type: "museum", index: "04", cn: "南京博物院", title: "Museum afternoon", meta: "Indoors · 2 hours", note: "The graceful fallback for rain, heat, or haze.", accent: "#efb8ff" },
  ];
  $("#city-plans").innerHTML = plans.map((plan) => {
    const score = activityScore(plan.type, state.weather, state.air);
    const verdict = score >= 80 ? "Excellent window" : score >= 64 ? "Good window" : score >= 48 ? "Possible with care" : "Better as a backup";
    return `
      <article class="plan-card reveal" style="--plan-accent:${plan.accent}">
        <div class="plan-number">${plan.index}</div>
        <div class="plan-top">
          <span class="plan-cn">${plan.cn}</span>
          <div class="plan-score"><strong>${score}</strong><span>/ 100</span></div>
        </div>
        <h3>${plan.title}</h3>
        <p>${plan.note}</p>
        <div class="plan-bottom"><span>${plan.meta}</span><strong>${verdict}</strong></div>
        <i class="score-line"><b style="width:${score}%"></b></i>
      </article>`;
  }).join("");
}

function updateUnitButtons() {
  $$(".unit-button").forEach((button) => {
    const active = button.dataset.unit === state.unit;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function renderFreshness() {
  if (!state.updatedAt) return;
  const local = state.updatedAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  setText("#last-updated", `${state.source === "cache" ? "Saved" : "Updated"} ${local}`);
}

function updateClock() {
  const now = new Date();
  setText("#local-clock", `${new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Shanghai",
  }).format(now)} CST`);
  const remaining = Math.max(0, state.refreshAt - Date.now());
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  setText("#next-refresh", `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`);
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("is-visible"), 3200);
}

function setupInteractions() {
  $$(".unit-button").forEach((button) => button.addEventListener("click", () => {
    state.unit = button.dataset.unit;
    localStorage.setItem("nanjing-weather-unit", state.unit);
    if (state.weather) render();
  }));
  ["#refresh-button", "#refresh-cta"].forEach((selector) => $(selector)?.addEventListener("click", () => loadWeather({ announce: true })));
  $("#dialog-close")?.addEventListener("click", () => $("#day-dialog").close());
  $("#day-dialog")?.addEventListener("click", (event) => {
    if (event.target === $("#day-dialog")) $("#day-dialog").close();
  });
  $("#share-button")?.addEventListener("click", shareWeather);
  window.addEventListener("online", () => loadWeather({ announce: true }));
  window.addEventListener("offline", () => setConnection(false));

  const sections = $$(".scene");
  const observer = new IntersectionObserver((entries) => {
    const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    $$(".scene-nav a").forEach((link) => link.classList.toggle("is-active", link.dataset.section === visible.target.id));
    visible.target.querySelectorAll(".reveal").forEach((element) => element.classList.add("is-revealed"));
  }, { threshold: [0.25, 0.5, 0.75] });
  sections.forEach((section) => observer.observe(section));

  document.addEventListener("keydown", (event) => {
    if (["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(document.activeElement?.tagName) || $("#day-dialog")?.open) return;
    if (!["ArrowDown", "ArrowUp", "PageDown", "PageUp"].includes(event.key)) return;
    event.preventDefault();
    const current = sections.findIndex((section) => {
      const rect = section.getBoundingClientRect();
      return rect.top <= window.innerHeight * 0.5 && rect.bottom >= window.innerHeight * 0.5;
    });
    const delta = ["ArrowDown", "PageDown"].includes(event.key) ? 1 : -1;
    sections[Math.max(0, Math.min(sections.length - 1, current + delta))]?.scrollIntoView({ behavior: "smooth" });
  });
}

async function shareWeather() {
  const current = state.weather?.current;
  const info = current ? weatherInfo(current.weather_code) : null;
  const text = current ? `Nanjing now: ${displayTemperature(current.temperature_2m, state.unit)}, ${info.label}.` : "Explore Nanjing’s live weather story.";
  try {
    if (navigator.share) await navigator.share({ title: "Nanjing Atmosphere", text, url: location.href });
    else {
      await navigator.clipboard.writeText(`${text} ${location.href}`);
      showToast("Weather snapshot copied to clipboard");
    }
  } catch (error) {
    if (error.name !== "AbortError") showToast("Sharing is unavailable in this browser");
  }
}

setupInteractions();
updateClock();
setInterval(updateClock, 1000);
setInterval(() => loadWeather(), REFRESH_MS);
loadWeather();

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}
