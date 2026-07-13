import { access, readFile } from "node:fs/promises";

const required = [
  "index.html",
  "styles.css",
  "app.js",
  "weather.js",
  "sw.js",
  "manifest.webmanifest",
  "assets/weather-mark.svg",
];

await Promise.all(required.map((file) => access(new URL(`../${file}`, import.meta.url))));
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const js = await readFile(new URL("../app.js", import.meta.url), "utf8");

for (const id of ["now", "rhythm", "outlook", "atmosphere", "city", "pipeline"]) {
  if (!html.includes(`id="${id}"`)) throw new Error(`Missing scene: ${id}`);
}
if (!js.includes("REFRESH_MS = 10 * 60 * 1000")) throw new Error("Ten-minute refresh automation is missing");
if (!html.includes("Open-Meteo") || !html.includes("CAMS ENSEMBLE")) throw new Error("Data attribution is missing");
if (!html.includes('name="viewport"')) throw new Error("Responsive viewport is missing");

console.log(`Static verification passed: ${required.length} assets, 6 story scenes, refresh automation, and data attribution.`);
