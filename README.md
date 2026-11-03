<p align="center">
  <img src="icon.svg" alt="Nebula" width="96" height="96">
</p>

<h1 align="center">Nebula</h1>

<p align="center">
  An aurora, a starfield, and a world of radio — one package for the DeepSeek Harness Web UI.
</p>

Nebula bundles two small, dependency-free client plugins into one installable
package:

- **Nebula Ambience** — a slow, pointer-aware aurora and starfield drawn across
  the whole frame, with a compact toggle in the composer toolbar.
- **Nebula Station** — a Radio Garden player with saved stations, station
  switching, volume, OS media controls, and a play/pause button in the composer
  toolbar.

Install once, get both. Both features default to on: the ambience drifts
immediately, and the station starts Smooth Jazz 24/7 (browsers that block
unmuted autoplay start it on your first click). Pause the music and the sky
keeps drifting.

## Nebula Ambience

- Six light pools with independent drift, breathing radius, and hue, weighted to
  the frame edges so the reading column stays clear.
- Twinkling stars with depth parallax, occasional meteors, a soft pointer lamp
  in dark mode, and a faint vignette.
- Theme-aware: additive glow in dark mode, a pale watercolor wash in light mode.
- Cheap by design: 30 fps cap, DPR capped at 2, paused when the tab is hidden,
  a static frame under `prefers-reduced-motion`, and no render loop when off.

## Nebula Station

- One-click playback of Smooth Jazz 24/7 from Radio Garden, streamed through
  Radio Garden's public listen endpoint.
- **Saved stations** — paste any `https://radio.garden/listen/…` station URL in
  Settings to add it; pick it from the dropdown; remove custom stations; up to 20.
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

### From Git

In **Plugins → Add plugin**, paste the pinned `v1.0.0` address:

```
git+https://github.com/sudo-catz/dsh-nebula.git#e6ec8bd2b2d5eaed3d1e1b8d01e5ef79fecbedfa
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
| Aurora toggle | Composer toolbar, sparkle icon |
| Play / pause station | Composer toolbar, radio-tower icon |
| Station switcher, add/remove, volume | Settings → General → Nebula Station |
| Open station page | Settings → General → Nebula Station |
| Play/pause/next/previous | OS media keys or the system media card |
| Start blocked autoplay | First click anywhere, or the radio button |

### Adding stations

1. Open a station on Radio Garden.
2. Copy its clean URL: `https://radio.garden/listen/<name>/<id>`.
3. Settings → General → paste it into the add field → **Add**.
4. Pick it from the dropdown anytime.

Smooth Jazz 24/7 is the default station on a fresh install. Switching while
playing keeps the music going; switching while paused only selects the station.
Only `https://radio.garden/listen/…` URLs are accepted; names are derived from
the slug, the list is re-validated on load, and the stream URL is built from the
validated station id.

## Security and privacy

- Both features are client-only; the Host half is a no-op. No filesystem,
  process, network, tool, prompt, or session access.
- No dependencies, no install scripts, no build step, no telemetry.
- The station player makes exactly one outbound request, only when playback
  starts (including the initial autoplay attempt): the Radio Garden media URL.
  It sends no app data and uses `referrerPolicy="no-referrer"`; the station page
  link uses `rel="noopener noreferrer"`.
- Preferences live in `localStorage`: the ambience toggle, station volume, saved
  stations, the active station, and the playback intent.
- The Radio Garden listen endpoint is **undocumented and unofficial**. It can
  change or be rate-limited, and it is intended for personal use. For a
  published/deployed radio feature, use a supported route.
- OS media controls expose the active station name to your operating system —
  that is their purpose.

## Compatibility

Built for DSH Web 0.2.x and tested on `0.2.1-rc.5`. Both features use public
Client extension points only — slots, the theme service, the locale service,
and browser media APIs. No `engines` constraint is declared.

This package supersedes the earlier separate `dsh-nebula-ambience` repo and the
local Nebula Radio bundle.

## License

[MIT](LICENSE) © 2026 sudo-catz
