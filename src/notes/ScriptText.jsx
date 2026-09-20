/* =====================================================================
   ScriptText.jsx: Apple-style handwriting. Text is laid out in a single-stroke cursive font
   and every new character is DRAWN by a pen: one continuous line, letters connected.

   It only DISPLAYS the text. Your real <textarea> still handles typing, undo, paste and the
   keyboard; it just has invisible text. Click on the drawn text to place the caret.

   Font packs come from tools/build_script_font.py (Vara stroke fonts, MIT).
   ===================================================================== */
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { layoutScript, caretPos, hitTest, unitToIndex, indexToUnit } from './scriptLayout';

/* ---- tuning knobs ---- */
const PEN_SPEED = 125;       // px per second the pen travels (higher = faster, snappier)
const MIN_MS = 170;          // a glyph never draws faster than this...
const MAX_MS = 450;          // ...or slower than this
const MAX_QUEUE_MS = 550;    // if the pen falls this far behind your typing it speeds up
const MAX_BURST = 30;        // pasting more than this many characters at once: no animation
const EASING = 'cubic-bezier(.35, .1, .3, 1)';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* ---- font pack loading (cached; call loadScriptFont(url) early to avoid a first-letter delay) ---- */
const packs = new Map();
export function loadScriptFont(url) {
  if (!packs.has(url)) {
    packs.set(url, fetch(url)
      .then(r => { if (!r.ok) throw new Error(`Script font ${r.status}`); return r.json(); })
      .catch(e => { packs.delete(url); throw e; }));
  }
  return packs.get(url);
}
function useScriptFont(url) {
  const [pack, setPack] = useState(null);
  useEffect(() => {
    let off = false;
    loadScriptFont(url).then(p => { if (!off) setPack(p); }).catch(() => {});
    return () => { off = true; };
  }, [url]);
  return pack;
}

