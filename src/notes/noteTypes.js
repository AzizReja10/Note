// Where the PNGs live, relative to the public folder:
//   files directly in public/       -> ''
//   files in public/notes/          -> '/notes'
const BASE = './notes';

const DEFAULT_INSET = [20, 8, 15, 8]; // safe starting point, tune per note

export const NOTE_TYPE = {
  'note-2': { src: `${BASE}/2.png`, width: 360, inset: [16, 8, 12, 19] }, // the orange one
  'note-3': { src: `${BASE}/3.png`, width: 380, inset: DEFAULT_INSET },
  'note-4': { src: `${BASE}/4.png`, width: 380, inset: DEFAULT_INSET },
  'note-5': { src: `${BASE}/5.png`, width: 380, inset: DEFAULT_INSET },
  'note-6': { src: `${BASE}/6.png`, width: 380, inset: DEFAULT_INSET },
  'note-7': { src: `${BASE}/7.png`, width: 380, inset: DEFAULT_INSET },
  'note-8': { src: `${BASE}/8.png`, width: 380, inset: DEFAULT_INSET },
  'note-9': { src: `${BASE}/9.png`, width: 380, inset: DEFAULT_INSET },
  'note-10': { src: `${BASE}/10.png`, width: 380, inset: DEFAULT_INSET },
  'note-11': { src: `${BASE}/11.png`, width: 380, inset: DEFAULT_INSET },
  'note-12': { src: `${BASE}/12.png`, width: 380, inset: DEFAULT_INSET },
  'note-13': { src: `${BASE}/13.png`, width: 380, inset: DEFAULT_INSET },
  'note-14': { src: `${BASE}/14.png`, width: 380, inset: DEFAULT_INSET },
  'note-15': { src: `${BASE}/15.png`, width: 380, inset: DEFAULT_INSET }
};