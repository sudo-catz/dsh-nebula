<p align="center">
  <img src="icon.svg" alt="Nebula" width="96" height="96">
</p>

<h1 align="center">Nebula</h1>

<p align="center">
  Aurora ambience, a clock-following sky, a deep-space theme, and Radio Garden radio — one package for the DeepSeek Harness Web UI.
</p>

## Features

- **Ambience** — a pointer-aware aurora and starfield across the whole frame, with drifting haze, soft clouds, and a faint Milky Way. On by default. Live weather adds cloud cover, drizzle, rain, showers, snow, fog, or a storm flash, using rain/snow amounts, probability, visibility, gusts, and CAPE from the 15-minute nowcast. NOAA's planetary K index lets the aurora breathe with geomagnetic activity.
- **Sky** — follows your local clock from dawn to night. A full-frame phase wash, horizon haze, a sun by day, and a phase-accurate moon carry the hour across the page. The moon is only drawn when it is actually above the horizon; its tooltip carries today's rise and set. The Settings strip also shows sunrise, sunset, the moon phase, and a one-line weather summary with a condition glyph. Drag the strip to preview any hour; **Live** returns to the clock.
- **Theme** — a deep-space palette for the whole app, with a lavender light variant, applied as a token skin. **Sky accent** optionally retints only the interactive accent tokens from dawn amber to night lavender, leaving surfaces and text stable.
- **Station** — five Radio Garden stations: Smooth Jazz 24/7 (default), Fox News Radio, FM Kahoku 78.8 FM, Ashiya Radio, and Listen Moe. Add and remove your own; dropped streams retry automatically.

The composer sparkle is the **Follow the clock** switch, and its background is a tiny live sky for the current hour. **Settings → General → Nebula Sky** also holds the theme and ambience switches. All three default on, with Dark as the default appearance.

## Install

### From Discover

Add this index source in **Plugins → Discover → Index sources**:

```
https://raw.githubusercontent.com/sudo-catz/dsh-nebula/main/market/index.json
```

### From npm

```
dsh-nebula
```

or pin the release:

```
dsh-nebula@1.2.0
```

`main` may be newer than the published npm release.

### From Git

```
git+https://github.com/sudo-catz/dsh-nebula.git#v1.2.0
```

That tag is the `v1.2.0` release. Omit the `#…` to follow `main`.

### From a local checkout

```
link:/absolute/path/to/dsh-nebula
```

## Controls

| Action | Where |
| --- | --- |
| Follow the clock | Composer sparkle, or the Nebula Sky switch |
| Preview an hour | Drag the Nebula Sky strip (arrow keys, Home/End) |
| Return to live | **Live**, beside the sky status |
| Nebula theme / Ambience / Weather | Nebula Sky switches |
| Sky accent | Nebula Sky switch |
| Current weather summary | Nebula Sky, below the switches |
| Play / pause | Composer radio-tower icon or OS media keys |
| Stations, volume, Add station | Settings → General → Nebula Station |

## Good to know

- Client-only: no Host work, dependencies, install scripts, or telemetry. Settings live in `localStorage`.
- The sky reads the device clock and, by default, makes one approximate IP lookup (ipwho.is, cached for 24 hours). Enable **Precise location** to use the browser's exact coordinates instead; the permission is only requested when you enable it, coordinates are stored locally, and they go only to Open-Meteo. Current weather plus a 15-minute nowcast comes from open-meteo.com (cached for 15 minutes), and NOAA's planetary K index (cached for 30 minutes) drives aurora intensity. If the IP timezone disagrees with the device timezone, a representative city for the device timezone is used.
- Radio Garden's listen endpoint is unofficial and intended for personal use.
- The five default stations are fixed; custom stations are yours to remove.
- Built for DSH Web 0.2.x. MIT © 2026 sudo-catz.
