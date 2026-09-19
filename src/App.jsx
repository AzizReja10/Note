import React, { useEffect, useRef, useState } from 'react';
import NoteBoard from './notes/NoteBoard';
import Header from './pages/Header';
import { useNotes } from './notes/useNotes';
import { localStorageAdapter } from './notes/storage';
import { toPng } from 'html-to-image';

const App = () => {
  const [isFolderOpen, setIsFolderOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isPreviewActive, setIsPreviewActive] = useState(false);
  const [activeNoteTransformId, setActiveNoteTransformId] = useState(null);
  const [activeTextTransformId, setActiveTextTransformId] = useState(null);
  const [selectedNoteId, setSelectedNoteId] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDark, setIsDark] = useState(() => {
    try {
      return localStorage.getItem('theme-mode') === 'dark';
    } catch {
      return false;
    }
  });

  const [isHighlighterActive, setIsHighlighterActive] = useState(false);
  const [highlighterColor, setHighlighterColor] = useState('#fde047'); // Fluorescent sketch highlighter yellow
  const [highlighterType, setHighlighterType] = useState('highlight'); // 'highlight' | 'underline' | 'circle' | 'box'
  const [highlighterMode, setHighlighterMode] = useState('draw'); // 'draw' | 'eraser'

  const boardRef = useRef(null);
  const notesManager = useNotes(localStorageAdapter);

  const handleToggleHighlighter = () => {
    setIsHighlighterActive((prev) => !prev);
  };

  const handleToggleNoteTransform = (noteId) => {
    setSelectedNoteId(noteId);
    setActiveNoteTransformId((current) => (current === noteId ? null : noteId));
  };

  const handleToggleTextTransform = (noteId) => {
    setSelectedNoteId(noteId);
    setActiveTextTransformId((current) => (current === noteId ? null : noteId));
  };

  const handleColorSelect = (color) => {
    const targetId = selectedNoteId || activeTextTransformId || activeNoteTransformId || notesManager.notes[notesManager.notes.length - 1]?.id;
    if (targetId && notesManager.updateTextColor) {
      notesManager.updateTextColor(targetId, color);
    }
  };

  // Sync dark class with <html> and document body
  React.useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme-mode', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme-mode', 'light');
    }
  }, [isDark]);

  // Turn off note and text rotate/resize transforms on single click outside any note
  React.useEffect(() => {
    const handleGlobalClick = (e) => {
      // If clicking inside a note, its handles, or header / modals / settings, don't dismiss
      if (e.target.closest('.note, .header, .file, .folder-modal, .settings-bottom-panel, .setting-btn')) return;
      setActiveNoteTransformId(null);
      setActiveTextTransformId(null);
    };

    window.addEventListener('pointerdown', handleGlobalClick);
    return () => window.removeEventListener('pointerdown', handleGlobalClick);
  }, []);

  const handleDownloadNotes = async () => {
    if (!notesManager.notes || notesManager.notes.length === 0) {
      alert('No notes on your board to download yet! Add some notes first.');
      return;
    }

    const boardEl = boardRef.current;
    if (!boardEl) {
      alert('Note board not ready.');
      return;
    }

    try {
      setIsDownloading(true);

      // Filter out delete buttons, drag handles, and modal overlays if any
      const filter = (node) => {
        if (node?.classList?.contains('note-delete')) return false;
        if (node?.classList?.contains('text-drag-handle')) return false;
        if (node?.getAttribute && node.getAttribute('data-html2canvas-ignore') === 'true') return false;
        return true;
      };

      const dataUrl = await toPng(boardEl, {
        backgroundColor: isDark ? '#141622' : '#fdfcdc',
        pixelRatio: 2, // High-resolution export
        filter,
        cacheBust: true,
      });

      const link = document.createElement('a');
      link.download = `sticky-notes-${Date.now()}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Failed to export notes as PNG image:', err);
      alert('Could not download image. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className={`min-h-screen w-full relative overflow-x-hidden transition-colors duration-400 ${isDark ? 'bg-[#141622]' : 'bg-[#fdfcdc]'}`}>
      <Header
        isFolderOpen={isFolderOpen}
        onToggleFolder={() => setIsFolderOpen((prev) => !prev)}
        onDownloadNotes={handleDownloadNotes}
        isDownloading={isDownloading}
        isPreviewActive={isPreviewActive}
        onTogglePreview={() => setIsPreviewActive((prev) => !prev)}
        isSettingsOpen={isSettingsOpen}
        onToggleSettings={() => setIsSettingsOpen((prev) => !prev)}
        isDark={isDark}
        onToggleDark={setIsDark}
      />
      <NoteBoard
        isFolderOpen={isFolderOpen}
        onCloseFolder={() => setIsFolderOpen(false)}
        notesManager={notesManager}
        boardRef={boardRef}
        isPreviewActive={isPreviewActive}
        activeNoteTransformId={activeNoteTransformId}
        activeTextTransformId={activeTextTransformId}
        onToggleNoteTransform={handleToggleNoteTransform}
        onToggleTextTransform={handleToggleTextTransform}
        onSelectNote={setSelectedNoteId}
        isHighlighterActive={isHighlighterActive}
        highlighterColor={highlighterColor}
        highlighterType={highlighterType}
        highlighterMode={highlighterMode}
      />

      {/* Settings Bottom Floating Panel (From Uiverse.io by emmanuelh-dev) */}
      <SettingsBottomPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSelectColor={handleColorSelect}
        isHighlighterActive={isHighlighterActive}
        onToggleHighlighter={handleToggleHighlighter}
        highlighterColor={highlighterColor}
        onSelectHighlighterColor={setHighlighterColor}
        highlighterType={highlighterType}
        onSelectHighlighterType={setHighlighterType}
        highlighterMode={highlighterMode}
        onSelectHighlighterMode={setHighlighterMode}
      />

      {/* Floating Dustbin at the bottom right corner of the page */}
      <Dustbin />
    </div>
  );
};

function Dustbin() {
  const [isActive, setIsActive] = useState(false);

  React.useEffect(() => {
    let shakeTimer = null;
    const handleActivate = () => {
      // Dustbin begins vibrating enthusiastically as note particles fly towards it around 1.35s
      shakeTimer = setTimeout(() => {
        setIsActive(true);
        setTimeout(() => setIsActive(false), 1000);
      }, 1350);
    };

    window.addEventListener('dustbin-activate', handleActivate);
    return () => {
      window.removeEventListener('dustbin-activate', handleActivate);
      if (shakeTimer) clearTimeout(shakeTimer);
    };
  }, []);

  return (
    <div
      className={`dustbin-container ${isActive ? 'is-active' : ''}`}
      data-html2canvas-ignore="true"
      title="Dustbin: Deleted notes dissolve here"
    >
      <img
        src="/dustbin.png"
        alt="Dustbin"
        className="dustbin-img"
        draggable={false}
      />
    </div>
  );
}

const PALETTE_COLORS = [
  '#e11d48',
  '#f472b6',
  '#fb923c',
  '#facc15',
  '#84cc16',
  '#10b981',
  '#0ea5e9',
  '#3b82f6',
  '#8b5cf6',
  '#a78bfa',
];

const HIGHLIGHT_STYLES = [
  { id: 'highlight', label: 'Highlight', icon: '🖍️' },
  { id: 'underline', label: 'Underline', icon: '〰️' },
  { id: 'circle', label: 'Circle', icon: '⭕' },
  { id: 'box', label: 'Box', icon: '▢' },
];

const HIGHLIGHT_COLORS = [
  { color: '#fde047', label: 'Neon Yellow' },
  { color: '#86efac', label: 'Mint Green' },
  { color: '#93c5fd', label: 'Sky Blue' },
  { color: '#f472b6', label: 'Bubble Pink' },
  { color: '#fdba74', label: 'Peach Orange' },
  { color: '#c084fc', label: 'Soft Purple' },
];

function SettingsBottomPanel({
  isOpen,
  onClose,
  onSelectColor = () => {},
  isHighlighterActive = false,
  onToggleHighlighter = () => {},
  highlighterColor = '#fde047',
  onSelectHighlighterColor = () => {},
  highlighterType = 'highlight',
  onSelectHighlighterType = () => {},
  highlighterMode = 'draw',
  onSelectHighlighterMode = () => {},
}) {
  const [activeView, setActiveView] = useState('menu'); // 'menu' | 'ink-palette' | 'highlight-palette'
  const [isFadingOut, setIsFadingOut] = useState(false);

  // Reset view when panel closes
  useEffect(() => {
    if (!isOpen) {
      setActiveView('menu');
      setIsFadingOut(false);
    }
  }, [isOpen]);

  const handleCloseSubPalette = () => {
    if (activeView !== 'menu' && !isFadingOut) {
      setIsFadingOut(true);
      setTimeout(() => {
        setActiveView('menu');
        setIsFadingOut(false);
      }, 240);
    } else if (activeView === 'menu') {
      // If no sub palette is open, close entire customizer panel
      onClose();
    }
  };

  const handlePickColor = (color) => {
    onSelectColor(color);
    // Smoothly fade out the color palette back to main menu
    handleCloseSubPalette();
  };

  const handlePickHighlightColor = (color) => {
    onSelectHighlighterColor(color);
    // Automatically switch to draw mode when picking a highlight color
    onSelectHighlighterMode('draw');
    if (!isHighlighterActive) {
      onToggleHighlighter();
    }
    handleCloseSubPalette();
  };

  const isExpanded = activeView !== 'menu';

  return (
    <div
      className={`settings-bottom-panel ${isOpen ? 'panel-open' : 'panel-closed'}`}
      data-html2canvas-ignore="true"
    >
      <div className={`settings-card ${isExpanded ? 'has-palette' : 'compact-card'}`}>
        {/* Top header bar with 3 colored dots from Uiverse.io */}
        <div className="flex items-center justify-between px-3.5 pt-2 pb-0.5 border-b border-neutral-100 dark:border-neutral-800/80">
          <div className="flex items-center gap-1.5">
            <span className="bg-blue-500 inline-block w-2.5 h-2.5 rounded-full shadow-sm" />
            <span className="bg-purple-500 inline-block w-2.5 h-2.5 rounded-full shadow-sm" />
            <span className="bg-pink-500 inline-block w-2.5 h-2.5 rounded-full shadow-sm" />
          </div>
          <span className="text-[11px] font-semibold tracking-wider text-neutral-400 dark:text-neutral-500 uppercase select-none">
            {activeView === 'ink-palette'
              ? 'Ink Color Palette'
              : activeView === 'highlight-palette'
              ? 'Highlighter Studio'
              : 'Text Customizer'}
          </span>
          <button
            type="button"
            onClick={handleCloseSubPalette}
            aria-label="Close"
            className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 text-xs px-1 rounded transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Card content */}
        <div className="card__content">
          {activeView === 'menu' ? (
            <div className="flex items-center gap-3">
              {/* Button 1: Open Ink Color Palette (Multi-layer animated button) */}
              <button
                type="button"
                onClick={() => {
                  setActiveView('ink-palette');
                  setIsFadingOut(false);
                }}
                className="layer-btn ink-layer-btn"
                title="Click to open Pen Ink Color Palette"
              >
                <span className="layer-btn-bg">
                  <span className="layer-btn-bg-layers">
                    <span className="layer-btn-bg-layer layer-bg-1 -purple" />
                    <span className="layer-btn-bg-layer layer-bg-2 -turquoise" />
                    <span className="layer-btn-bg-layer layer-bg-3 -yellow" />
                  </span>
                </span>
                <span className="layer-btn-inner">
                  <span className="layer-btn-inner-static flex items-center gap-1.5">
                    <span className="palette-color-preview" />
                    <span>Ink Color</span>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m9 18 6-6-6-6"/>
                    </svg>
                  </span>
                  <span className="layer-btn-inner-hover flex items-center gap-1.5">
                    <span className="palette-color-preview" />
                    <span>Choose Color</span>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m9 18 6-6-6-6"/>
                    </svg>
                  </span>
                </span>
              </button>

              {/* Button 2: Open Highlighter Studio Palette (Multi-layer animated button) */}
              <button
                type="button"
                onClick={() => {
                  setActiveView('highlight-palette');
                  setIsFadingOut(false);
                }}
                className={`layer-btn hl-layer-btn ${isHighlighterActive ? 'is-active-pen' : ''}`}
                title="Click to open Highlighter palette and rough styles"
              >
                <span className="layer-btn-bg">
                  <span className="layer-btn-bg-layers">
                    <span className="layer-btn-bg-layer layer-bg-1 -pink" />
                    <span className="layer-btn-bg-layer layer-bg-2 -yellow" />
                    <span className="layer-btn-bg-layer layer-bg-3 -turquoise" />
                  </span>
                </span>
                <span className="layer-btn-inner">
                  <span className="layer-btn-inner-static flex items-center gap-1.5">
                    <img
                      src={highlighterMode === 'eraser' ? '/eraser.png' : '/pen.png'}
                      alt="Highlighter tool"
                      className="w-3.5 h-3.5 object-contain"
                      draggable={false}
                    />
                    <span>{isHighlighterActive ? (highlighterMode === 'eraser' ? 'Eraser (ON)' : 'Highlighter (ON)') : 'Highlighter'}</span>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m9 18 6-6-6-6"/>
                    </svg>
                  </span>
                  <span className="layer-btn-inner-hover flex items-center gap-1.5">
                    <img
                      src={highlighterMode === 'eraser' ? '/eraser.png' : '/pen.png'}
                      alt="Highlighter tool"
                      className="w-3.5 h-3.5 object-contain"
                      draggable={false}
                    />
                    <span>Studio Tools</span>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m9 18 6-6-6-6"/>
                    </svg>
                  </span>
                </span>
              </button>
            </div>
          ) : activeView === 'ink-palette' ? (
            /* Ink Color 3D Interactive Palette */
            <div className={`palette-fade-wrapper ${isFadingOut ? 'palette-fading-out' : ''}`}>
              <div className="container-items">
                {PALETTE_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className="item-color"
                    style={{ '--color': color }}
                    aria-color={color}
                    onClick={() => handlePickColor(color)}
                    title={`Next typed text will be ${color}`}
                  />
                ))}
              </div>
            </div>
          ) : (
            /* Highlighter Studio Component (Expandable like ink palette) */
            <div className={`palette-fade-wrapper highlighter-studio-view ${isFadingOut ? 'palette-fading-out' : ''}`}>
              <div className="flex items-center gap-1.5 max-w-full overflow-x-auto py-0.5">
                {/* Pen (Draw) mode button with small pen icon */}
                <button
                  type="button"
                  onClick={() => {
                    if (isHighlighterActive && highlighterMode === 'draw') {
                      // Clicked active pen -> toggle off to normal typing mode
                      onToggleHighlighter();
                    } else {
                      // Switch to draw mode and ensure active
                      onSelectHighlighterMode('draw');
                      if (!isHighlighterActive) onToggleHighlighter();
                    }
                  }}
                  className={`highlighter-tool-toggle-btn ${isHighlighterActive && highlighterMode === 'draw' ? 'is-active-tool' : ''}`}
                  title={isHighlighterActive && highlighterMode === 'draw' ? 'Pen is ON (click to turn OFF and write)' : 'Click to turn ON Pen'}
                >
                  <img
                    src="/pen.png"
                    alt="Pen"
                    className="w-3.5 h-3.5 object-contain"
                    draggable={false}
                  />
                  <span className="text-[11px] font-semibold whitespace-nowrap">
                    {isHighlighterActive && highlighterMode === 'draw' ? 'Pen (ON)' : 'Pen'}
                  </span>
                </button>

                {/* Eraser tool button with eraser.png */}
                <button
                  type="button"
                  onClick={() => {
                    if (isHighlighterActive && highlighterMode === 'eraser') {
                      // Clicked active eraser -> toggle off to normal typing mode
                      onToggleHighlighter();
                    } else {
                      // Switch to eraser mode and ensure active
                      onSelectHighlighterMode('eraser');
                      if (!isHighlighterActive) onToggleHighlighter();
                    }
                  }}
                  className={`highlighter-tool-toggle-btn ${isHighlighterActive && highlighterMode === 'eraser' ? 'is-active-tool eraser-active' : ''}`}
                  title={isHighlighterActive && highlighterMode === 'eraser' ? 'Eraser is ON (click to turn OFF and write)' : 'Click to turn ON Eraser'}
                >
                  <img
                    src="/eraser.png"
                    alt="Eraser"
                    className="w-3.5 h-3.5 object-contain"
                    draggable={false}
                  />
                  <span className="text-[11px] font-semibold whitespace-nowrap">
                    {isHighlighterActive && highlighterMode === 'eraser' ? 'Eraser (ON)' : 'Eraser'}
                  </span>
                </button>

                {/* Annotation Type Switcher (Highlight, Underline, Circle, Box) */}
                <div className="flex items-center gap-0.5 bg-neutral-100 dark:bg-neutral-800/90 p-0.5 rounded-lg flex-shrink-0">
                  {HIGHLIGHT_STYLES.map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => {
                        onSelectHighlighterType(st.id);
                        onSelectHighlighterMode('draw');
                        if (!isHighlighterActive) onToggleHighlighter();
                      }}
                      className={`highlighter-type-pill ${highlighterType === st.id && highlighterMode === 'draw' ? 'is-selected' : ''}`}
                      title={`${st.label} style`}
                    >
                      <span>{st.icon}</span>
                      <span className="text-[11px] font-medium hidden md:inline">{st.label}</span>
                    </button>
                  ))}
                </div>

                {/* Highlighter Color Palette Swatches */}
                <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800/90 px-1.5 py-1 rounded-lg flex-shrink-0">
                  {HIGHLIGHT_COLORS.map((item) => (
                    <button
                      key={item.color}
                      type="button"
                      onClick={() => handlePickHighlightColor(item.color)}
                      className={`highlighter-palette-swatch-lg ${highlighterColor === item.color ? 'is-active-color' : ''}`}
                      style={{ backgroundColor: item.color }}
                      title={`Select ${item.label}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
