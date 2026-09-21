/* =====================================================================
   highlights.js: highlights that live ON THE CHARACTERS themselves.

   Why: an overlay that is drawn from measured rectangles (what rough-notation does) has to guess
   where the text is. On a rotated or scaled note, or when the text reflows, the guess is wrong and
   the highlight lands in the wrong place. Here there is nothing to guess: each highlighted
   character carries its own marker, so it always sits exactly on the text, wraps with it, rotates
   with it, and follows it when you edit.

   Data: note.highlights = [{ id, from, to, type, color, startIndex, endIndex }]
     from/to : UTF-16 offsets into note.text (from included, to excluded)
     type    : 'highlight' | 'underline' | 'box' | 'circle'
   No React and no DOM in here, so it is easy to test.
   ===================================================================== */

export const TYPES = ['highlight', 'underline', 'box', 'circle'];
const CODE = { highlight: 'h', underline: 'u', box: 'b', circle: 'c' };

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export const normalizeRange = r => {
  if (!r) return null;
  const from = Number.isFinite(r.from) ? r.from : (Number.isFinite(r.startIndex) ? r.startIndex : null);
  const to = Number.isFinite(r.to) ? r.to : (Number.isFinite(r.endIndex) ? r.endIndex : null);
  if (from === null || to === null) return null;
  const lo = Math.min(from, to);
  const hi = Math.max(from, to);
  return {
    id: r.id || uid(),
    from: lo,
    to: hi,
    startIndex: lo,
    endIndex: hi,
    type: r.type || 'highlight',
    color: r.color || '#fde047',
  };
};

const ok = r => !!r && (
  (Number.isFinite(r.from) && Number.isFinite(r.to)) ||
  (Number.isFinite(r.startIndex) && Number.isFinite(r.endIndex))
);

/* ---------- editing the list of ranges ---------- */

/** cut [from, to) out of the ranges (only those of `type`, or all when type is null) */
function subtract(list, from, to, type = null) {
  const out = [];
  for (const item of list) {
    const r = normalizeRange(item);
    if (!r) continue;
    if ((type && r.type !== type) || r.to <= from || r.from >= to) { out.push(r); continue; }
    if (r.from < from) {
      out.push({ ...r, to: from, endIndex: from });
    }
    if (r.to > to) {
      out.push({
        ...r,
        id: r.from < from ? `${r.id}~${to}` : r.id,
        from: to,
        startIndex: to,
      });
    }
  }
  return out;
}

/** add a range; it replaces whatever of the SAME type it overlaps (so re-colouring works) */
export function addRange(list = [], { from, to, startIndex, endIndex, type = 'highlight', color = '#fde047' }) {
  const lo = Number.isFinite(from) ? from : (Number.isFinite(startIndex) ? startIndex : 0);
  const hi = Number.isFinite(to) ? to : (Number.isFinite(endIndex) ? endIndex : 0);
  const start = Math.min(lo, hi);
  const end = Math.max(lo, hi);
  if (!(end > start)) return list;
  const newHl = {
    id: uid(),
    from: start,
    to: end,
    startIndex: start,
    endIndex: end,
    type,
    color,
  };
  return [...subtract(list, start, end, type), newHl];
}

/** the eraser: remove [from, to) from every kind of highlight */
export function eraseRange(list = [], from, to) {
  const start = Math.min(from, to);
  const end = Math.max(from, to);
  if (!(end > start)) return list;
  return subtract(list, start, end);
}

const isHigh = c => c >= 0xd800 && c <= 0xdbff;
const isLow = c => c >= 0xdc00 && c <= 0xdfff;

/**
 * Keep highlights on the same words when the text is edited.
 * Finds what changed (common prefix/suffix) and moves each range accordingly:
 *   typing BEFORE a highlight pushes it along; typing INSIDE it grows it;
 *   typing right AFTER it does not extend it; deleting its text removes it.
 */
