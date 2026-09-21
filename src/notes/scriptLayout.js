/* =====================================================================
   scriptLayout.js: pure maths for laying out text in a script font pack.
   No React, no DOM, so it's easy to test and reuse.

   pack   = the JSON made by tools/build_script_font.py  { lh, space, asc, desc, xh, glyphs }
   chars  = [{ id, c }]   one entry per Unicode code point (what useCharTags returns)
   cells  = clusterChars(chars): one cell per VISIBLE character. An emoji built from several code
            points (👍🏽 skin tone, 🇮🇳 flag, 👨👩👧 family, 1️⃣ keycap) is ONE cell.

   Everything below (layout, caret, click) works in CELLS, so the caret can never land inside an emoji.
   A cell is drawn as one of:
     glyph     a character the script font has            -> drawn by the pen
     space / nl
     fallback  emoji, accents, other alphabets            -> drawn as normal text
   ===================================================================== */

/* ---- emoji detection ---- */
const EMOJI_RE = /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20e3/u;
export const isEmoji = c => EMOJI_RE.test(c);

/* ---- grouping code points into visible characters ---- */
const RI = c => { const p = c.codePointAt(0); return p >= 0x1f1e6 && p <= 0x1f1ff; };   // flag letters
const EXT = /^[\u200d\ufe0f\u20e3\u0300-\u036f\u{1F3FB}-\u{1F3FF}]$/u;                  // ZWJ, VS16, keycap, accents, skin tones

function clusterRanges(chars) {
  const n = chars.length;
  if (!n) return [];

  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    const out = [];
    let ci = 0;
    for (const { segment } of seg.segment(chars.map(x => x.c).join(''))) {
      const s = ci;
      let u = 0;
      while (u < segment.length && ci < n) { u += chars[ci].c.length; ci++; }
      out.push([s, ci]);
    }
    return out;
  }

  // browsers without Intl.Segmenter: a small approximation
  const out = [];
  let s = 0;
  let riRun = RI(chars[0].c) ? 1 : 0;
  for (let i = 1; i <= n; i++) {
    if (i === n) { out.push([s, n]); break; }
    const c = chars[i].c, prev = chars[i - 1].c;
    let join = EXT.test(c) || prev === '\u200d';
    if (!join && RI(c) && RI(prev) && riRun % 2 === 1) join = true;
    riRun = RI(c) ? (RI(prev) ? riRun + 1 : 1) : 0;
    if (!join) { out.push([s, i]); s = i; }
  }
  return out;
}

/** [{ id, c }] per code point  ->  [{ id, c }] per visible character (id = id of its first code point) */
export function clusterChars(chars) {
  return clusterRanges(chars).map(([s, e]) => ({
    id: chars[s].id,
    c: e - s === 1 ? chars[s].c : chars.slice(s, e).map(x => x.c).join(''),
  }));
}

/** width of one script-font character in px */
export function advanceOf(pack, c, scale, letterSpacing = 0, wordSpacing = 0) {
  if (c === ' ') return pack.space * scale + wordSpacing;
  if (c === '\n') return 0;
  const g = pack.glyphs[c];
  return (g ? g.a : 8) * scale + letterSpacing;
}

/**
 * Word-wrap cells into lines.
 * opts.fallbackWidth(text) -> px width of an emoji/other cell (default: 0.8 line-heights)
 * Returns { items: [{ i, id, c, kind, x, line, w }], lines }   (one item per cell, in order)
 */
