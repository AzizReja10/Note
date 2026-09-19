import { useRef } from 'react';

let uid = 0;

// Turns the note text into [{ id, c, color, fresh }].
// Every character keeps a stable id and its color at the time it was typed.
// Newly inserted characters adopt currentColor, while previously typed characters retain their original color!
export function useCharTags(text, currentColor = null) {
  const ref = useRef(null);

  // first render / page load: existing text is NOT animated
  if (ref.current === null) {
    ref.current = {
      text,
      chars: [...text].map(c => ({ id: ++uid, c, color: currentColor, fresh: false }))
    };
  }

  const prev = ref.current;
  if (prev.text !== text) {
    const a = [...prev.text];
    const b = [...text];

    // common prefix and suffix -> whatever is left in the middle is the change
    let p = 0;
    while (p < a.length && p < b.length && a[p] === b[p]) p++;
    let s = 0;
    while (s < a.length - p && s < b.length - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++;

    const inserted = b
      .slice(p, b.length - s)
      .map(c => ({ id: ++uid, c, color: currentColor, fresh: true }));

    ref.current = {
      text,
      chars: [
        ...prev.chars.slice(0, p),
        ...inserted,
        ...prev.chars.slice(prev.chars.length - s),
      ],
    };
  }

  return ref.current.chars;
}
