// Where the PNGs live, relative to the public folder:
//   files directly in public/       -> ''
//   files in public/notes/          -> '/notes'
const BASE = './notes';

const DEFAULT_INSET = [20, 8, 15, 8]; // safe starting point, tune per note

export const NOTE_TYPE = {
  'note-1': { src: `${BASE}/1.png`, width: 300, inset: DEFAULT_INSET },
  'note-2': { src: `${BASE}/2.png`, width: 280, inset: [16, 8, 12, 19] }, // the orange one
  'note-3': { src: `${BASE}/3.png`, width: 300, inset: DEFAULT_INSET },
  'note-4': { src: `${BASE}/4.png`, width: 300, inset: DEFAULT_INSET },
  'note-5': { src: `${BASE}/5.png`, width: 300, inset: DEFAULT_INSET },
  'note-6': { src: `${BASE}/6.png`, width: 300, inset: DEFAULT_INSET },
  'note-7': { src: `${BASE}/7.png`, width: 300, inset: DEFAULT_INSET },
};