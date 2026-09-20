/* =====================================================================
   scriptLayout.js: pure maths for laying out text in a script font pack.
   No React, no DOM, so it's easy to test and reuse.

   pack   = the JSON made by tools/build_script_font.py  { lh, space, asc, desc, xh, glyphs }
   chars  = [{ id, c }]  (the array useCharTags returns; only `c` is used here)
   ===================================================================== */

/** width of one character in px */
export function advanceOf(pack, c, scale, letterSpacing = 0, wordSpacing = 0) {
  if (c === ' ') return pack.space * scale + wordSpacing;
  if (c === '\n') return 0;
  const g = pack.glyphs[c];
  return (g ? g.a : 8) * scale + letterSpacing;        // unknown glyph: a small gap
}

/**
 * Word-wrap `chars` into lines.
 * Returns { items: [{ i, c, x, line, w }], lines }  (one item per character, same order as chars)
 */
export function layoutScript(chars, pack, { scale, width, letterSpacing = 0, wordSpacing = 0 }) {
  const maxW = Math.max(width, 40);
  const adv = c => advanceOf(pack, c, scale, letterSpacing, wordSpacing);
  const items = [];
  const n = chars.length;
  let x = 0, line = 0, i = 0;

  while (i < n) {
    const c = chars[i].c;

    if (c === '\n') { items.push({ i, c, x, line, w: 0 }); line++; x = 0; i++; continue; }
    if (c === ' ')  { const w = adv(c); items.push({ i, c, x, line, w }); x += w; i++; continue; }

    // a word = a run of non-space, non-newline characters
    let j = i, wordW = 0;
    while (j < n && chars[j].c !== ' ' && chars[j].c !== '\n') { wordW += adv(chars[j].c); j++; }

    if (x > 0 && x + wordW > maxW && wordW <= maxW) { line++; x = 0; }   // whole word drops to the next line

    for (let k = i; k < j; k++) {
      const w = adv(chars[k].c);
      if (x > 0 && x + w > maxW) { line++; x = 0; }                      // a word longer than the line: break it
      items.push({ i: k, c: chars[k].c, x, line, w });
      x += w;
    }
    i = j;
  }
  return { items, lines: line + 1 };
}

/** where the caret sits for character index k (0..chars.length) */
export function caretPos(layout, k) {
  const { items } = layout;
  if (!items.length) return { x: 0, line: 0 };
  if (k < items.length) return { x: items[k].x, line: items[k].line };
  const last = items[items.length - 1];
  if (last.c === '\n') return { x: 0, line: last.line + 1 };
  return { x: last.x + last.w, line: last.line };
}

/** which character index is closest to a click at (x, y) in layout px */
export function hitTest(layout, x, y, lineHeight) {
  const line = Math.max(0, Math.min(layout.lines - 1, Math.floor(y / lineHeight)));
  let after = null;
  for (const it of layout.items) {
    if (it.line !== line) continue;
    if (it.c === '\n') return after ?? it.i;               // clicked past the end of a line
    if (x < it.x + it.w / 2) return it.i;
    after = it.i + 1;
  }
  return after ?? layout.items.length;
}

/* The textarea counts UTF-16 units, but `chars` are whole characters (emoji = 1 char, 2 units). */
export function unitToIndex(chars, unit) {
  let u = 0;
  for (let i = 0; i < chars.length; i++) { if (u >= unit) return i; u += chars[i].c.length; }
  return chars.length;
}
export function indexToUnit(chars, index) {
  let u = 0;
  for (let i = 0; i < index && i < chars.length; i++) u += chars[i].c.length;
  return u;
}
