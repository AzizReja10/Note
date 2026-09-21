import { useCallback, useEffect, useRef, useState } from 'react';
import { localStorageAdapter } from './storage';
import { shiftRanges } from './highlights';

// note shape: { id, type, text, x, y, rotation, z }
export function useNotes(storage = localStorageAdapter) {
  const [notes, setNotes] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const topZ = useRef(1);

  // load once
  useEffect(() => {
    let cancelled = false;
    storage.load().then(saved => {
      if (cancelled) return;
      topZ.current = saved.reduce((m, n) => Math.max(m, n.z ?? 1), 1);
      setNotes(saved);
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, [storage]);

  // debounced save (skipped until the first load finishes so we never overwrite saved data)
  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => storage.save(notes), 400);
    return () => clearTimeout(t);
  }, [notes, loaded, storage]);

  const patch = useCallback((id, changes) => {
    setNotes(list => list.map(n => (n.id === id ? { ...n, ...changes } : n)));
  }, []);

  const addNote = useCallback((type, { x = 40, y = 40 } = {}) => {
    const note = {
      id: crypto.randomUUID(),
      type,
      text: '',
      x,
      y,
      rotation: +(Math.random() * 6 - 3).toFixed(1),
      z: ++topZ.current,
    };
    setNotes(list => [...list, note]);
    return note.id;
  }, []);

  const updateText = useCallback((id, text) => {
    setNotes(list =>
      list.map(n =>
        n.id === id
          ? {
              ...n,
              text,
              highlights: shiftRanges(n.highlights, n.text, text),
            }
          : n
      )
    );
  }, []);

  const updateTextColor = useCallback((id, textColor) => patch(id, { textColor }), [patch]);

  const updateFontFamily = useCallback((id, fontFamily) => patch(id, { fontFamily }), [patch]);

  const setHighlights = useCallback((id, highlights) => patch(id, { highlights }), [patch]);

  const addHighlight = useCallback((id, highlight) => {
    setNotes(list =>
      list.map(n => {
        if (n.id !== id) return n;
        const prevHighlights = n.highlights || [];
        return {
          ...n,
          highlights: [...prevHighlights, highlight],
        };
      })
    );
  }, []);

  const removeHighlight = useCallback((id, highlightId) => {
    setNotes(list =>
      list.map(n => {
        if (n.id !== id) return n;
        return {
          ...n,
          highlights: (n.highlights || []).filter(h => h.id !== highlightId),
        };
      })
    );
  }, []);

  const clearHighlights = useCallback((id) => {
    patch(id, { highlights: [] });
  }, [patch]);

  const moveNote = useCallback(
    (id, x, y) => {
      const winW = typeof window !== 'undefined' ? window.innerWidth : 1200;
      const winH = typeof window !== 'undefined' ? window.innerHeight : 800;
      const maxX = Math.max(8, winW - 80);
      const maxY = Math.max(70, winH - 120);
      const clampedX = Math.min(maxX, Math.max(8, x));
      const clampedY = Math.min(maxY, Math.max(60, y));
      patch(id, { x: clampedX, y: clampedY });
    },
    [patch]
  );

  const moveTextArea = useCallback(
    (id, textOffsetX, textOffsetY) => patch(id, { textOffsetX, textOffsetY }),
    [patch]
  );

  const resizeTextArea = useCallback(
    (id, textWidth, textHeight) => {
      const clampedW = Math.max(80, Math.min(800, Math.round(textWidth)));
      const clampedH = Math.max(40, Math.min(800, Math.round(textHeight)));
      patch(id, { textWidth: clampedW, textHeight: clampedH });
    },
    [patch]
  );

  const rotateTextArea = useCallback(
    (id, textRotation) => {
      let norm = textRotation % 360;
      if (norm > 180) norm -= 360;
      if (norm < -180) norm += 360;
      patch(id, { textRotation: +norm.toFixed(1) });
    },
    [patch]
  );

  const resizeNote = useCallback(
    (id, width) => {
      const clampedWidth = Math.max(30, Math.min(1000, Math.round(width)));
      patch(id, { width: clampedWidth });
    },
    [patch]
  );

  const rotateNote = useCallback(
    (id, rotation) => {
      // Normalize angle between -180 and 180 degrees rounded to 1 decimal place
      let norm = rotation % 360;
      if (norm > 180) norm -= 360;
      if (norm < -180) norm += 360;
      patch(id, { rotation: +norm.toFixed(1) });
    },
    [patch]
  );

  const bringToFront = useCallback(id => patch(id, { z: ++topZ.current }), [patch]);

  // Keep all notes within viewport whenever window is resized
  useEffect(() => {
    const handleResize = () => {
      const winW = window.innerWidth;
      const winH = window.innerHeight;
      const isNarrow = winW < 640;
      setNotes((list) => {
        let changed = false;
        const updated = list.map((n) => {
          const noteW = 380;
          const maxNoteW = Math.min(noteW, winW - 32);
          const maxX = Math.max(8, winW - maxNoteW - 12);
          const maxY = Math.max(70, winH - 120);

          let newX = n.x;
          let newY = n.y;

          if (isNarrow) {
            // On mobile / small screens, center the note horizontally
            newX = Math.max(8, (winW - maxNoteW) / 2);
            changed = true;
          } else {
            if (n.x > maxX) {
              newX = maxX;
              changed = true;
            } else if (n.x < 8) {
              newX = 8;
              changed = true;
            }
          }

          if (n.y > maxY) {
            newY = maxY;
            changed = true;
          } else if (n.y < 60) {
            newY = 60;
            changed = true;
          }

          if (newX !== n.x || newY !== n.y) {
            return { ...n, x: Math.round(newX), y: Math.round(newY) };
          }
          return n;
        });

        return changed ? updated : list;
      });
    };

    window.addEventListener('resize', handleResize);
    // Also run once after loading to adjust any out-of-bounds notes from saved storage
    if (loaded) {
      handleResize();
    }
    return () => window.removeEventListener('resize', handleResize);
  }, [loaded]);

  const removeNote = useCallback(id => {
    setNotes(list => list.filter(n => n.id !== id));
  }, []);

  return {
    notes,
    loaded,
    addNote,
    updateText,
    updateTextColor,
    updateFontFamily,
    addHighlight,
    removeHighlight,
    clearHighlights,
    setHighlights,
    moveNote,
    moveTextArea,
    resizeTextArea,
    rotateTextArea,
    resizeNote,
    rotateNote,
    bringToFront,
    removeNote,
  };
}