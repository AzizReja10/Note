/* =====================================================================
   ScriptText.jsx: Apple-style handwriting. Text is laid out in a single-stroke cursive font
   and every new character is DRAWN by a pen: one continuous line, letters connected.
   Emoji (and any character the stroke font lacks) are shown as real text and pop in.

   It only DISPLAYS the text. Your real <textarea> still handles typing, undo, paste and the
   keyboard; it just has invisible text. Click on the drawn text to place the caret.

   Font packs come from tools/build_script_font.py (Vara stroke fonts, MIT).
   ===================================================================== */
import { forwardRef, memo, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  layoutScript, caretPos, hitTest, cellAtPoint, unitToIndex, indexToUnit, clusterChars, isEmoji,
} from './scriptLayout';

/* ---- tuning knobs ---- */
const PEN_SPEED = 90;        // px per second the pen travels (lower = slower, more graceful)
const MIN_MS = 220;          // a glyph never draws faster than this...
const MAX_MS = 600;          // ...or slower than this
const MAX_QUEUE_MS = 700;    // if the pen falls this far behind your typing it speeds up
const MAX_BURST = 30;        // pasting more than this many characters at once: no animation
const EASING = 'cubic-bezier(.35, .1, .3, 1)';
const POP_MS = 260;          // emoji pop-in time
const EMOJI_EM = 1.05;       // emoji size relative to the script's ascender height

// characters the stroke font can't draw fall back to this stack (emoji come from the system emoji font)
const FALLBACK_FONT =
  "'Patrick Hand', 'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif";

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const isReduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

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

/* ---- measuring fallback characters (emoji etc.) with a canvas ---- */
function makeMeasure(family) {
  const cache = new Map();
  let ctx = null;
  return (c, size) => {
    const key = `${size}|${c}`;
    let w = cache.get(key);
    if (w == null) {
      ctx = ctx || document.createElement('canvas').getContext('2d');
      if (ctx) { ctx.font = `${size}px ${family}`; w = ctx.measureText(c).width; }
      else w = size;
      cache.set(key, w);
    }
    return w;
  };
}

/* ---- one stroke character: strokes drawn in order, queued behind the previous character ---- */
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

