/* =====================================================================
   dustDelete.js: the note turns into dust where it sits, hangs for a
   moment, then flows in a soft arc into the dustbin.

   Why it's smooth:
   - ONE canvas + ONE requestAnimationFrame loop (no per-particle DOM nodes)
   - every position is computed from elapsed time, so it stays smooth on any frame rate
   - glow is a small pre-drawn sprite per colour, reused (no box-shadow / shadowBlur)
   - dust colours and positions are sampled from the real note PNG,
     so it only appears where paper exists (torn edges included)
   ===================================================================== */

/* ---- tuning knobs ------------------------------------------------- */
const FADE_MS   = 650;   // how long the paper itself takes to fade away
const SWEEP_MS  = 320;   // dust "wakes up" outward from the click point over this time
const LIFT_MS   = [600, 800];   // dust drifting out from the note
const HOLD_MS   = [0, 90];      // brief hang before it flies
const FLY_MS    = [650, 850];   // flight into the dustbin
const SIZE_PX   = [6, 14];
const TINT      = 0.88;  // darkens dust slightly so pale paper stays visible on a pale background
const BIN_TARGET_Y = 0.3; // 0 = top edge of the bin image, 1 = bottom (aim near the opening)

/* ---- easing ------------------------------------------------------- */
const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
const easeInOutCubic = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const rand = (a, b) => a + Math.random() * (b - a);

/* ---- soft dot sprites, cached per (quantised) colour ---------------- */
const sprites = new Map();
function spriteFor(r, g, b) {
  const qr = ((r >> 4) << 4) + 8, qg = ((g >> 4) << 4) + 8, qb = ((b >> 4) << 4) + 8;
  const key = `${qr},${qg},${qb}`;
  let s = sprites.get(key);
  if (!s) {
    const size = 32;
    s = document.createElement('canvas');
    s.width = s.height = size;
    const c = s.getContext('2d');
    const grad = c.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, `rgba(${qr},${qg},${qb},1)`);
    grad.addColorStop(0.5, `rgba(${qr},${qg},${qb},.8)`);
    grad.addColorStop(1, `rgba(${qr},${qg},${qb},0)`);
    c.fillStyle = grad;
    c.fillRect(0, 0, size, size);
    sprites.set(key, s);
  }
  return s;
}

/**
 * @param el          the .note root element
 * @param rotation    the note's rotation in degrees (note.rotation)
 * @param origin      {x, y} click position: the dust ripples outward from here
 * @param onNoteGone  called once the paper has faded; remove the note from your state here
 */
