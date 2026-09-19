import { useCallback, useEffect, useRef, useState } from 'react';
import { localStorageAdapter } from './storage';

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

  const updateText = useCallback((id, text) => patch(id, { text }), [patch]);

  const moveNote = useCallback(
    (id, x, y) => patch(id, { x: Math.max(0, x), y: Math.max(0, y) }),
    [patch]
  );

  const bringToFront = useCallback(id => patch(id, { z: ++topZ.current }), [patch]);

  const removeNote = useCallback(id => {
    setNotes(list => list.filter(n => n.id !== id));
  }, []);

  return { notes, loaded, addNote, updateText, moveNote, bringToFront, removeNote };
}