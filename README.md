<p align="center">
  <img src="icon.svg" alt="Nebula" width="96" height="96">
</p>

<h1 align="center">Nebula</h1>

<p align="center">
  Aurora ambience, a clock-following sky, a deep-space theme, and Radio Garden radio — one package for the DeepSeek Harness Web UI.
</p>

## Features

- **Ambience** — a pointer-aware aurora and starfield across the whole frame, with drifting haze, soft clouds, and a faint Milky Way. On by default.
- **Sky** — follows your local clock from dawn to night. A full-frame phase wash, horizon haze, a sun by day, and a phase-accurate moon at night carry the hour across the page, while the Settings strip shows sunrise, sunset, and the moon phase. Drag the strip to preview any hour; **Live** returns to the clock.
- **Theme** — a deep-space palette for the whole app, with a lavender light variant, applied as a token skin.
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
dsh-nebula@1.1.0
```

`main` may be newer than the published npm release.

### From Git

```
git+https://github.com/sudo-catz/dsh-nebula.git#c29d0f8ec5a7665bb448202ac891352e49b69bca
```

That commit is the `v1.1.0` release. Omit the `#…` to follow `main`.

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
| Nebula theme / Ambience | Nebula Sky switches |
| Play / pause | Composer radio-tower icon or OS media keys |
| Stations, volume, Add station | Settings → General → Nebula Station |

## Good to know

- Client-only: no Host work, dependencies, install scripts, or telemetry. Settings live in `localStorage`.
- The sky reads the device clock and makes one approximate IP lookup (ipwho.is, cached for 24 hours) to place sunrise and sunset. No location permission prompt. If the IP timezone disagrees with the device timezone, a representative city for the device timezone is used.
- Radio Garden's listen endpoint is unofficial and intended for personal use.
- The five default stations are fixed; custom stations are yours to remove.
- Built for DSH Web 0.2.x. MIT © 2026 sudo-catz.
