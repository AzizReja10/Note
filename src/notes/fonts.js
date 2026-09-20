import patrickUrl from '@fontsource/patrick-hand/files/patrick-hand-latin-400-normal.woff?url';

export const NOTE_FONTS = [
  {
    id: 'patrick-hand',
    label: 'Patrick Hand',
    category: 'Handwriting',
    fontFamily: "'Patrick Hand', cursive, sans-serif",
    previewText: 'Handwritten notes',
    glyphUrl: patrickUrl,
  },
  {
    id: 'open-sans',
    label: 'Open Sans',
    category: 'Clean Sans',
    fontFamily: "'Open Sans Variable', sans-serif",
    previewText: 'Modern & Clean',
  },
  {
    id: 'caveat',
    label: 'Caveat',
    category: 'Casual Script',
    fontFamily: "'Caveat', cursive",
    previewText: 'Playful cursive',
  },
  {
    id: 'kalam',
    label: 'Kalam',
    category: 'Marker Pen',
    fontFamily: "'Kalam', cursive",
    previewText: 'Felt tip pen',
  },
  {
    id: 'dancing-script',
    label: 'Dancing Script',
    category: 'Calligraphy',
    fontFamily: "'Dancing Script', cursive",
    previewText: 'Elegant flow',
  },
  {
    id: 'shadows',
    label: 'Shadows Into Light',
    category: 'Dainty Neat',
    fontFamily: "'Shadows Into Light', cursive",
    previewText: 'Delicate script',
  },
  {
    id: 'monospace',
    label: 'Typewriter Mono',
    category: 'Monospace',
    fontFamily: "'Courier New', Courier, monospace",
    previewText: 'Retro typewriter',
  },
];

export function getFontGlyphUrl(fontFamily) {
  if (!fontFamily) return patrickUrl; // Default font in app is Patrick Hand
  const match = NOTE_FONTS.find(
    (f) =>
      f.fontFamily === fontFamily ||
      fontFamily.toLowerCase().includes(f.id) ||
      (f.id === 'patrick-hand' && fontFamily.toLowerCase().includes('patrick'))
  );
  return match?.glyphUrl;
}