export function shiftRanges(list, oldText, newText) {
  if (!list || !list.length || oldText === newText) return list;
  const a = oldText || '', b = newText || '';
  const max = Math.min(a.length, b.length);

  let p = 0;
  while (p < max && a[p] === b[p]) p++;
  let s = 0;
  while (s < max - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++;
  if (p > 0 && isHigh(a.charCodeAt(p - 1))) p--; // never split an emoji's surrogate pair
  if (s > 0 && isLow(a.charCodeAt(a.length - s))) s--;

  const oldEnd = a.length - s; // end of the changed middle, in the old text
  const newEnd = b.length - s; // ...and in the new text
  const delta = b.length - a.length;

  const mapStart = pos => (pos >= oldEnd ? pos + delta : pos <= p ? pos : p);
  const mapEnd = pos => (pos <= p ? pos : pos >= oldEnd ? pos + delta : newEnd);

  return list
    .filter(ok)
    .map(r => {
      const norm = normalizeRange(r);
      const newFrom = mapStart(norm.from);
      const newTo = mapEnd(norm.to);
      return {
        ...norm,
        from: newFrom,
        to: newTo,
        startIndex: newFrom,
        endIndex: newTo,
      };
    })
    .filter(r => r.to > r.from);
}

/* ---------- turning ranges into per-character CSS classes ---------- */

/**
 * chars   = [{ c }] one per code point (useCharTags)
 * list    = note.highlights
 * preview = optional live range while the pen is dragging: { from, to, type, color, erase }
 * returns an array, one entry per char: null, or { cls, style }
 *   cls   e.g. "hl-h hl-h-s" (h = highlight; -s / -e mark the first / last character of a range)
 *   style e.g. { '--hlc-h': '#fde047' }
 */
export function marksFor(chars, list = [], preview = null) {
  if (!chars || !chars.length) return [];
  const n = chars.length;
  const off = new Array(n + 1);
  off[0] = 0;
  for (let i = 0; i < n; i++) off[i + 1] = off[i] + chars[i].c.length;

  const cls = new Array(n).fill(null);
  const style = new Array(n).fill(null);

  const apply = (rawRange, erase) => {
    const r = normalizeRange(rawRange);
    if (!r) return;
    let first = -1, last = -1;
    for (let i = 0; i < n; i++) {
      if (off[i] < r.to && off[i + 1] > r.from) { if (first < 0) first = i; last = i; }
    }
    if (first < 0) return;
    if (!erase) {
      // a marker never starts or ends on a space (no stray slivers); spaces BETWEEN words stay marked.
      while (first <= last && /^\s+$/.test(chars[first].c)) first++;
      while (last >= first && /^\s+$/.test(chars[last].c)) last--;
      if (first > last) return;
    }
    for (let i = first; i <= last; i++) {
      cls[i] = cls[i] || new Set();
      if (erase) { cls[i].add('hl-erase'); continue; }
      const k = CODE[r.type] || 'h';
      cls[i].add(`hl-${k}`);
      if (i === first) cls[i].add(`hl-${k}-s`);
      if (i === last) cls[i].add(`hl-${k}-e`);
      if (r.color) {
        style[i] = style[i] || {};
        style[i][`--hlc-${k}`] = r.color;
      }
    }
  };

  for (const r of list) if (ok(r)) apply(r, false);
  if (preview) apply(preview, !!preview.erase);

  return cls.map((c, i) => (c ? { cls: [...c].join(' '), style: style[i] || undefined } : null));
}

/* ---------- pointer -> character ---------- */

/** total UTF-16 range covered when the pen goes from char index a to char index b (inclusive) */
export function unitRange(chars, a, b) {
  const lo = Math.min(a, b), hi = Math.max(a, b);
  let from = 0;
  for (let i = 0; i < lo; i++) from += chars[i].c.length;
  let to = from;
  for (let i = lo; i <= hi; i++) to += chars[i].c.length;
  return { from, to, startIndex: from, endIndex: to };
}

/**
 * The character whose box is closest to (x, y): true 2D distance, 0 when the point is inside a box.
 * Use it in the text's own (unrotated) coordinates, where lines are horizontal.
 */
export function nearestIndex(rects, x, y) {
  let best = -1, bestD = Infinity;
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    if (!r || (r.width === 0 && r.height === 0)) continue;
    const dx = x < r.left ? r.left - x : x > r.right ? x - r.right : 0;
    const dy = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0;
    const d = dx * dx + dy * dy;
    if (d < bestD) { best = i; bestD = d; }
  }
  return best;
}

/** local -> screen transform (rotation + uniform scale + translation) from two reference points */
export function fitSimilarity(a, b) {
  const dlx = b.lx - a.lx, dly = b.ly - a.ly, dsx = b.sx - a.sx, dsy = b.sy - a.sy;
  const den = dlx * dlx + dly * dly;
  if (den < 1e-6) return null;
  const mr = (dsx * dlx + dsy * dly) / den; // m = ds / dl as complex numbers
  const mi = (dsy * dlx - dsx * dly) / den;
  return { mr, mi, tx: a.sx - (mr * a.lx - mi * a.ly), ty: a.sy - (mi * a.lx + mr * a.ly) };
}

/** screen point -> local point */
export function toLocal(T, x, y) {
  const dx = x - T.tx, dy = y - T.ty, den = T.mr * T.mr + T.mi * T.mi;
  return { x: (dx * T.mr + dy * T.mi) / den, y: (dy * T.mr - dx * T.mi) / den };
}

/**
 * spans = the per-character elements, in order. Returns { indexAt(clientX, clientY) }.
 * Reads offsetLeft/Top/Width/Height (layout, unaffected by transforms) and getBoundingClientRect
 * (on screen). Call it once when the pointer goes down: the layout doesn't change during a drag.
 */
export function pointerMap(spans) {
  const local = [], center = [], screen = [];
  for (const el of spans) {
    const w = el.offsetWidth, h = el.offsetHeight;
    const l = { left: el.offsetLeft, top: el.offsetTop, right: el.offsetLeft + w, bottom: el.offsetTop + h, width: w, height: h };
    const r = el.getBoundingClientRect();
    local.push(l);
    screen.push(r);
    center.push({ lx: (l.left + l.right) / 2, ly: (l.top + l.bottom) / 2, sx: (r.left + r.right) / 2, sy: (r.top + r.bottom) / 2 });
  }
  let A = -1;
  for (let i = 0; i < local.length; i++) if (local[i].width > 0 || local[i].height > 0) { A = i; break; }
  let B = -1, far = 0;
  if (A >= 0) {
    for (let i = 0; i < local.length; i++) {
      if (!(local[i].width > 0 || local[i].height > 0)) continue;
      const d = (center[i].lx - center[A].lx) ** 2 + (center[i].ly - center[A].ly) ** 2;
      if (d > far) { far = d; B = i; }
    }
  }
  const T = A >= 0 && B >= 0 ? fitSimilarity(center[A], center[B]) : null;
  return {
    indexAt(x, y) {
      if (!T) return nearestIndex(screen, x, y);
      const p = toLocal(T, x, y);
      return nearestIndex(local, p.x, p.y);
    },
  };
}