export function dustDelete(el, { rotation = 0, origin, onNoteGone } = {}) {
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  /* ---- 1. measure BEFORE touching anything ---- */
  const img = el.querySelector('.note-paper');
  const w = el.offsetWidth;            // layout size (ignores rotation)
  const h = el.offsetHeight;
  const rect = el.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;   // centre stays put under rotation
  const cy = rect.top + rect.height / 2;
  const rad = (rotation * Math.PI) / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);

  const bin = document.querySelector('.dustbin-container');
  const br = bin?.getBoundingClientRect() ?? {
    left: window.innerWidth - 80, top: window.innerHeight - 80, width: 72, height: 72,
  };
  const binX = br.left + br.width / 2;
  const binY = br.top + br.height * BIN_TARGET_Y;

  // pixels of the real note image, so dust only spawns on paper
  let pixels = null, sw = 0, sh = 0;
  if (!reduced && img?.complete && img.naturalWidth) {
    sw = Math.max(8, w >> 1);
    sh = Math.max(8, h >> 1);
    const oc = document.createElement('canvas');
    oc.width = sw; oc.height = sh;
    const octx = oc.getContext('2d', { willReadFrequently: true });
    octx.drawImage(img, 0, 0, sw, sh);
    try { pixels = octx.getImageData(0, 0, sw, sh).data; } catch { pixels = null; }
  }

  /* ---- 2. the paper fades out (opacity only, so it's cheap) ---- */
  el.style.pointerEvents = 'none';
  const fade = el.animate([{ opacity: 1 }, { opacity: 0 }], {
    duration: reduced ? 200 : FADE_MS, easing: 'ease-in-out', fill: 'forwards',
  });
  const done = () => onNoteGone?.();
  fade.finished.then(done, done);

  if (reduced) return;

  /* ---- 3. build the particles once ---- */
  const count = Math.min(220, Math.max(90, Math.round((w * h) / 700)));
  const o = origin ?? { x: cx, y: cy };
  const maxD = Math.hypot(w, h);
  const ps = [];

  for (let i = 0; i < count; i++) {
    let lx = (Math.random() - 0.5) * w, ly = (Math.random() - 0.5) * h;
    let r = 245, g = 205, b = 130;

    if (pixels) {
      for (let k = 0; k < 14; k++) {
        const u = Math.random(), v = Math.random();
        const idx = (((v * sh) | 0) * sw + ((u * sw) | 0)) * 4;
        if (pixels[idx + 3] < 200) continue;                                   // transparent: skip
        const R = pixels[idx], G = pixels[idx + 1], B = pixels[idx + 2];
        if (R * 0.3 + G * 0.59 + B * 0.11 < 90) continue;                       // leftover dark shadow: skip
        r = R; g = G; b = B;
        lx = (u - 0.5) * w; ly = (v - 0.5) * h;
        break;
      }
    }

    // where this speck starts on screen (undo the note's rotation)
    const sx = cx + lx * cos - ly * sin;
    const sy = cy + lx * sin + ly * cos;

    // where it drifts to: outward from the note centre, slightly upward
    const ang = Math.atan2(sy - cy, sx - cx) + rand(-0.9, 0.9);
    const dist = rand(25, 95);
    const lx2 = sx + Math.cos(ang) * dist;
    const ly2 = sy + Math.sin(ang) * dist - rand(15, 45);

    // where it lands, and the curve there: always bends upward, so the stream arcs
    const bx = binX + rand(-br.width * 0.12, br.width * 0.12);
    const by = binY + rand(-4, 4);
    const dx = bx - lx2, dy = by - ly2;
    const len = Math.hypot(dx, dy) || 1;
    let px = -dy / len, py = dx / len;
    if (py > 0) { px = -px; py = -py; }
    const off = len * rand(0.1, 0.3);

    ps.push({
      sx, sy, lx: lx2, ly: ly2,
      cx: (lx2 + bx) / 2 + px * off, cy: (ly2 + by) / 2 + py * off,
      bx, by,
      size: rand(SIZE_PX[0], SIZE_PX[1]),
      delay: Math.min(1, Math.hypot(sx - o.x, sy - o.y) / maxD) * SWEEP_MS + rand(0, 80),
      liftDur: rand(LIFT_MS[0], LIFT_MS[1]),
      hold: rand(HOLD_MS[0], HOLD_MS[1]),
      flyDur: rand(FLY_MS[0], FLY_MS[1]),
      phase: Math.random() * Math.PI * 2,
      sprite: spriteFor((r * TINT) | 0, (g * TINT) | 0, (b * TINT) | 0),
    });
  }

  let firstArrival = Infinity, lastArrival = 0;
  for (const p of ps) {
    const arrive = p.delay + p.liftDur + p.hold + p.flyDur;
    if (arrive < firstArrival) firstArrival = arrive;
    if (arrive > lastArrival) lastArrival = arrive;
  }

  /* ---- 4. one canvas, one loop ---- */
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = window.innerWidth, H = window.innerHeight;
  const cv = document.createElement('canvas');
  cv.width = W * dpr; cv.height = H * dpr;
  Object.assign(cv.style, {
    position: 'fixed', left: '0', top: '0', width: W + 'px', height: H + 'px',
    pointerEvents: 'none', zIndex: 100001,
  });
  document.body.appendChild(cv);
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const t0 = performance.now();
  let binNotified = false;

  function frame(now) {
    const t = Math.max(0, now - t0);
    ctx.clearRect(0, 0, W, H);
    let alive = 0;

    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      const pt = t - p.delay;
      if (pt < 0) { alive++; continue; }          // not woken up yet

      let x, y, a = 1, s = 1, fe = 0;
      const flyStart = p.liftDur + p.hold;

      if (pt < p.liftDur) {                        // drift out, decelerating
        const e = easeOutCubic(pt / p.liftDur);
        x = p.sx + (p.lx - p.sx) * e;
        y = p.sy + (p.ly - p.sy) * e;
        a = Math.min(1, pt / 140);
      } else if (pt < flyStart) {                  // hang
        x = p.lx; y = p.ly;
      } else {                                     // flow into the bin along a curve
        const f = (pt - flyStart) / p.flyDur;
        if (f >= 1) continue;                      // arrived, gone
        fe = easeInOutCubic(f);
        const m = 1 - fe;
        x = m * m * p.lx + 2 * m * fe * p.cx + fe * fe * p.bx;
        y = m * m * p.ly + 2 * m * fe * p.cy + fe * fe * p.by;
        s = 1 - 0.65 * fe;
        a = f > 0.8 ? (1 - f) / 0.2 : 1;
      }
      alive++;

      // tiny organic wobble that fades out as the flight commits
      const drift = (1 - fe) * 3;
      x += Math.sin(pt * 0.004 + p.phase) * drift;
      y += Math.cos(pt * 0.0033 + p.phase) * drift;

      const d = p.size * s;
      ctx.globalAlpha = a;
      ctx.drawImage(p.sprite, x - d / 2, y - d / 2, d, d);
    }
    ctx.globalAlpha = 1;

    // tell the dustbin when the first dust is about to land, and for how long
    if (!binNotified && t >= firstArrival - 100) {
      binNotified = true;
      window.dispatchEvent(new CustomEvent('dustbin-receive', {
        detail: { duration: lastArrival - firstArrival + 250 },
      }));
    }

    if (alive > 0 && t < lastArrival + 800) requestAnimationFrame(frame);
    else cv.remove();
  }
  requestAnimationFrame(frame);
}
