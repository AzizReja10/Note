import React, { useRef, useState } from 'react';
import NoteBoard from './notes/NoteBoard';
import Header from './pages/Header';
import { useNotes } from './notes/useNotes';
import { localStorageAdapter } from './notes/storage';
import { toPng } from 'html-to-image';

const App = () => {
  const [isFolderOpen, setIsFolderOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isPreviewActive, setIsPreviewActive] = useState(false);
  const [isDark, setIsDark] = useState(() => {
    try {
      return localStorage.getItem('theme-mode') === 'dark';
    } catch {
      return false;
    }
  });

  const boardRef = useRef(null);
  const notesManager = useNotes(localStorageAdapter);

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
        isDark={isDark}
        onToggleDark={setIsDark}
      />
      <NoteBoard
        isFolderOpen={isFolderOpen}
        onCloseFolder={() => setIsFolderOpen(false)}
        notesManager={notesManager}
        boardRef={boardRef}
        isPreviewActive={isPreviewActive}
      />

      {/* Floating Dustbin at the bottom right corner of the page */}
      <Dustbin />
    </div>
  );
};

function Dustbin() {
  const [isActive, setIsActive] = useState(false);

  React.useEffect(() => {
    const handleActivate = () => {
      setIsActive(true);
      setTimeout(() => setIsActive(false), 900);
    };

    window.addEventListener('dustbin-activate', handleActivate);
    return () => window.removeEventListener('dustbin-activate', handleActivate);
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

export default App;