/* ---- one character: strokes drawn in order, queued behind the previous character ---- */
const Glyph = memo(function Glyph({ glyph, x, y, scale, strokePx, color, animate, pen }) {
  const ref = useRef(null);
  const started = useRef(false);

  // runs once, when the character first appears (before paint, so it never flashes fully drawn)
  useLayoutEffect(() => {
    if (!animate) return;
    // React StrictMode (the Vite default) runs every new effect TWICE in development. Without this
    // guard the second run queues a second animation that hides the first one, and the letter
    // pops in fully drawn instead of being drawn. Refs survive that double run, so this is safe.
    if (started.current) return;
    started.current = true;
    const paths = ref.current.querySelectorAll('path');
    const now = performance.now();
    const wait = Math.min(Math.max(0, pen.current - now), MAX_QUEUE_MS);   // one pen: wait your turn
    const rush = wait > 350 ? 0.55 : 1;                                     // pen is behind: draw faster
    let t = wait;

    paths.forEach((el, i) => {
      const len = el.getTotalLength?.() || glyph.p[i].l;
      const dur = clamp((len * scale) / PEN_SPEED * 1000, MIN_MS, MAX_MS) * rush;
      // the "L L+2" dash pattern avoids the stray dot round line-caps draw at the start of a hidden path
      el.style.strokeDasharray = `${len} ${len + 2}`;
      el.style.strokeDashoffset = `${len + 1}`;
      const a = el.animate(
        [{ strokeDashoffset: len + 1 }, { strokeDashoffset: 0 }],
        { duration: dur, delay: t, easing: EASING, fill: 'both' }
      );
      a.finished.then(() => {
        el.style.strokeDasharray = 'none';
        el.style.strokeDashoffset = '0';
        a.cancel();
      }, () => {});
      t += dur;
    });
    pen.current = now + t;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <g
      ref={ref}
      style={{
        transform: `translate(${x}px, ${y}px) scale(${scale})`,
        transformOrigin: '0 0',
        transition: animate ? 'none' : 'transform .18s ease-out',   // later letters glide when text before them changes
      }}
      fill="none"
      stroke={color}
      strokeWidth={strokePx / scale}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {glyph.p.map((p, i) => <path key={i} d={p.d} />)}
    </g>
  );
});

/**
 * <ScriptText
 *   chars     = array from useCharTags: [{ id, c }]
 *   packUrl   = '/script-satisfy.json'
 *   lineHeight= px between the printed lines of the note
 *   caret     = textarea.selectionStart when collapsed, else null   (UTF-16 units)
 *   focused   = is the textarea focused
 *   onCaret   = (utf16Index) => void   called when the user clicks the drawn text
 * />
 */
export default function ScriptText({
  chars,
  packUrl,
  lineHeight = 28,
  strokePx = 1.6,
  color = '#3a3a3a',
  letterSpacing = 0,
  wordSpacing = 3,
  baselineNudge = 0,      // px: move the writing up (-) or down (+) relative to the printed lines
  caret = null,
  focused = false,
  onCaret,
  onDoubleClick,
  onPointerDown,
  onPointerUp,
}) {
  const pack = useScriptFont(packUrl);
  const svgRef = useRef(null);
  const pen = useRef(0);
  const [box, setBox] = useState({ w: 300, h: 120 });

  // size of the writable area (the parent container)
  useLayoutEffect(() => {
    const el = svgRef.current?.parentElement;
    if (!el) return;
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* which characters are NEW this render? (initial text and big pastes are never animated) */
  const seen = useRef(null);
  if (seen.current === null) seen.current = new Set(chars.map(c => c.id));
  const fresh = chars.filter(c => !seen.current.has(c.id));
  const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const animateIds = !reduce && fresh.length > 0 && fresh.length <= MAX_BURST
    ? new Set(fresh.map(c => c.id))
    : null;
  useLayoutEffect(() => { chars.forEach(c => seen.current.add(c.id)); }, [chars]);

  const scale = pack ? lineHeight / pack.lh : 1;
  const layout = useMemo(
    () => (pack ? layoutScript(chars, pack, { scale, width: box.w, letterSpacing, wordSpacing }) : null),
    [chars, pack, scale, box.w, letterSpacing, wordSpacing]
  );

  // baseline of line 0 so the letters sit on the printed line
  const baseOffset = pack
    ? (lineHeight - (pack.asc + pack.desc) * scale) / 2 + pack.asc * scale + baselineNudge
    : 0;
  const scrollY = layout ? Math.max(0, layout.lines * lineHeight - box.h) : 0;   // keep the last line visible

  const lineY = line => line * lineHeight + baseOffset - scrollY;

  function handleClick(e) {
    if (!layout || !onCaret) return;
    const m = svgRef.current.getScreenCTM();
    if (!m) return;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());   // handles note rotation
    onCaret(indexToUnit(chars, hitTest(layout, p.x, p.y + scrollY, lineHeight)));
  }

  let caretEl = null;
  if (layout && focused && caret != null) {
    const cp = caretPos(layout, unitToIndex(chars, caret));
    const base = lineY(cp.line);
    caretEl = (
      <line
        className="script-caret"
        x1={cp.x} x2={cp.x}
        y1={base - pack.asc * scale * 0.9} y2={base + pack.desc * scale * 0.5}
        stroke={color} strokeWidth={1.4} strokeLinecap="round"
      />
    );
  }

  return (
    <svg
      ref={svgRef}
      className="script-layer"
      aria-hidden="true"
      onClick={handleClick}
      onDoubleClick={onDoubleClick}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      {layout && layout.items.map(it => {
        const glyph = pack.glyphs[it.c];
        if (!glyph) return null;                                   // space, newline, unsupported character
        return (
          <Glyph
            key={chars[it.i].id}
            glyph={glyph}
            x={it.x}
            y={lineY(it.line)}
            scale={scale}
            strokePx={strokePx}
            color={color}
            animate={!!animateIds?.has(chars[it.i].id)}
            pen={pen}
          />
        );
      })}
      {caretEl}
    </svg>
  );
}
