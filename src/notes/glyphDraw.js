/* =====================================================================
   glyphDraw.js: each newly typed character is DRAWN (its outline is traced, then filled in)
   before the real text takes over.

   How it works (all on top of your existing two-layer note):
   1. useCharTags already marks new characters with class "ch-new".
   2. Those spans are hidden immediately (before the browser paints) with data-draw="on".
   3. opentype.js reads the note's font file and turns that character into SVG path data.
   4. The path is placed exactly where the hidden character sits and animated:
        outline traces (stroke-dashoffset) -> fill fades in -> outline fades out
   5. The real character is revealed (data-draw="done"), pixel-identical, and the path is removed.

   Layout, wrapping, selection, the textarea and undo are untouched: the overlay is purely visual.
   ===================================================================== */
import { useLayoutEffect } from 'react';
import { parse } from 'opentype.js';

const NS = 'http://www.w3.org/2000/svg';

/* ---- tuning knobs ---- */
const DRAW_MS = 750;        // how long one character takes to draw (relaxed, visible stroke trace)
const STAGGER_MS = 50;      // delay between characters that arrive together (short paste)
const MAX_ANIMATED = 40;    // pasting more than this at once: skip the effect, just show the text
const STROKE_EM = 0.03;     // outline thickness as a fraction of the font size
const BASELINE_NUDGE = 0;   // px. If the drawn letter sits 1px off from the real one, adjust here

/* ---- font loading (cached, one download per font file) ---- */
const fonts = new Map();
export function loadGlyphFont(url) {
  let p = fonts.get(url);
  if (!p) {
    p = fetch(url)
      .then(r => { if (!r.ok) throw new Error(`Font ${r.status}`); return r.arrayBuffer(); })
      .then(buf => parse(buf));
    fonts.set(url, p);
  }
  return p;
}

/* ---- where is the baseline? measured from the browser's own layout, so it can't disagree ---- */
const ascents = new Map();
function measureAscent(sample) {
  const cs = getComputedStyle(sample);
  const key = [cs.fontFamily, cs.fontSize, cs.fontWeight, cs.fontStyle, cs.lineHeight, cs.letterSpacing].join('|');
  let a = ascents.get(key);
  if (a == null) {
    const box = document.createElement('div');
    Object.assign(box.style, {
      position: 'absolute', visibility: 'hidden', left: '-9999px', top: '0', whiteSpace: 'pre',
      fontFamily: cs.fontFamily, fontSize: cs.fontSize, fontWeight: cs.fontWeight,
      fontStyle: cs.fontStyle, lineHeight: cs.lineHeight, letterSpacing: cs.letterSpacing,
    });
    // a zero-size inline-block sits exactly ON the baseline
    box.innerHTML = '<span>Hx</span><span style="display:inline-block;width:0;height:0"></span>';
    document.body.appendChild(box);
    const [text, probe] = box.children;
    a = probe.getBoundingClientRect().top - text.getBoundingClientRect().top;
    box.remove();
    ascents.set(key, a);
  }
  return a;
}

/* offset of an element inside `root`, ignoring rotation (offsetLeft/Top don't include transforms) */
function offsetIn(el, root) {
  let x = 0, y = 0, n = el;
  while (n && n !== root) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
  return { x, y };
}

const reveal = span => { span.dataset.draw = 'done'; };

async function drawSpans(spans, { renderEl, layerEl, fontUrl }) {
  let font;
  try { font = await loadGlyphFont(fontUrl); }
  catch { spans.forEach(reveal); return; }                 // font failed: just show the text

  if (spans.length > MAX_ANIMATED) { spans.forEach(reveal); return; }

  layerEl.style.color = getComputedStyle(renderEl).color;

  spans.forEach((span, i) => {
    if (!span.isConnected) return;                          // deleted while the font was loading
    const ch = span.textContent;
    const glyph = font.charToGlyph(ch);
    if (!ch.trim() || !glyph || glyph.index === 0) return reveal(span);   // space, emoji, missing glyph

    const size = parseFloat(getComputedStyle(span).fontSize);
    const { x, y } = offsetIn(span, renderEl);
    const baseline = y + measureAscent(span) - renderEl.scrollTop + BASELINE_NUDGE;
    const d = font.getPath(ch, x, baseline, size).toPathData(2);

    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', d);
    path.setAttribute('fill', 'currentColor');
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', Math.max(0.7, size * STROKE_EM).toFixed(2));
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    path.style.fillOpacity = '0';
    layerEl.appendChild(path);

    const len = path.getTotalLength();
    path.style.strokeDasharray = String(len);
    path.style.strokeDashoffset = String(len);

    const delay = i * STAGGER_MS;
    const anims = [
      // 1. the outline is traced
      path.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }],
        { duration: DRAW_MS, delay, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'both' }),
      // 2. the letter fills in
      path.animate([{ fillOpacity: 0 }, { fillOpacity: 1 }],
        { duration: DRAW_MS * 0.45, delay: delay + DRAW_MS * 0.55, easing: 'ease-out', fill: 'both' }),
      // 3. the outline fades so the final letter matches normal text weight
      path.animate([{ strokeOpacity: 1 }, { strokeOpacity: 0 }],
        { duration: DRAW_MS * 0.3, delay: delay + DRAW_MS * 0.75, easing: 'linear', fill: 'both' }),
    ];

    Promise.all(anims.map(a => a.finished)).then(
      () => { reveal(span); path.remove(); },
      () => {}                                              // note deleted mid-animation: ignore
    );
  });
}

/**
 * useGlyphDraw(renderRef, layerRef, chars, fontUrl)
 *   renderRef : the .note-render div (the layer holding the per-character spans)
 *   layerRef  : the <svg className="glyph-layer"> placed next to it
 *   chars     : the array returned by useCharTags (so this runs whenever the text changes)
 *   fontUrl   : URL of a .woff / .ttf / .otf file for the note's font (undefined = effect off)
 */
export function useGlyphDraw(renderRef, layerRef, chars, fontUrl) {
  // layout effect: runs before the browser paints, so the real letter never flashes
  useLayoutEffect(() => {
    const renderEl = renderRef.current;
    const layerEl = layerRef.current;
    if (!fontUrl || !renderEl || !layerEl) return;

    const fresh = [...renderEl.querySelectorAll('.ch-new:not([data-draw])')];
    if (!fresh.length) return;
    fresh.forEach(s => { s.dataset.draw = 'on'; });         // hide now
    drawSpans(fresh, { renderEl, layerEl, fontUrl });
  }, [chars, fontUrl, renderRef, layerRef]);
}