/* ---- emoji and other characters with no stroke glyph: real text that pops in ---- */
const FallbackGlyph = memo(function FallbackGlyph({ c, x, y, size, family, color, animate, pen }) {
  const ref = useRef(null);
  const started = useRef(false);

  useLayoutEffect(() => {
    if (!animate || started.current) return;   // (same StrictMode guard as Glyph)
    started.current = true;
    const now = performance.now();
    const wait = Math.min(Math.max(0, pen.current - now), MAX_QUEUE_MS);
    const dur = wait > 350 ? POP_MS * 0.6 : POP_MS;
    ref.current.animate(
      [
        { opacity: 0, transform: 'scale(.35) rotate(-14deg)' },
        { opacity: 1, transform: 'scale(1.14) rotate(3deg)', offset: 0.65 },
        { opacity: 1, transform: 'scale(1) rotate(0deg)' },
      ],
      { duration: dur, delay: wait, easing: 'cubic-bezier(.34, 1.4, .5, 1)', fill: 'backwards' }   // hidden until its turn
    );
    pen.current = now + wait + dur;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <g
      style={{
        transform: `translate(${x}px, ${y}px)`,
        transition: animate ? 'none' : 'transform .18s ease-out',
      }}
    >
      {/* positioned by the <g>, animated on the <text>, so the two transforms never fight */}
      <text
        ref={ref}
        x={0}
        y={0}
        fontSize={size}
        fontFamily={family}
        fill={color}
        style={{ transformBox: 'fill-box', transformOrigin: '50% 60%' }}
      >
        {c}
      </text>
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
export default forwardRef(function ScriptText({
  chars,
  packUrl,
  lineHeight = 28,
  strokePx = 1.6,
  color = '#3a3a3a',
  letterSpacing = 0,
  wordSpacing = 3,
  fallbackFont = FALLBACK_FONT,   // used for emoji, accents and anything the script font lacks
  baselineNudge = 0,      // px: move the writing up (-) or down (+) relative to the printed lines
  caret = null,
  focused = false,
  highlights = [],
  activeHighlightRange = null,
  highlighterColor = '#facc15',
  highlighterType = 'highlight',
  isHighlighterActive = false,
  highlighterMode = 'draw',
  onCaret,
  onDoubleClick,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}, ref) {
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

  // one cell per visible character (an emoji made of several code points is ONE cell)
  const cells = useMemo(() => clusterChars(chars), [chars]);

  /* which cells are NEW this render? (initial text and big pastes are never animated) */
  const seen = useRef(null);
  if (seen.current === null) seen.current = new Set(cells.map(c => c.id));
  const fresh = cells.filter(c => !seen.current.has(c.id));
  const animateIds = !isReduced() && fresh.length > 0 && fresh.length <= MAX_BURST
    ? new Set(fresh.map(c => c.id))
    : null;
  useLayoutEffect(() => { cells.forEach(c => seen.current.add(c.id)); }, [cells]);

  const scale = pack ? lineHeight / pack.lh : 1;

  // sizes and widths for characters the stroke font can't draw
  const emojiSize = pack ? Math.round(pack.asc * scale * EMOJI_EM) : 18;
  const textSize = Math.round(lineHeight * 0.7);
  const measure = useMemo(() => makeMeasure(fallbackFont), [fallbackFont]);
  const fallbackWidth = useMemo(
    () => c => measure(c, isEmoji(c) ? emojiSize : textSize) + 2,
    [measure, emojiSize, textSize]
  );

  const layout = useMemo(
    () => (pack ? layoutScript(cells, pack, { scale, width: box.w, letterSpacing, wordSpacing, fallbackWidth }) : null),
    [cells, pack, scale, box.w, letterSpacing, wordSpacing, fallbackWidth]
  );

  // baseline of line 0 so the letters sit on the printed line
  const baseOffset = pack
    ? (lineHeight - (pack.asc + pack.desc) * scale) / 2 + pack.asc * scale + baselineNudge
    : 0;
  const scrollY = layout ? Math.max(0, layout.lines * lineHeight - box.h) : 0;   // keep the last line visible

  const lineY = line => line * lineHeight + baseOffset - scrollY;

  // Expose character hit-testing to parent components (handles all rotation, scale, offsets natively)
  useImperativeHandle(ref, () => ({
    getCharIndexFromPoint(clientX, clientY) {
      if (!svgRef.current || !layout) return -1;
      const m = svgRef.current.getScreenCTM();
      if (!m) return -1;
      const p = new DOMPoint(clientX, clientY).matrixTransform(m.inverse());
      const cellIdx = cellAtPoint(layout, p.x, p.y + scrollY, lineHeight);
      if (cellIdx === -1) return -1;
      return indexToUnit(cells, cellIdx);
    }
  }), [layout, cells, lineHeight, scrollY]);

  // Combine saved highlights and current active preview highlight range
  const renderedHighlights = useMemo(() => {
    if (!layout || !layout.items.length) return [];

    const itemRanges = layout.items.map(it => {
      const startUnit = indexToUnit(cells, it.i);
      const endUnit = startUnit + (cells[it.i]?.c?.length || 1) - 1;
      return { it, startUnit, endUnit };
    });

    const list = [...(highlights || [])];
    if (activeHighlightRange && (activeHighlightRange.start != null || activeHighlightRange.from != null || activeHighlightRange.startIndex != null)) {
      const start = activeHighlightRange.from ?? activeHighlightRange.start ?? activeHighlightRange.startIndex;
      const end = activeHighlightRange.to ?? activeHighlightRange.end ?? activeHighlightRange.endIndex;
      list.push({
        id: '__preview__',
        startIndex: start,
        endIndex: end,
        from: start,
        to: end,
        color: activeHighlightRange.color || highlighterColor || '#facc15',
        type: activeHighlightRange.type || highlighterType || 'highlight',
        erase: activeHighlightRange.erase,
        isPreview: true,
      });
    }

    const results = [];

    list.forEach(hl => {
      const rawStart = hl.from ?? hl.startIndex ?? hl.start;
      const rawEnd = hl.to ?? hl.endIndex ?? hl.end;
      if (rawStart == null || rawEnd == null) return;
      const s = Math.min(rawStart, rawEnd);
      const e = Math.max(rawStart, rawEnd);

      const matched = itemRanges.filter(
        ir => !(ir.endUnit < s || ir.startUnit > e) && ir.it.kind !== 'nl'
      );
      if (matched.length === 0) return;

      // Group by line
      const byLine = new Map();
      matched.forEach(({ it }) => {
        if (!byLine.has(it.line)) byLine.set(it.line, []);
        byLine.get(it.line).push(it);
      });

      byLine.forEach((lineItems, lineNum) => {
        if (lineItems.length === 0) return;

        // Skip leading/trailing pure whitespace on this line unless that's all there is
        let first = 0;
        while (first < lineItems.length && lineItems[first].kind === 'space' && first < lineItems.length - 1) {
          first++;
        }
        let last = lineItems.length - 1;
        while (last > first && lineItems[last].kind === 'space') {
          last--;
        }
        const trimmed = lineItems.slice(first, last + 1);
        if (trimmed.length === 0) return;

        const minX = Math.min(...trimmed.map(it => it.x));
        const maxX = Math.max(...trimmed.map(it => it.x + it.w));
        const textWidth = Math.max(4, maxX - minX);

        const lineTop = lineNum * lineHeight - scrollY;
        const yBaseline = lineTop + baseOffset;
        const type = hl.type || 'highlight';

        let x, y, w, h, rx, ry;

        if (type === 'circle') {
          // Pill/capsule shape: semicircular ends with radius h / 2.
          // Constrained to line slot so adjacent lines NEVER collide (3px gap).
          const circleH = Math.max(18, Math.min(lineHeight - 3, lineHeight * 0.9));
          const circleY = lineTop + (lineHeight - circleH) / 2;
          const padX = Math.max(7, Math.round(circleH * 0.28));
          const circleX = minX - padX;
          const circleW = textWidth + padX * 2;
          const circleR = circleH / 2;

          x = circleX;
          y = circleY;
          w = circleW;
          h = circleH;
          rx = circleR;
          ry = circleR;
        } else if (type === 'box') {
          // Bounding rectangle: 4px gap between lines guarantees no collision.
          const boxH = Math.max(16, Math.min(lineHeight - 4, lineHeight * 0.88));
          const boxY = lineTop + (lineHeight - boxH) / 2;
          const padX = 4;
          const boxX = minX - padX;
          const boxW = textWidth + padX * 2;

          x = boxX;
          y = boxY;
          w = boxW;
          h = boxH;
          rx = 4;
          ry = 4;
        } else {
          // Marker highlight backdrop
          const hlH = Math.max(16, Math.min(lineHeight - 3.5, lineHeight * 0.88));
          const hlY = lineTop + (lineHeight - hlH) / 2;
          const padX = 3;
          const hlX = minX - padX;
          const hlW = textWidth + padX * 2;

          x = hlX;
          y = hlY;
          w = hlW;
          h = hlH;
          rx = 3.5;
          ry = 3.5;
        }

        results.push({
          key: `${hl.id || 'hl'}-${lineNum}`,
          type,
          color: hl.color || '#fde047',
          erase: hl.erase,
          isPreview: hl.isPreview,
          x,
          y,
          w,
          h,
          rx,
          ry,
          baselineY: yBaseline,
        });
      });
    });

    return results;
  }, [layout, cells, highlights, activeHighlightRange, highlighterColor, highlighterType, baseOffset, scrollY, lineHeight]);

  function handleClick(e) {
    if (!layout || !onCaret) return;
    const m = svgRef.current.getScreenCTM();
    if (!m) return;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse()); // handles note rotation
    onCaret(indexToUnit(cells, hitTest(layout, p.x, p.y + scrollY, lineHeight)));
  }

  let caretEl = null;
  if (layout && focused && caret != null) {
    const cp = caretPos(layout, unitToIndex(cells, caret));
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
      className={`script-layer ${isHighlighterActive ? (highlighterMode === 'eraser' ? 'is-eraser-mode' : 'is-highlighter-mode') : ''}`}
      style={{ overflow: 'visible' }}
      aria-hidden="true"
      onClick={handleClick}
      onDoubleClick={onDoubleClick}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* Layer 0: Highlights behind the ink strokes */}
      {renderedHighlights.map(hl => {
        if (hl.erase) {
          return (
            <rect
              key={hl.key}
              x={hl.x}
              y={hl.y}
              width={hl.w}
              height={hl.h}
              rx={hl.rx || 3}
              ry={hl.ry || 3}
              fill="rgba(239, 68, 68, 0.28)"
              stroke="rgba(239, 68, 68, 0.85)"
              strokeWidth={1.5}
              strokeDasharray="4 2"
            />
          );
        }
        if (hl.type === 'underline') {
          return (
            <line
              key={hl.key}
              x1={hl.x}
              y1={hl.baselineY + 2.5}
              x2={hl.x + hl.w}
              y2={hl.baselineY + 2.5}
              stroke={hl.color}
              strokeWidth={2.4}
              strokeDasharray="5 2.5"
              strokeLinecap="round"
              opacity={hl.isPreview ? 0.6 : 0.9}
              className="script-highlight-line"
            />
          );
        }
        if (hl.type === 'box') {
          return (
            <rect
              key={hl.key}
              x={hl.x}
              y={hl.y}
              width={hl.w}
              height={hl.h}
              rx={hl.rx || 4}
              ry={hl.ry || 4}
              fill="none"
              stroke={hl.color}
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={hl.isPreview ? '4 3' : undefined}
              opacity={hl.isPreview ? 0.7 : 0.95}
              className="script-highlight-box"
            />
          );
        }
        if (hl.type === 'circle') {
          return (
            <rect
              key={hl.key}
              x={hl.x}
              y={hl.y}
              width={hl.w}
              height={hl.h}
              rx={hl.rx || hl.h / 2}
              ry={hl.ry || hl.h / 2}
              fill="none"
              stroke={hl.color}
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={hl.isPreview ? '4 3' : undefined}
              opacity={hl.isPreview ? 0.7 : 0.95}
              className="script-highlight-circle"
            />
          );
        }
        // Default 'highlight' marker backdrop
        return (
          <rect
            key={hl.key}
            x={hl.x}
            y={hl.y}
            width={hl.w}
            height={hl.h}
            rx={hl.rx || 3.5}
            ry={hl.ry || 3.5}
            fill={hl.color}
            opacity={hl.isPreview ? 0.4 : 0.55}
            className="script-highlight-marker"
          />
        );
      })}

      {/* Layer 1: Ink glyphs and characters */}
      {layout && layout.items.map(it => {
        if (it.kind === 'space' || it.kind === 'nl') return null;
        const animate = !!animateIds?.has(it.id);
        if (it.kind === 'fallback') {
          return (
            <FallbackGlyph
              key={it.id}
              c={it.c}
              x={it.x}
              y={lineY(it.line)}
              size={isEmoji(it.c) ? emojiSize : textSize}
              family={fallbackFont}
              color={color}
              animate={animate}
              pen={pen}
            />
          );
        }
        return (
          <Glyph
            key={it.id}
            glyph={pack.glyphs[it.c]}
            x={it.x}
            y={lineY(it.line)}
            scale={scale}
            strokePx={strokePx}
            color={color}
            animate={animate}
            pen={pen}
          />
        );
      })}
      {caretEl}
    </svg>
  );
});
