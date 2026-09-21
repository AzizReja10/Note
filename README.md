<div align="center">

# 📌 NoteApp — Aesthetic Digital Sticky Notes & Moodboard

An interactive, hyper-tactile sticky note canvas featuring **real-time pen-drawn cursive handwriting**, **character-anchored highlighters**, **physics-based dust disintegration**, and **smart PNG export**.

[![React 19](https://img.shields.io/badge/React-19.2-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.3-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Live Demo](https://img.shields.io/badge/Live_Demo-Vercel-black?style=for-the-badge&logo=vercel&logoColor=white)](https://note-smoky-nine.vercel.app/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

[🌐 Live Demo](https://note-smoky-nine.vercel.app/) • [Features](#-key-features) • [Tech Stack](#-tech-stack) • [Getting Started](#-getting-started) • [Architecture](#-how-it-works) • [User Guide](#-controls--shortcuts)

</div>

---

## ✨ Key Features

### 📝 Real Paper Sticky Notes & Stickers
- **14 Realistic Paper Textures**: Notes featuring authentic paper grains, folded textures, and torn edges.
- **Stickers & Decals**: Playful sticker accessories to decorate your board.
- **Interactive 3D Folder Modal**: Browse through note styles and stickers with an animated 3D folder perspective flip.
- **Freeform Canvas**: Drag notes anywhere, resize freely, and rotate with precision handles.
- **Smart Stacking**: Automatic z-index elevation brings whatever note you touch directly to the front.

### ✍️ Animated Stroke Handwriting Engine
- **Apple-Style Cursive Drawing**: Rather than standard text display, text is rendered with a custom vector stroke engine. Each character is physically drawn on the fly by an animated virtual pen.
- **Continuous Flow**: Glyphs connect into continuous cursive script (Satisfy and Parisienne font packs).
- **Emoji & Fallback Support**: Non-stroke glyphs and emojis seamlessly pop into place with playful micro-animations.
- **Burst Detection**: Fast pastes automatically bypass animations to keep the interface instantaneous.

### 🖍️ Character-Anchored Highlighter & Pen Tool
- **4 Annotation Modes**:
  - `Highlight`: Translucent marker sweep over text.
  - `Underline`: Hand-drawn wavy underline accent.
  - `Circle`: Organic circular emphasis loop.
  - `Box`: Hand-drawn rectangular framing.
- **Vibrant Fluorescent Palette**: Neon Yellow, Mint Green, Sky Blue, Bubble Pink, Peach Orange, Soft Purple.
- **Eraser Mode**: Click or drag across highlighted text to scrub annotations away.
- **No Drifting**: Unlike overlay-based annotations that misalign when notes rotate or reflow, annotations in NoteApp are anchored directly to UTF-16 character indices. They rotate, resize, and flow identically with your words.

### 💨 Physics Particle Dust Disintegration ("Thanos Snap")
- **Tactile Note Deletion**: Deleting a note doesn't just make it disappear—it dissolves into thousands of tiny paper dust particles.
- **Texture-Sampled Color**: The engine samples the note's actual PNG pixel colors, producing authentic paper dust matching torn edges and paper tints.
- **Aerodynamic Flight**: Dust particles drift outward from your click point, hang momentarily in the air, and swoop into the floating bottom-right dustbin.
- **High Performance**: Single HTML5 Canvas2D and `requestAnimationFrame` loop with pre-cached radial gradient sprites, achieving a locked 60 FPS without DOM overhead.

### 🔤 Typography & Ink Customizer
- **9 Curated Fonts**:
  - *Handwritten & Calligraphy*: Script (Satisfy), Parisienne, Patrick Hand, Dancing Script, Caveat, Kalam, Shadows Into Light.
  - *Clean & Retro*: Open Sans Variable, Typewriter Monospace.
- **Ink Palette**: Choose between classic charcoal ink or 10 curated vibrant ink shades.
- **Independent Text Containers**: Move, rotate, and resize the text box inside any note independently from the paper background.
- **Positioning Preview**: Toggle alignment border guides to visually fine-tune text containers.

### 📸 Smart Auto-Crop PNG Export
- **One-Click Snapshot**: Capture your entire board or note arrangements to a high-resolution PNG (`html-to-image`).
- **Collective Bounding-Box Cropping**: Detects the bounding box of all active notes and stickers, automatically trimming excess canvas with an aesthetic 24px margin.
- **Clean Export**: Transform handles, delete buttons, typing badges, and system UI elements are automatically excluded from the final image.

### 🌓 macOS-Style Dock & Day/Night Theme
- **Floating Glassmorphic Dock**: Magnified dock bar with smooth spring physics.
- **Animated Day/Night Switch**: Seamlessly transition between Warm Parchment (`#fdfcdc`) and Midnight Slate (`#141622`).
- **Offline Persistence**: Board state, coordinates, dimensions, rotations, text content, and theme preferences persist automatically via `localStorage`.

---

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| **React 19** | Core UI library & reactive state management |
| **Vite 8** | Next-generation fast build tool & dev server |
| **Tailwind CSS v4** | Modern utility-first CSS styling system |
| **Motion (Framer Motion)** | Spring animations and UI layout transitions |
| **html-to-image** | High-resolution DOM to PNG rasterization |
| **Base UI / Shadcn UI** | Accessible foundation components |
| **Lucide React** | Sleek, consistent iconography |
| **Oxlint** | High-performance linter for code health |

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (version 18.0 or higher recommended)
- [npm](https://www.npmjs.com/) or [pnpm](https://pnpm.io/)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/AzizReja10/Note.git
   cd Note
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Open in browser:**
   Navigate to `http://localhost:5173` (or the URL displayed in your terminal).

### Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Starts the Vite local development server with Hot Module Replacement (HMR) |
| `npm run build` | Compiles and bundles production-ready assets into the `dist/` directory |
| `npm run preview` | Previews the production build locally |
| `npm run lint` | Runs Oxlint across all JavaScript and JSX files |

---

## 📂 Project Structure

```text
noteApp/
├── public/
│   ├── notes/                  # Paper textures (2.png - 15.png) & sticker assets
│   │   └── stickers/           # Sticker PNG graphics
│   ├── script-satisfy.json     # Stroke vector font definition for Satisfy
│   ├── script-parisienne.json  # Stroke vector font definition for Parisienne
│   ├── dustbin.png             # Target graphic for note deletion physics
│   ├── pen.svg / eraser.svg    # Cursor & tool assets
│   └── favicon.png             # Application favicon
├── src/
│   ├── components/
│   │   └── ui/                 # Dock, blur-fade, loader, and interactive widgets
│   ├── notes/
│   │   ├── Note.jsx            # Core note component (drag, rotate, resize, text area)
│   │   ├── NoteBoard.jsx       # Board canvas, 3D folder modal & placement logic
│   │   ├── ScriptText.jsx      # Apple-style handwriting stroke drawing engine
│   │   ├── scriptLayout.js     # Typography measurement, caret positioning & line breaking
│   │   ├── glyphDraw.js        # Canvas/SVG stroke glyph path generation
│   │   ├── highlights.js       # Character-anchored annotation & highlight math
│   │   ├── useHighlightPen.js  # Pointer event tracker for drawing annotations
│   │   ├── dustDelete.js       # Texture-sampled particle disintegration animation
│   │   ├── fonts.js            # Font definitions and loader configuration
│   │   ├── noteTypes.js        # Dimensions, paper insets & asset registry
│   │   └── storage.js          # LocalStorage persistence adapter
│   ├── pages/
│   │   ├── Header.jsx          # Top dock bar with folder, preview, export & settings
│   │   └── DayNightSwitch.jsx  # Animated theme switcher
│   ├── App.jsx                 # Main application state, toolbar panels & snapshot orchestration
│   ├── index.css               # Design tokens, custom animations, Tailwind CSS v4 setup
│   └── main.jsx                # Application root entry point
├── package.json
└── vite.config.js
```

---

## 🔍 How It Works

### 1. The Vector Stroke Handwriting Pipeline
Most handwriting fonts in web apps simply apply an `@font-face` cursive font. NoteApp takes inspiration from Apple Notes:
- Vector stroke definitions (`script-satisfy.json`, `script-parisienne.json`) provide single-line Bézier curves for each glyph rather than closed outline shapes.
- [`ScriptText.jsx`](src/notes/ScriptText.jsx) calculates text metrics and feeds coordinates into [`scriptLayout.js`](src/notes/scriptLayout.js).
- When a user types, new glyphs are animated sequentially along their vector paths using CSS `stroke-dashoffset` interpolation, simulating real pen movement across paper.

### 2. Character-Anchored Highlighting
Traditional canvas highlighter overlays fail when a note is scaled, rotated, or when text wraps differently.
- [`highlights.js`](src/notes/highlights.js) treats highlights as immutable text ranges bound to UTF-16 indices (`[from, to)`).
- Markers are rendered inline alongside the character cells.
- When you edit text, rotate the note, or change container sizes, highlights stay locked to the exact words you marked.

### 3. Texture-Sampled Dust Disintegration
- When you click the delete icon on a note, [`dustDelete.js`](src/notes/dustDelete.js) reads the underlying note image data.
- It generates non-uniform particles matching the paper's exact pixel colors and alpha mask (including torn borders).
- Particles animate along quadratic Bezier curves with varying mass, air resistance, and drift, creating an organic particle flight into the corner dustbin.

---

## 🎮 Controls & Shortcuts

| Action | Control |
|---|---|
| **Add Notes / Stickers** | Click the **Folder icon** in the dock to open the collection |
| **Move Note** | Click and drag anywhere on the note paper |
| **Rotate / Resize Note** | Hover over note and use the corner transform handles |
| **Edit Text** | Click inside the note's text area to focus and type |
| **Adjust Text Container** | Use the text repositioning handle or turn on **Preview Mode** in the dock |
| **Change Font & Color** | Click the **T** icon in the dock to open the typography panel |
| **Highlight & Annotate** | Open **Settings** (slider icon) to activate the highlighter, choose style and color |
| **Erase Annotations** | Select the eraser mode in the highlighter menu and scrub over highlighted text |
| **Delete Note** | Click the red trash icon on any note to trigger dust disintegration |
| **Export to Image** | Click the **Download** icon in the dock to save a cropped high-res PNG |
| **Toggle Dark Mode** | Click the sun/moon switch on the right side of the dock |

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

<div align="center">
  Crafted with ❤️ by <a href="https://github.com/AzizReja10">AzizReja10</a>
</div>
