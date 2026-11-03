<p align="center">
  <img src="icon.svg" alt="Nebula" width="96" height="96">
</p>

<h1 align="center">Nebula</h1>

<p align="center">
  An aurora, a sky that follows your clock, a deep-space theme, and a world of radio — one package for the DeepSeek Harness Web UI.
</p>

Nebula bundles four small, dependency-free features into one installable
package:

- **Nebula Ambience** — a slow, pointer-aware aurora and starfield drawn across
  the whole frame, on by default, with a switch in the Nebula Sky row.
- **Nebula Sky** — the aurora follows your local clock: rose and amber at
  dawn, pale and airy at midday, burning at dusk, starlit at night. The
  composer sparkle and the Settings switch both follow or fix the clock.
- **Nebula Station** — a Radio Garden player with saved stations, station
  switching, volume, OS media controls, and a play/pause button in the composer
  toolbar.
- **Nebula Theme** — a deep-space palette for the whole app, tuned to the
  aurora, with a one-line switch inside the Nebula Sky row.

Install once, get all four. Everything defaults to on: the ambience drifts
immediately, the sky tracks the hour, the station starts Smooth Jazz 24/7
(browsers that block unmuted autoplay start it on your first click), and the
theme repaints the app in Nebula colors. Pause the music and the sky keeps
moving.

## What's new in 1.1.0

- **Nebula Sky** — the aurora follows your local clock: dawn, midday, dusk and
  night, with a sun/moon glow, fading stars and meteors, and a full-frame wash
  in light mode.
- **Scrub the day** — drag the sky strip in Settings to preview any hour;
  **Live** returns to the real clock.
- **Dark by default** — while Follow the clock is on, a load on a light built-in
  theme selects Dark so the sky is seen as designed. Custom themes are left
  alone, and turning the clock off keeps your light theme.
- **Five stations** — Smooth Jazz 24/7 plus Fox News Radio, FM Kahoku 78.8 FM,
  Ashiya Radio, and Listen Moe, with Smooth Jazz still the default.
- **Nebula Theme** — a deep-space palette applied to the whole app, on by
  default, as a single line under Follow the clock.
- **All on by default** — ambience, theme, Follow the clock and Dark are the
  shipped defaults; the one-time seed only re-asserts them for this generation.

## Nebula Ambience

- Six light pools with independent drift, breathing radius, and hue, weighted to
  the frame edges so the reading column stays clear.
- Twinkling stars with depth parallax, occasional meteors, a soft pointer lamp
  in dark mode, and a faint vignette.
- Theme-aware: additive glow in dark mode, a pale watercolor wash in light mode.
- Cheap by design: 30 fps cap, DPR capped at 2, paused when the tab is hidden,
  and a static frame under `prefers-reduced-motion`.

## Nebula Sky

- The aurora runs on a clock, not a schedule: a set of keyframes across the day
  (deep night, pre-dawn, dawn, morning, midday, afternoon, dusk, twilight,
  night) is interpolated with a smoothstep, so colors never jump.
- Dawn pulls rose and amber into the pools, midday washes them pale and wide,
  dusk burns orange and magenta, and night returns the stars and meteors.
- A soft sun glow travels left to right along the top edge by day; at night it
  becomes a cool moon glow. Stars and meteors fade out under a bright sky.
- In light mode the sky becomes a full-frame watercolor wash tinted by the
  phase — violet at night, amber at dawn, gold in the afternoon, rose at dusk —
  plus deepened corner pools, so it stays visible on white.
- Settings → General → **Nebula Sky** shows the current phase and local time on
  a day-length color strip. Drag the strip (or focus it and use the arrow keys)
  to preview any hour on the spot; **Live** returns to the real clock.
- The canvas is on by default. **Follow the clock** switches between the live
  clock and a fixed palette; the composer sparkle is the same switch. The
  **Ambience** line under the theme toggle shows or hides the canvas.
- Only your local clock is read — no location permission, no geolocation, no
  network. It costs the same either way: one canvas loop, one frame budget.
- Ambience, Follow the clock and the theme are on by default; Dark is the
  default appearance. While Follow the clock is on, a load on a light built-in
  theme selects the dark theme so the sky is seen as designed (with a couple of
  retries if the settings write is slow). Turn it off to keep a light theme and
  the fixed palette.
- **Nebula theme** — the line under Follow the clock paints the app with the
  token-level deep-space palette (lifted midnight indigo, soft lavender in light
  mode). It is a token override, not a registered theme.
- **Ambience** — the line under the theme toggle shows or hides the aurora
  canvas without touching the clock, theme, or station.

## Nebula Station

- Five Radio Garden stations ship by default — **Smooth Jazz 24/7** (the active
  default), **Fox News Radio**, **FM Kahoku 78.8 FM**, **Ashiya Radio**, and
  **Listen Moe** — streamed through Radio Garden's public listen endpoint. The
  five seeds are fixed; saved stations can be removed.
