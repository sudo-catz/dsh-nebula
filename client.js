/**
 * Nebula — Client half.
 *
 * One package, two experiences:
 *  - Nebula Ambience: a pointer-aware aurora and starfield rendered in the
 *    frame-wide overlay, with a composer toggle.
 *  - Nebula Station: a Radio Garden player with saved stations, station
 *    switching, volume, OS media controls, and a composer play/pause toggle.
 *
 * Both features are plain, dependency-free client code. The station audio is a
 * browser <audio> element pointed at Radio Garden's public listen endpoint; the
 * aurora is a canvas in shell.overlay. Nothing here reads sessions, cookies,
 * files, or other plugins' data.
 */
window.__ModuleLoader__.load({
  id: 'dsh-nebula',
  factory(require) {
    function createAmbience() {
    const React = require('react');
    const h = React.createElement;
    const { useEffect, useReducer, useRef } = React;

    const NS = 'nebula-ambience';
    const STORAGE_KEY = 'dsh.nebula-ambience.enabled';
    const TAU = Math.PI * 2;

    const EN = {
      toggleOn: 'Nebula ambience is on. Click to let the sky rest.',
      toggleOff: 'Nebula ambience is off. Click to light up the sky.',
      actionOn: 'Turn off nebula ambience',
      actionOff: 'Turn on nebula ambience',
    };
    const ID = {
      toggleOn: 'Suasana nebula menyala. Klik untuk mengistirahatkan langit.',
      toggleOff: 'Suasana nebula padam. Klik untuk menyalakan langit.',
      actionOn: 'Matikan suasana nebula',
      actionOff: 'Nyalakan suasana nebula',
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
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  transition: background-color 140ms ease, color 140ms ease;
}
.dsh-nebula-toggle:hover {
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-primary);
}
.dsh-nebula-toggle:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary);
  outline-offset: 1px;
}
.dsh-nebula-toggle.is-on { color: var(--dsw-alias-brand-primary); }
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
    let meteorBurst = 0;
    let requestStaticRedraw = () => {};

    function t(key) {
      const value = translate(key);
      return typeof value === 'string' && value && value !== key ? value : EN[key] || key;
    }

    /* ------------------------------------------------------------------ */
    /* Shared on/off store (the two toggle seats must never disagree).     */
    /* ------------------------------------------------------------------ */

    let enabled = (() => {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        return raw === null ? true : raw !== '0';
      } catch {
        return true;
      }
    })();

    const listeners = new Set();

    function emit() {
      for (const listener of listeners) listener();
    }

    function setEnabled(next) {
      if (enabled === next) return;
      enabled = next;
      if (next) meteorBurst = 3;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      } catch {
        /* Private mode: the session preference still applies. */
      }
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

    /* ------------------------------------------------------------------ */
    /* Atmosphere layer                                                    */
    /* ------------------------------------------------------------------ */

    function makeStars(w, h) {
      const count = Math.min(170, Math.max(40, Math.round((w * h) / 13000)));
      const stars = [];
      for (let index = 0; index < count; index += 1) {
        stars.push({
          x: Math.random(),
          y: Math.random(),
          r: 0.4 + Math.random() * 1.25,
          tw: 0.0005 + Math.random() * 0.0022,
          ph: Math.random() * TAU,
          d: 0.3 + Math.random() * 0.9,
          a: 0.22 + Math.random() * 0.6,
        });
      }
      return stars;
    }

    function NebulaLayer() {
      const on = useEnabled();
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
        let meteors = [];
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

        function draw(now, dt) {
          g.setTransform(dpr, 0, 0, dpr, 0, 0);
          g.clearRect(0, 0, w, h);

          const light = scheme === 'light';
          const palette = light ? LIGHT : DARK;
          const span = Math.max(w, h);

          easedX += (pointerX - easedX) * 0.045;
          easedY += (pointerY - easedY) * 0.045;
          const px = (easedX - 0.5) * 2;
          const py = (easedY - 0.5) * 2;

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

          g.globalCompositeOperation = light ? 'source-over' : 'lighter';
          g.fillStyle = palette.star;
          for (let index = 0; index < stars.length; index += 1) {
            const star = stars[index];
            const twinkle = 0.55 + 0.45 * Math.sin(now * star.tw + star.ph);
            g.globalAlpha = Math.max(0, star.a * twinkle * palette.starAlpha);
            const starX = star.x * w + px * star.d * 9;
            const starY = star.y * h + py * star.d * 6;
            g.beginPath();
            g.arc(starX, starY, star.r, 0, TAU);
            g.fill();
          }
          g.globalAlpha = 1;

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

            if (!reduced()) {
              if (meteorBurst > 0) {
                meteors.push(spawnMeteor());
                meteorBurst -= 1;
                nextShot = now + 5000 + Math.random() * 6000;
              } else if (now > nextShot) {
                meteors.push(spawnMeteor());
                nextShot = now + 6500 + Math.random() * 8500;
              }
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

          if (!light) {
            g.globalCompositeOperation = 'source-over';
            const vignette = g.createRadialGradient(
              w * 0.5,
              h * 0.45,
              Math.min(w, h) * 0.5,
              w * 0.5,
              h * 0.45,
              span * 0.82,
            );
            vignette.addColorStop(0, 'rgba(3,5,12,0)');
            vignette.addColorStop(1, 'rgba(3,5,12,0.14)');
            g.fillStyle = vignette;
            g.fillRect(0, 0, w, h);
          }
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
          if (!reduced()) return;
          draw(4200, 0);
        }
        requestStaticRedraw = drawStill;

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
      );
    }

    /* ------------------------------------------------------------------ */
    /* Toggle                                                              */
    /* ------------------------------------------------------------------ */

    function NebulaToggle() {
      const on = useEnabled();
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
            'aria-pressed': on,
            'aria-label': action,
            title: hint,
            onClick: () => setEnabled(!enabled),
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

        const localeFace = ctx.get('locale');
        if (localeFace) {
          ctx.effect(() => {
            const disposers = [];
            const dictionaries = [
              ['en', EN],
              ['id', ID],
            ];
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
      },
    };
    }

    function createStation() {
    const React = require('react');
    const h = React.createElement;
    const { useEffect, useReducer, useState } = React;

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
    const STATION_PATTERN = /^https:\/\/radio\.garden\/listen\/([A-Za-z0-9._~-]+)\/([A-Za-z0-9_-]{4,64})\/?$/i;
    const SEED_STATION = {
      id: '1vlrqH6v',
      name: 'Smooth Jazz 24/7',
      url: 'https://radio.garden/listen/smooth-jazz-24-7/1vlrqH6v',
    };

    const EN = {
      play: 'Play {station}',
      pause: 'Pause {station}',
      tooltipPlay: 'Play {station} — streamed via Radio Garden',
      tooltipPause: 'Pause {station}',
      tooltipConnecting: 'Connecting to {station}…',
      tooltipError: 'Stream unavailable — open the station page',
      tooltipArmed: 'Click to start {station}',
      title: 'Nebula Station',
      stationLabel: 'Station',
      openStation: 'Open station page',
      removeStation: 'Remove',
      retry: 'Retry',
      volumeLabel: 'Volume',
      stateOn: 'Playing',
      stateOff: 'Paused',
      stateConnecting: 'Connecting…',
      stateError: 'Stream unavailable',
      stateArmed: 'Click to start',
      hint: 'Streams via Radio Garden. Paste a station URL to add it.',
      addLabel: 'Add station',
      addPlaceholder: 'https://radio.garden/listen/…',
      addButton: 'Add',
      addInvalid: 'Use a radio.garden/listen/… station URL.',
      addDuplicate: 'That station is already in the list.',
      addLimit: 'You can save up to 20 stations.',
    };
    const ID = {
      play: 'Putar {station}',
      pause: 'Jeda {station}',
      tooltipPlay: 'Putar {station} — streaming lewat Radio Garden',
      tooltipPause: 'Jeda {station}',
      tooltipConnecting: 'Menghubungkan ke {station}…',
      tooltipError: 'Stream tidak tersedia — buka halaman stasiun',
      tooltipArmed: 'Klik untuk memutar {station}',
      title: 'Stasiun Nebula',
      stationLabel: 'Stasiun',
      openStation: 'Buka halaman stasiun',
      removeStation: 'Hapus',
      retry: 'Coba lagi',
      volumeLabel: 'Volume',
      stateOn: 'Diputar',
      stateOff: 'Dijeda',
      stateConnecting: 'Menghubungkan…',
      stateError: 'Stream tidak tersedia',
      stateArmed: 'Klik untuk memutar',
      hint: 'Streaming lewat Radio Garden. Tempel URL stasiun untuk menambahkannya.',
      addLabel: 'Tambah stasiun',
      addPlaceholder: 'https://radio.garden/listen/…',
      addButton: 'Tambah',
      addInvalid: 'Gunakan URL stasiun radio.garden/listen/…',
      addDuplicate: 'Stasiun itu sudah ada di daftar.',
      addLimit: 'Anda dapat menyimpan hingga 20 stasiun.',
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
  gap: 8px;
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
.dsh-nr-row-state.is-error { color: var(--dsw-alias-state-error-primary); }
.dsh-nr-row-state.is-armed { color: var(--dsw-alias-brand-primary); }
.dsh-nr-station-row {
  display: flex;
  align-items: center;
  gap: 12px;
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
  color: #ffffff;
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
  background: var(--dsw-alias-bg-layer-1);
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
.dsh-nr-add-form {
  display: flex;
  align-items: center;
  gap: 8px;
}
.dsh-nr-input {
  flex: 1;
  min-width: 0;
  height: 32px;
  padding: 0 10px;
  border-radius: 8px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: transparent;
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
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.dsh-nr-add:hover { background: var(--dsw-alias-bg-overlay); }
.dsh-nr-add:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary);
  outline-offset: 1px;
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
@media (prefers-reduced-motion: reduce) {
  .dsh-nr-wave { animation: none; }
}
`;

    let translate = (key) => EN[key] || key;
    let runtime = null;
    let audio = null;
    let loadedId = '';
    let playing = false;
    let connecting = false;
    let failed = false;
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
      const list = [{ ...SEED_STATION }];
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
      return stations[0] || SEED_STATION;
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

    function ensureAudio() {
      if (audio) return audio;
      const element = new Audio();
      element.preload = 'none';
      element.referrerPolicy = 'no-referrer';
      element.volume = volume;
      element.addEventListener('playing', () => {
        if (audio !== element) return;
        clearConnectTimer();
        playing = true;
        connecting = false;
        failed = false;
        armed = false;
        disarmGesture();
        emit();
      });
      element.addEventListener('pause', () => {
        if (audio !== element) return;
        clearConnectTimer();
        playing = false;
        connecting = false;
        emit();
      });
      element.addEventListener('error', () => {
        if (audio !== element) return;
        clearConnectTimer();
        playing = false;
        connecting = false;
        failed = true;
        armed = false;
        disarmGesture();
        emit();
      });
      element.addEventListener('ended', () => {
        if (audio !== element) return;
        clearConnectTimer();
        playing = false;
        connecting = false;
        emit();
      });
      audio = element;
      loadedId = '';
      applySource(element);
      return element;
    }

    function handlePlayFailure(error) {
      clearConnectTimer();
      connecting = false;
      playing = false;
      if (error && error.name === 'NotAllowedError') {
        failed = false;
        armed = true;
        armGesture();
        emit();
        return;
      }
      if (!error || error.name !== 'AbortError') failed = true;
      emit();
    }

    function playRadio() {
      if (playing || connecting) return;
      const station = activeStation();
      if (!station) return;
      playbackIntent = true;
      persistPlaybackIntent();
      armed = false;
      disarmGesture();
      let element;
      try {
        element = ensureAudio();
      } catch (error) {
        console.warn('[nebula-station] audio is unavailable', error);
        failed = true;
        emit();
        return;
      }
      if (loadedId !== station.id) {
        loadedId = '';
        applySource(element);
      }
      if (failed) {
        try {
          element.load();
        } catch {
          /* The next play attempt surfaces the failure. */
        }
      }
      failed = false;
      connecting = true;
      emit();
      clearConnectTimer();
      connectTimer = window.setTimeout(() => {
        connectTimer = 0;
        if (!audio || audio !== element) return;
        if (connecting && !playing) {
          connecting = false;
          failed = true;
          emit();
        }
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

    function pauseRadio() {
      if (!playing && !connecting) {
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
      if (audio) {
        try {
          audio.pause();
        } catch {
          /* State still settles below. */
        }
      }
      playing = false;
      connecting = false;
      emit();
    }

    function toggleRadio() {
      if (playing || connecting) pauseRadio();
      else playRadio();
    }

    function cycleStation(delta) {
      if (stations.length < 2) return;
      let index = stations.findIndex((station) => station.id === activeId);
      if (index < 0) index = 0;
      const next = stations[(index + delta + stations.length) % stations.length];
      if (!next) return;
      const wasLive = playing || connecting || armed;
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
      const wasLive = playing || connecting || armed;
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
      if (!station || station.id === SEED_STATION.id) return;
      stations = stations.filter((item) => item.id !== station.id);
      persistStations();
      activeId = SEED_STATION.id;
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
      disarmGesture();
      teardownMediaSession();
      const element = audio;
      audio = null;
      loadedId = '';
      playing = false;
      connecting = false;
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
      const stationName = state.active ? state.active.name : 'Radio';
      const active = state.playing || state.connecting;
      const className =
        'dsh-nr-toggle' +
        (state.playing
          ? ' is-playing'
          : state.connecting
            ? ' is-connecting'
            : state.failed
              ? ' is-error'
              : state.armed
                ? ' is-armed'
                : '');
      const tooltip = state.failed
        ? t('tooltipError')
        : state.connecting
          ? format('tooltipConnecting', stationName)
          : state.playing
            ? format('tooltipPause', stationName)
            : state.armed
              ? format('tooltipArmed', stationName)
              : format('tooltipPlay', stationName);
      return h(
        React.Fragment,
        null,
        h('style', { key: 'css' }, CSS),
        h(
          'button',
          {
            key: 'button',
            type: 'button',
            className,
            'aria-pressed': active,
            'aria-busy': state.connecting ? 'true' : undefined,
            'aria-label': format(active ? 'pause' : 'play', stationName),
            title: tooltip,
            onClick: toggleRadio,
          },
          h(RadioIcon),
        ),
      );
    }

    function RadioRow() {
      const state = useRadio();
      const [draft, setDraft] = useState('');
      const [error, setError] = useState('');
      const percent = Math.round(state.volume * 100);
      const status = state.failed
        ? t('stateError')
        : state.connecting
          ? t('stateConnecting')
          : state.playing
            ? t('stateOn')
            : state.armed
              ? t('stateArmed')
              : t('stateOff');
      const stateClass =
        'dsh-nr-row-state' +
        (state.failed ? ' is-error' : state.playing ? ' is-on' : state.armed ? ' is-armed' : '');
      const active = state.active || SEED_STATION;
      const hue = stationHue(active);
      const avatarStyle = {
        background:
          'linear-gradient(135deg, hsl(' + hue + ', 72%, 55%), hsl(' + ((hue + 48) % 360) + ', 72%, 42%))',
      };

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
        switchStation(parsed.id);
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
            state.failed
              ? h(
                  'button',
                  { className: 'dsh-nr-retry', type: 'button', onClick: playRadio },
                  t('retry'),
                )
              : null,
            active.id === SEED_STATION.id
              ? null
              : h(
                  'button',
                  {
                    className: 'dsh-nr-remove',
                    type: 'button',
                    onClick: removeActiveStation,
                  },
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
              onChange: (event) => setVolume(Number(event.target.value) / 100),
            }),
            h('span', { className: 'dsh-nr-value' }, percent + '%'),
          ),
          h(
            'form',
            { className: 'dsh-nr-add-form', onSubmit: onAdd },
            h('input', {
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
          ),
          h(
            'div',
            { className: error ? 'dsh-nr-error' : 'dsh-nr-row-hint', role: error ? 'alert' : undefined },
            error || t('hint'),
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
            const dictionaries = [
              ['en', EN],
              ['id', ID],
            ];
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

    const ambience = createAmbience();
    const station = createStation();

    return {
      inject: ['slots'],
      apply(ctx) {
        ambience.apply(ctx);
        station.apply(ctx);
      },
    };
  },
});
