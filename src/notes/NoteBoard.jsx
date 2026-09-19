import React, { useRef, useState } from 'react';
import Note from './Note';
import { NOTE_TYPE } from './noteTypes';
import { useNotes } from './useNotes';
import { localStorageAdapter } from './storage';
import { BlurFade } from '@/registry/magicui/blur-fade';

const NoteBoard = ({
  types = NOTE_TYPE,
  storage = localStorageAdapter,
  isFolderOpen = false,
  onCloseFolder = () => {},
  notesManager,
  boardRef: externalBoardRef,
  isPreviewActive = false,
  activeNoteTransformId = null,
  activeTextTransformId = null,
  onToggleNoteTransform = () => {},
  onToggleTextTransform = () => {},
}) => {
  const internalBoardRef = useRef(null);
  const boardRef = externalBoardRef || internalBoardRef;
  const [newId, setNewId] = useState(null);
  const fallbackManager = useNotes(storage);
  const {
    notes,
    loaded,
    addNote,
    updateText,
    moveNote,
    moveTextArea,
    resizeTextArea,
    rotateTextArea,
    resizeNote,
    rotateNote,
    bringToFront,
    removeNote,
  } = notesManager || fallbackManager;

  const handleAdd = (type) => {
    const el = boardRef.current;
    const clientWidth = window.innerWidth || el?.clientWidth || document.documentElement.clientWidth;
    const clientHeight = window.innerHeight || el?.clientHeight || document.documentElement.clientHeight;
    const rawWidth = types[type]?.width || 380;
    const isMobile = clientWidth < 640;
    const effectiveWidth = isMobile ? Math.min(rawWidth, clientWidth - 32) : rawWidth;
    
    // Exactly center horizontally:
    const x = Math.max(16, Math.round((clientWidth - effectiveWidth) / 2));
    
    // Center vertically in viewport, offset below header (header is ~60px high)
    const y = Math.max(isMobile ? 100 : 120, Math.round((clientHeight - 360) / 2));
    
    setNewId(addNote(type, { x, y }));
  };

  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'notes' | 'stickers'

  return (
    <>
      {/* 3D Folder Dropdown Modal when Folder Dock Icon is clicked */}
      {isFolderOpen && (
        <div className="fixed inset-0 z-40 flex items-start justify-center pt-20 pb-12 px-4 bg-black/40 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
          <div className="relative w-full max-w-5xl bg-neutral-900/90 border border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
            {/* Header info bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-neutral-800 gap-4">
              <div className="flex items-center gap-3">
                {/* 3D Folder presentation */}
                <div className="relative group flex items-center justify-center">
                  <div className="file relative w-12 h-8 cursor-pointer origin-bottom [perspective:1500px]">
                    <div className="work-5 bg-amber-600 w-full h-full origin-top rounded-lg rounded-tl-none group-hover:shadow-[0_10px_20px_rgba(0,0,0,.3)] transition-all ease duration-300 relative after:absolute after:content-[''] after:bottom-[99%] after:left-0 after:w-4 after:h-1.5 after:bg-amber-600 after:rounded-t-lg before:absolute before:content-[''] before:-top-[6px] before:left-[15px] before:w-1.5 before:h-1.5 before:bg-amber-600 before:[clip-path:polygon(0_35%,0%_100%,50%_100%);]" />
                    <div className="work-4 absolute inset-0.5 bg-zinc-400 rounded-lg transition-all ease duration-300 origin-bottom select-none group-hover:[transform:rotateX(-20deg)]" />
                    <div className="work-3 absolute inset-0.5 bg-zinc-300 rounded-lg transition-all ease duration-300 origin-bottom group-hover:[transform:rotateX(-30deg)]" />
                    <div className="work-2 absolute inset-0.5 bg-zinc-200 rounded-lg transition-all ease duration-300 origin-bottom group-hover:[transform:rotateX(-38deg)]" />
                    <div className="work-1 absolute bottom-0 bg-gradient-to-t from-amber-500 to-amber-400 w-full h-7 rounded-lg rounded-tr-none transition-all ease duration-300 origin-bottom flex items-end group-hover:shadow-[inset_0_10px_20px_#fbbf24,_inset_0_-10px_20px_#d97706] group-hover:[transform:rotateX(-46deg)_translateY(1px)]" />
                  </div>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white tracking-tight">Notes & Stickers Collection</h3>
                  <p className="text-xs text-neutral-400">Click any card to add it to your board</p>
                </div>
              </div>

              {/* Category Filter Tabs */}
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-neutral-800/90 p-1 rounded-xl border border-neutral-700/60 text-xs">
                  <button
                    type="button"
                    onClick={() => setActiveTab('all')}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                      activeTab === 'all'
                        ? 'bg-amber-500 text-white shadow-sm'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    All ({Object.keys(types).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('notes')}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                      activeTab === 'notes'
                        ? 'bg-amber-500 text-white shadow-sm'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    Notes ({Object.values(types).filter(t => !t.isSticker).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('stickers')}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                      activeTab === 'stickers'
                        ? 'bg-amber-500 text-white shadow-sm'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    Stickers ✨ ({Object.values(types).filter(t => t.isSticker).length})
                  </button>
                </div>

                <button
                  type="button"
                  onClick={onCloseFolder}
                  className="w-8 h-8 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-300 flex items-center justify-center transition-colors cursor-pointer text-sm ml-2"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Note & Sticker Cards in the styled browser card container */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 pt-6 max-h-[65vh] overflow-y-auto pr-1">
              {Object.entries(types)
                .filter(([_, cfg]) => {
                  if (activeTab === 'notes') return !cfg.isSticker;
                  if (activeTab === 'stickers') return cfg.isSticker;
                  return true;
                })
                .map(([type, cfg], idx) => (
                <BlurFade key={type} delay={0.05 + idx * 0.03} inView>
                  <div
                    onClick={() => {
                      handleAdd(type);
                      onCloseFolder();
                    }}
                    className="group bg-white w-full h-64 rounded-lg flex flex-col cursor-pointer border border-neutral-200/80 shadow-md hover:shadow-2xl hover:-translate-y-1.5 transition-all duration-300 overflow-hidden"
                  >
                    <div className="flex p-2 gap-1.5 items-center border-b border-neutral-100 bg-neutral-50/50">
                      <div>
                        <span className="bg-blue-500 inline-block w-2.5 h-2.5 rounded-full"></span>
                      </div>
                      <div className="circle">
                        <span className="bg-purple-500 inline-block w-2.5 h-2.5 rounded-full"></span>
                      </div>
                      <div className="circle">
                        <span className="bg-pink-500 inline-block w-2.5 h-2.5 rounded-full"></span>
                      </div>
                      <span className="ml-auto text-[10px] uppercase font-semibold text-neutral-400 group-hover:text-amber-600 transition-colors">
                        + Add
                      </span>
                    </div>
                    <div className="card__content flex-1 p-2 flex items-center justify-center relative overflow-hidden bg-gradient-to-b from-transparent to-neutral-50/50">
                      <img
                        className="max-w-full max-h-full object-contain drop-shadow-sm group-hover:scale-105 transition-transform duration-300 pointer-events-none"
                        src={cfg.src}
                        alt={`Note ${type}`}
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/80 text-white text-xs font-semibold px-3 py-1 rounded-full shadow-md">
                          Add Note
                        </span>
                      </div>
                    </div>
                  </div>
                </BlurFade>
              ))}
            </div>
          </div>
        </div>
      )}



      {/* Floating interactive board layer */}
      <div className="board" ref={boardRef}>
        {loaded &&
          notes.map((note) => (
            <Note
              key={note.id}
              note={note}
              config={types[note.type] || Object.values(types)[0]}
              autoFocus={note.id === newId}
              onText={updateText}
              onMove={moveNote}
              onMoveTextArea={moveTextArea}
              onResizeTextArea={resizeTextArea}
              onRotateTextArea={rotateTextArea}
              onResize={resizeNote}
              onRotate={rotateNote}
              isNoteTransformActive={activeNoteTransformId === note.id}
              isTextTransformActive={activeTextTransformId === note.id}
              onToggleNoteTransform={onToggleNoteTransform}
              onToggleTextTransform={onToggleTextTransform}
              isPreviewActive={isPreviewActive}
              onDelete={removeNote}
              onFront={bringToFront}
            />
          ))}
      </div>
    </>
  );
};

export default NoteBoard;