- **Saved stations** — press **Add station** in Settings to open a URL field,
  paste any `https://radio.garden/listen/…` station, and press **Add**; the field
  collapses afterward. Pick stations from the dropdown; remove custom ones; up
  to 20.
- **Volume** with a visible label and persisted preference.
- **OS media controls** — station name in the system media card, media keys for
  play/pause/stop, and next/previous to cycle saved stations.
- Stream failures show **Stream unavailable** with a **Retry** action and a link
  to the station page.
- **On by default** — playback starts with Smooth Jazz 24/7. If the browser
  blocks unmuted autoplay, the button and Settings row show **Click to start**
  and the first click anywhere begins playback. Pausing remembers off.

## Install

### From the plugin market index

Add this index source in **Plugins → Discover → Index sources**:

```
https://raw.githubusercontent.com/sudo-catz/dsh-nebula/main/market/index.json
```

The entry pins an exact commit. Discover requires the optional plugin-market
bundle on profiles that do not ship it.

### From npm

In **Plugins → Add plugin**, enter the package name:

```
dsh-nebula
```

Or pin the exact version:

```
dsh-nebula@1.1.0
```

The plugin manager reads it from the npm registry and installs the bundle.

### From Git

In **Plugins → Add plugin**, paste the pinned `v1.1.0` address:

```
git+https://github.com/sudo-catz/dsh-nebula.git#c29d0f8ec5a7665bb448202ac891352e49b69bca
```

Or follow the default branch:

```
git+https://github.com/sudo-catz/dsh-nebula.git
```

### From a local checkout

```
link:/absolute/path/to/dsh-nebula
```

## Controls

| Control | Where |
| --- | --- |
| Follow the clock | Composer toolbar sparkle icon, or Settings → General → Nebula Sky switch (same control) |
| Nebula theme | Settings → General → Nebula Sky → Nebula theme switch |
| Ambience | Settings → General → Nebula Sky → Ambience switch |
| Preview any hour | Settings → General → drag the Nebula Sky strip (←/→ for 15 min, Shift for an hour, Home/End for midnight/last minute) |
| Return to live | Settings → General → **Live**, next to the sky status |
| Play / pause station | Composer toolbar, radio-tower icon |
| Station switcher, add/remove, volume | Settings → General → Nebula Station |
| Add a station | Settings → General → Nebula Station → Add station |
| Open station page | Settings → General → Nebula Station |
| Play/pause/next/previous | OS media keys or the system media card |
| Start blocked autoplay | First click anywhere, or the radio button |

### Adding stations

1. Open a station on Radio Garden.
2. Copy its clean URL: `https://radio.garden/listen/<name>/<id>`.
3. Settings → General → **Add station** → paste the URL → **Add**.
4. Pick it from the dropdown anytime.

Smooth Jazz 24/7 is the default station on a fresh install; the four other
seeds are one click away in the dropdown. Switching while playing keeps the
music going; switching while paused only selects the station.
Only `https://radio.garden/listen/…` URLs are accepted; names are derived from
the slug, the list is re-validated on load, and the stream URL is built from the
validated station id.

## Security and privacy

- All four features are client-only; the Host half is a no-op. No filesystem,
  process, network, tool, prompt, or session access.
- No dependencies, no install scripts, no build step, no telemetry.
- The station player makes exactly one outbound request, only when playback
  starts (including the initial autoplay attempt): the Radio Garden media URL.
  It sends no app data and uses `referrerPolicy="no-referrer"`; the station page
  link uses `rel="noopener noreferrer"`.
- Preferences live in `localStorage`: the ambience toggle, the sky/clock
  toggle, the Nebula theme toggle, station volume, saved stations, the active
  station, and the playback intent.
- While Follow the clock is on, the plugin selects the built-in dark theme on
  load when a light built-in theme is active; custom themes are never touched.
  Turn the clock off to stop it. During a session you can still pick Light in
  Appearance; the next load with the clock on selects Dark again.
- The sky reads the device clock only. It does not request geolocation or send
  the time anywhere.
- The Radio Garden listen endpoint is **undocumented and unofficial**. It can
  change or be rate-limited, and it is intended for personal use. For a
  published/deployed radio feature, use a supported route.
- OS media controls expose the active station name to your operating system —
  that is their purpose.

## Compatibility

Built for DSH Web 0.2.x and tested on `0.2.1-rc.5`. All four features use public
Client extension points only — slots, the theme service, the locale service,
and browser media APIs. No `engines` constraint is declared.

This package supersedes the earlier separate `dsh-nebula-ambience` repo and the
local Nebula Radio bundle.

## License

[MIT](LICENSE) © 2026 sudo-catz
