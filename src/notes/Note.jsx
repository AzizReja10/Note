import { memo, useRef } from 'react';
import { useCharTags } from './useCharTags';

// Classes to style: .note  .note-paper  .note-text  .note-render  .note-input
//                   .ch  .ch-new  .note-delete  .is-dragging

function Note({
  note,
  config,
  autoFocus,
  onText,
  onMove,
  onMoveTextArea,
  isPreviewActive = false,
  onFront,
  onDelete,
}) {
  if (!config) return null;
  const drag = useRef(null); // { offX, offY } while dragging note
  const textDrag = useRef(null); // { startX, startY, initialOffsetX, initialOffsetY } while dragging textarea
  const rootRef = useRef(null);
  const renderRef = useRef(null); // the mirror layer that shows animated characters
  const chars = useCharTags(note.text);

  function handlePointerDown(e) {
    // grab the paper only, not the textarea, text-drag-handle, or the delete button
    if (e.target.closest('textarea, button, .text-drag-handle')) return;
    onFront(note.id);
    drag.current = { offX: e.clientX - note.x, offY: e.clientY - note.y };
    e.currentTarget.setPointerCapture(e.pointerId);
    rootRef.current.classList.add('is-dragging');
  }

  function handlePointerMove(e) {
    if (!drag.current) return;
    const rawX = e.clientX - drag.current.offX;
    const rawY = e.clientY - drag.current.offY;
    const noteWidth = config.width || 380;
    const maxNoteW = Math.min(noteWidth, window.innerWidth - 32);
    const maxX = Math.max(8, window.innerWidth - maxNoteW - 12);
    const maxY = Math.max(70, window.innerHeight - 120);
    const clampedX = Math.min(maxX, Math.max(8, rawX));
    const clampedY = Math.min(maxY, Math.max(60, rawY));
    onMove(note.id, clampedX, clampedY);
  }

  function endDrag() {
    drag.current = null;
    rootRef.current?.classList.remove('is-dragging');
  }

  // Dragging the textarea position directly within the note
  function handleTextDragStart(e) {
    e.stopPropagation();
    e.preventDefault();
    onFront(note.id);
    textDrag.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialOffsetX: note.textOffsetX || 0,
      initialOffsetY: note.textOffsetY || 0,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handleTextDragMove(e) {
    if (!textDrag.current) return;
    const dx = e.clientX - textDrag.current.startX;
    const dy = e.clientY - textDrag.current.startY;
    const newOffsetX = textDrag.current.initialOffsetX + dx;
    const newOffsetY = textDrag.current.initialOffsetY + dy;
    if (onMoveTextArea) {
      onMoveTextArea(note.id, Math.round(newOffsetX), Math.round(newOffsetY));
    }
  }

  function handleTextDragEnd() {
    textDrag.current = null;
  }

  const customTextTransform =
    (note.textOffsetX || note.textOffsetY)
      ? `translate3d(${note.textOffsetX || 0}px, ${note.textOffsetY || 0}px, 0)`
      : undefined;

  // Responsive width & centered clamping for rendering
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
  const noteWidth = config.width || 380;
  // If on mobile / narrow screen, ensure note width fits cleanly within the screen
  const renderedWidth = isMobile ? Math.min(noteWidth, (window.innerWidth || 360) - 32) : noteWidth;
  
  // Calculate horizontal position:
  let renderLeft = note.x;
  if (typeof window !== 'undefined') {
    if (isMobile) {
      // Always keep centered on small screens / mobile
      renderLeft = Math.max(16, Math.round((window.innerWidth - renderedWidth) / 2));
    } else {
      const maxX = Math.max(16, window.innerWidth - renderedWidth - 16);
      renderLeft = Math.min(maxX, Math.max(16, note.x));
    }
  }

  return (
    <div
      ref={rootRef}
      className="note"
      data-type={note.type}
      style={{
        left: renderLeft,
        top: note.y,
        width: renderedWidth,
        zIndex: note.z,
        transform: `rotate(${note.rotation}deg)`,
        '--note-inset': config.inset.map((v) => `${v}%`).join(' '),
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <img className="note-paper" src={config.src} alt="" draggable={false} />

      {/* Textarea positioning wrapper */}
      <div
        className={`note-text-container ${isPreviewActive ? 'is-preview-active' : ''}`}
        style={{
          transform: customTextTransform,
        }}
      >
        {/* Draggable move badge displayed when preview mode is on */}
        {isPreviewActive && (
          <div
            className="text-drag-handle"
            title="Drag to position text on note"
            onPointerDown={handleTextDragStart}
            onPointerMove={handleTextDragMove}
            onPointerUp={handleTextDragEnd}
            onPointerCancel={handleTextDragEnd}
          >
            <span>✥ Drag Text</span>
          </div>
        )}

        {/* layer 1 (visible): one <span> per character, new ones animate */}
        <div ref={renderRef} className="note-text note-render" aria-hidden="true">
          {chars.map((ch) => (
            <span key={ch.id} className={ch.fresh ? 'ch ch-new' : 'ch'}>
              {ch.c}
            </span>
          ))}
          {'\u200b'}
        </div>

        {/* layer 2 (on top): real textarea, transparent text, handles all input */}
        <textarea
          className="note-text note-input"
          placeholder="Write something..."
          aria-label="Note text"
          value={note.text}
          autoFocus={autoFocus}
          onChange={(e) => onText(note.id, e.target.value)}
          onFocus={() => onFront(note.id)}
          onScroll={(e) => {
            if (renderRef.current) renderRef.current.scrollTop = e.target.scrollTop;
          }}
        />
      </div>

      <button
        type="button"
        className="note-delete"
        aria-label="Delete note"
        data-html2canvas-ignore="true"
        onClick={() => onDelete(note.id)}
      >
        ✕
      </button>
    </div>
  );
}

// memo: while one note is dragged or typed in, the others don't re-render
export default memo(Note);