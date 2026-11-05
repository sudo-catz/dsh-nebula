<p align="center">
  <img src="icon.svg" alt="Nebula" width="96" height="96">
</p>

<h1 align="center">Nebula</h1>

<p align="center">
  Aurora, a clock-aware sky with live weather, a deep-space theme, and a Radio Garden player for the DeepSeek Harness Web UI.
</p>

## Features

- **Ambience** — pointer-aware aurora and starfield with drifting haze, live rain/snow/fog, meteor flashes, and Kp-driven aurora intensity.
- **Sky** — dawn-to-night wash, sun and moon, sunrise/sunset, moon phase, and an hour scrubber. The weather summary keeps feels-like, humidity, meaningful wind/gusts, and substantial rain/snow only.
- **Theme** — deep-space palette with a light variant; the accent follows the time of day while surfaces stay stable.
- **Station** — five default stations plus up to ten saved. Search or paste a Radio Garden URL, browse countries, list all stations, preview tracks, and add without interrupting playback. The Settings picker shows seven rows, scrolls, and deletes custom stations. Scroll over the volume row to adjust it.
- **Composer** — the sparkle toggles the sky; the radio-tower chevron opens the station tooltip.

## Install

### Discover

Add this index source in **Plugins → Discover → Index sources**:

```
https://raw.githubusercontent.com/sudo-catz/dsh-nebula/main/market/index.json
```

### npm

```
dsh-nebula
```

Pin a release with `dsh-nebula@1.4.0`.

### Git

```
git+https://github.com/sudo-catz/dsh-nebula.git#v1.4.0
```

### Local checkout

```
link:/absolute/path/to/dsh-nebula
```

## Controls

| Action | Where |
| --- | --- |
| Follow the clock | Composer sparkle or **Sky** tile |
| Preview an hour | Drag the Nebula Sky strip |
| Return to live | **Live** beside the sky status |
| Sky, Weather, Aurora & stars, Nebula theme | Nebula Sky tiles |
| Play / pause | Station panel, composer radio-tower icon, or media keys |
| Station picker, delete, volume, search, country browse, preview | Settings → General → Nebula Station |
| Collapse a section | Section header chevron |

## Notes

- Client-only; no Host code, dependencies, telemetry, or install scripts. Settings live in `localStorage`.
- Approximate location uses IANA time-zone principal coordinates, never an IP address. **Precise location** is opt-in and cached for 15 minutes; place names come from OpenStreetMap Nominatim.
- Weather comes from Open-Meteo; aurora intensity uses NOAA's planetary K index.
- Radio search and country browse use radio-browser.info. Streams are third-party and may change or go offline. The five defaults are fixed; custom stations can be removed.
- Push a `vX.Y.Z` tag to publish to npm and create a GitHub release through the release workflow.
- Built for DSH Web 0.2.x. MIT © 2026 sudo-catz.
