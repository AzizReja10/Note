export const NOTE_FONTS = [
  {
    id: 'script',
    label: 'Script',
    desc: 'Handwritten',
    category: 'Handwritten',
    fontFamily: "'Patrick Hand', cursive",
    script: '/script-satisfy.json',
    previewText: 'Continuous cursive',
  },
  {
    id: 'script-parisienne',
    label: 'Parisienne',
    desc: 'Calligraphy',
    category: 'Calligraphy',
    fontFamily: "'Dancing Script', cursive",
    script: '/script-parisienne.json',
    previewText: 'Parisian cursive',
  },
  {
    id: 'patrick-hand',
    label: 'Patrick Hand',
    category: 'Handwriting',
    fontFamily: "'Patrick Hand', cursive, sans-serif",
    previewText: 'Handwritten notes',
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

export function getFontScriptUrl(fontFamily) {
  // If font is undefined / empty or explicitly script font, default to '/script-satisfy.json'
  if (!fontFamily) return '/script-satisfy.json';
  const match = NOTE_FONTS.find(
    (f) =>
      f.fontFamily === fontFamily ||
      f.id === fontFamily ||
      (f.id === 'script' && fontFamily.includes('Patrick Hand')) ||
      (f.id === 'script-parisienne' && fontFamily.includes('Parisienne'))
  );
  return match?.script;
}
