# Nanjing Atmosphere

A live, interactive weather story for Nanjing. It combines a presentation-like narrative with current conditions, the next 24 hours, a seven-day outlook, air quality, and weather-aware city recommendations.

## Live app

**[Open Nanjing Atmosphere →](https://leiyin11.github.io/nanjing-weather/)**

## Run it

Requires Node.js 20 or later. No package installation is needed.

```powershell
npm start
```

Open `http://127.0.0.1:4173`. Use the section navigation, mouse/trackpad, or Page Up/Page Down and arrow keys to move through the story.

## Automated behavior

- Fetches current, hourly, and seven-day data from Open-Meteo at startup.
- Fetches current air quality from the Open-Meteo Air Quality API (CAMS global forecast).
- Refreshes both feeds automatically every 10 minutes and on reconnect.
- Saves the last successful reading in the browser for graceful offline fallback.
- Caches the app shell through a service worker.
- Verifies structure, syntax, data URLs, attribution, and core calculations with `npm run verify`.
- Includes a portable GitHub Pages workflow in `.github/workflows/pages.yml`. It runs as-is when this folder is used as the repository root.

## Data notes

Coordinates are fixed to central Nanjing (`32.0603° N, 118.7969° E`) and timestamps use `Asia/Shanghai`. Forecasts are model-based and should not replace official warnings from the China Meteorological Administration.

Weather data: [Open-Meteo](https://open-meteo.com/). Air-quality data: CAMS ENSEMBLE through Open-Meteo.
