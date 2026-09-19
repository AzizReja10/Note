// Where the PNGs live, relative to the public folder:
//   files directly in public/       -> ''
//   files in public/notes/          -> '/notes'
const BASE = './notes';

const DEFAULT_INSET = [20, 8, 15, 8]; // safe starting point, tune per note

export const NOTE_TYPE = {
  'note-2': { src: `${BASE}/2.png`, width: 360, inset: [16, 8, 12, 19], category: 'note' }, // the orange one
  'note-3': { src: `${BASE}/3.png`, width: 380, inset: DEFAULT_INSET, category: 'note' },
  'note-4': { src: `${BASE}/4.png`, width: 380, inset: DEFAULT_INSET, category: 'note' },
  'note-5': { src: `${BASE}/5.png`, width: 380, inset: DEFAULT_INSET, category: 'note' },
  'note-6': { src: `${BASE}/6.png`, width: 380, inset: DEFAULT_INSET, category: 'note' },
  'note-7': { src: `${BASE}/7.png`, width: 380, inset: DEFAULT_INSET, category: 'note' },
  'note-8': { src: `${BASE}/8.png`, width: 380, inset: DEFAULT_INSET, category: 'note' },
  'note-9': { src: `${BASE}/9.png`, width: 380, inset: DEFAULT_INSET, category: 'note' },
  'note-10': { src: `${BASE}/10.png`, width: 380, inset: DEFAULT_INSET, category: 'note' },
  'note-11': { src: `${BASE}/11.png`, width: 380, inset: DEFAULT_INSET, category: 'note' },
  'note-12': { src: `${BASE}/12.png`, width: 380, inset: DEFAULT_INSET, category: 'note' },
  'note-13': { src: `${BASE}/13.png`, width: 380, inset: DEFAULT_INSET, category: 'note' },
  'note-14': { src: `${BASE}/14.png`, width: 380, inset: DEFAULT_INSET, category: 'note' },
  'note-15': { src: `${BASE}/15.png`, width: 380, inset: DEFAULT_INSET, category: 'note' },

  // Stickers from public/notes/stickers/
  'sticker-1': { src: `${BASE}/stickers/1.png`, width: 220, inset: [15, 12, 15, 12], category: 'sticker', isSticker: true },
  'sticker-2': { src: `${BASE}/stickers/2.png`, width: 220, inset: [15, 12, 15, 12], category: 'sticker', isSticker: true },
  'sticker-3': { src: `${BASE}/stickers/3.png`, width: 220, inset: [15, 12, 15, 12], category: 'sticker', isSticker: true },
  'sticker-4': { src: `${BASE}/stickers/4.png`, width: 220, inset: [15, 12, 15, 12], category: 'sticker', isSticker: true },
  'sticker-5': { src: `${BASE}/stickers/5.png`, width: 220, inset: [15, 12, 15, 12], category: 'sticker', isSticker: true },
  'sticker-6': { src: `${BASE}/stickers/6.png`, width: 220, inset: [15, 12, 15, 12], category: 'sticker', isSticker: true },
};