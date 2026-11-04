/**
 * Nebula — Client half.
 *
 * One package, four experiences:
 *  - Nebula Ambience: a pointer-aware aurora and starfield rendered in the
 *    frame-wide overlay, with a composer toggle.
 *  - Nebula Sky: the ambience follows the local clock — rose and amber at
 *    dawn, pale and airy at midday, burning at dusk, starlit at night.
 *  - Nebula Station: a Radio Garden player with saved stations, station
 *    switching, volume, OS media controls, and a composer play/pause toggle.
 *  - Nebula Theme: a deep-space token palette for the whole app.
 *
 * All four are plain, dependency-free client code. The station audio is a
 * browser <audio> element pointed at Radio Garden's public listen endpoint; the
 * aurora and sky are a canvas in shell.overlay. Nothing here reads sessions,
 * cookies, files, or other plugins' data.
 */
window.__ModuleLoader__.load({
  id: 'dsh-nebula',
  factory(require) {
    function createAmbience(themeApi) {
    const React = require('react');
    const h = React.createElement;
    const { useEffect, useReducer, useRef, useState } = React;

    const NS = 'nebula-ambience';
    const SKY_KEY = 'dsh.nebula-sky.enabled';
    const AMBIENCE_KEY = 'dsh.nebula-ambience.visible';
    const DEFAULTS_KEY = 'dsh.nebula.defaults.v2';
    const GEO_KEY = 'dsh.nebula-sky.geo';
    const GEO_TTL_MS = 24 * 60 * 60 * 1000;
    const GEO_ENDPOINT = 'https://ipwho.is/';
    const WEATHER_KEY = 'dsh.nebula-weather';
    const WEATHER_ENABLED_KEY = 'dsh.nebula-weather.enabled';
    const WEATHER_TTL_MS = 15 * 60 * 1000;
    const WEATHER_ENDPOINT = 'https://api.open-meteo.com/v1/forecast';
    const DEVICE_ZONE = (() => {
      try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      } catch {
        return 'UTC';
      }
    })();
    // If IP geolocation disagrees with the machine timezone, it is usually a
    // VPN or ISP exit. In that case use a representative city for the machine
    // timezone so the markers stay aligned with the clock on the strip.
    const TZ_FALLBACKS = {
      'Asia/Jakarta': { lat: -6.2088, lon: 106.8456 },
      'Asia/Kuala_Lumpur': { lat: 3.139, lon: 101.6869 },
      'Asia/Singapore': { lat: 1.3521, lon: 103.8198 },
      'Asia/Tokyo': { lat: 35.6762, lon: 139.6503 },
      'Europe/Paris': { lat: 48.8566, lon: 2.3522 },
      'Europe/London': { lat: 51.5074, lon: -0.1278 },
      'Atlantic/Reykjavik': { lat: 64.1466, lon: -21.9426 },
      'America/New_York': { lat: 40.7128, lon: -74.006 },
      'America/Los_Angeles': { lat: 34.0522, lon: -118.2437 },
      'Australia/Sydney': { lat: -33.8688, lon: 151.2093 },
    };
    const TAU = Math.PI * 2;

    const EN = {
      toggleOn: 'Nebula sky is following the clock. Click to fix the palette.',
      toggleOff: 'Nebula sky is on a fixed palette. Click to follow the clock.',
      actionOn: 'Stop following the clock',
      actionOff: 'Follow the clock',
      themeLabel: 'Nebula theme',
      themeActionOn: 'Turn off the Nebula theme',
      themeActionOff: 'Apply the Nebula theme',
      ambienceLabel: 'Ambience',
      ambienceActionOn: 'Turn off the ambience',
      ambienceActionOff: 'Turn on the ambience',
      weatherLabel: 'Weather',
      weatherActionOn: 'Turn live weather off',
      weatherActionOff: 'Turn live weather on',
      weatherClear: 'Clear',
      weatherMostlyClear: 'Mostly clear',
      weatherPartlyCloudy: 'Partly cloudy',
      weatherOvercast: 'Overcast',
      weatherFog: 'Fog',
      weatherDrizzle: 'Drizzle',
      weatherRain: 'Rain',
      weatherSnow: 'Snow',
      weatherStorm: 'Thunderstorm',
      weatherOff: 'Weather off',
      weatherPending: 'Weather —',
      weatherCloud: 'cloud',
      ambienceOffStatus: 'Ambience off',
      skyHintAmbienceOff: 'Ambience is off. Turn it on above to see the sky.',
      skyTitle: 'Nebula Sky',
      skySunrise: 'Sunrise',
      skySunset: 'Sunset',
      moonNew: 'New moon',
      moonWaxingCrescent: 'Waxing crescent',
      moonFirstQuarter: 'First quarter',
      moonWaxingGibbous: 'Waxing gibbous',
      moonFull: 'Full moon',
      moonWaningGibbous: 'Waning gibbous',
      moonLastQuarter: 'Last quarter',
      moonWaningCrescent: 'Waning crescent',
      skyHint: 'Drag the strip to preview any hour. Live returns to the clock.',
      skyHintPreview: 'Previewing {phase} at {time}. Live returns to the clock.',
      skyHintFixed: 'Fixed palette. Turn Follow the clock on above to follow the day.',
      skyFollow: 'Follow the clock',
      skyStatus: 'Now: {phase} · {time}',
      skyPreviewStatus: 'Preview: {phase} · {time}',
      skyLive: 'Live',
      skyScrub: 'Drag to preview the sky at any hour',
      skyFixed: 'Fixed sky',
      skyActionOn: 'Stop following the clock',
      skyActionOff: 'Follow the clock',
      phaseNight: 'night',
      phaseDawn: 'dawn',
      phaseMorning: 'morning',
      phaseMidday: 'midday',
      phaseAfternoon: 'afternoon',
      phaseDusk: 'dusk',
      phaseTwilight: 'twilight',
    };

    const CSS = `
.dsh-nebula-canvas {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  pointer-events: none;
  animation: dsh-nebula-in 900ms ease-out both;
}
@keyframes dsh-nebula-in { from { opacity: 0 } to { opacity: 1 } }

.dsh-nebula-grain {
  position: fixed;
  inset: 0;
  display: block;
  pointer-events: none;
  opacity: 0.035;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  background-size: 180px 180px;
  mix-blend-mode: soft-light;
}

.dsh-nebula-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  margin: 0;
  padding: 0;
  flex: none;
  border: 0;
  border-radius: 8px;
  background-color: transparent;
  background-image: var(--dsh-nebula-sky-bg, none);
  background-repeat: no-repeat;
  background-size: 100% 100%;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  transition: background-color 140ms ease, box-shadow 140ms ease, color 140ms ease;
}
.dsh-nebula-toggle:hover {
  background-color: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-primary);
}
.dsh-nebula-toggle:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary);
  outline-offset: 1px;
}
.dsh-nebula-toggle.is-on {
  color: var(--dsw-alias-label-primary);
  box-shadow: inset 0 0 0 0.5px rgba(255, 255, 255, 0.14);
}
.dsh-nebula-toggle .dsh-nebula-glyph { display: block; }
.dsh-nebula-toggle.is-on .dsh-nebula-glyph {
  filter: drop-shadow(0 0 4px var(--dsw-alias-brand-primary));
  animation: dsh-nebula-turn 18s linear infinite;
}
@keyframes dsh-nebula-turn {
  from { transform: rotate(0deg) }
  to { transform: rotate(360deg) }
}
@media (prefers-reduced-motion: reduce) {
  .dsh-nebula-canvas { animation: none; }
  .dsh-nebula-toggle.is-on .dsh-nebula-glyph { animation: none; }
}

.dsh-sky-row {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 0;
  border-bottom: 0.5px solid var(--dsw-alias-border-l2);
  font-family: inherit;
}
.dsh-sky-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}
.dsh-sky-title {
  color: var(--dsw-alias-label-primary);
  font-size: 14px;
  font-weight: 400;
  line-height: 22px;
}
.dsh-sky-title-group {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.dsh-sky-moon {
  flex: none;
  font-size: 13px;
  line-height: 1;
  opacity: 0.8;
  cursor: default;
  filter: grayscale(1) brightness(1.15) drop-shadow(0 0 3px rgba(190, 210, 255, 0.35));
}
.dsh-sky-sun {
  position: absolute;
  top: -9px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 10px;
  height: 10px;
  transform: translateX(-50%);
  color: #f5c76a;
  pointer-events: none;
  filter: drop-shadow(0 0 3px rgba(245, 199, 106, 0.5));
}
.dsh-sky-sun.is-set {
  color: #f08a7a;
  filter: drop-shadow(0 0 3px rgba(240, 138, 122, 0.5));
}
.dsh-sky-sun-icon { display: block; }
.dsh-sky-sun::after {
  content: '';
  position: absolute;
  top: 9px;
  left: 50%;
  width: 1px;
  height: 4px;
  transform: translateX(-50%);
  background: currentColor;
  opacity: 0.55;
}
.dsh-sky-head-right {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  min-width: 0;
}
.dsh-sky-live {
  display: inline-flex;
  align-items: center;
  flex: none;
  height: 22px;
  margin: 0;
  padding: 0 8px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 999px;
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-brand-primary);
  font: inherit;
  font-size: 11px;
  line-height: 1;
  cursor: pointer;
}
.dsh-sky-live:hover { border-color: var(--dsw-alias-brand-primary); }
.dsh-sky-live:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary);
  outline-offset: 2px;
}
.dsh-sky-state {
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 18px;
  font-variant-numeric: tabular-nums;
  text-align: right;
}
.dsh-sky-strip {
  position: relative;
  height: 10px;
  border-radius: 999px;
  cursor: ew-resize;
  touch-action: none;
  user-select: none;
  background: linear-gradient(
    90deg,
    #070b1c 0%,
    #0d1733 18%,
    #2a2b60 22%,
    #f59e7a 25%,
    #bfe4ff 33%,
    #e8f6ff 50%,
    #ffe7b0 65%,
    #ff9f6e 73%,
    #f05a7e 76%,
    #7c4dff 81%,
    #1b2550 87%,
    #070b1c 100%
  );
  box-shadow: inset 0 0 0 0.5px var(--dsw-alias-border-l2);
}
.dsh-sky-strip::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: -10px;
  bottom: -10px;
}
.dsh-sky-strip.is-off { cursor: default; }
.dsh-sky-strip:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary);
  outline-offset: 3px;
}
.dsh-sky-mark {
  position: absolute;
  top: -4px;
  bottom: -4px;
  width: 3px;
  margin-left: -1.5px;
  border-radius: 2px;
  background: #f7f9ff;
  box-shadow: 0 0 0 1px rgba(3, 5, 12, 0.55), 0 0 8px rgba(255, 255, 255, 0.75);
  transition: left 600ms ease;
}
.dsh-sky-strip.is-preview .dsh-sky-mark {
  background: var(--dsw-alias-brand-primary);
  box-shadow: 0 0 0 1px rgba(3, 5, 12, 0.55), 0 0 10px var(--dsw-alias-brand-primary);
}
.dsh-sky-options {
  display: flex;
  flex-direction: column;
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: 10px;
  background: var(--dsw-alias-bg-layer-1);
  overflow: hidden;
}
.dsh-sky-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 9px 12px;
}
.dsh-sky-option + .dsh-sky-option {
  border-top: 0.5px solid var(--dsw-alias-border-l1);
}
.dsh-sky-option-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  line-height: 20px;
}
.dsh-sky-option-label svg {
  flex: none;
  opacity: 0.8;
}
.dsh-sky-weather-summary {
  padding: 0 2px;
  color: var(--dsw-alias-label-secondary);
  font-size: 11px;
  line-height: 16px;
}
.dsh-sky-switch {
  position: relative;
  flex: none;
  width: 34px;
  height: 20px;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: var(--dsw-alias-bg-layer-2);
  box-shadow: inset 0 0 0 1px var(--dsw-alias-border-l1);
  cursor: pointer;
  transition: background-color 160ms ease;
}
.dsh-sky-switch::before {
  content: '';
  position: absolute;
  inset: -6px;
  border-radius: 999px;
}
.dsh-sky-switch.is-on { background: var(--dsw-alias-brand-primary); }
.dsh-sky-switch:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary);
  outline-offset: 2px;
}
.dsh-sky-knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #f7f9ff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
  transition: transform 160ms ease;
}
.dsh-sky-switch.is-on .dsh-sky-knob { transform: translateX(14px); }
.dsh-sky-hint {
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 18px;
}
@media (prefers-reduced-motion: reduce) {
  .dsh-sky-mark, .dsh-sky-switch, .dsh-sky-knob { transition: none; }
}
`;

    // Light pools hug the frame edges so the reading column stays legible.
    const DARK = {
      star: '#e2f4ff',
      starAlpha: 1,
      glow: true,
      blobs: [
        { c: '56,189,248', a: 0.105, x: 0.10, y: 0.07, r: 0.60, ax: 0.045, ay: 0.035, sx: 0.00007, sy: 0.00009, p: 0.0, d: 1.0 },
        { c: '167,139,250', a: 0.115, x: 0.93, y: 0.05, r: 0.55, ax: 0.040, ay: 0.040, sx: 0.00006, sy: 0.00008, p: 2.1, d: 1.4 },
        { c: '45,212,191', a: 0.085, x: 0.03, y: 0.93, r: 0.48, ax: 0.045, ay: 0.030, sx: 0.00008, sy: 0.00006, p: 4.2, d: 0.8 },
        { c: '244,114,182', a: 0.075, x: 0.97, y: 0.90, r: 0.52, ax: 0.040, ay: 0.035, sx: 0.00005, sy: 0.00007, p: 1.2, d: 1.2 },
        { c: '99,102,241', a: 0.075, x: 0.52, y: -0.02, r: 0.44, ax: 0.050, ay: 0.030, sx: 0.00007, sy: 0.00005, p: 3.3, d: 0.6 },
        { c: '14,165,233', a: 0.022, x: 0.55, y: 0.62, r: 0.42, ax: 0.060, ay: 0.050, sx: 0.00004, sy: 0.00006, p: 5.0, d: 0.4 },
      ],
    };
    const LIGHT_COLORS = ['2,132,199', '124,58,237', '13,148,136', '219,39,119', '79,70,229', '2,132,199'];
    const LIGHT = {
      star: '#334155',
      starAlpha: 0.5,
      glow: false,
      blobs: DARK.blobs.map((blob, index) => ({
        ...blob,
        c: LIGHT_COLORS[index] || blob.c,
        a: blob.a * 0.55,
      })),
    };

    let scheme = 'dark';
    let translate = (key) => EN[key] || key;
    let requestStaticRedraw = () => {};

    function t(key) {
      const value = translate(key);
      return typeof value === 'string' && value && value !== key ? value : EN[key] || key;
    }

    let skyEnabled = (() => {
      try {
        const raw = window.localStorage.getItem(SKY_KEY);
        return raw === null ? true : raw !== '0';
      } catch {
        return true;
      }
    })();

    let ambienceEnabled = (() => {
      try {
        const raw = window.localStorage.getItem(AMBIENCE_KEY);
        return raw === null ? true : raw !== '0';
      } catch {
        return true;
      }
    })();

    let skyGeo = readGeo();
    let weather = readWeather();
    let weatherEnabled = readWeatherEnabled();

    // null follows the clock; a number pins the sky to that minute for preview.
    let skyPreview = null;

    const listeners = new Set();

    function emit() {
      for (const listener of listeners) listener();
    }

    function readGeo() {
      try {
        const parsed = JSON.parse(window.localStorage.getItem(GEO_KEY) || 'null');
        if (
          parsed &&
          Number.isFinite(parsed.lat) &&
          Number.isFinite(parsed.lon) &&
          parsed.lat >= -90 &&
          parsed.lat <= 90 &&
          parsed.lon >= -180 &&
          parsed.lon <= 180
        ) {
          return {
            lat: parsed.lat,
            lon: parsed.lon,
            tz: typeof parsed.tz === 'string' ? parsed.tz : '',
            ts: Number(parsed.ts) || 0,
          };
        }
      } catch {
        /* No cached location. */
      }
      return null;
    }

    function readWeather() {
      try {
        const parsed = JSON.parse(window.localStorage.getItem(WEATHER_KEY) || 'null');
        if (
          parsed &&
          Number.isFinite(parsed.code) &&
          Number.isFinite(parsed.cloud) &&
          Number.isFinite(parsed.lat) &&
          Number.isFinite(parsed.lon)
        ) {
          return {
            code: Math.round(parsed.code),
            cloud: Math.min(100, Math.max(0, Number(parsed.cloud))),
            precip: Number.isFinite(Number(parsed.precip)) ? Number(parsed.precip) : 0,
            temp: Number.isFinite(Number(parsed.temp)) ? Number(parsed.temp) : null,
            windSpeed: Number.isFinite(Number(parsed.windSpeed)) ? Number(parsed.windSpeed) : 0,
            windDir: Number.isFinite(Number(parsed.windDir)) ? Number(parsed.windDir) : 0,
            lat: Number(parsed.lat),
            lon: Number(parsed.lon),
            ts: Number(parsed.ts) || 0,
          };
        }
      } catch {
        /* No cached weather. */
      }
      return null;
    }

    function readWeatherEnabled() {
      try {
        const raw = window.localStorage.getItem(WEATHER_ENABLED_KEY);
        return raw === null ? true : raw !== '0';
      } catch {
        return true;
      }
    }

    function weatherKind(code) {
      if ([95, 96, 99].includes(code)) return 'storm';
      if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow';
      if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) {
        return 'rain';
      }
      if ([45, 48].includes(code)) return 'fog';
      if (code === 3) return 'overcast';
      if (code === 1 || code === 2) return 'cloudy';
      return 'clear';
    }

    function weatherConditionKey(code) {
      if (code === 0) return 'weatherClear';
      if (code === 1) return 'weatherMostlyClear';
      if (code === 2) return 'weatherPartlyCloudy';
      if (code === 3) return 'weatherOvercast';
      if (code === 45 || code === 48) return 'weatherFog';
      if (code === 51 || code === 53 || code === 55 || code === 56 || code === 57) {
        return 'weatherDrizzle';
      }
      if (
        code === 61 ||
        code === 63 ||
        code === 65 ||
        code === 66 ||
        code === 67 ||
        code === 80 ||
        code === 81 ||
        code === 82
      ) {
        return 'weatherRain';
      }
      if (
        code === 71 ||
        code === 73 ||
        code === 75 ||
        code === 77 ||
        code === 85 ||
        code === 86
      ) {
        return 'weatherSnow';
      }
      if (code === 95 || code === 96 || code === 99) return 'weatherStorm';
      return 'weatherClear';
    }

    function weatherIntensity(currentWeather) {
      if (!currentWeather) return 0;
      const kind = weatherKind(currentWeather.code);
      if (kind === 'storm') return 1;
      const amount = Math.max(0, Number(currentWeather.precip) || 0);
      if (kind === 'snow') return Math.min(1, 0.35 + amount * 0.35);
      return Math.min(1, Math.max(0.18, 0.18 + amount / 5));
    }

    function weatherStarDim(currentWeather) {
      if (!currentWeather) return 1;
      const kind = weatherKind(currentWeather.code);
      let dim = 1 - Math.min(1, Math.max(0, currentWeather.cloud / 100)) * 0.55;
      if (kind === 'fog') dim *= 0.35;
      else if (kind === 'rain') dim *= 0.7;
      else if (kind === 'snow') dim *= 0.6;
      else if (kind === 'storm') dim *= 0.4;
      return Math.max(0.12, dim);
    }

    function weatherBodyDim(currentWeather) {
      if (!currentWeather) return 1;
      const kind = weatherKind(currentWeather.code);
      let dim = 1 - Math.min(1, Math.max(0, currentWeather.cloud / 100)) * 0.5;
      if (kind === 'fog') dim *= 0.5;
      else if (kind === 'rain' || kind === 'snow') dim *= 0.75;
      else if (kind === 'storm') dim *= 0.5;
      return Math.max(0.25, dim);
    }

    function weatherWindX(currentWeather) {
      if (!currentWeather) return 0;
      const speed = Number(currentWeather.windSpeed);
      const direction = Number(currentWeather.windDir);
      if (!Number.isFinite(speed) || !Number.isFinite(direction)) return 0;
      return Math.cos((direction * Math.PI) / 180) * Math.max(0, speed) * 2.4;
    }

    let weatherController = null;
    function refreshWeather(location) {
      if (!location || typeof window.fetch !== 'function') return null;
      const now = Date.now();
      if (
        weather &&
        now - weather.ts < WEATHER_TTL_MS &&
        Math.abs(weather.lat - location.lat) < 0.02 &&
        Math.abs(weather.lon - location.lon) < 0.02
      ) {
        return null;
      }
      if (weatherController) weatherController.abort();
      const controller = typeof AbortController === 'function' ? new AbortController() : null;
      weatherController = controller;
      const timer = window.setTimeout(() => {
        if (controller) controller.abort();
      }, 8000);
      const query =
        '?latitude=' +
        encodeURIComponent(location.lat.toFixed(4)) +
        '&longitude=' +
        encodeURIComponent(location.lon.toFixed(4)) +
        '&current=weather_code,cloud_cover,precipitation,temperature_2m,wind_speed_10m,wind_direction_10m' +
        '&timezone=auto&forecast_days=1';
      window
        .fetch(WEATHER_ENDPOINT + query, {
          cache: 'no-store',
          credentials: 'omit',
          signal: controller ? controller.signal : undefined,
        })
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => {
          if (weatherController !== controller) return;
          const current = data && data.current;
          const code = Number(current && current.weather_code);
          const cloud = Number(current && current.cloud_cover);
          if (!Number.isFinite(code) || !Number.isFinite(cloud)) return;
          weather = {
            code: Math.round(code),
            cloud: Math.min(100, Math.max(0, cloud)),
            precip: Math.max(0, Number(current.precipitation) || 0),
            temp: Number.isFinite(Number(current.temperature_2m))
              ? Number(current.temperature_2m)
              : null,
            windSpeed: Number.isFinite(Number(current.wind_speed_10m))
              ? Math.max(0, Number(current.wind_speed_10m))
              : 0,
            windDir: Number.isFinite(Number(current.wind_direction_10m))
              ? Number(current.wind_direction_10m)
              : 0,
            lat: location.lat,
            lon: location.lon,
            ts: Date.now(),
          };
          try {
            window.localStorage.setItem(WEATHER_KEY, JSON.stringify(weather));
          } catch {
            /* Private mode: the session weather still applies. */
          }
          emit();
          requestStaticRedraw();
        })
        .catch(() => {
          /* Keep the last weather when the lookup fails. */
        })
        .finally(() => {
          window.clearTimeout(timer);
          if (weatherController === controller) weatherController = null;
        });
      return controller;
    }

    let geoController = null;
    function refreshGeo() {
      const now = Date.now();
      if (skyGeo && skyGeo.tz && now - skyGeo.ts < GEO_TTL_MS) return null;
      if (typeof window.fetch !== 'function') return null;
      if (geoController) geoController.abort();
      const controller = typeof AbortController === 'function' ? new AbortController() : null;
      geoController = controller;
      const timer = window.setTimeout(() => {
        if (controller) controller.abort();
      }, 8000);
      window
        .fetch(GEO_ENDPOINT, {
          cache: 'no-store',
          credentials: 'omit',
          signal: controller ? controller.signal : undefined,
        })
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => {
          if (geoController !== controller) return;
          const lat = Number(data && data.latitude);
          const lon = Number(data && data.longitude);
          if (
            !Number.isFinite(lat) ||
            !Number.isFinite(lon) ||
            lat < -90 ||
            lat > 90 ||
            lon < -180 ||
            lon > 180
          ) {
            return;
          }
          const tz =
            data && data.timezone
              ? typeof data.timezone === 'string'
                ? data.timezone
                : data.timezone.id || ''
              : '';
          skyGeo = { lat, lon, tz, ts: Date.now() };
          try {
            window.localStorage.setItem(GEO_KEY, JSON.stringify(skyGeo));
          } catch {
            /* Private mode: the session location still applies. */
          }
          emit();
          requestStaticRedraw();
          if (weatherEnabled) refreshWeather(resolveSkyLocation(skyGeo));
        })
        .catch(() => {
          /* The sun markers stay hidden when the lookup fails. */
        })
        .finally(() => {
          window.clearTimeout(timer);
          if (geoController === controller) geoController = null;
        });
      return controller;
    }

    function resolveSkyLocation(geo) {
      const fallback = TZ_FALLBACKS[DEVICE_ZONE] || null;
      if (!geo) return fallback;
      if (geo.tz && geo.tz === DEVICE_ZONE) return { lat: geo.lat, lon: geo.lon };
      if (fallback) return fallback;
      if (!geo.tz) return { lat: geo.lat, lon: geo.lon };
      return null;
    }

    function setWeatherEnabled(next) {
      if (weatherEnabled === next) return;
      weatherEnabled = next;
      try {
        window.localStorage.setItem(WEATHER_ENABLED_KEY, next ? '1' : '0');
      } catch {
        /* Private mode: the session preference still applies. */
      }
      if (next) {
        refreshWeather(resolveSkyLocation(skyGeo));
      } else if (weatherController) {
        weatherController.abort();
      }
      emit();
      requestStaticRedraw();
    }

    function setSkyEnabled(next) {
      if (skyEnabled === next) return;
      skyEnabled = next;
      skyPreview = null;
      try {
        window.localStorage.setItem(SKY_KEY, next ? '1' : '0');
      } catch {
        /* Private mode: the session preference still applies. */
      }
      emit();
      requestStaticRedraw();
    }

    // This generation ships with the sky as the default; re-assert it once so
    // a leftover off-state from testing does not hide the feature. After the
    // marker is set, the user's switch is respected forever.
    function setAmbienceEnabled(next) {
      if (ambienceEnabled === next) return;
      ambienceEnabled = next;
      if (!next) skyPreview = null;
      try {
        window.localStorage.setItem(AMBIENCE_KEY, next ? '1' : '0');
      } catch {
        /* Private mode: the session preference still applies. */
      }
      emit();
      requestStaticRedraw();
    }

    // This generation ships with ambience, sky and theme on. Re-assert all
    // three once; afterward every switch is the user's.
    function seedDefaults(themeApi) {
      try {
        if (window.localStorage.getItem(DEFAULTS_KEY) === '1') return;
        let changed = false;
        if (!ambienceEnabled) {
          ambienceEnabled = true;
          window.localStorage.setItem(AMBIENCE_KEY, '1');
          changed = true;
        }
        if (!skyEnabled) {
          skyEnabled = true;
          window.localStorage.setItem(SKY_KEY, '1');
          changed = true;
        }
        themeApi.setEnabled(true);
        window.localStorage.setItem(DEFAULTS_KEY, '1');
        if (changed) {
          emit();
          requestStaticRedraw();
        }
      } catch {
        /* Private mode: keep the in-memory defaults. */
      }
    }

    function setSkyPreview(next) {
      const value = next === null ? null : Math.min(1439, Math.max(0, Math.round(next)));
      if (skyPreview === value) return;
      skyPreview = value;
      emit();
      requestStaticRedraw();
    }

    function useSkyEnabled() {
      const [, force] = useReducer((version) => version + 1, 0);
      useEffect(() => {
        listeners.add(force);
        return () => {
          listeners.delete(force);
        };
      }, []);
      return skyEnabled;
    }

    function useAmbienceEnabled() {
      const [, force] = useReducer((version) => version + 1, 0);
      useEffect(() => {
        listeners.add(force);
        return () => {
          listeners.delete(force);
        };
      }, []);
      return ambienceEnabled;
    }

    function useSkyPreview() {
      const [, force] = useReducer((version) => version + 1, 0);
      useEffect(() => {
        listeners.add(force);
        return () => {
          listeners.delete(force);
        };
      }, []);
      return skyPreview;
    }

    function useSkyGeo() {
      const [, force] = useReducer((version) => version + 1, 0);
      useEffect(() => {
        listeners.add(force);
        return () => {
          listeners.delete(force);
        };
      }, []);
      return skyGeo;
    }

    function useWeatherEnabled() {
      const [, force] = useReducer((version) => version + 1, 0);
      useEffect(() => {
        listeners.add(force);
        return () => {
          listeners.delete(force);
        };
      }, []);
      return weatherEnabled;
    }

    function useSkyWeather() {
      const [, force] = useReducer((version) => version + 1, 0);
      useEffect(() => {
        listeners.add(force);
        return () => {
          listeners.delete(force);
        };
      }, []);
      return weather;
    }

    // The composer control repaints its own sky thumbnail, so it needs a clock
    // tick even while Settings is closed.
    function useSkyMinute() {
      const [minute, setMinute] = useState(() => minuteOfDay());
      useEffect(() => {
        const sync = () => {
          const next = minuteOfDay();
          setMinute((previous) => (previous === next ? previous : next));
        };
        sync();
        const timer = window.setInterval(sync, 15000);
        document.addEventListener('visibilitychange', sync);
        return () => {
          window.clearInterval(timer);
          document.removeEventListener('visibilitychange', sync);
        };
      }, []);
      return minute;
    }

    // The sky is designed for the dark palette. On the first run of this
    // generation, move a light built-in theme to dark once; later choices are
    // never touched again.
    function seedDarkTheme(themeFace, tries) {
      const attempt = tries || 0;
      if (!themeFace || typeof themeFace.getTheme !== 'function' || typeof themeFace.setTheme !== 'function') {
        return;
      }
      try {
        const snapshot = themeFace.getTheme();
        if (!snapshot || !snapshot.active) return;
        if (snapshot.active.colorScheme !== 'light') return;
        const preference = snapshot.preference;
        if (preference !== 'system' && preference !== 'light') return;
        themeFace.setTheme('dark');
        // A rejected write can revert after the optimistic publish; retry a
        // couple of times, and try again on the next load either way.
        window.setTimeout(() => {
          try {
            const after = themeFace.getTheme();
            if (after && after.active && after.active.colorScheme === 'light' && attempt < 2) {
              window.setTimeout(() => seedDarkTheme(themeFace, attempt + 1), 2000);
            }
          } catch {
            /* Try again on the next load. */
          }
        }, 1500);
      } catch {
        if (attempt < 2) {
          window.setTimeout(() => seedDarkTheme(themeFace, attempt + 1), 1600);
        }
      }
    }

    /* ------------------------------------------------------------------ */
    /* Sky clock                                                           */
    /*                                                                     */
    /* Keyframes across the day, interpolated with a smoothstep so the      */
    /* palette never jumps. Each frame carries the six aurora colors, a     */
    /* brightness scale, the star alpha, and a soft sun or moon glow that   */
    /* travels across the top of the frame.                                 */
    /* ------------------------------------------------------------------ */

    const SKY_FRAMES = [
      {
        at: 0,
        phase: 'phaseNight',
        scale: 1,
        star: 1,
        colors: ['56,189,248', '167,139,250', '45,212,191', '244,114,182', '99,102,241', '14,165,233'],
        orb: { c: '190,215,255', a: 0.034, x: 0.55, y: 0.12 },
      },
      {
        at: 240,
        phase: 'phaseNight',
        scale: 0.9,
        star: 0.55,
        colors: ['37,99,235', '129,140,248', '13,148,136', '192,38,211', '67,56,202', '8,145,178'],
        orb: { c: '190,215,255', a: 0.016, x: 0.2, y: 0.3 },
      },
      {
        at: 330,
        phase: 'phaseDawn',
        scale: 0.8,
        star: 0.12,
        colors: ['251,113,133', '251,191,36', '253,186,116', '244,114,182', '167,139,250', '56,189,248'],
        orb: { c: '255,170,120', a: 0.05, x: 0.12, y: 0.3 },
      },
      {
        at: 420,
        phase: 'phaseMorning',
        scale: 0.68,
        star: 0,
        colors: ['56,189,248', '125,211,252', '45,212,191', '253,224,71', '96,165,250', '14,165,233'],
        orb: { c: '255,214,150', a: 0.045, x: 0.24, y: 0.16 },
      },
      {
        at: 690,
        phase: 'phaseMidday',
        scale: 0.55,
        star: 0,
        colors: ['125,211,252', '186,230,253', '103,232,249', '253,224,71', '147,197,253', '56,189,248'],
        orb: { c: '255,250,235', a: 0.022, x: 0.5, y: 0.05 },
      },
      {
        at: 930,
        phase: 'phaseAfternoon',
        scale: 0.62,
        star: 0,
        colors: ['56,189,248', '251,191,36', '45,212,191', '253,186,116', '96,165,250', '14,165,233'],
        orb: { c: '255,205,140', a: 0.04, x: 0.76, y: 0.16 },
      },
      {
        at: 1050,
        phase: 'phaseDusk',
        scale: 0.85,
        star: 0.08,
        colors: ['251,146,60', '244,63,94', '253,186,116', '217,70,239', '167,139,250', '99,102,241'],
        orb: { c: '255,150,90', a: 0.06, x: 0.88, y: 0.3 },
      },
      {
        at: 1140,
        phase: 'phaseTwilight',
        scale: 0.95,
        star: 0.42,
        colors: ['129,140,248', '192,38,211', '45,212,191', '251,113,133', '139,92,246', '14,165,233'],
        orb: { c: '244,114,182', a: 0.045, x: 0.9, y: 0.36 },
      },
      {
        at: 1230,
        phase: 'phaseNight',
        scale: 1,
        star: 0.72,
        colors: ['56,189,248', '167,139,250', '45,212,191', '192,38,211', '99,102,241', '14,165,233'],
        orb: { c: '190,215,255', a: 0.02, x: 0.72, y: 0.26 },
      },
      {
        at: 1320,
        phase: 'phaseNight',
        scale: 1,
        star: 1,
        colors: ['56,189,248', '167,139,250', '45,212,191', '244,114,182', '99,102,241', '14,165,233'],
        orb: { c: '190,215,255', a: 0.032, x: 0.58, y: 0.12 },
      },
      {
        at: 1440,
        phase: 'phaseNight',
        scale: 1,
        star: 1,
        colors: ['56,189,248', '167,139,250', '45,212,191', '244,114,182', '99,102,241', '14,165,233'],
        orb: { c: '190,215,255', a: 0.034, x: 0.55, y: 0.12 },
      },
    ];

    // The visual horizon for the sun/moon arc and the atmospheric haze.
    const HORIZON = 0.34;

    function minuteOfDay() {
      const now = new Date();
      return now.getHours() * 60 + now.getMinutes();
    }

    function secondsOfDay() {
      const now = new Date();
      return (
        now.getHours() * 3600 +
        now.getMinutes() * 60 +
        now.getSeconds() +
        now.getMilliseconds() / 1000
      );
    }

    function dayOfYear(date) {
      return Math.floor(
        (Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) -
          Date.UTC(date.getFullYear(), 0, 0)) /
          86400000,
      );
    }

    function sunTimes(geo, date = new Date()) {
      if (!geo || !Number.isFinite(geo.lat) || !Number.isFinite(geo.lon)) return null;
      const n = dayOfYear(date);
      const gamma = ((2 * Math.PI) / 365) * (n - 1);
      const cos = Math.cos;
      const sin = Math.sin;
      const eqtime =
        229.18 *
        (0.000075 +
          0.001868 * cos(gamma) -
          0.032077 * sin(gamma) -
          0.014615 * cos(2 * gamma) -
          0.040849 * sin(2 * gamma));
      const decl =
        0.006918 -
        0.399912 * cos(gamma) +
        0.070257 * sin(gamma) -
        0.006758 * cos(2 * gamma) +
        0.000907 * sin(2 * gamma) -
        0.002697 * cos(3 * gamma) +
        0.00148 * sin(3 * gamma);
      const lat = (geo.lat * Math.PI) / 180;
      const cosHa =
        cos((90.833 * Math.PI) / 180) / (cos(lat) * cos(decl)) - Math.tan(lat) * Math.tan(decl);
      if (cosHa > 1) return { kind: 'polarNight' };
      if (cosHa < -1) return { kind: 'midnightSun' };
      const ha = (Math.acos(cosHa) * 180) / Math.PI;
      const solarNoon = 720 - 4 * geo.lon - eqtime;
      const sunriseUtc = solarNoon - 4 * ha;
      const sunsetUtc = solarNoon + 4 * ha;
      const baseUtc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
      const sunriseInstant = new Date(baseUtc + sunriseUtc * 60000);
      const sunsetInstant = new Date(baseUtc + sunsetUtc * 60000);
      // Resolve the machine offset at the event instant, not at the current
      // instant; this matters on DST transition days.
      const sunrise = Math.round(
        (((sunriseUtc - sunriseInstant.getTimezoneOffset()) % 1440) + 1440) % 1440,
      ) % 1440;
      const sunset = Math.round(
        (((sunsetUtc - sunsetInstant.getTimezoneOffset()) % 1440) + 1440) % 1440,
      ) % 1440;
      return { kind: 'normal', sunrise, sunset };
    }

    function moonPhase(date = new Date()) {
      // Low-precision lunar and solar longitudes (Schlyter/Meeus). This is
      // accurate to a fraction of a degree, unlike the mean-lunation count
      // that drifted by about half a day near new moon and over-reported the
      // illuminated percentage.
      const RAD = Math.PI / 180;
      const days = (date.getTime() - Date.UTC(1999, 11, 31)) / 86400000;
      const sin = Math.sin;
      const cos = Math.cos;
      const norm = (value) => ((value % 360) + 360) % 360;

      const sunW = 282.9404 + 4.70935e-5 * days;
      const sunM = norm(356.047 + 0.9856002585 * days);
      const sunLon = norm(
        sunW + sunM + 1.915 * sin(sunM * RAD) + 0.02 * sin(2 * sunM * RAD),
      );

      const node = norm(125.1228 - 0.0529538083 * days);
      const inclination = 5.1454;
      const periapsis = norm(318.0634 + 0.1643573223 * days);
      const eccentricity = 0.0549;
      const moonM = norm(115.3654 + 13.0649929509 * days);
      const eccentricAnomaly =
        moonM +
        (180 / Math.PI) *
          eccentricity *
          sin(moonM * RAD) *
          (1 + eccentricity * cos(moonM * RAD));
      const x = 60.2666 * (cos(eccentricAnomaly * RAD) - eccentricity);
      const y =
        60.2666 * Math.sqrt(1 - eccentricity * eccentricity) * sin(eccentricAnomaly * RAD);
      const radius = Math.hypot(x, y);
      const trueAnomaly = Math.atan2(y, x) / RAD;
      const argument = trueAnomaly + periapsis;
      const moonX =
        radius *
        (cos(node * RAD) * cos(argument * RAD) -
          sin(node * RAD) * sin(argument * RAD) * cos(inclination * RAD));
      const moonY =
        radius *
        (sin(node * RAD) * cos(argument * RAD) +
          cos(node * RAD) * sin(argument * RAD) * cos(inclination * RAD));

      let moonLon = Math.atan2(moonY, moonX) / RAD;
      const meanLon = norm(node + periapsis + moonM);
      const elongation = norm(meanLon - sunLon);
      const latitudeArgument = norm(meanLon - node);

      moonLon +=
        -1.274 * sin((moonM - 2 * elongation) * RAD) +
        0.658 * sin(2 * elongation * RAD) -
        0.186 * sin(sunM * RAD) -
        0.059 * sin((2 * moonM - 2 * elongation) * RAD) -
        0.057 * sin((moonM - 2 * elongation + sunM) * RAD) +
        0.053 * sin((moonM + 2 * elongation) * RAD) +
        0.046 * sin((2 * elongation - sunM) * RAD) +
        0.041 * sin((moonM - sunM) * RAD) -
        0.035 * sin(elongation * RAD) -
        0.031 * sin((moonM + sunM) * RAD) -
        0.015 * sin((2 * latitudeArgument - 2 * elongation) * RAD) +
        0.011 * sin((moonM - 4 * elongation) * RAD);

      const delta = norm(moonLon - sunLon);
      const phase = delta / 360;
      const illumination = Math.round(((1 - cos(delta * RAD)) / 2) * 100);
      let key = 'moonNew';
      if (phase < 0.03 || phase >= 0.97) key = 'moonNew';
      else if (phase < 0.22) key = 'moonWaxingCrescent';
      else if (phase < 0.28) key = 'moonFirstQuarter';
      else if (phase < 0.47) key = 'moonWaxingGibbous';
      else if (phase < 0.53) key = 'moonFull';
      else if (phase < 0.72) key = 'moonWaningGibbous';
      else if (phase < 0.78) key = 'moonLastQuarter';
      else key = 'moonWaningCrescent';
      return { key, illumination, value: phase };
    }

    function pad2(value) {
      return (value < 10 ? '0' : '') + value;
    }

    function clockTime(minute) {
      const stamp = ((Math.round(minute) % 1440) + 1440) % 1440;
      const hour = Math.floor(stamp / 60);
      return pad2(hour) + ':' + pad2(stamp % 60);
    }

    function mixNumber(from, to, u) {
      return from + (to - from) * u;
    }

    function mixColor(from, to, u) {
      const a = String(from).split(',').map((part) => Number(part) || 0);
      const b = String(to).split(',').map((part) => Number(part) || 0);
      return a.map((value, index) => Math.round(mixNumber(value, b[index] ?? value, u))).join(',');
    }

    function shadeColor(color, factor) {
      return String(color)
        .split(',')
        .map((part) => Math.round((Number(part) || 0) * factor))
        .join(',');
    }

    let skyMemoMinute = -1;
    let skyMemo = null;

    function currentSky() {
      const minute = skyPreview === null ? minuteOfDay() : skyPreview;
      if (minute !== skyMemoMinute) {
        skyMemoMinute = minute;
        skyMemo = skyAt(minute);
      }
      return skyMemo;
    }

    function skyAt(minute) {
      const stamp = ((minute % 1440) + 1440) % 1440;
      let from = SKY_FRAMES[0];
      let to = SKY_FRAMES[SKY_FRAMES.length - 1];
      for (let index = 0; index < SKY_FRAMES.length - 1; index += 1) {
        if (stamp >= SKY_FRAMES[index].at && stamp < SKY_FRAMES[index + 1].at) {
          from = SKY_FRAMES[index];
          to = SKY_FRAMES[index + 1];
          break;
        }
      }
      const span = to.at - from.at || 1;
      const raw = Math.min(1, Math.max(0, (stamp - from.at) / span));
      const ease = raw * raw * (3 - 2 * raw);
      return {
        phase: ease < 0.5 ? from.phase : to.phase,
        scale: mixNumber(from.scale, to.scale, ease),
        star: mixNumber(from.star, to.star, ease),
        colors: from.colors.map((color, index) => mixColor(color, to.colors[index] || color, ease)),
        orb: {
          c: mixColor(from.orb.c, to.orb.c, ease),
          a: mixNumber(from.orb.a, to.orb.a, ease),
          x: mixNumber(from.orb.x, to.orb.x, ease),
          y: mixNumber(from.orb.y, to.orb.y, ease),
        },
      };
    }

    let solarMemoKey = '';
    let solarMemo = null;
    function solarFor(location, date) {
      const key =
        date.toDateString() + '|' + (location ? location.lat + ',' + location.lon : 'none');
      if (key !== solarMemoKey) {
        solarMemoKey = key;
        solarMemo = location ? sunTimes(location, date) : null;
      }
      return solarMemo;
    }

    let moonMemoKey = '';
    let moonMemo = null;
    function moonFor(date) {
      const key = date.toDateString() + '|' + date.getHours();
      if (key !== moonMemoKey) {
        moonMemoKey = key;
        moonMemo = moonPhase(date);
      }
      return moonMemo;
    }

    // Where the sun or moon would be for this local minute. Sunrise and sunset
    // come from the same solar math as the Settings markers; without a
    // location, a plain 06:00/18:00 day still gives the background a motion.
    function celestialAt(minute, location) {
      const date = new Date();
      const moon = moonFor(date);
      const solar = solarFor(location, date);
      const southern = !!(location && location.lat < 0);
      if (solar && solar.kind === 'midnightSun') {
        return {
          kind: 'sun',
          t: 0.5,
          x: 0.5,
          y: 0.13,
          southern,
          phase: moon.value,
          illumination: moon.illumination,
        };
      }
      if (solar && solar.kind === 'polarNight') {
        return {
          kind: 'moon',
          t: 0.5,
          x: 0.5,
          y: 0.16,
          southern,
          phase: moon.value,
          illumination: moon.illumination,
        };
      }
      const sunrise = solar && solar.kind === 'normal' ? solar.sunrise : 360;
      const sunset = solar && solar.kind === 'normal' ? solar.sunset : 1080;
      const stamp = ((minute % 1440) + 1440) % 1440;
      const left = 0.14;
      const right = 0.86;
      // East is the right edge in this view; both sun and moon travel from
      // right (east) to left (west).
      if (stamp >= sunrise && stamp < sunset) {
        const t = (stamp - sunrise) / Math.max(1, sunset - sunrise);
        return {
          kind: 'sun',
          t,
          x: right - (right - left) * t,
          y: HORIZON - 0.2 * Math.sin(Math.PI * t),
          southern,
          phase: moon.value,
          illumination: moon.illumination,
        };
      }
      const night = Math.max(1, 1440 - sunset + sunrise);
      const elapsed = stamp >= sunset ? stamp - sunset : 1440 - sunset + stamp;
      const t = Math.min(1, Math.max(0, elapsed / night));
      return {
        kind: 'moon',
        t,
        x: right - (right - left) * t,
        y: HORIZON - 0.18 * Math.sin(Math.PI * t),
        southern,
        phase: moon.value,
        illumination: moon.illumination,
      };
    }

    function currentCelestial() {
      const minute = skyPreview === null ? secondsOfDay() / 60 : skyPreview;
      return celestialAt(minute, resolveSkyLocation(skyGeo));
    }

    // A tiny live sky thumbnail behind the composer sparkle: a warm or cool
    // sun/moon spot over the current two sky colors.
    function skyButtonBackground(sky, body) {
      if (!sky) return 'none';
      const [a, b, c] = sky.colors;
      const isSun = body && body.kind === 'sun';
      const x = body ? Math.round(10 + body.x * 80) : 50;
      const y = body ? Math.round(20 + body.y * 58) : 34;
      const color = isSun ? '255,226,170' : '205,222,255';
      const glow = isSun ? 0.55 : 0.45 + 0.45 * (body ? body.illumination / 100 : 0);
      return (
        'radial-gradient(circle at ' +
        x +
        '% ' +
        y +
        '%, rgba(' +
        color +
        ',' +
        glow +
        ') 0 8%, rgba(' +
        color +
        ',' +
        glow * 0.3 +
        ') 18%, rgba(' +
        color +
        ',0) 44%),' +
        'linear-gradient(145deg, rgba(' +
        a +
        ',0.36), rgba(' +
        b +
        ',0.15) 54%, rgba(' +
        c +
        ',0.3))'
      );
    }

    /* ------------------------------------------------------------------ */
    /* Atmosphere layer                                                    */
    /* ------------------------------------------------------------------ */

    function makeStars(w, h) {
      const count = Math.min(170, Math.max(40, Math.round((w * h) / 13000)));
      const stars = [];
      for (let index = 0; index < count; index += 1) {
        const near = Math.random() < 0.22;
        stars.push({
          x: Math.random(),
          y: Math.random(),
          r: near ? 0.75 + Math.random() * 1.15 : 0.3 + Math.random() * 0.8,
          tw: near
            ? 0.0004 + Math.random() * 0.0014
            : 0.0007 + Math.random() * 0.0024,
          ph: Math.random() * TAU,
          d: near ? 0.65 + Math.random() * 0.6 : 0.2 + Math.random() * 0.55,
          a: near ? 0.45 + Math.random() * 0.45 : 0.14 + Math.random() * 0.38,
        });
      }
      return stars;
    }

    function makeMilkyStars(w, h) {
      const count = Math.min(100, Math.max(30, Math.round(w / 14)));
      const stars = [];
      const angle = -0.55;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      for (let index = 0; index < count; index += 1) {
        const along = Math.random() - 0.5;
        const spread = (Math.random() + Math.random() + Math.random() - 1.5) * 0.06;
        const x = Math.min(0.98, Math.max(0.02, 0.5 + cos * along - sin * spread));
        const y = Math.min(0.78, Math.max(0.04, 0.43 + sin * along + cos * spread));
        stars.push({
          x,
          y,
          r: 0.25 + Math.random() * 0.55,
          tw: 0.0004 + Math.random() * 0.0018,
          ph: Math.random() * TAU,
          d: 0.2 + Math.random() * 0.5,
          a: 0.12 + Math.random() * 0.23,
        });
      }
      return stars;
    }

    function makeClouds(w, h) {
      const clouds = [];
      for (let index = 0; index < 6; index += 1) {
        clouds.push({
          x: 0.12 + Math.random() * 0.76,
          y: HORIZON - 0.12 + Math.random() * 0.23,
          rx: 0.14 + Math.random() * 0.18,
          ry: 0.02 + Math.random() * 0.028,
          a: 0.04 + Math.random() * 0.03,
          sx: 0.000018 + Math.random() * 0.00003,
          ax: 0.008 + Math.random() * 0.016,
          ay: 0.006 + Math.random() * 0.012,
          d: 0.3 + Math.random() * 0.5,
          p: Math.random() * TAU,
        });
      }
      return clouds;
    }

    function makeRain(w, h) {
      const count = Math.min(180, Math.max(80, Math.round(w / 8)));
      const drops = [];
      for (let index = 0; index < count; index += 1) {
        drops.push({
          x: Math.random(),
          y: Math.random(),
          speed: 520 + Math.random() * 380,
          wind: -30 + Math.random() * 60,
          len: 0.025 + Math.random() * 0.04,
          a: 0.16 + Math.random() * 0.28,
        });
      }
      return drops;
    }

    function makeSnow(w, h) {
      const count = Math.min(110, Math.max(50, Math.round(w / 14)));
      const flakes = [];
      for (let index = 0; index < count; index += 1) {
        flakes.push({
          x: Math.random(),
          y: Math.random(),
          speed: 22 + Math.random() * 38,
          phase: Math.random() * TAU,
          drift: 0.0008 + Math.random() * 0.0015,
          r: 0.8 + Math.random() * 1.8,
          a: 0.25 + Math.random() * 0.45,
        });
      }
      return flakes;
    }

    function NebulaLayer() {
      const on = useAmbienceEnabled();
      const canvasRef = useRef(null);

      useEffect(() => {
        if (!on) return undefined;
        const canvas = canvasRef.current;
        if (!canvas) return undefined;
        const g = canvas.getContext('2d');
        if (!g) return undefined;

        const motionQuery =
          typeof window.matchMedia === 'function'
            ? window.matchMedia('(prefers-reduced-motion: reduce)')
            : null;
        const reduced = () => !!(motionQuery && motionQuery.matches);

        let disposed = false;
        let raf = 0;
        let last = 0;
        let nextShot = 1500 + Math.random() * 2600;
        let w = 1;
        let h = 1;
        let dpr = 1;
        let stars = [];
        let milkyStars = [];
        let clouds = [];
        let rainDrops = [];
        let snowFlakes = [];
        let meteors = [];
        let nextLightning = 0;
        let lightningAt = 0;
        let lightningBolt = null;
        let shownWeather = weatherEnabled ? weather : null;
        let previousWeather = null;
        let weatherMix = 1;
        let pointerX = 0.5;
        let pointerY = 0.42;
        let easedX = 0.5;
        let easedY = 0.42;
        let visible = document.visibilityState !== 'hidden';

        function resize() {
          dpr = Math.min(window.devicePixelRatio || 1, 2);
          w = Math.max(1, window.innerWidth || 1);
          h = Math.max(1, window.innerHeight || 1);
          canvas.width = Math.round(w * dpr);
          canvas.height = Math.round(h * dpr);
          g.setTransform(dpr, 0, 0, dpr, 0, 0);
          stars = makeStars(w, h);
          milkyStars = makeMilkyStars(w, h);
          clouds = makeClouds(w, h);
          rainDrops = makeRain(w, h);
          snowFlakes = makeSnow(w, h);
        }

        function spawnMeteor() {
          const fromLeft = Math.random() < 0.55;
          const angle = fromLeft
            ? 0.32 + Math.random() * 0.3
            : Math.PI - (0.32 + Math.random() * 0.3);
          const speed = ((0.5 + Math.random() * 0.45) * Math.min(w, h)) / 900;
          return {
            x: (fromLeft ? 0.08 + Math.random() * 0.34 : 0.58 + Math.random() * 0.34) * w,
            y: (0.02 + Math.random() * 0.34) * h,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 1,
            decay: 1 / (620 + Math.random() * 520),
          };
        }

        function drawMeteor(meteor) {
          const alpha = Math.max(0, Math.min(1, meteor.life));
          const tailX = meteor.x - meteor.vx * 150;
          const tailY = meteor.y - meteor.vy * 150;
          const trail = g.createLinearGradient(meteor.x, meteor.y, tailX, tailY);
          trail.addColorStop(0, 'rgba(255,255,255,' + 0.9 * alpha + ')');
          trail.addColorStop(0.35, 'rgba(168,220,255,' + 0.42 * alpha + ')');
          trail.addColorStop(1, 'rgba(168,220,255,0)');
          g.strokeStyle = trail;
          g.lineWidth = 1.5;
          g.lineCap = 'round';
          g.beginPath();
          g.moveTo(meteor.x, meteor.y);
          g.lineTo(tailX, tailY);
          g.stroke();

          const head = g.createRadialGradient(meteor.x, meteor.y, 0, meteor.x, meteor.y, 7);
          head.addColorStop(0, 'rgba(255,255,255,' + 0.85 * alpha + ')');
          head.addColorStop(1, 'rgba(180,225,255,0)');
          g.fillStyle = head;
          g.beginPath();
          g.arc(meteor.x, meteor.y, 7, 0, TAU);
          g.fill();
        }

        function drawMilkyWay(sky) {
          if (!sky || sky.star < 0.35) return;
          const bandAlpha = 0.06 * sky.star;
          g.save();
          g.globalCompositeOperation = 'lighter';
          g.translate(w * 0.5, h * 0.43);
          g.rotate(-0.55);
          const band = g.createLinearGradient(0, -h * 0.16, 0, h * 0.16);
          band.addColorStop(0, 'rgba(160,190,255,0)');
          band.addColorStop(0.5, 'rgba(170,200,255,' + bandAlpha + ')');
          band.addColorStop(1, 'rgba(160,190,255,0)');
          g.fillStyle = band;
          g.fillRect(-w * 0.7, -h * 0.16, w * 1.4, h * 0.32);
          g.restore();
        }

        function drawClouds(now, px, py, sky, light, weather) {
          if (!sky || !clouds.length) return;
          const tint = light ? shadeColor(sky.colors[0], 0.45) : sky.colors[0];
          const cover = weather
            ? Math.min(1, Math.max(0, weather.cloud / 100))
            : 0.25;
          const kind = weather ? weatherKind(weather.code) : 'unknown';
          const alphaScale =
            kind === 'unknown' ? 0.75 : kind === 'clear' ? 0.25 : 0.55 + cover * 0.9;
          const activeClouds = weather
            ? Math.min(
                clouds.length,
                Math.max(1, Math.round(1 + cover * (clouds.length - 1))),
              )
            : Math.min(clouds.length, 3);
          const wind = weatherWindX(weather);
          const windDrift = wind * 0.000000045;
          g.save();
          g.globalCompositeOperation = 'source-over';
          for (let index = 0; index < activeClouds; index += 1) {
            const cloud = clouds[index];
            let baseX = cloud.x + windDrift * now;
            baseX = ((baseX % 1.4) + 1.4) % 1.4 - 0.2;
            const x =
              (baseX +
                Math.sin(now * cloud.sx + cloud.p) * cloud.ax +
                px * cloud.d * 0.004) *
              w;
            const y =
              (cloud.y +
                Math.cos(now * cloud.sx * 0.7 + cloud.p) * cloud.ay +
                py * cloud.d * 0.003) *
              h;
            const radius = cloud.ry * h;
            if (radius < 1) continue;
            g.save();
            g.translate(x, y);
            g.scale((cloud.rx * w) / radius, 1);
            const grad = g.createRadialGradient(0, 0, 0, 0, 0, radius);
            const alpha = cloud.a * alphaScale * (light ? 1.3 : 1);
            grad.addColorStop(0, 'rgba(' + tint + ',' + alpha + ')');
            grad.addColorStop(0.55, 'rgba(' + tint + ',' + alpha * 0.45 + ')');
            grad.addColorStop(1, 'rgba(' + tint + ',0)');
            g.fillStyle = grad;
            g.fillRect(-radius, -radius, radius * 2, radius * 2);
            g.restore();
          }
          g.restore();

          if (weather && cover > 0.45) {
            const veil = g.createLinearGradient(0, 0, 0, h * 0.72);
            veil.addColorStop(0, 'rgba(' + tint + ',' + (0.015 + cover * 0.055) + ')');
            veil.addColorStop(0.58, 'rgba(' + tint + ',' + (0.008 + cover * 0.03) + ')');
            veil.addColorStop(1, 'rgba(' + tint + ',0)');
            g.save();
            g.globalCompositeOperation = 'source-over';
            g.fillStyle = veil;
            g.fillRect(0, 0, w, h * 0.72);
            g.restore();
          }
        }

        function drawMoonShape(cx, cy, r, phase) {
          const p = ((phase % 1) + 1) % 1;
          const rx = Math.max(0.001, Math.abs(Math.cos(TAU * p)) * r);
          g.beginPath();
          if (p < 0.5) {
            // Waxing: lit on the right; the terminator swings from the right
            // rim at new moon, through the middle at first quarter, to the
            // left rim at full moon.
            g.arc(cx, cy, r, -Math.PI / 2, Math.PI / 2, false);
            g.ellipse(cx, cy, rx, r, 0, Math.PI / 2, -Math.PI / 2, p < 0.25);
          } else {
            // Waning: the mirror image, lit on the left.
            g.arc(cx, cy, r, -Math.PI / 2, Math.PI / 2, true);
            g.ellipse(cx, cy, rx, r, 0, Math.PI / 2, -Math.PI / 2, p < 0.75);
          }
          g.closePath();
        }

        function drawCelestial(body, sky, light, weatherDim) {
          if (!body || !sky) return;
          const span = Math.max(w, h);
          const isSun = body.kind === 'sun';
          const dim = Math.max(0, Math.min(1, weatherDim ?? 1));
          const r = Math.max(7, Math.min(isSun ? 13 : 18, span * (isSun ? 0.0095 : 0.011)));
          const cx = Math.max(18, Math.min(w - 18, body.x * w));
          const cy = Math.max(22, Math.min(h - 22, body.y * h));
          const lit = Math.max(0, Math.min(1, body.illumination / 100));
          const horizonFade = 0.45 + 0.55 * Math.sin(Math.PI * body.t);
          const alpha = (isSun ? 0.42 : 0.55 + 0.45 * lit) * horizonFade * dim;
          const color = isSun
            ? light
              ? '196,142,82'
              : sky.orb.c
            : light
              ? '86,106,146'
              : '208,222,255';
          const glowRadius = r * (isSun ? 8 : 7);
          const glowAlpha =
            (isSun ? (light ? 0.05 : 0.09) : light ? 0.035 : 0.04 + 0.14 * lit) *
            horizonFade *
            dim;

          g.globalCompositeOperation = light ? 'source-over' : 'lighter';
          const glow = g.createRadialGradient(cx, cy, 0, cx, cy, glowRadius);
          glow.addColorStop(0, 'rgba(' + color + ',' + glowAlpha + ')');
          glow.addColorStop(0.22, 'rgba(' + color + ',' + glowAlpha * 0.55 + ')');
          glow.addColorStop(0.55, 'rgba(' + color + ',' + glowAlpha * 0.16 + ')');
          glow.addColorStop(1, 'rgba(' + color + ',0)');
          g.fillStyle = glow;
          g.fillRect(cx - glowRadius, cy - glowRadius, glowRadius * 2, glowRadius * 2);

          if (isSun) {
            if (light) {
              g.fillStyle = 'rgba(' + color + ',' + 0.38 * alpha + ')';
              g.beginPath();
              g.arc(cx, cy, r, 0, TAU);
              g.fill();

              g.fillStyle = 'rgba(255,245,225,' + 0.32 * alpha + ')';
              g.beginPath();
              g.arc(cx, cy, r * 0.58, 0, TAU);
              g.fill();
            } else {
              g.fillStyle = 'rgba(255,205,130,' + 0.66 * alpha + ')';
              g.beginPath();
              g.arc(cx, cy, r, 0, TAU);
              g.fill();

              g.fillStyle = 'rgba(255,236,190,' + 0.72 * alpha + ')';
              g.beginPath();
              g.arc(cx, cy, r * 0.58, 0, TAU);
              g.fill();
            }
          } else {
            // The unlit disc is a faint silhouette; the lit part is cut with
            // two arcs so the phase is a real shape rather than a full disc.
            g.globalCompositeOperation = 'source-over';
            g.fillStyle = light
              ? 'rgba(255,255,255,' + 0.24 * horizonFade + ')'
              : 'rgba(190,210,245,' + (0.04 + 0.06 * lit) * horizonFade + ')';
            g.beginPath();
            g.arc(cx, cy, r, 0, TAU);
            g.fill();

            if (lit > 0.02) {
              g.globalCompositeOperation = light ? 'source-over' : 'lighter';
              g.fillStyle = light
                ? 'rgba(' + color + ',' + (0.25 + 0.2 * lit) * horizonFade + ')'
                : 'rgba(238,244,255,' + (0.6 + 0.3 * lit) * horizonFade + ')';
              if (body.southern) {
                g.save();
                g.translate(cx, cy);
                g.scale(-1, 1);
                g.translate(-cx, -cy);
                drawMoonShape(cx, cy, r, body.phase);
                g.fill();
                g.restore();
              } else {
                drawMoonShape(cx, cy, r, body.phase);
                g.fill();
              }
            } else {
              g.strokeStyle = light
                ? 'rgba(86,106,146,0.18)'
                : 'rgba(196,216,250,0.14)';
              g.lineWidth = 1;
              g.beginPath();
              g.arc(cx, cy, r, 0, TAU);
              g.stroke();
            }
          }
          g.globalCompositeOperation = light ? 'source-over' : 'lighter';
        }

        function drawWeather(now, dt, currentWeather, light, opacity, advance) {
          if (!currentWeather || opacity <= 0.01) return;
          const kind = weatherKind(currentWeather.code);

          if (kind === 'fog') {
            const tint = light ? '125,138,155' : '190,208,228';
            const alpha = (light ? 0.055 : 0.07) * opacity;
            const veil = g.createLinearGradient(0, 0, 0, h);
            veil.addColorStop(0, 'rgba(' + tint + ',' + alpha * 0.55 + ')');
            veil.addColorStop(0.45, 'rgba(' + tint + ',' + alpha + ')');
            veil.addColorStop(1, 'rgba(' + tint + ',' + alpha * 0.7 + ')');
            g.save();
            g.globalCompositeOperation = 'source-over';
            g.fillStyle = veil;
            g.fillRect(0, 0, w, h);
            g.restore();
            return;
          }

          if (kind === 'rain' || kind === 'storm') {
            const intensity = weatherIntensity(currentWeather);
            const active = Math.min(
              rainDrops.length,
              Math.max(24, Math.round(rainDrops.length * (0.3 + 0.7 * intensity))),
            );
            const step = dt > 0 ? Math.min(48, dt) / 1000 : 0;
            const wind = weatherWindX(currentWeather);
            const color = light ? '55,82,120' : '178,210,242';
            g.save();
            g.globalCompositeOperation = 'source-over';
            g.strokeStyle = 'rgba(' + color + ',1)';
            g.lineWidth = light ? 1.1 : 1.25;
            g.lineCap = 'round';
            for (let index = 0; index < active; index += 1) {
              const drop = rainDrops[index];
              if (step > 0 && advance) {
                drop.y += (drop.speed * step) / h;
                drop.x += ((drop.wind * 0.2 + wind) * step) / w;
                if (drop.y > 1.05) drop.y = ((drop.y + 0.05) % 1.1) - 0.05;
                if (drop.x < -0.05) drop.x = 1.05;
                else if (drop.x > 1.05) drop.x = -0.05;
              }
              const x = drop.x * w;
              const y = drop.y * h;
              g.globalAlpha =
                drop.a * (0.55 + 0.45 * intensity) * (light ? 0.85 : 1) * opacity;
              g.beginPath();
              g.moveTo(x, y);
              g.lineTo(x - (drop.wind * 0.2 + wind) * 0.08, y + drop.len * h);
              g.stroke();
            }
            g.restore();
          }

          if (kind === 'snow') {
            const wind = weatherWindX(currentWeather);
            const color = light ? '88,108,140' : '238,246,255';
            g.save();
            g.globalCompositeOperation = 'source-over';
            g.fillStyle = 'rgba(' + color + ',1)';
            for (let index = 0; index < snowFlakes.length; index += 1) {
              const flake = snowFlakes[index];
              if (dt > 0 && advance) {
                const step = Math.min(48, dt) / 1000;
                flake.y += (flake.speed * step) / h;
                flake.x +=
                  (wind * 0.45 * step) / w +
                  Math.sin(now * 0.0012 + flake.phase) * flake.drift * (step * 60);
                if (flake.y > 1.03) flake.y = ((flake.y + 0.03) % 1.06) - 0.03;
                if (flake.x < -0.03) flake.x = 1.03;
                else if (flake.x > 1.03) flake.x = -0.03;
              }
              g.globalAlpha = flake.a * (light ? 0.8 : 1) * opacity;
              g.beginPath();
              g.arc(flake.x * w, flake.y * h, flake.r, 0, TAU);
              g.fill();
            }
            g.restore();
          }

          if (kind === 'storm' && !reduced() && advance && opacity > 0.85) {
            if (!nextLightning) nextLightning = now + 3500 + Math.random() * 5000;
            if (now > nextLightning) {
              lightningAt = now;
              nextLightning = now + 7000 + Math.random() * 11000;
              let boltX = 0.2 + Math.random() * 0.6;
              let boltY = 0.04;
              const points = [{ x: boltX, y: boltY }];
              for (let index = 0; index < 6; index += 1) {
                boltX += (Math.random() - 0.5) * 0.05;
                boltY += 0.045 + Math.random() * 0.035;
                points.push({ x: boltX, y: boltY });
              }
              lightningBolt = points;
            }
            const age = now - lightningAt;
            if (lightningAt && age >= 0 && age < 180) {
              const fade = (1 - age / 180) * opacity;
              g.save();
              g.globalCompositeOperation = 'source-over';
              g.fillStyle = 'rgba(205,225,255,' + fade * 0.05 + ')';
              g.fillRect(0, 0, w, h);
              g.restore();

              if (lightningBolt) {
                g.save();
                g.globalCompositeOperation = 'lighter';
                g.strokeStyle = 'rgba(225,240,255,' + fade * 0.55 + ')';
                g.lineWidth = 1.5;
                g.lineJoin = 'round';
                g.beginPath();
                for (let index = 0; index < lightningBolt.length; index += 1) {
                  const point = lightningBolt[index];
                  if (index === 0) g.moveTo(point.x * w, point.y * h);
                  else g.lineTo(point.x * w, point.y * h);
                }
                g.stroke();
                g.restore();
              }
            }
          }
        }

        function draw(now, dt) {
          g.setTransform(dpr, 0, 0, dpr, 0, 0);
          g.clearRect(0, 0, w, h);

          const light = scheme === 'light';
          const sky = skyEnabled ? currentSky() : null;
          const body = sky ? currentCelestial() : null;
          const targetWeather = weatherEnabled ? weather : null;
          if (targetWeather !== shownWeather) {
            previousWeather = shownWeather;
            shownWeather = targetWeather;
            weatherMix = 0;
          }
          if (dt > 0) weatherMix = Math.min(1, weatherMix + dt / 900);
          else weatherMix = 1;
          const currentWeather = shownWeather;
          const starDim =
            previousWeather && weatherMix < 1
              ? mixNumber(weatherStarDim(previousWeather), weatherStarDim(currentWeather), weatherMix)
              : weatherStarDim(currentWeather);
          const bodyDim =
            previousWeather && weatherMix < 1
              ? mixNumber(weatherBodyDim(previousWeather), weatherBodyDim(currentWeather), weatherMix)
              : weatherBodyDim(currentWeather);
          let palette = light ? LIGHT : DARK;
          if (sky) {
            // A light page needs a real wash, not a hint: dark, saturated ink
            // for the pools, and a full-frame gradient so the phase is obvious.
            const lightScale = 0.55 + 0.65 * sky.scale;
            palette = {
              star: palette.star,
              starAlpha: palette.starAlpha * sky.star * starDim,
              glow: !light && sky.star > 0.3 && starDim > 0.4,
              blobs: palette.blobs.map((blob, index) => {
                const skyColor = sky.colors[index] || blob.c;
                return {
                  ...blob,
                  c: light ? shadeColor(skyColor, 0.45) : skyColor,
                  a: light
                    ? DARK.blobs[index].a * lightScale
                    : blob.a * (0.35 + 0.65 * sky.scale) * 1.9,
                };
              }),
            };
          }
          const span = Math.max(w, h);

          easedX += (pointerX - easedX) * 0.045;
          easedY += (pointerY - easedY) * 0.045;
          const px = (easedX - 0.5) * 2;
          const py = (easedY - 0.5) * 2;

          g.globalCompositeOperation = 'source-over';

          // A full-frame phase wash, not just the pools: the whole page shifts
          // from dawn amber through daylight blue to night violet.
          if (sky) {
            const washColor = light ? shadeColor(sky.colors[1], 0.45) : sky.colors[1];
            const wash = g.createLinearGradient(0, 0, 0, h);
            if (light) {
              wash.addColorStop(0, 'rgba(' + washColor + ',0.16)');
              wash.addColorStop(0.25, 'rgba(' + washColor + ',0.11)');
              wash.addColorStop(0.65, 'rgba(' + washColor + ',0.04)');
              wash.addColorStop(1, 'rgba(' + washColor + ',0)');
            } else {
              wash.addColorStop(0, 'rgba(' + washColor + ',0.1)');
              wash.addColorStop(0.42, 'rgba(' + washColor + ',0.045)');
              wash.addColorStop(0.72, 'rgba(' + washColor + ',0.018)');
              wash.addColorStop(1, 'rgba(3,5,12,0.12)');
            }
            g.fillStyle = wash;
            g.fillRect(0, 0, w, h);

            // A soft band at the arc's horizon grounds the sun and moon.
            const horizonY = HORIZON * h;
            const hazeTint = light ? shadeColor(sky.colors[0], 0.45) : sky.colors[0];
            const hazeAlpha =
              (light ? 0.035 : 0.015) + sky.orb.a * (light ? 0.9 : 0.6);
            const haze = g.createLinearGradient(
              0,
              horizonY - h * 0.18,
              0,
              horizonY + h * 0.18,
            );
            haze.addColorStop(0, 'rgba(' + hazeTint + ',0)');
            haze.addColorStop(0.5, 'rgba(' + hazeTint + ',' + hazeAlpha + ')');
            haze.addColorStop(1, 'rgba(' + hazeTint + ',0)');
            g.fillStyle = haze;
            g.fillRect(0, horizonY - h * 0.18, w, h * 0.36);
          }

          g.globalCompositeOperation = light ? 'source-over' : 'lighter';

          for (let index = 0; index < palette.blobs.length; index += 1) {
            const blob = palette.blobs[index];
            const x = (blob.x + Math.sin(now * blob.sx + blob.p) * blob.ax + px * blob.d * 0.012) * w;
            const y = (blob.y + Math.cos(now * blob.sy + blob.p * 1.7) * blob.ay + py * blob.d * 0.012) * h;
            const radius = span * blob.r * (1 + Math.sin(now * 0.00034 + blob.p) * 0.07);
            const pool = g.createRadialGradient(x, y, 0, x, y, radius);
            pool.addColorStop(0, 'rgba(' + blob.c + ',' + blob.a + ')');
            pool.addColorStop(0.42, 'rgba(' + blob.c + ',' + blob.a * 0.62 + ')');
            pool.addColorStop(0.72, 'rgba(' + blob.c + ',' + blob.a * 0.24 + ')');
            pool.addColorStop(1, 'rgba(' + blob.c + ',0)');
            g.fillStyle = pool;
            g.fillRect(x - radius, y - radius, radius * 2, radius * 2);
          }

          if (!light) drawMilkyWay(sky);

          // A soft sun (or moon) glow rides the top edge as the hours pass.
          if (!light && sky && sky.orb.a > 0.004) {
            const orbAlpha = sky.orb.a;
            const orbRadius = span * 0.55;
            const cx = sky.orb.x * w;
            const cy = sky.orb.y * h;
            const orb = g.createRadialGradient(cx, cy, 0, cx, cy, orbRadius);
            orb.addColorStop(0, 'rgba(' + sky.orb.c + ',' + orbAlpha + ')');
            orb.addColorStop(0.32, 'rgba(' + sky.orb.c + ',' + orbAlpha * 0.42 + ')');
            orb.addColorStop(1, 'rgba(' + sky.orb.c + ',0)');
            g.fillStyle = orb;
            g.fillRect(cx - orbRadius, cy - orbRadius, orbRadius * 2, orbRadius * 2);
          }

          g.globalCompositeOperation = light ? 'source-over' : 'lighter';
          g.fillStyle = palette.star;
          for (let index = 0; index < stars.length; index += 1) {
            const star = stars[index];
            const twinkle = 0.55 + 0.45 * Math.sin(now * star.tw + star.ph);
            const starX = star.x * w + px * star.d * 9;
            const starY = star.y * h + py * star.d * 6;
            let starAlpha = star.a * twinkle * palette.starAlpha;
            starAlpha *= Math.max(0.18, 1 - Math.max(0, starY / h - HORIZON) * 2.2);
            if (body) {
              const dx = starX - body.x * w;
              const dy = starY - body.y * h;
              const distance = Math.hypot(dx, dy);
              starAlpha *= 0.35 + 0.65 * Math.min(1, Math.max(0, (distance - 16) / 44));
            }
            if (star.r > 1.2) {
              g.globalAlpha = Math.max(0, starAlpha * 0.12);
              g.beginPath();
              g.arc(starX, starY, star.r * 3.2, 0, TAU);
              g.fill();
            }
            g.globalAlpha = Math.max(0, starAlpha);
            g.beginPath();
            g.arc(starX, starY, star.r, 0, TAU);
            g.fill();
          }

          if (!light && sky && sky.star > 0.35) {
            for (let index = 0; index < milkyStars.length; index += 1) {
              const star = milkyStars[index];
              const twinkle = 0.55 + 0.45 * Math.sin(now * star.tw + star.ph);
              const starX = star.x * w + px * star.d * 6;
              const starY = star.y * h + py * star.d * 4;
              let starAlpha = star.a * twinkle * palette.starAlpha;
              starAlpha *= Math.max(0.18, 1 - Math.max(0, starY / h - HORIZON) * 2.2);
              if (body) {
                const dx = starX - body.x * w;
                const dy = starY - body.y * h;
                const distance = Math.hypot(dx, dy);
                starAlpha *= 0.35 + 0.65 * Math.min(1, Math.max(0, (distance - 16) / 44));
              }
              g.globalAlpha = Math.max(0, starAlpha);
              g.beginPath();
              g.arc(starX, starY, star.r, 0, TAU);
              g.fill();
            }
          }
          g.globalAlpha = 1;

          if (sky) {
            drawClouds(now, px, py, sky, light, currentWeather);
            g.globalCompositeOperation = light ? 'source-over' : 'lighter';
          }

          if (palette.glow) {
            const lamp = g.createRadialGradient(
              easedX * w,
              easedY * h,
              0,
              easedX * w,
              easedY * h,
              Math.min(w, h) * 0.34,
            );
            lamp.addColorStop(0, 'rgba(130,205,255,0.055)');
            lamp.addColorStop(1, 'rgba(130,205,255,0)');
            g.fillStyle = lamp;
            g.fillRect(0, 0, w, h);

            if (!reduced() && now > nextShot) {
              meteors.push(spawnMeteor());
              nextShot = now + 6500 + Math.random() * 8500;
            }

            if (meteors.length) {
              for (let index = 0; index < meteors.length; index += 1) {
                const meteor = meteors[index];
                meteor.x += meteor.vx * dt;
                meteor.y += meteor.vy * dt;
                meteor.life -= dt * meteor.decay;
              }
              meteors = meteors.filter(
                (meteor) =>
                  meteor.life > 0 &&
                  meteor.x > -220 &&
                  meteor.x < w + 220 &&
                  meteor.y < h + 220,
              );
              for (let index = 0; index < meteors.length; index += 1) drawMeteor(meteors[index]);
            }
          }

          if (body) drawCelestial(body, sky, light, bodyDim);
          if (sky && previousWeather && weatherMix < 1) {
            drawWeather(now, dt, previousWeather, light, 1 - weatherMix, false);
          }
          if (sky && currentWeather && weatherMix > 0) {
            drawWeather(now, dt, currentWeather, light, weatherMix, true);
          }

          g.globalCompositeOperation = 'source-over';
          const vignette = g.createRadialGradient(
            w * 0.5,
            h * 0.45,
            Math.min(w, h) * 0.5,
            w * 0.5,
            h * 0.45,
            span * 0.82,
          );
          vignette.addColorStop(0, light ? 'rgba(255,255,255,0)' : 'rgba(3,5,12,0)');
          vignette.addColorStop(
            1,
            light ? 'rgba(120,110,140,0.045)' : 'rgba(3,5,12,0.14)',
          );
          g.fillStyle = vignette;
          g.fillRect(0, 0, w, h);
          g.globalCompositeOperation = 'source-over';
        }

        function tick(timestamp) {
          raf = 0;
          if (disposed || !visible) return;
          const now = timestamp || 0;
          const elapsed = last ? Math.min(48, Math.max(0, now - last)) : 16;
          if (last && elapsed < 31) {
            raf = requestAnimationFrame(tick);
            return;
          }
          last = now;
          draw(now, elapsed);
          if (!reduced()) raf = requestAnimationFrame(tick);
        }

        function kick() {
          if (disposed || !visible || reduced() || raf) return;
          last = 0;
          raf = requestAnimationFrame(tick);
        }

        function drawStill() {
          draw(4200, 0);
        }
        requestStaticRedraw = drawStill;

        // Reduced motion has no frame loop; keep the still frame on the clock.
        const stillTimer = window.setInterval(() => {
          if (!disposed && visible) drawStill();
        }, 30000);

        function onResize() {
          resize();
          drawStill();
        }

        function onVisibility() {
          const nextVisible = document.visibilityState !== 'hidden';
          if (nextVisible === visible) return;
          visible = nextVisible;
          if (visible) {
            last = 0;
            drawStill();
            kick();
          } else {
            cancelAnimationFrame(raf);
            raf = 0;
          }
        }

        function onPointer(event) {
          if (!event || !Number.isFinite(event.clientX)) return;
          pointerX = Math.min(1, Math.max(0, event.clientX / w));
          pointerY = Math.min(1, Math.max(0, event.clientY / h));
        }

        function onMotion() {
          cancelAnimationFrame(raf);
          raf = 0;
          last = 0;
          drawStill();
          kick();
        }

        resize();
        draw(4200, 0);
        kick();

        window.addEventListener('resize', onResize);
        window.addEventListener('pointermove', onPointer, { passive: true });
        document.addEventListener('visibilitychange', onVisibility);
        if (motionQuery) {
          if (typeof motionQuery.addEventListener === 'function') {
            motionQuery.addEventListener('change', onMotion);
          } else if (typeof motionQuery.addListener === 'function') {
            motionQuery.addListener(onMotion);
          }
        }

        return () => {
          disposed = true;
          if (requestStaticRedraw === drawStill) requestStaticRedraw = () => {};
          window.clearInterval(stillTimer);
          cancelAnimationFrame(raf);
          raf = 0;
          window.removeEventListener('resize', onResize);
          window.removeEventListener('pointermove', onPointer);
          document.removeEventListener('visibilitychange', onVisibility);
          if (motionQuery) {
            if (typeof motionQuery.removeEventListener === 'function') {
              motionQuery.removeEventListener('change', onMotion);
            } else if (typeof motionQuery.removeListener === 'function') {
              motionQuery.removeListener(onMotion);
            }
          }
          stars = [];
          meteors = [];
          g.clearRect(0, 0, w, h);
        };
      }, [on]);

      if (!on) return null;
      return h(
        React.Fragment,
        null,
        h('style', { key: 'style' }, CSS),
        h('canvas', {
          key: 'canvas',
          ref: canvasRef,
          className: 'dsh-nebula-canvas',
          'aria-hidden': 'true',
        }),
        h('div', {
          key: 'grain',
          className: 'dsh-nebula-grain',
          'aria-hidden': 'true',
        }),
      );
    }

    /* ------------------------------------------------------------------ */
    /* Toggle                                                              */
    /* ------------------------------------------------------------------ */

    function NebulaToggle() {
      const on = useSkyEnabled();
      const minute = useSkyMinute();
      const geo = useSkyGeo();
      const location = resolveSkyLocation(geo);
      const sky = skyAt(minute);
      const body = celestialAt(minute, location);
      const skyBackground = on ? skyButtonBackground(sky, body) : 'none';
      const action = t(on ? 'actionOn' : 'actionOff');
      const hint = t(on ? 'toggleOn' : 'toggleOff');
      return h(
        React.Fragment,
        null,
        h('style', { key: 'style' }, CSS),
        h(
          'button',
          {
            key: 'button',
            type: 'button',
            className: 'dsh-nebula-toggle' + (on ? ' is-on' : ''),
            style: { '--dsh-nebula-sky-bg': skyBackground },
            'aria-pressed': on,
            'aria-label': action,
            title: hint,
            onClick: () => setSkyEnabled(!skyEnabled),
          },
          h(
            'svg',
            {
              className: 'dsh-nebula-glyph',
              viewBox: '0 0 24 24',
              width: 16,
              height: 16,
              fill: 'none',
              'aria-hidden': 'true',
              focusable: 'false',
            },
            h('path', {
              d: 'M12 2.6c.5 4.7 2.2 6.4 6.9 6.9-4.7.5-6.4 2.2-6.9 6.9-.5-4.7-2.2-6.4-6.9-6.9 4.7-.5 6.4-2.2 6.9-6.9z',
              fill: 'currentColor',
            }),
            h('circle', { cx: 18.4, cy: 17.6, r: 1.5, fill: 'currentColor', opacity: 0.65 }),
            h('circle', { cx: 5.4, cy: 19.2, r: 1, fill: 'currentColor', opacity: 0.45 }),
          ),
        ),
      );
    }

    /* ------------------------------------------------------------------ */
    /* Sky settings row                                                    */
    /* ------------------------------------------------------------------ */

    const MOON_GLYPHS = {
      moonNew: '🌑',
      moonWaxingCrescent: '🌒',
      moonFirstQuarter: '🌓',
      moonWaxingGibbous: '🌔',
      moonFull: '🌕',
      moonWaningGibbous: '🌖',
      moonLastQuarter: '🌗',
      moonWaningCrescent: '🌘',
    };

    function SunIcon() {
      return h(
        'svg',
        {
          className: 'dsh-sky-sun-icon',
          viewBox: '0 0 12 12',
          width: 10,
          height: 10,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.2,
          strokeLinecap: 'round',
          'aria-hidden': 'true',
          focusable: 'false',
        },
        h('circle', { cx: 6, cy: 6, r: 2.1, fill: 'currentColor', stroke: 'none' }),
        h('path', {
          d: 'M6 1v1.6M6 9.4V11M1 6h1.6M9.4 6H11M2.5 2.5l1.1 1.1M8.4 8.4l1.1 1.1M9.5 2.5 8.4 3.6M3.6 8.4 2.5 9.5',
        }),
      );
    }

    function WeatherGlyph({ kind }) {
      const common = {
        className: 'dsh-weather-glyph',
        viewBox: '0 0 16 16',
        width: 14,
        height: 14,
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': 'true',
        focusable: 'false',
      };
      if (kind === 'clear') {
        return h(
          'svg',
          common,
          h('circle', { cx: 8, cy: 8, r: 2.6, fill: 'currentColor', stroke: 'none' }),
          h('path', { d: 'M8 1.2v1.5M8 13.3v1.5M1.2 8h1.5M13.3 8h1.5M3.2 3.2l1 1M11.8 11.8l1 1M12.8 3.2l-1 1M4.2 11.8l-1 1' }),
        );
      }
      if (kind === 'fog') {
        return h('svg', common, h('path', { d: 'M2.2 6.2h11.6M1.4 8.9h13.2M3 11.6h10' }));
      }
      const cloud = h('path', {
        d: 'M4.4 10.9h7.2a2 2 0 0 0 .1-4 3 3 0 0 0-5.7-1 2.6 2.6 0 0 0-1.6 5Z',
        fill: kind === 'overcast' ? 'currentColor' : 'none',
        fillOpacity: kind === 'overcast' ? 0.18 : 0,
      });
      if (kind === 'rain') {
        return h(
          'svg',
          common,
          cloud,
          h('path', { d: 'M5.8 12.4 5.3 14M9.8 12.4 9.3 14' }),
        );
      }
      if (kind === 'snow') {
        return h(
          'svg',
          common,
          cloud,
          h('path', { d: 'M6 12.6v2M5 13.6h2M10.4 12.6v2M9.4 13.6h2' }),
        );
      }
      if (kind === 'storm') {
        return h(
          'svg',
          common,
          cloud,
          h('path', { d: 'M8.4 11.2 7 13.7h1.5l-.8 2' }),
        );
      }
      return h('svg', common, cloud);
    }

    function SkyRow() {
      const ambienceOn = useAmbienceEnabled();
      const skyOn = useSkyEnabled();
      const weatherOn = useWeatherEnabled();
      const currentWeather = useSkyWeather();
      const themeOn = themeApi.useEnabled();
      const preview = useSkyPreview();
      const geo = useSkyGeo();
      const location = resolveSkyLocation(geo);
      const southern = !!(location && location.lat < 0);
      const [minute, setMinute] = useState(() => minuteOfDay());
      const dragging = useRef(false);
      const stripRef = useRef(null);

      useEffect(() => {
        const sync = () => {
          setMinute(minuteOfDay());
          // Under reduced motion there is no frame loop, so nudge the still frame.
          requestStaticRedraw();
        };
        sync();
        const timer = window.setInterval(sync, 60000);
        document.addEventListener('visibilitychange', sync);
        return () => {
          window.clearInterval(timer);
          document.removeEventListener('visibilitychange', sync);
        };
      }, []);

      const live = preview === null;
      const shownMinute = live ? minute : preview;
      const sample = skyAt(shownMinute);
      const canScrub = ambienceOn && skyOn;
      const status = !ambienceOn
        ? t('ambienceOffStatus')
        : !skyOn
          ? t('skyFixed')
          : (live ? t('skyStatus') : t('skyPreviewStatus'))
              .replace('{phase}', t(sample.phase))
              .replace('{time}', clockTime(shownMinute));
      const hintKey = !ambienceOn
        ? 'skyHintAmbienceOff'
        : !skyOn
          ? 'skyHintFixed'
          : live
            ? 'skyHint'
            : 'skyHintPreview';
      const hint = t(hintKey)
        .replace('{phase}', t(sample.phase))
        .replace('{time}', clockTime(shownMinute));
      const marker = Math.min(99.4, Math.max(0.6, (shownMinute / 1440) * 100));
      const moon = moonPhase();
      const moonLabel = t(moon.key) + ' ' + moon.illumination + '%';
      const weatherKindNow = currentWeather ? weatherKind(currentWeather.code) : null;
      const weatherLabel = h(
        React.Fragment,
        null,
        weatherOn && weatherKindNow ? h(WeatherGlyph, { kind: weatherKindNow }) : null,
        weatherOn && weatherKindNow ? ' ' : null,
        t('weatherLabel'),
      );
      const weatherSummary = !weatherOn
        ? t('weatherOff')
        : currentWeather
          ? [
              t(weatherConditionKey(currentWeather.code)),
              Number.isFinite(Number(currentWeather.cloud))
                ? Math.round(currentWeather.cloud) + '% ' + t('weatherCloud')
                : null,
              Number.isFinite(Number(currentWeather.temp))
                ? Math.round(currentWeather.temp) + '°C'
                : null,
            ]
              .filter(Boolean)
              .join(' · ')
          : t('weatherPending');
      const sun = location ? sunTimes(location) : null;
      const sunPercent = (value) => Math.min(99.2, Math.max(0.8, (value / 1440) * 100));

      const scrubTo = (event) => {
        const rect =
          event.currentTarget && event.currentTarget.getBoundingClientRect
            ? event.currentTarget.getBoundingClientRect()
            : null;
        if (!rect || !rect.width) return;
        const ratio = (event.clientX - rect.left) / rect.width;
        setSkyPreview(Math.min(1, Math.max(0, ratio)) * 1439);
      };

      const onPointerDown = (event) => {
        if (!canScrub) return;
        dragging.current = true;
        if (typeof event.currentTarget.focus === 'function') event.currentTarget.focus();
        if (typeof event.preventDefault === 'function') event.preventDefault();
        if (event.currentTarget.setPointerCapture) {
          try {
            event.currentTarget.setPointerCapture(event.pointerId);
          } catch {
            /* Pointer capture is best-effort. */
          }
        }
        scrubTo(event);
      };

      const onPointerMove = (event) => {
        if (!dragging.current || !canScrub) return;
        scrubTo(event);
      };

      const onPointerUp = (event) => {
        dragging.current = false;
        if (event.currentTarget.releasePointerCapture) {
          try {
            event.currentTarget.releasePointerCapture(event.pointerId);
          } catch {
            /* Already released. */
          }
        }
      };

      const onKeyDown = (event) => {
        if (!canScrub) return;
        const step = event.shiftKey ? 60 : 15;
        let next = shownMinute;
        if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') next -= step;
        else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next += step;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = 1439;
        else if (event.key === 'Escape') {
          setSkyPreview(null);
          event.preventDefault();
          return;
        } else return;
        event.preventDefault();
        setSkyPreview(Math.min(1439, Math.max(0, next)));
      };

      const option = (key, label, on, toggle, actionOn, actionOff) =>
        h(
          'div',
          { key, className: 'dsh-sky-option' },
          h('span', { className: 'dsh-sky-option-label' }, label),
          h(
            'button',
            {
              type: 'button',
              role: 'switch',
              className: 'dsh-sky-switch' + (on ? ' is-on' : ''),
              'aria-checked': on,
              'aria-label': t(on ? actionOn : actionOff),
              title: t(on ? actionOn : actionOff),
              onClick: toggle,
            },
            h('span', { className: 'dsh-sky-knob' }),
          ),
        );

      return h(
        React.Fragment,
        null,
        h('style', { key: 'style' }, CSS),
        h(
          'div',
          { key: 'row', className: 'dsh-sky-row' },
          h(
            'div',
            { className: 'dsh-sky-head' },
            h(
              'div',
              { className: 'dsh-sky-title-group' },
              h('div', { className: 'dsh-sky-title' }, t('skyTitle')),
              h(
                'span',
                {
                  className: 'dsh-sky-moon',
                  role: 'img',
                  'aria-label': moonLabel,
                  title: moonLabel,
                },
                h(
                  'span',
                  {
                    'aria-hidden': 'true',
                    style: southern ? { transform: 'scaleX(-1)' } : undefined,
                  },
                  MOON_GLYPHS[moon.key] || '',
                ),
              ),
            ),
            h(
              'div',
              { className: 'dsh-sky-head-right' },
              h('div', { className: 'dsh-sky-state' }, status),
              live
                ? null
                : h(
                    'button',
                    {
                      type: 'button',
                      className: 'dsh-sky-live',
                      onClick: () => {
                        setSkyPreview(null);
                        if (stripRef.current && typeof stripRef.current.focus === 'function') {
                          stripRef.current.focus();
                        }
                      },
                    },
                    t('skyLive'),
                  ),
            ),
          ),
          h(
            'div',
            {
              ref: stripRef,
              className: 'dsh-sky-strip' + (canScrub ? '' : ' is-off') + (live ? '' : ' is-preview'),
              role: 'slider',
              tabIndex: canScrub ? 0 : -1,
              'aria-disabled': canScrub ? undefined : true,
              'aria-label': t('skyScrub'),
              'aria-valuemin': 0,
              'aria-valuemax': 1439,
              'aria-valuenow': shownMinute,
              'aria-valuetext': t(sample.phase) + ' ' + clockTime(shownMinute),
              onPointerDown,
              onPointerMove,
              onPointerUp,
              onPointerCancel: onPointerUp,
              onKeyDown,
            },
            h('span', { className: 'dsh-sky-mark', style: { left: marker + '%' } }),
            sun && sun.kind === 'normal'
              ? [
                  h(
                    'span',
                    {
                      key: 'sunrise',
                      className: 'dsh-sky-sun is-rise',
                      style: { left: sunPercent(sun.sunrise) + '%' },
                      role: 'img',
                      'aria-label': t('skySunrise') + ' ' + clockTime(sun.sunrise),
                      title: t('skySunrise') + ' ' + clockTime(sun.sunrise),
                    },
                    h(SunIcon),
                  ),
                  h(
                    'span',
                    {
                      key: 'sunset',
                      className: 'dsh-sky-sun is-set',
                      style: { left: sunPercent(sun.sunset) + '%' },
                      role: 'img',
                      'aria-label': t('skySunset') + ' ' + clockTime(sun.sunset),
                      title: t('skySunset') + ' ' + clockTime(sun.sunset),
                    },
                    h(SunIcon),
                  ),
                ]
              : null,
          ),
          h(
            'div',
            { className: 'dsh-sky-options' },
            option('clock', t('skyFollow'), skyOn, () => setSkyEnabled(!skyEnabled), 'skyActionOn', 'skyActionOff'),
            option(
              'weather',
              weatherLabel,
              weatherOn,
              () => setWeatherEnabled(!weatherEnabled),
              'weatherActionOn',
              'weatherActionOff',
            ),
            option('theme', t('themeLabel'), themeOn, () => themeApi.setEnabled(!themeOn), 'themeActionOn', 'themeActionOff'),
            option(
              'ambience',
              t('ambienceLabel'),
              ambienceOn,
              () => setAmbienceEnabled(!ambienceEnabled),
              'ambienceActionOn',
              'ambienceActionOff',
            ),
          ),
          h('div', { className: 'dsh-sky-weather-summary', 'aria-live': 'polite' }, weatherSummary),
          h('div', { className: 'dsh-sky-hint' }, hint),
        ),
      );
    }

    return {
      apply(ctx) {
        const themeFace = ctx.get('theme');
        if (themeFace && typeof themeFace.getTheme === 'function') {
          try {
            const snapshot = themeFace.getTheme();
            if (snapshot && snapshot.active && snapshot.active.colorScheme) {
              scheme = snapshot.active.colorScheme;
            }
          } catch {
            /* Keep the dark palette when the snapshot is unavailable. */
          }
        }
        ctx.on('theme/change', (snapshot) => {
          if (snapshot && snapshot.active && snapshot.active.colorScheme) {
            scheme = snapshot.active.colorScheme;
          }
          requestStaticRedraw();
        });

        seedDefaults(themeApi);

        ctx.effect(() => {
          const controller = refreshGeo();
          return () => {
            if (controller) controller.abort();
          };
        });

        ctx.effect(() => {
          if (weatherEnabled) refreshWeather(resolveSkyLocation(skyGeo));
          const timer = window.setInterval(() => {
            if (weatherEnabled) refreshWeather(resolveSkyLocation(skyGeo));
          }, WEATHER_TTL_MS);
          return () => {
            window.clearInterval(timer);
            if (weatherController) weatherController.abort();
          };
        });

        if (themeFace) {
          // Wait for the host settings section to hydrate before writing a
          // preference; an early write is rejected and then reverts.
          ctx.effect(() => {
            const timer = window.setTimeout(() => {
              if (skyEnabled) seedDarkTheme(themeFace);
            }, 1800);
            return () => window.clearTimeout(timer);
          });
        }

        const localeFace = ctx.get('locale');
        if (localeFace) {
          ctx.effect(() => {
            const disposers = [];
            const dictionaries = [['en', EN]];
            for (const [tag, dictionary] of dictionaries) {
              try {
                disposers.push(localeFace.register(NS, tag, dictionary));
              } catch {
                /* A previous generation already registered this namespace. */
              }
            }
            translate = localeFace.bind(NS);
            return () => {
              while (disposers.length) {
                try {
                  disposers.pop()();
                } catch {
                  /* Already disposed. */
                }
              }
            };
          });
          ctx.on('locale/change', () => {
            translate = localeFace.bind(NS);
            emit();
          });
        }

        ctx.slots.inject('shell.overlay', () =>
          ctx.slots.register(
            { name: 'shell.overlay', id: 'nebula-layer', order: -5 },
            NebulaLayer,
          ),
        );
        ctx.slots.inject('conversation.input.right', () =>
          ctx.slots.register(
            { name: 'conversation.input.right', id: 'nebula-toggle', order: 20 },
            NebulaToggle,
          ),
        );
        ctx.slots.inject('settings.general.item', () =>
          ctx.slots.register(
            { name: 'settings.general.item', id: 'nebula-sky-row', order: 26 },
            SkyRow,
          ),
        );
      },
    };
    }


    function createNebulaTheme() {
    const React = require('react');
    const { useEffect, useReducer } = React;

    const THEME_KEY = 'dsh.nebula-theme.enabled';
    const SOURCE = 'dsh-nebula-theme';

    // Every alias token the built-in themes own. Light values stay airy; dark
    // values are the deep-space palette the aurora was drawn for.
    const TOKENS = {
      // surfaces
      '--dsw-alias-bg-base': { dark: '#182238', light: '#e6edfb' },
      '--dsw-alias-bg-layer-1': { dark: '#1e2a46', light: '#eef3fe' },
      '--dsw-alias-bg-layer-2': { dark: '#243152', light: '#e1e9f9' },
      '--dsw-alias-bg-layer-3': { dark: '#2c3b61', light: '#d6e0f5' },
      '--dsw-alias-bg-overlay': { dark: '#2a385c', light: '#dfe8f8' },
      '--dsw-alias-bg-module-platform': { dark: '#243152', light: '#e5ecfa' },
      '--dsw-alias-bg-multi-select': { dark: '#243152', light: '#e5ecfa' },
      '--dsw-alias-bg-document-preview': { dark: '#121b2e', light: '#f4f7ff' },
      '--dsw-alias-bg-document-selection': { dark: 'rgba(168,186,255,0.25)', light: 'rgba(67,56,202,0.16)' },
      '--dsw-alias-bg-skeleton': { dark: 'rgba(242,245,255,0.08)', light: 'rgba(19,27,50,0.06)' },
      '--dsw-specific-input-major': { dark: '#243152', light: '#ffffff' },
      '--dsw-specific-login-input': { dark: '#1e2a46', light: '#eef3fe' },
      '--dsw-specific-selector': { dark: '#243152', light: '#e1e9f9' },
      '--dsw-specific-sidebar-fill': { dark: '#121b2e', light: '#dfe8f7' },
      '--dsw-specific-sidebar-nav-item-active-accent': { dark: '#2c3b61', light: '#cfdbf3' },
      '--dsw-specific-sidebar-nav-item-active': { dark: '#2c3b61', light: '#d6e0f5' },
      '--dsw-specific-sidebar-nav-item-hover': { dark: '#243152', light: '#dfe8f8' },
      '--dsw-specific-bubble': { dark: '#243152', light: '#e1e9f9' },
      '--dsw-specific-bubble-highlight': { dark: '#2c3b61', light: '#d6e0f5' },
      '--dsw-specific-tip': { dark: '#243152', light: '#e5ecfa' },
      '--dsw-specific-menu': { dark: '#243152eb', light: '#f7f9ffeb' },
      '--dsw-menu-surface-fill': { dark: '#243152eb', light: '#f7f9ffeb' },
      '--dsw-alias-menu-group-header-fill': { dark: '#1e2a46f0', light: '#e6edfbf0' },
      // borders
      '--dsw-alias-border-l1': { dark: '#32436a', light: '#c9d5ec' },
      '--dsw-alias-border-l2': { dark: '#40527d', light: '#b9c8e4' },
      '--dsw-alias-border-l2-darkmode-thin': { dark: '#32436a', light: '#c9d5ec' },
      '--dsw-alias-border-l3': { dark: '#4e6190', light: '#aabbe0' },
      '--dsw-alias-border-l4': { dark: '#5d72a4', light: '#9db0d8' },
      '--dsw-alias-border-inverted': { dark: 'rgba(255,255,255,0.06)', light: 'rgba(19,27,50,0.06)' },
      '--dsw-alias-border-inverted2': { dark: 'rgba(255,255,255,0.10)', light: 'rgba(19,27,50,0.10)' },
      '--dsw-elevation-stroke-color': { dark: '#32436a', light: '#c9d5ec' },
      // text
      '--dsw-alias-label-primary': { dark: '#f2f5ff', light: '#101a36' },
      '--dsw-alias-label-secondary': { dark: '#c2cde4', light: '#56637f' },
      '--dsw-alias-label-tertiary': { dark: '#9aa8c4', light: '#74809a' },
      '--dsw-alias-label-caption': { dark: '#8593b0', light: '#8b97b0' },
      '--dsw-alias-label-dimmed': { dark: '#dbe3f7', light: '#dbe3f2' },
      '--dsw-alias-label-primary-bluish': { dark: '#e8efff', light: '#2a3a80' },
      '--dsw-alias-label-primary-dimmed': { dark: '#dbe3f7', light: '#1b2540' },
      '--dsw-alias-label-primary-foreground': { dark: '#182238', light: '#f7f9ff' },
      '--dsw-alias-label-primary-inverted': { dark: '#0f1c31', light: '#f7f9ff' },
      '--dsw-alias-label-document-preview': { dark: '#c2cde4', light: '#56637f' },
      '--dsw-alias-menu-icon': { dark: '#dbe3f7', light: '#2a3550' },
      '--dsw-alias-link': { dark: '#a8baff', light: '#4338ca' },
      '--dsw-alias-brand-primary': { dark: '#a8baff', light: '#4338ca' },
      '--dsw-alias-brand-text': { dark: '#182238', light: '#f7f9ff' },
      '--dsw-alias-brand-primary-invert': { dark: '#eef2ff', light: '#050814' },
      '--dsw-alias-switch-thumb': { dark: '#f2f5ff', light: '#f7f9ff' },
      // interactive and buttons
      '--dsw-alias-interactive-bg-hover': { dark: 'rgba(168,186,255,0.10)', light: 'rgba(67,56,202,0.07)' },
      '--dsw-alias-interactive-bg-active': { dark: 'rgba(168,186,255,0.16)', light: 'rgba(67,56,202,0.12)' },
      '--dsw-alias-interactive-bg-hover-solid': { dark: '#2c3b61', light: '#dfe7fa' },
      '--dsw-alias-interactive-bg-hover-accent': { dark: 'rgba(168,186,255,0.20)', light: 'rgba(67,56,202,0.14)' },
      '--dsw-alias-interactive-bg-hover-danger': { dark: 'rgba(251,113,133,0.12)', light: 'rgba(220,38,38,0.08)' },
      '--dsw-alias-button-contrast-fill': { dark: '#f2f5ff', light: '#101a36' },
      '--dsw-alias-button-elevated-fill': { dark: '#2c3b61', light: '#f7f9ff' },
      '--dsw-alias-button-floating-fill': { dark: '#243152', light: '#f7f9ff' },
      '--dsw-alias-button-floating-hover': { dark: '#2c3b61', light: '#e8eefc' },
      '--dsw-alias-button-ghost-active-border': { dark: '#4e6190', light: '#a6b7d8' },
      '--dsw-alias-button-ghost-active-fill': { dark: '#2c3b61', light: '#dfe7fa' },
      '--dsw-alias-button-ghost-active-hover': { dark: '#30406a', light: '#d3ddf2' },
      '--dsw-alias-button-info-fill': { dark: '#a8baff', light: '#4338ca' },
      '--dsw-alias-button-info-hover': { dark: '#bfcdff', light: '#5b4fe0' },
      '--dsw-alias-button-primary-dimmed': { dark: '#2c3b61', light: '#dfe7fa' },
      '--dsw-alias-button-primary-fill': { dark: '#a8baff', light: '#4338ca' },
      '--dsw-alias-button-primary-hover': { dark: '#bfcdff', light: '#3730a3' },
      '--dsw-alias-button-tool-bar-fill': { dark: 'rgba(168,186,255,0.14)', light: 'rgba(67,56,202,0.10)' },
      '--dsw-alias-button-tool-bar-fill-invisible': { dark: 'rgba(168,186,255,0.06)', light: 'rgba(67,56,202,0.04)' },
      '--dsw-alias-button-tool-bar-hover': { dark: 'rgba(168,186,255,0.22)', light: 'rgba(67,56,202,0.16)' },
      // states
      '--dsw-alias-state-error-primary': { dark: '#fb7185', light: '#dc2626' },
      '--dsw-alias-state-error-secondary': { dark: '#fda4af', light: '#ef4444' },
      '--dsw-alias-state-idle-primary': { dark: '#9aa8c4', light: '#64748b' },
      '--dsw-alias-state-success-primary': { dark: '#4ade80', light: '#059669' },
      '--dsw-alias-state-success-secondary': { dark: '#86efac', light: '#10b981' },
      '--dsw-alias-state-success-tertiary': { dark: '#143a2b', light: '#d1fae5' },
      '--dsw-alias-state-warn-primary': { dark: '#fbbf24', light: '#b45309' },
      '--dsw-alias-state-warn-label': { dark: '#fbbf24', light: '#b45309' },
      '--dsw-alias-state-warn-secondary': { dark: '#fcd34d', light: '#d97706' },
      '--dsw-alias-state-warn-tertiary': { dark: '#3a2a08', light: '#fef3c7' },
      '--dsw-alias-state-business-primary': { dark: '#a8baff', light: '#4338ca' },
      '--dsw-alias-state-business-tertiary': { dark: '#2c3b61', light: '#eef2ff' },
      // markdown and code
      '--dsw-alias-markdown-citation': { dark: '#243152', light: '#e1e9f9' },
      '--dsw-alias-markdown-code-block': { dark: '#121b2e', light: '#eef3fe' },
      '--dsw-alias-markdown-code-block-banner': { dark: '#1e2a46', light: '#e1e9f9' },
      '--dsw-alias-markdown-code-segment-selected': { dark: '#2c3b61', light: '#ffffff' },
      '--dsw-alias-markdown-code-segment-unselected': { dark: '#121b2e', light: '#e6eefb' },
      '--dsw-alias-markdown-inline-code': { dark: '#243152', light: '#e1e9f9' },
      '--dsw-alias-markdown-placeholder': { dark: '#243152', light: '#f4f7ff' },
      '--dsw-alias-markdown-tag': { dark: '#243152', light: '#e1e9f9' },
      '--dsw-alias-turn-trigger-bg': { dark: '#243152', light: '#e1e9f9' },
      '--dsw-alias-turn-trigger-bg-hover': { dark: '#2c3b61', light: '#d6e0f5' },
      // scrollbars
      '--dsw-alias-scrollbar-bg-l1': { dark: '#32436a', light: '#c9d5ec' },
      '--dsw-alias-scrollbar-bg-l2': { dark: '#40527d', light: '#b9c8e4' },
      '--dsw-alias-scrollbar-hover-l1': { dark: '#40527d', light: '#aabbe0' },
      '--dsw-alias-scrollbar-hover-l2': { dark: '#4e6190', light: '#9db0d8' },
      // toast, tooltip, focus
      '--dsw-alias-toast-bg': { dark: '#30406a', light: '#1b2540' },
      '--dsw-alias-toast-label': { dark: '#f2f5ff', light: '#f7f9ff' },
      '--dsw-alias-tooltip-bg': { dark: '#2c3b61', light: '#1b2540' },
      '--dsw-alias-tooltip-key-bg': { dark: '#40527d', light: '#34466f' },
      '--dsw-focus-ring-color': { dark: '#a8baff', light: '#4338ca' },
      // thinking gradients
      '--dsw-linear-gradient-think': { dark: 'linear-gradient(180deg, #1e2a46 20.19%, #1e2a4600 100%)', light: 'linear-gradient(180deg, #eef3fe 20.19%, #eef3fe00 100%)' },
      '--dsw-linear-think-select': { dark: 'linear-gradient(180deg, #243152 20.19%, #24315200 100%)', light: 'linear-gradient(180deg, #e1e9f9 20.19%, #e1e9f900 100%)' },
    };

    let enabled = (() => {
      try {
        const raw = window.localStorage.getItem(THEME_KEY);
        return raw === null ? true : raw !== '0';
      } catch {
        return true;
      }
    })();

    let runtime = null;
    let themeFace = null;
    let override = null;
    const listeners = new Set();

    function emit() {
      for (const listener of listeners) listener();
    }


    function disposeOverride() {
      if (!override) return;
      try {
        override();
      } catch {
        /* Already disposed. */
      }
      override = null;
    }

    function applyOverride() {
      if (!enabled) {
        disposeOverride();
        return;
      }
      const face = themeFace || (runtime && runtime.get('theme'));
      if (!face || typeof face.overrideTokens !== 'function') return;
      themeFace = face;
      disposeOverride();
      try {
        override = face.overrideTokens(SOURCE, TOKENS);
      } catch {
        override = null;
      }
    }

    function setEnabled(next) {
      if (enabled === next) return;
      enabled = next;
      try {
        window.localStorage.setItem(THEME_KEY, next ? '1' : '0');
      } catch {
        /* Private mode: the session preference still applies. */
      }
      if (next) applyOverride();
      else disposeOverride();
      emit();
    }

    function useEnabled() {
      const [, force] = useReducer((version) => version + 1, 0);
      useEffect(() => {
        listeners.add(force);
        return () => {
          listeners.delete(force);
        };
      }, []);
      return enabled;
    }

    return {
      apply(ctx) {
        runtime = ctx;
        themeFace = ctx.get('theme') || null;
        if (enabled) applyOverride();
        ctx.effect(() => () => {
          disposeOverride();
        });
        // The theme service can arrive a beat after this plugin; retry once.
        ctx.effect(() => {
          const timer = window.setTimeout(() => {
            if (enabled && !override) applyOverride();
          }, 700);
          return () => window.clearTimeout(timer);
        });
      },
      useEnabled,
      setEnabled,
    };
    }

    function createStation() {
    const React = require('react');
    const h = React.createElement;
    const { useEffect, useReducer, useRef, useState } = React;

    const NS = 'nebula-station';
    const VOLUME_KEY = 'dsh.nebula-station.volume';
    const STATIONS_KEY = 'dsh.nebula-station.stations';
    const ACTIVE_KEY = 'dsh.nebula-station.active';
    const PLAYBACK_KEY = 'dsh.nebula-station.enabled';
    const LEGACY_VOLUME_KEY = 'dsh.nebula-radio.volume';
    const LEGACY_STATIONS_KEY = 'dsh.nebula-radio.stations';
    const DEFAULT_VOLUME = 0.4;
    const MAX_STATIONS = 20;
    const CONNECT_TIMEOUT_MS = 20000;
    const STALL_TIMEOUT_MS = 12000;
    const MAX_RETRIES = 3;
    const RETRY_DELAYS_MS = [1500, 3000, 6000];
    const STATION_PATTERN = /^https:\/\/radio\.garden\/listen\/([A-Za-z0-9._~-]+)\/([A-Za-z0-9_-]{4,64})\/?$/i;
    // The five stations that ship with the player. Smooth Jazz is the
    // default active station; all five are fixed and cannot be removed.
    const SEED_STATIONS = [
      { id: '1vlrqH6v', name: 'Smooth Jazz 24/7', url: 'https://radio.garden/listen/smooth-jazz-24-7/1vlrqH6v' },
      { id: 'JBY4BMqo', name: 'Fox News Radio', url: 'https://radio.garden/listen/fox-news-radio/JBY4BMqo' },
      { id: '6fNoOGMY', name: 'FM Kahoku 78.8 FM', url: 'https://radio.garden/listen/fm-kahoku-78-8-fm/6fNoOGMY' },
      { id: 'agGPOrdP', name: 'Ashiya Radio', url: 'https://radio.garden/listen/ashiyaradio/agGPOrdP' },
      { id: 'XehO7lZ3', name: 'Listen Moe', url: 'https://radio.garden/listen/listen-moe/XehO7lZ3' },
    ];
    const SEED_IDS = new Set(SEED_STATIONS.map((station) => station.id));
    const DEFAULT_SEED = SEED_STATIONS[0];

    const EN = {
      play: 'Play {station}',
      pause: 'Pause {station}',
      tooltipPlay: 'Play {station} — streamed via Radio Garden',
      tooltipPause: 'Pause {station}',
      tooltipConnecting: 'Connecting to {station}…',
      tooltipBuffering: 'Buffering {station}…',
      tooltipReconnecting: 'Reconnecting to {station}…',
      tooltipError: 'Stream unavailable — open the station page',
      tooltipArmed: 'Click to start {station}',
      title: 'Nebula Station',
      stationLabel: 'Station',
      chooseStation: 'Choose station',
      stations: 'Stations',
      stationFooter: 'Add or remove stations in Settings → Nebula Station.',
      openStation: 'Open station page',
      removeStation: 'Remove',
      retry: 'Retry',
      retryNow: 'Retry now',
      volumeLabel: 'Volume',
      stateOn: 'Playing',
      stateOff: 'Paused',
      stateConnecting: 'Connecting…',
      stateBuffering: 'Buffering…',
      stateReconnecting: 'Reconnecting…',
      stateError: 'Stream unavailable',
      stateArmed: 'Click to start',
      hint: 'Streams via Radio Garden.',
      addToggle: 'Add station',
      addHint: 'Paste a radio.garden/listen/… station URL.',
      cancel: 'Cancel',
      addLabel: 'Add station',
      addPlaceholder: 'https://radio.garden/listen/…',
      addButton: 'Add',
      addInvalid: 'Use a radio.garden/listen/… station URL.',
      addDuplicate: 'That station is already in the list.',
      addLimit: 'You can save up to 20 stations.',
    };

    const CSS = `
.dsh-nr-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  margin: 0;
  padding: 0;
  flex: none;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  transition: background-color 140ms ease, color 140ms ease;
}
.dsh-nr-toggle:hover {
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-primary);
}
.dsh-nr-toggle:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary);
  outline-offset: 1px;
}
.dsh-nr-toggle.is-playing,
.dsh-nr-toggle.is-connecting { color: var(--dsw-alias-brand-primary); }
.dsh-nr-toggle.is-error { color: var(--dsw-alias-state-error-primary); }
.dsh-nr-toggle.is-armed { color: var(--dsw-alias-brand-primary); }
.dsh-nr-split {
  display: inline-flex;
  align-items: center;
  border-radius: 8px;
  transition: background-color 140ms ease;
}
.dsh-nr-split:hover,
.dsh-nr-split:focus-within {
  background: var(--dsw-alias-bg-layer-2);
}
.dsh-nr-split .dsh-nr-toggle {
  border-radius: 8px 0 0 8px;
}
.dsh-nr-split .dsh-nr-toggle:hover {
  background: transparent;
}
.dsh-nr-menu {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 28px;
  margin: 0;
  padding: 0;
  flex: none;
  border: 0;
  border-radius: 0 8px 8px 0;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  box-shadow: inset 1px 0 0 transparent;
  cursor: pointer;
  transition: background-color 140ms ease, color 140ms ease, box-shadow 140ms ease;
}
.dsh-nr-split:hover .dsh-nr-menu,
.dsh-nr-menu.is-open {
  box-shadow: inset 1px 0 0 var(--dsw-alias-border-l1);
}
.dsh-nr-menu:hover { color: var(--dsw-alias-label-primary); }
.dsh-nr-menu.is-open { color: var(--dsw-alias-brand-primary); }
.dsh-nr-menu:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary);
  outline-offset: -1px;
}
.dsh-nr-chevron {
  display: block;
  transition: transform 140ms ease;
}
.dsh-nr-menu.is-open .dsh-nr-chevron { transform: rotate(180deg); }
.dsh-nr-icon { display: block; }
.dsh-nr-wave { opacity: 0.55; }
.dsh-nr-toggle.is-playing .dsh-nr-wave,
.dsh-nr-toggle.is-connecting .dsh-nr-wave {
  animation: dsh-nr-wave 1.4s ease-in-out infinite;
}
.dsh-nr-toggle.is-connecting .dsh-nr-wave { animation-duration: 0.9s; }
.dsh-nr-toggle.is-playing .dsh-nr-wave-b { animation-delay: 0.2s; }
.dsh-nr-toggle.is-armed .dsh-nr-wave {
  animation: dsh-nr-wave 2.6s ease-in-out infinite;
}
.dsh-nr-toggle.is-playing .dsh-nr-core {
  filter: drop-shadow(0 0 3px currentColor);
}
@keyframes dsh-nr-wave {
  0%, 100% { opacity: 0.3 }
  50% { opacity: 1 }
}
.dsh-nr-row {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 0;
  border-bottom: 0.5px solid var(--dsw-alias-border-l2);
  font-family: inherit;
}
.dsh-nr-row-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}
.dsh-nr-row-title {
  color: var(--dsw-alias-label-primary);
  font-size: 14px;
  font-weight: 400;
  line-height: 22px;
}
.dsh-nr-row-state {
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 18px;
}
.dsh-nr-row-state.is-on { color: var(--dsw-alias-state-success-primary); }
.dsh-nr-row-state.is-buffering { color: var(--dsw-alias-brand-primary); }
.dsh-nr-row-state.is-error { color: var(--dsw-alias-state-error-primary); }
.dsh-nr-row-state.is-armed { color: var(--dsw-alias-brand-primary); }
.dsh-nr-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: 10px;
  background: var(--dsw-alias-bg-layer-1);
}
.dsh-nr-station-row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.dsh-nr-meta {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}
.dsh-nr-avatar {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  color: #f7f9ff;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
  user-select: none;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.18);
}
.dsh-nr-select {
  flex: 1;
  min-width: 0;
  height: 32px;
  padding: 0 8px;
  border-radius: 8px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 13px;
}
.dsh-nr-select:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary);
  outline-offset: 1px;
}
.dsh-nr-remove {
  flex: none;
  border: 0;
  background: transparent;
  padding: 0;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 12px;
  line-height: 18px;
  cursor: pointer;
}
.dsh-nr-remove:hover {
  color: var(--dsw-alias-state-error-primary);
  text-decoration: underline;
}
.dsh-nr-remove:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary);
  outline-offset: 2px;
  border-radius: 4px;
}
.dsh-nr-retry {
  flex: none;
  border: 0;
  background: transparent;
  padding: 0;
  color: var(--dsw-alias-brand-primary);
  font: inherit;
  font-size: 12px;
  line-height: 18px;
  cursor: pointer;
}
.dsh-nr-retry:hover { text-decoration: underline; }
.dsh-nr-retry:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary);
  outline-offset: 2px;
  border-radius: 4px;
}
.dsh-nr-row-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}
.dsh-nr-volume-label {
  flex: none;
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 18px;
}
.dsh-nr-range {
  flex: 1;
  min-width: 120px;
  margin: 0;
  cursor: pointer;
  accent-color: var(--dsw-alias-brand-primary);
}
.dsh-nr-value {
  min-width: 38px;
  color: var(--dsw-alias-label-secondary);
  font-size: 13px;
  line-height: 20px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.dsh-nr-add-toggle {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 10px;
  border: 1px dashed var(--dsw-alias-border-l2);
  border-radius: 8px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: color 140ms ease, border-color 140ms ease, background-color 140ms ease;
}
.dsh-nr-add-toggle:hover {
  color: var(--dsw-alias-label-primary);
  border-color: var(--dsw-alias-brand-primary);
  background: var(--dsw-alias-bg-layer-2);
}
.dsh-nr-add-toggle:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary);
  outline-offset: 2px;
}
.dsh-nr-plus {
  font-size: 14px;
  line-height: 1;
}
.dsh-nr-add-form {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.dsh-nr-input {
  flex: 1;
  min-width: 0;
  height: 32px;
  padding: 0 10px;
  border-radius: 8px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 13px;
}
.dsh-nr-input::placeholder { color: var(--dsw-alias-label-secondary); }
.dsh-nr-input:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary);
  outline-offset: 1px;
}
.dsh-nr-input.is-invalid { border-color: var(--dsw-alias-state-error-primary); }
.dsh-nr-add {
  flex: none;
  height: 32px;
  padding: 0 12px;
  border: 0;
  border-radius: 8px;
  background: var(--dsw-alias-brand-primary);
  color: var(--dsw-alias-brand-text);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.dsh-nr-add:hover { background: var(--dsw-alias-button-primary-hover); }
.dsh-nr-add:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary);
  outline-offset: 1px;
}
.dsh-nr-cancel {
  flex: none;
  height: 32px;
  padding: 0 6px;
  border: 0;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.dsh-nr-cancel:hover {
  color: var(--dsw-alias-label-primary);
  text-decoration: underline;
}
.dsh-nr-cancel:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary);
  outline-offset: 2px;
  border-radius: 4px;
}
.dsh-nr-row-hint {
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 18px;
}
.dsh-nr-error {
  color: var(--dsw-alias-state-error-primary);
  font-size: 12px;
  line-height: 18px;
}
.dsh-nr-link {
  flex: none;
  color: var(--dsw-alias-brand-primary);
  font-size: 12px;
  line-height: 18px;
  text-decoration: none;
  border-radius: 4px;
  cursor: pointer;
}
.dsh-nr-link:hover { text-decoration: underline; }
.dsh-nr-link:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary);
  outline-offset: 2px;
}
.dsh-nr-pop {
  position: fixed;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: 12px;
  background: var(--dsw-alias-bg-overlay);
  color: var(--dsw-alias-label-primary);
  box-shadow: 0 16px 40px rgba(3, 5, 12, 0.35);
  font-family: inherit;
  animation: dsh-nr-pop-in 120ms ease-out;
}
@keyframes dsh-nr-pop-in {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
.dsh-nr-pop-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px 4px;
}
.dsh-nr-pop-title {
  color: var(--dsw-alias-label-secondary);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.dsh-nr-pop-state {
  color: var(--dsw-alias-label-secondary);
  font-size: 11px;
  white-space: nowrap;
}
.dsh-nr-pop-list {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow-y: auto;
  padding: 4px 6px 6px;
}
.dsh-nr-pop-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  height: 36px;
  padding: 0 6px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}
.dsh-nr-pop-item:hover { background: var(--dsw-alias-bg-layer-2); }
.dsh-nr-pop-item.is-current { background: var(--dsw-alias-bg-layer-1); }
.dsh-nr-pop-item.is-current:hover { background: var(--dsw-alias-bg-layer-2); }
.dsh-nr-pop-item:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary);
  outline-offset: -2px;
}
.dsh-nr-pop-avatar {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 7px;
  color: #f7f9ff;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.02em;
  user-select: none;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.18);
}
.dsh-nr-pop-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dsh-nr-pop-item.is-current .dsh-nr-pop-name { font-weight: 500; }
.dsh-nr-pop-check {
  flex: none;
  color: var(--dsw-alias-brand-primary);
}
.dsh-nr-pop-foot {
  padding: 7px 12px 9px;
  border-top: 0.5px solid var(--dsw-alias-border-l1);
  color: var(--dsw-alias-label-secondary);
  font-size: 11px;
  line-height: 15px;
}
@media (prefers-reduced-motion: reduce) {
  .dsh-nr-wave { animation: none; }
  .dsh-nr-pop { animation: none; }
  .dsh-nr-chevron { transition: none; }
}
`;

    let translate = (key) => EN[key] || key;
    let runtime = null;
    let audio = null;
    let loadedId = '';
    let playing = false;
    let connecting = false;
    let buffering = false;
    let reconnecting = false;
    let failed = false;
    let retryCount = 0;
    let retryTimer = 0;
    let stallTimer = 0;
    let volume = readVolume();
    let stations = readStations();
    let activeId = readActiveId(stations);
    let connectTimer = 0;
    let mediaKey = '';
    let mediaSessionReady = false;
    let armed = false;
    let playbackIntent = readPlaybackIntent();
    let gestureCleanup = null;

    const listeners = new Set();

    function emit() {
      updateMediaSession();
      for (const listener of listeners) listener();
    }

    function readVolume() {
      try {
        let raw = window.localStorage.getItem(VOLUME_KEY);
        if (raw === null) raw = window.localStorage.getItem(LEGACY_VOLUME_KEY);
        if (raw === null) return DEFAULT_VOLUME;
        const value = Number(raw);
        return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : DEFAULT_VOLUME;
      } catch {
        return DEFAULT_VOLUME;
      }
    }

    function readPlaybackIntent() {
      try {
        const raw = window.localStorage.getItem(PLAYBACK_KEY);
        return raw === null ? true : raw !== '0';
      } catch {
        return true;
      }
    }

    function persistPlaybackIntent() {
      try {
        window.localStorage.setItem(PLAYBACK_KEY, playbackIntent ? '1' : '0');
      } catch {
        /* The current session still honors the intent. */
      }
    }

    function t(key) {
      const value = translate(key);
      return typeof value === 'string' && value && value !== key ? value : EN[key] || key;
    }

    function format(key, stationName) {
      return t(key).replace(/\{station\}/g, () => stationName);
    }

    function stationNameFromSlug(slug) {
      let text = slug;
      try {
        text = decodeURIComponent(slug);
      } catch {
        /* Keep the raw slug. */
      }
      const words = text
        .replace(/[._~-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .filter(Boolean);
      const name = words
        .map((word) => (/^[0-9]+$/.test(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)))
        .join(' ');
      const cleaned = name.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 80);
      return cleaned || 'Radio station';
    }

    function stationHue(station) {
      const text = (station && (station.id || station.name)) || 'radio';
      let hash = 0;
      for (let index = 0; index < text.length; index += 1) {
        hash = (hash * 31 + text.charCodeAt(index)) % 360;
      }
      return hash;
    }

    function stationInitials(name) {
      const words = String(name || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean);
      if (!words.length) return 'R';
      if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
      return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
    }

    function parseStationUrl(value) {
      if (typeof value !== 'string') return null;
      const text = value.trim();
      if (!text || text.length > 300) return null;
      const match = STATION_PATTERN.exec(text);
      if (!match) return null;
      const slug = match[1];
      const id = match[2];
      return {
        id,
        name: stationNameFromSlug(slug),
        url: 'https://radio.garden/listen/' + slug + '/' + id,
      };
    }

    function readStations() {
      const list = SEED_STATIONS.map((station) => ({ ...station }));
      try {
        let raw = window.localStorage.getItem(STATIONS_KEY);
        if (raw === null) raw = window.localStorage.getItem(LEGACY_STATIONS_KEY);
        if (!raw) return list;
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return list;
        for (const entry of parsed) {
          if (list.length >= MAX_STATIONS) break;
          const station = parseStationUrl(entry && typeof entry === 'object' ? entry.url : '');
          if (!station) continue;
          if (list.some((item) => item.id === station.id)) continue;
          list.push(station);
        }
      } catch {
        /* A corrupt store falls back to the seed station. */
      }
      return list;
    }

    function readActiveId(list) {
      try {
        const raw = window.localStorage.getItem(ACTIVE_KEY);
        if (raw) {
          for (const station of list) {
            if (station.id === raw) return raw;
          }
        }
      } catch {
        /* Fall through to the first station. */
      }
      return list[0].id;
    }

    function persistStations() {
      try {
        const data = stations.map((station) => ({ id: station.id, url: station.url }));
        window.localStorage.setItem(STATIONS_KEY, JSON.stringify(data));
      } catch {
        /* The current session still keeps the list in memory. */
      }
    }

    function persistActive() {
      try {
        window.localStorage.setItem(ACTIVE_KEY, activeId);
      } catch {
        /* The current session still keeps the selection. */
      }
    }

    function activeStation() {
      for (const station of stations) {
        if (station.id === activeId) return station;
      }
      return stations[0] || DEFAULT_SEED;
    }

    function streamUrlFor(station) {
      return (
        'https://radio.garden/api/ara/content/listen/' +
        encodeURIComponent(station.id) +
        '/channel.mp3'
      );
    }

    function useRadio() {
      const [, force] = useReducer((version) => version + 1, 0);
      useEffect(() => {
        listeners.add(force);
        return () => {
          listeners.delete(force);
        };
      }, []);
      return {
        playing,
        connecting,
        buffering,
        reconnecting,
        failed,
        armed,
        volume,
        stations,
        activeId,
        active: activeStation(),
      };
    }

    /* ------------------------------------------------------------------ */
    /* Playback                                                            */
    /* ------------------------------------------------------------------ */

    function clearConnectTimer() {
      if (connectTimer) {
        window.clearTimeout(connectTimer);
        connectTimer = 0;
      }
    }

    function clearRetryTimer() {
      if (retryTimer) {
        window.clearTimeout(retryTimer);
        retryTimer = 0;
      }
    }

    function clearStallTimer() {
      if (stallTimer) {
        window.clearTimeout(stallTimer);
        stallTimer = 0;
      }
    }

    function resetRecovery() {
      clearRetryTimer();
      clearStallTimer();
      retryCount = 0;
      reconnecting = false;
      buffering = false;
    }

    function applySource(element) {
      const station = activeStation();
      if (!station) return;
      loadedId = station.id;
      try {
        element.src = streamUrlFor(station);
        element.load();
      } catch {
        /* The next play attempt surfaces the failure. */
      }
    }

    function markBuffering(element) {
      if (!playbackIntent || failed) return;
      clearConnectTimer();
      buffering = true;
      connecting = false;
      emit();
      clearStallTimer();
      stallTimer = window.setTimeout(() => {
        stallTimer = 0;
        if (!audio || audio !== element || !playbackIntent) return;
        if (!buffering) return;
        playing = false;
        buffering = false;
        handleStreamFailure();
      }, STALL_TIMEOUT_MS);
    }

    function onOnline() {
      if (!playbackIntent || playing || connecting) return;
      if (!failed && !reconnecting) return;
      clearRetryTimer();
      clearStallTimer();
      retryCount = 0;
      failed = false;
      reconnecting = true;
      startPlayback(true);
    }

    function ensureAudio() {
      if (audio) return audio;
      const element = new Audio();
      element.preload = 'none';
      element.referrerPolicy = 'no-referrer';
      element.volume = volume;
      element.addEventListener('playing', () => {
        if (audio !== element) return;
        clearConnectTimer();
        clearStallTimer();
        clearRetryTimer();
        playing = true;
        connecting = false;
        buffering = false;
        reconnecting = false;
        failed = false;
        retryCount = 0;
        armed = false;
        disarmGesture();
        emit();
      });
      element.addEventListener('waiting', () => {
        if (audio !== element) return;
        markBuffering(element);
      });
      element.addEventListener('stalled', () => {
        if (audio !== element) return;
        markBuffering(element);
      });
      element.addEventListener('pause', () => {
        if (audio !== element) return;
        clearConnectTimer();
        clearStallTimer();
        playing = false;
        connecting = false;
        buffering = false;
        emit();
      });
      element.addEventListener('error', () => {
        if (audio !== element) return;
        clearConnectTimer();
        clearStallTimer();
        playing = false;
        connecting = false;
        buffering = false;
        const code = element.error && element.error.code;
        if (code === 4) {
          clearRetryTimer();
          retryCount = 0;
          reconnecting = false;
          failed = true;
          armed = false;
          disarmGesture();
          emit();
          return;
        }
        handleStreamFailure();
      });
      element.addEventListener('ended', () => {
        if (audio !== element) return;
        clearConnectTimer();
        clearStallTimer();
        playing = false;
        connecting = false;
        buffering = false;
        if (playbackIntent) {
          handleStreamFailure();
        } else {
          reconnecting = false;
          failed = false;
          emit();
        }
      });
      window.addEventListener('online', onOnline);
      audio = element;
      loadedId = '';
      applySource(element);
      return element;
    }

    function handleStreamFailure() {
      clearConnectTimer();
      clearStallTimer();
      playing = false;
      connecting = false;
      buffering = false;
      armed = false;
      disarmGesture();
      if (!playbackIntent) {
        reconnecting = false;
        failed = false;
        emit();
        return;
      }
      if (retryCount >= MAX_RETRIES) {
        reconnecting = false;
        failed = true;
        emit();
        return;
      }
      failed = false;
      reconnecting = true;
      emit();
      clearRetryTimer();
      const delay = RETRY_DELAYS_MS[Math.min(retryCount, RETRY_DELAYS_MS.length - 1)];
      retryTimer = window.setTimeout(() => {
        retryTimer = 0;
        if (!playbackIntent || !reconnecting) return;
        retryCount += 1;
        startPlayback(true);
      }, delay);
    }

    function handlePlayFailure(error) {
      if (error && error.name === 'AbortError') return;
      clearConnectTimer();
      connecting = false;
      playing = false;
      buffering = false;
      if (error && error.name === 'NotAllowedError') {
        clearRetryTimer();
        clearStallTimer();
        retryCount = 0;
        reconnecting = false;
        failed = false;
        armed = true;
        armGesture();
        emit();
        return;
      }
      handleStreamFailure();
    }

    function startPlayback(isRetry) {
      const station = activeStation();
      if (!station) return;
      let element;
      try {
        element = ensureAudio();
      } catch (error) {
        console.warn('[nebula-station] audio is unavailable', error);
        reconnecting = false;
        failed = true;
        emit();
        return;
      }
      if (isRetry || failed || loadedId !== station.id) {
        loadedId = '';
        applySource(element);
      }
      failed = false;
      connecting = true;
      reconnecting = !!isRetry;
      buffering = false;
      emit();
      clearConnectTimer();
      connectTimer = window.setTimeout(() => {
        connectTimer = 0;
        if (!audio || audio !== element) return;
        if (connecting && !playing) handleStreamFailure();
      }, CONNECT_TIMEOUT_MS);
      let attempt;
      try {
        attempt = element.play();
      } catch (error) {
        handlePlayFailure(error);
        return;
      }
      if (attempt && typeof attempt.catch === 'function') {
        attempt.catch((error) => {
          if (!audio || audio !== element) return;
          handlePlayFailure(error);
        });
      }
    }

    function retryNow() {
      clearRetryTimer();
      clearStallTimer();
      retryCount = 0;
      reconnecting = false;
      buffering = false;
      failed = false;
      loadedId = '';
      if (audio) {
        try {
          audio.pause();
        } catch {
          /* State settles below. */
        }
      }
      playing = false;
      connecting = false;
      playRadio();
    }

    function playRadio() {
      if (playing || connecting) return;
      const station = activeStation();
      if (!station) return;
      const needsReload = failed || reconnecting;
      playbackIntent = true;
      persistPlaybackIntent();
      armed = false;
      disarmGesture();
      resetRecovery();
      failed = false;
      if (needsReload) loadedId = '';
      startPlayback(false);
    }

    function pauseRadio() {
      if (!playing && !connecting && !buffering && !reconnecting) {
        if (armed) {
          armed = false;
          playbackIntent = false;
          persistPlaybackIntent();
          disarmGesture();
          emit();
        }
        return;
      }
      playbackIntent = false;
      persistPlaybackIntent();
      armed = false;
      disarmGesture();
      clearConnectTimer();
      clearRetryTimer();
      clearStallTimer();
      reconnecting = false;
      buffering = false;
      if (audio) {
        try {
          audio.pause();
        } catch {
          /* State still settles below. */
        }
      }
      playing = false;
      connecting = false;
      failed = false;
      emit();
    }

    function toggleRadio() {
      if (playing || connecting || buffering || reconnecting) pauseRadio();
      else playRadio();
    }

    function cycleStation(delta) {
      if (stations.length < 2) return;
      let index = stations.findIndex((station) => station.id === activeId);
      if (index < 0) index = 0;
      const next = stations[(index + delta + stations.length) % stations.length];
      if (!next) return;
      const wasLive = playing || connecting || buffering || reconnecting || armed || failed;
      switchStation(next.id);
      if (!wasLive) playRadio();
    }

    function armGesture() {
      if (gestureCleanup) return;
      const start = () => {
        disarmGesture();
        if (!armed) return;
        armed = false;
        emit();
        playRadio();
      };
      window.addEventListener('click', start);
      gestureCleanup = () => {
        window.removeEventListener('click', start);
      };
    }

    function disarmGesture() {
      const cleanup = gestureCleanup;
      if (!cleanup) return;
      gestureCleanup = null;
      cleanup();
    }

    function attemptAutoplay() {
      if (!playbackIntent || playing || connecting) return;
      playRadio();
    }

    function setupMediaSession() {
      if (typeof navigator === 'undefined' || !navigator.mediaSession) return;
      const session = navigator.mediaSession;
      if (typeof session.setActionHandler !== 'function') return;
      mediaSessionReady = true;
      mediaKey = '';
      const handlers = {
        play: () => playRadio(),
        pause: () => pauseRadio(),
        stop: () => pauseRadio(),
        nexttrack: () => cycleStation(1),
        previoustrack: () => cycleStation(-1),
      };
      for (const [action, handler] of Object.entries(handlers)) {
        try {
          session.setActionHandler(action, handler);
        } catch {
          /* Some actions are unsupported on this platform. */
        }
      }
    }

    function updateMediaSession() {
      if (!mediaSessionReady || typeof navigator === 'undefined' || !navigator.mediaSession) return;
      const session = navigator.mediaSession;
      try {
        if (!audio) {
          if (mediaKey) {
            mediaKey = '';
            session.metadata = null;
            session.playbackState = 'none';
          }
          return;
        }
        const station = activeStation();
        const key = station.id + '|' + (playing ? 'playing' : 'paused');
        if (key === mediaKey) return;
        mediaKey = key;
        if (typeof MediaMetadata === 'function') {
          session.metadata = new MediaMetadata({
            title: station.name,
            artist: 'Radio Garden',
            album: 'Nebula Station',
          });
        }
        session.playbackState = playing ? 'playing' : 'paused';
      } catch {
        /* Media session support is best effort. */
      }
    }

    function teardownMediaSession() {
      if (!mediaSessionReady) return;
      mediaSessionReady = false;
      mediaKey = '';
      if (typeof navigator === 'undefined' || !navigator.mediaSession) return;
      const session = navigator.mediaSession;
      for (const action of ['play', 'pause', 'stop', 'nexttrack', 'previoustrack']) {
        try {
          session.setActionHandler(action, null);
        } catch {
          /* Already unset or unsupported. */
        }
      }
      try {
        session.metadata = null;
        session.playbackState = 'none';
      } catch {
        /* Ignore unsupported fields. */
      }
    }

    function switchStation(nextId) {
      const next = stations.find((station) => station.id === nextId);
      if (!next || next.id === activeId) return;
      const wasLive = playing || connecting || buffering || reconnecting || armed || failed;
      clearRetryTimer();
      clearStallTimer();
      retryCount = 0;
      reconnecting = false;
      buffering = false;
      activeId = next.id;
      persistActive();
      armed = false;
      if (audio) {
        try {
          audio.pause();
        } catch {
          /* The source swap below still applies. */
        }
        loadedId = '';
        applySource(audio);
      }
      playing = false;
      connecting = false;
      failed = false;
      emit();
      if (wasLive) playRadio();
    }

    function removeActiveStation() {
      const station = activeStation();
      if (!station || SEED_IDS.has(station.id)) return;
      clearRetryTimer();
      clearStallTimer();
      retryCount = 0;
      reconnecting = false;
      buffering = false;
      stations = stations.filter((item) => item.id !== station.id);
      persistStations();
      activeId = DEFAULT_SEED.id;
      persistActive();
      if (audio) {
        try {
          audio.pause();
        } catch {
          /* The source swap below still applies. */
        }
        loadedId = '';
        applySource(audio);
      }
      playing = false;
      connecting = false;
      failed = false;
      emit();
    }

    function setVolume(next) {
      const numeric = Number(next);
      volume = Number.isFinite(numeric) ? Math.min(1, Math.max(0, numeric)) : DEFAULT_VOLUME;
      if (audio) {
        try {
          audio.volume = volume;
        } catch {
          /* Keep the previous level. */
        }
      }
      try {
        window.localStorage.setItem(VOLUME_KEY, String(volume));
      } catch {
        /* Private mode still honors the session value. */
      }
      emit();
    }

    function shutdown() {
      clearConnectTimer();
      clearRetryTimer();
      clearStallTimer();
      window.removeEventListener('online', onOnline);
      disarmGesture();
      teardownMediaSession();
      const element = audio;
      audio = null;
      loadedId = '';
      playing = false;
      connecting = false;
      buffering = false;
      reconnecting = false;
      retryCount = 0;
      failed = false;
      armed = false;
      if (element) {
        try {
          element.pause();
        } catch {
          /* Already stopped. */
        }
        try {
          element.removeAttribute('src');
          element.load();
        } catch {
          /* Already released. */
        }
      }
    }

    function openStationInSidebar(event) {
      const station = activeStation();
      if (!station) return;
      const sidebar = runtime && typeof runtime.get === 'function' ? runtime.get('sidebarRight') : undefined;
      if (!sidebar || typeof sidebar.openTab !== 'function') return;
      try {
        sidebar.openTab('browser', { params: { url: station.url } });
        event.preventDefault();
      } catch {
        /* Fall through to the link's normal new-tab behavior. */
      }
    }

    /* ------------------------------------------------------------------ */
    /* Components                                                          */
    /* ------------------------------------------------------------------ */

    function RadioIcon() {
      return h(
        'svg',
        {
          className: 'dsh-nr-icon',
          viewBox: '0 0 24 24',
          width: 16,
          height: 16,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.6,
          strokeLinecap: 'round',
          'aria-hidden': 'true',
          focusable: 'false',
        },
        h('path', { d: 'M12 10.4V20.4' }),
        h('path', { d: 'M8.8 20.5h6.4' }),
        h('circle', {
          className: 'dsh-nr-core',
          cx: 12,
          cy: 8.2,
          r: 1.9,
          fill: 'currentColor',
          stroke: 'none',
        }),
        h('path', { className: 'dsh-nr-wave', d: 'M8.4 11.2a5.8 5.8 0 0 1 0-6' }),
        h('path', {
          className: 'dsh-nr-wave dsh-nr-wave-b',
          d: 'M15.6 11.2a5.8 5.8 0 0 0 0-6',
        }),
      );
    }

    function RadioButton() {
      const state = useRadio();
      const [open, setOpen] = useState(false);
      const [position, setPosition] = useState(null);
      const splitRef = useRef(null);
      const menuButtonRef = useRef(null);
      const popoverRef = useRef(null);
      const itemRefs = useRef([]);
      const stationName = state.active ? state.active.name : 'Radio';
      const busy = state.connecting || state.buffering || state.reconnecting;
      const active = state.playing || busy;
      const className =
        'dsh-nr-toggle' +
        (busy
          ? ' is-connecting'
          : state.playing
            ? ' is-playing'
            : state.failed
              ? ' is-error'
              : state.armed
                ? ' is-armed'
                : '');
      const tooltip = state.failed
        ? t('tooltipError')
        : state.reconnecting
          ? format('tooltipReconnecting', stationName)
          : state.buffering
            ? format('tooltipBuffering', stationName)
            : state.connecting
              ? format('tooltipConnecting', stationName)
              : state.playing
                ? format('tooltipPause', stationName)
                : state.armed
                  ? format('tooltipArmed', stationName)
                  : format('tooltipPlay', stationName);
      const statusLabel = state.failed
        ? t('stateError')
        : state.reconnecting
          ? t('stateReconnecting')
          : state.buffering
            ? t('stateBuffering')
            : state.connecting
              ? t('stateConnecting')
              : state.playing
                ? t('stateOn')
                : state.armed
                  ? t('stateArmed')
                  : t('stateOff');

      useEffect(() => {
        if (!open) return undefined;
        const onPointerDown = (event) => {
          if (splitRef.current && splitRef.current.contains(event.target)) return;
          closeMenu(false);
        };
        const onKeyDown = (event) => {
          if (event.key !== 'Escape') return;
          event.preventDefault();
          closeMenu(true);
        };
        const onResize = () => closeMenu(false);
        document.addEventListener('pointerdown', onPointerDown, true);
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('resize', onResize);
        const focusTimer = window.setTimeout(() => {
          const index = Math.max(0, state.stations.findIndex((station) => station.id === state.activeId));
          const item = itemRefs.current[index] || itemRefs.current[0];
          if (item && typeof item.focus === 'function') item.focus();
        }, 0);
        return () => {
          document.removeEventListener('pointerdown', onPointerDown, true);
          window.removeEventListener('keydown', onKeyDown);
          window.removeEventListener('resize', onResize);
          window.clearTimeout(focusTimer);
        };
      }, [open]);

      function closeMenu(restoreFocus) {
        setOpen(false);
        setPosition(null);
        if (restoreFocus) {
          window.setTimeout(() => {
            const button = menuButtonRef.current;
            if (button && typeof button.focus === 'function') button.focus();
          }, 0);
        }
      }

      function openMenu() {
        if (open) {
          closeMenu(true);
          return;
        }
        let next;
        const button = menuButtonRef.current;
        if (button && typeof button.getBoundingClientRect === 'function') {
          const rect = button.getBoundingClientRect();
          const width = Math.min(264, Math.max(160, window.innerWidth - 16));
          const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8));
          const above = rect.top > Math.min(window.innerHeight - rect.bottom, 360) || rect.top > 300;
          const space = above ? rect.top - 8 : window.innerHeight - rect.bottom - 8;
          const maxHeight = Math.max(110, Math.min(360, space));
          next = { left, width, maxHeight };
          if (above) next.bottom = window.innerHeight - rect.top + 6;
          else next.top = rect.bottom + 6;
        } else {
          next = { left: 8, top: 8, width: 264, maxHeight: 320 };
        }
        setPosition(next);
        setOpen(true);
      }

      function onListKeyDown(event) {
        if (
          event.key !== 'ArrowDown' &&
          event.key !== 'ArrowUp' &&
          event.key !== 'Home' &&
          event.key !== 'End'
        ) {
          return;
        }
        const items = Array.from(
          popoverRef.current ? popoverRef.current.querySelectorAll('[data-station-item]') : [],
        );
        if (!items.length) return;
        const current = items.indexOf(document.activeElement);
        let next = current;
        if (event.key === 'ArrowDown') next = current < 0 ? 0 : (current + 1) % items.length;
        else if (event.key === 'ArrowUp') next = current <= 0 ? items.length - 1 : current - 1;
        else if (event.key === 'Home') next = 0;
        else next = items.length - 1;
        event.preventDefault();
        const item = items[next];
        if (item && typeof item.focus === 'function') item.focus();
      }

      function renderStation(station, index) {
        const current = station.id === state.activeId;
        const hue = stationHue(station);
        const avatarStyle = {
          background:
            'linear-gradient(135deg, hsl(' + hue + ', 72%, 55%), hsl(' + ((hue + 48) % 360) + ', 72%, 42%))',
        };
        return h(
          'button',
          {
            key: station.id,
            ref: (element) => {
              itemRefs.current[index] = element;
            },
            type: 'button',
            role: 'menuitemradio',
            'aria-checked': current,
            'data-station-item': 'true',
            tabIndex: -1,
            className: 'dsh-nr-pop-item' + (current ? ' is-current' : ''),
            title: station.name,
            onClick: () => {
              const wasIdle =
                !playing && !connecting && !buffering && !reconnecting && !armed && !failed;
              switchStation(station.id);
              if (wasIdle) playRadio();
              closeMenu(true);
            },
          },
          h(
            'span',
            { className: 'dsh-nr-pop-avatar', style: avatarStyle, 'aria-hidden': 'true' },
            stationInitials(station.name),
          ),
          h('span', { className: 'dsh-nr-pop-name' }, station.name),
          h(
            'svg',
            {
              className: 'dsh-nr-pop-check',
              viewBox: '0 0 16 16',
              width: 12,
              height: 12,
              fill: 'none',
              stroke: 'currentColor',
              strokeWidth: 1.8,
              strokeLinecap: 'round',
              strokeLinejoin: 'round',
              'aria-hidden': 'true',
              style: current ? undefined : { opacity: 0 },
            },
            h('path', { d: 'M3.5 8.2 6.6 11 12.5 5' }),
          ),
        );
      }

      return h(
        React.Fragment,
        null,
        h('style', { key: 'css' }, CSS),
        h(
          'div',
          { className: 'dsh-nr-split', ref: splitRef },
          h(
            'button',
            {
              type: 'button',
              className,
              'aria-pressed': active,
              'aria-busy': busy ? 'true' : undefined,
              'aria-label': format(active ? 'pause' : 'play', stationName),
              title: tooltip,
              onClick: () => {
                if (open) closeMenu(false);
                toggleRadio();
              },
            },
            h(RadioIcon),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'dsh-nr-menu' + (open ? ' is-open' : ''),
              ref: menuButtonRef,
              'aria-haspopup': 'menu',
              'aria-expanded': open,
              'aria-controls': 'dsh-nr-station-menu',
              'aria-label': t('chooseStation'),
              title: t('chooseStation'),
              onClick: openMenu,
            },
            h(
              'svg',
              {
                className: 'dsh-nr-chevron',
                viewBox: '0 0 12 12',
                width: 10,
                height: 10,
                fill: 'none',
                stroke: 'currentColor',
                strokeWidth: 1.5,
                strokeLinecap: 'round',
                strokeLinejoin: 'round',
                'aria-hidden': 'true',
                focusable: 'false',
              },
              h('path', { d: 'M3 4.5 6 7.5 9 4.5' }),
            ),
          ),
          open && position
            ? h(
                'div',
                {
                  className: 'dsh-nr-pop',
                  style: position,
                  ref: popoverRef,
                  onBlur: (event) => {
                    if (!event.currentTarget.contains(event.relatedTarget)) closeMenu(false);
                  },
                },
                h(
                  'div',
                  { className: 'dsh-nr-pop-head' },
                  h('span', { className: 'dsh-nr-pop-title' }, t('stations')),
                  h('span', { className: 'dsh-nr-pop-state' }, statusLabel),
                ),
                h(
                  'div',
                  {
                    className: 'dsh-nr-pop-list',
                    role: 'menu',
                    id: 'dsh-nr-station-menu',
                    'aria-label': t('stations'),
                    onKeyDown: onListKeyDown,
                  },
                  state.stations.map(renderStation),
                ),
                h('div', { className: 'dsh-nr-pop-foot' }, t('stationFooter')),
              )
            : null,
        ),
      );
    }

    function RadioRow() {
      const state = useRadio();
      const [draft, setDraft] = useState('');
      const [error, setError] = useState('');
      const [adding, setAdding] = useState(false);
      const addInputRef = useRef(null);
      const addToggleRef = useRef(null);
      const percent = Math.round(state.volume * 100);
      const status = state.failed
        ? t('stateError')
        : state.reconnecting
          ? t('stateReconnecting')
          : state.buffering
            ? t('stateBuffering')
            : state.connecting
              ? t('stateConnecting')
              : state.playing
                ? t('stateOn')
                : state.armed
                  ? t('stateArmed')
                  : t('stateOff');
      const stateClass =
        'dsh-nr-row-state' +
        (state.failed
          ? ' is-error'
          : state.reconnecting || state.buffering || state.connecting
            ? ' is-buffering'
            : state.playing
              ? ' is-on'
              : state.armed
                ? ' is-armed'
                : '');
      const active = state.active || DEFAULT_SEED;
      const hue = stationHue(active);
      const avatarStyle = {
        background:
          'linear-gradient(135deg, hsl(' + hue + ', 72%, 55%), hsl(' + ((hue + 48) % 360) + ', 72%, 42%))',
      };

      useEffect(() => {
        if (!adding) return;
        const input = addInputRef.current;
        if (input && typeof input.focus === 'function') input.focus();
      }, [adding]);

      function focusToggle() {
        window.setTimeout(() => {
          const toggle = addToggleRef.current;
          if (toggle && typeof toggle.focus === 'function') toggle.focus();
        }, 0);
      }

      function openAdd() {
        setAdding(true);
        setError('');
      }

      function closeAdd() {
        setAdding(false);
        setDraft('');
        setError('');
        focusToggle();
      }

      function onDraftChange(event) {
        setDraft(event.target.value);
        if (error) setError('');
      }

      function onAdd(event) {
        event.preventDefault();
        const parsed = parseStationUrl(draft);
        if (!parsed) {
          setError(t('addInvalid'));
          return;
        }
        if (stations.some((station) => station.id === parsed.id)) {
          setError(t('addDuplicate'));
          return;
        }
        if (stations.length >= MAX_STATIONS) {
          setError(t('addLimit'));
          return;
        }
        stations.push(parsed);
        persistStations();
        setDraft('');
        setError('');
        setAdding(false);
        switchStation(parsed.id);
        focusToggle();
      }

      function onFormKeyDown(event) {
        if (event.key === 'Escape') {
          event.preventDefault();
          closeAdd();
        }
      }

      return h(
        React.Fragment,
        null,
        h('style', { key: 'css' }, CSS),
        h(
          'div',
          { key: 'row', className: 'dsh-nr-row' },
          h(
            'div',
            { className: 'dsh-nr-row-head' },
            h('div', { className: 'dsh-nr-row-title' }, t('title')),
            h('div', { className: stateClass, 'aria-live': 'polite' }, status),
          ),
          h(
            'div',
            { className: 'dsh-nr-panel' },
            h(
              'div',
              { className: 'dsh-nr-station-row' },
              h(
                'span',
                { className: 'dsh-nr-avatar', style: avatarStyle, 'aria-hidden': 'true' },
                stationInitials(active.name),
              ),
              h(
                'select',
                {
                  className: 'dsh-nr-select',
                  value: state.activeId,
                  'aria-label': t('stationLabel'),
                  onChange: (event) => switchStation(event.target.value),
                },
                state.stations.map((station) =>
                  h('option', { key: station.id, value: station.id }, station.name),
                ),
              ),
            ),
            h(
              'div',
              { className: 'dsh-nr-meta' },
              h(
                'a',
                {
                  className: 'dsh-nr-link',
                  href: active.url,
                  target: '_blank',
                  rel: 'noopener noreferrer',
                  onClick: openStationInSidebar,
                },
                t('openStation'),
              ),
              state.failed || state.reconnecting
                ? h(
                    'button',
                    {
                      className: 'dsh-nr-retry',
                      type: 'button',
                      onClick: retryNow,
                      title: t(state.reconnecting ? 'retryNow' : 'retry'),
                    },
                    t(state.reconnecting ? 'retryNow' : 'retry'),
                  )
                : null,
              SEED_IDS.has(active.id)
                ? null
                : h(
                    'button',
                    { className: 'dsh-nr-remove', type: 'button', onClick: removeActiveStation },
                    t('removeStation'),
                  ),
            ),
            h(
              'div',
              { className: 'dsh-nr-row-controls' },
              h('span', { className: 'dsh-nr-volume-label' }, t('volumeLabel')),
              h('input', {
                type: 'range',
                min: 0,
                max: 100,
                step: 1,
                className: 'dsh-nr-range',
                value: percent,
                'aria-label': t('volumeLabel'),
                'aria-valuetext': percent + '%',
                onChange: (event) => setVolume(Number(event.target.value) / 100),
              }),
              h('span', { className: 'dsh-nr-value' }, percent + '%'),
            ),
          ),
          adding
            ? h(
                'form',
                { className: 'dsh-nr-add-form', onSubmit: onAdd, onKeyDown: onFormKeyDown },
                h('input', {
                  ref: addInputRef,
                  className: 'dsh-nr-input' + (error ? ' is-invalid' : ''),
                  type: 'text',
                  value: draft,
                  maxLength: 300,
                  autoComplete: 'off',
                  spellCheck: 'false',
                  inputMode: 'url',
                  placeholder: t('addPlaceholder'),
                  'aria-label': t('addLabel'),
                  'aria-invalid': error ? 'true' : undefined,
                  onChange: onDraftChange,
                }),
                h(
                  'button',
                  { className: 'dsh-nr-add', type: 'submit' },
                  t('addButton'),
                ),
                h(
                  'button',
                  { className: 'dsh-nr-cancel', type: 'button', onClick: closeAdd },
                  t('cancel'),
                ),
              )
            : h(
                'button',
                {
                  ref: addToggleRef,
                  type: 'button',
                  className: 'dsh-nr-add-toggle',
                  'aria-expanded': false,
                  onClick: openAdd,
                },
                h('span', { className: 'dsh-nr-plus', 'aria-hidden': 'true' }, '+'),
                t('addToggle'),
              ),
          h(
            'div',
            { className: error ? 'dsh-nr-error' : 'dsh-nr-row-hint', role: error ? 'alert' : undefined },
            error || (adding ? t('addHint') : t('hint')),
          ),
        ),
      );
    }

    return {
      apply(ctx) {
        runtime = ctx;

        const localeFace = ctx.get('locale');
        if (localeFace) {
          ctx.effect(() => {
            const disposers = [];
            const dictionaries = [['en', EN]];
            for (const [tag, dictionary] of dictionaries) {
              try {
                disposers.push(localeFace.register(NS, tag, dictionary));
              } catch {
                /* A previous generation already registered this namespace. */
              }
            }
            translate = localeFace.bind(NS);
            return () => {
              while (disposers.length) {
                try {
                  disposers.pop()();
                } catch {
                  /* Already disposed. */
                }
              }
            };
          });
          ctx.on('locale/change', () => {
            translate = localeFace.bind(NS);
            emit();
          });
        }

        ctx.effect(() => () => {
          shutdown();
        });

        setupMediaSession();

        ctx.slots.inject('conversation.input.right', () =>
          ctx.slots.register(
            { name: 'conversation.input.right', id: 'nebula-station-toggle', order: 19 },
            RadioButton,
          ),
        );
        ctx.slots.inject('settings.general.item', () =>
          ctx.slots.register(
            { name: 'settings.general.item', id: 'nebula-station-row', order: 25 },
            RadioRow,
          ),
        );

        attemptAutoplay();
      },
    };
    }

    const nebulaTheme = createNebulaTheme();
    const ambience = createAmbience(nebulaTheme);
    const station = createStation();

    return {
      inject: ['slots'],
      apply(ctx) {
        nebulaTheme.apply(ctx);
        ambience.apply(ctx);
        station.apply(ctx);
      },
    };
  },
});
