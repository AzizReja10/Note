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

  const boardRef = useRef(null);
  const notesManager = useNotes(localStorageAdapter);

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
      />

      {/* Settings Bottom Floating Panel (From Uiverse.io by emmanuelh-dev) */}
      <SettingsBottomPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSelectColor={handleColorSelect}
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

function SettingsBottomPanel({
  isOpen,
  onClose,
  onSelectColor = () => {},
}) {
  const [showPalette, setShowPalette] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);

  // Reset showPalette when panel closes
  useEffect(() => {
    if (!isOpen) {
      setShowPalette(false);
      setIsFadingOut(false);
    }
  }, [isOpen]);

  const handleClosePalette = () => {
    if (showPalette && !isFadingOut) {
      setIsFadingOut(true);
      setTimeout(() => {
        setShowPalette(false);
        setIsFadingOut(false);
      }, 240);
    } else if (!showPalette) {
      // If palette isn't open, clicking cross closes the entire section
      onClose();
    }
  };

  const handlePickColor = (color) => {
    onSelectColor(color);
    // Smoothly fade out the color palette back to the customizer button
    handleClosePalette();
  };

  return (
    <div
      className={`settings-bottom-panel ${isOpen ? 'panel-open' : 'panel-closed'}`}
      data-html2canvas-ignore="true"
    >
      <div className={`settings-card ${showPalette ? 'has-palette' : 'compact-card'}`}>
        {/* Top header bar with 3 colored dots from Uiverse.io */}
        <div className="flex items-center justify-between px-3.5 pt-2 pb-0.5 border-b border-neutral-100 dark:border-neutral-800/80">
          <div className="flex items-center gap-1.5">
            <span className="bg-blue-500 inline-block w-2.5 h-2.5 rounded-full shadow-sm" />
            <span className="bg-purple-500 inline-block w-2.5 h-2.5 rounded-full shadow-sm" />
            <span className="bg-pink-500 inline-block w-2.5 h-2.5 rounded-full shadow-sm" />
          </div>
          <span className="text-[11px] font-semibold tracking-wider text-neutral-400 dark:text-neutral-500 uppercase select-none">
            Text Customizer
          </span>
          <button
            type="button"
            onClick={handleClosePalette}
            aria-label="Close"
            className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 text-xs px-1 rounded transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Card content - Button to reveal palette or the 3D Interactive Color Palette */}
        <div className="card__content">
          {!showPalette ? (
            <button
              type="button"
              onClick={() => {
                setShowPalette(true);
                setIsFadingOut(false);
              }}
              className="open-palette-btn"
              title="Click to open Color Palette"
            >
              <span className="palette-color-preview" />
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m9 18 6-6-6-6"/>
              </svg>
            </button>
          ) : (
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
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