export function layoutScript(cells, pack, { scale, width, letterSpacing = 0, wordSpacing = 0, fallbackWidth }) {
  const maxW = Math.max(width, 40);
  const fb = fallbackWidth || (() => pack.lh * scale * 0.8);

  const units = cells.map((cell, i) => {
    const c = cell.c;
    let kind = 'fallback';
    if (c === '\n') kind = 'nl';
    else if (c === ' ') kind = 'space';
    else if (pack.glyphs[c]) kind = 'glyph';
    const w =
      kind === 'nl' ? 0 :
      kind === 'fallback' ? fb(c) + letterSpacing :
      advanceOf(pack, c, scale, letterSpacing, wordSpacing);
    return { i, id: cell.id, c, kind, w };
  });

  const items = [];
  let x = 0, line = 0, u = 0;

  while (u < units.length) {
    const un = units[u];

    if (un.kind === 'nl')    { items.push({ ...un, x, line }); line++; x = 0; u++; continue; }
    if (un.kind === 'space') { items.push({ ...un, x, line }); x += un.w; u++; continue; }

    // a word = a run of cells that are not spaces or newlines
    let j = u, wordW = 0;
    while (j < units.length && units[j].kind !== 'space' && units[j].kind !== 'nl') { wordW += units[j].w; j++; }

    if (x > 0 && x + wordW > maxW && wordW <= maxW) { line++; x = 0; }   // whole word drops to the next line

    for (let k = u; k < j; k++) {
      const w = units[k].w;
      if (x > 0 && x + w > maxW) { line++; x = 0; }                      // a word longer than the line: break it
      items.push({ ...units[k], x, line });
      x += w;
    }
    u = j;
  }
  return { items, lines: line + 1 };
}

/** where the caret sits for cell index k (0..cells.length) */
export function caretPos(layout, k) {
  const { items } = layout;
  if (!items.length) return { x: 0, line: 0 };
  if (k < items.length) return { x: items[k].x, line: items[k].line };
  const last = items[items.length - 1];
  if (last.kind === 'nl') return { x: 0, line: last.line + 1 };
  return { x: last.x + last.w, line: last.line };
}

/** which cell index is closest to a click at (x, y) in layout px */
export function hitTest(layout, x, y, lineHeight) {
  const line = Math.max(0, Math.min(layout.lines - 1, Math.floor(y / lineHeight)));
  let after = null;
  for (const it of layout.items) {
    if (it.line !== line) continue;
    if (it.kind === 'nl') return after ?? it.i;               // clicked past the end of a line
    if (x < it.x + it.w / 2) return it.i;
    after = it.i + 1;
  }
  return after ?? layout.items.length;
}

/** which cell index is directly under the point (x, y) in layout px */
export function cellAtPoint(layout, x, y, lineHeight) {
  if (!layout || !layout.items || layout.items.length === 0) return -1;
  const line = Math.max(0, Math.min(layout.lines - 1, Math.floor(y / lineHeight)));
  const lineItems = layout.items.filter(it => it.line === line && it.kind !== 'nl');

  if (lineItems.length === 0) {
    let closest = -1;
    let minD = Infinity;
    for (const it of layout.items) {
      if (it.kind === 'nl') continue;
      const cx = it.x + it.w / 2;
      const cy = (it.line + 0.5) * lineHeight;
      const d = Math.hypot(x - cx, y - cy);
      if (d < minD) { minD = d; closest = it.i; }
    }
    return minD < 60 ? closest : -1;
  }

  for (const it of lineItems) {
    if (x >= it.x && x <= it.x + it.w) {
      return it.i;
    }
  }

  if (x < lineItems[0].x) return lineItems[0].i;
  const last = lineItems[lineItems.length - 1];
  if (x > last.x + last.w) return last.i;

  let closest = lineItems[0].i;
  let minD = Infinity;
  for (const it of lineItems) {
    const cx = it.x + it.w / 2;
    const d = Math.abs(x - cx);
    if (d < minD) { minD = d; closest = it.i; }
  }
  return closest;
}

/* The textarea counts UTF-16 units; cells can be several units long (an emoji is 2 or more). */
export function unitToIndex(cells, unit) {
  let u = 0;
  for (let i = 0; i < cells.length; i++) { if (u >= unit) return i; u += cells[i].c.length; }
  return cells.length;
}
export function indexToUnit(cells, index) {
  let u = 0;
  for (let i = 0; i < index && i < cells.length; i++) u += cells[i].c.length;
  return u;
}

