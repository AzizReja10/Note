/* =====================================================================
   useHighlightPen.js: drag the pen over text to highlight it, or the eraser to remove highlights.

   const pen = useHighlightPen({
     renderRef,          // ref of the .note-render layer that holds one <span> per character
     scriptTextRef,      // optional ref of ScriptText (if cursive handwriting active)
     scriptUrl,          // truthy if script font active
     chars,              // from useCharTags
     enabled,            // is highlighter mode on?
     tool,               // 'pen' | 'eraser'
     type, color,        // 'highlight' | 'underline' | 'box' | 'circle', and its colour
     highlights,         // note.highlights
     onChange,           // (nextHighlights) => void
   });
   pen.handlers  -> spread on the <textarea> (the layer that receives the pointer)
   pen.preview   -> pass to marksFor(...) so the highlight shows live while dragging

   The pointer is mapped back into the text's own unrotated coordinates (see pointerMap in
   highlights.js), so a rotated, scaled or scrolled note is no problem.
   ===================================================================== */
import { useRef, useState } from 'react';
import { addRange, eraseRange, pointerMap, unitRange } from './highlights';

// the per-character spans inside the render layer (keep this in sync with your Note.jsx)
const SPAN = '.note-char-span, .ch';

export function useHighlightPen({
  renderRef,
  scriptTextRef,
  scriptUrl,
  chars,
  enabled,
  tool = 'pen',
  type = 'highlight',
  color = '#fde047',
  highlights = [],
  onChange,
}) {
  const drag = useRef(null); // { a, b, map, isScript } while the pointer is down
  const [preview, setPreview] = useState(null);

  const makePreview = (a, b) => ({
    ...unitRange(chars, a, b),
    type,
    color,
    erase: tool === 'eraser',
  });

  function onPointerDown(e) {
    if (!enabled || e.button > 0) return;

    // If cursive script is active, use scriptTextRef's inverted SVG matrix hit-testing
    if (scriptUrl && scriptTextRef?.current?.getCharIndexFromPoint) {
      const i = scriptTextRef.current.getCharIndexFromPoint(e.clientX, e.clientY);
      if (i < 0) return;
      e.preventDefault();
      e.stopPropagation();
      try {
        e.currentTarget.setPointerCapture?.(e.pointerId);
      } catch {
        /* ignore */
      }
      drag.current = { a: i, b: i, isScript: true };
      setPreview(makePreview(i, i));
      return;
    }

    const root = renderRef.current;
    const spans = root ? [...root.querySelectorAll(SPAN)] : [];
    if (!spans.length) return;
    const map = pointerMap(spans);
    const i = map.indexAt(e.clientX, e.clientY);
    if (i < 0) return;
    e.preventDefault();
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }
    drag.current = { a: i, b: i, map };
    setPreview(makePreview(i, i));
  }

  function onPointerMove(e) {
    const d = drag.current;
    if (!d) return;

    if (d.isScript && scriptTextRef?.current?.getCharIndexFromPoint) {
      const i = scriptTextRef.current.getCharIndexFromPoint(e.clientX, e.clientY);
      if (i < 0 || i === d.b) return;
      d.b = i;
      setPreview(makePreview(d.a, i));
      return;
    }

    if (d.map) {
      const i = d.map.indexAt(e.clientX, e.clientY);
      if (i < 0 || i === d.b) return;
      d.b = i;
      setPreview(makePreview(d.a, i));
    }
  }

  function finish(commit) {
    const d = drag.current;
    drag.current = null;
    setPreview(null);
    if (!d || !commit) return;
    const { from, to } = unitRange(chars, d.a, d.b);

    if (tool === 'eraser') {
      if (onChange) onChange(eraseRange(highlights, from, to));
    } else {
      let start = from;
      let end = to;
      // If user tapped/clicked without dragging, expand to highlight the word
      if (start === end && chars && chars.length) {
        const text = chars.map((c) => c.c).join('');
        while (start > 0 && !/\s/.test(text[start - 1])) start--;
        while (end < text.length && !/\s/.test(text[end])) end++;
      }
      if (onChange) {
        onChange(addRange(highlights, { from: start, to: end, type, color }));
      }
    }
  }

  return {
    preview,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: () => finish(true),
      onPointerCancel: () => finish(false),
    },
  };
}
