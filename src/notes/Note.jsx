import { memo, useRef } from 'react';

function Note({ note, config, autoFocus, onText, onMove, onFront, onDelete }) {
  const drag = useRef(null); // { offX, offY } while dragging, otherwise null
  const rootRef = useRef(null);

  function handlePointerDown(e) {
    // grab the paper only, not the textarea or the delete button
    if (e.target.closest('textarea, button')) return;
    onFront(note.id);
    drag.current = { offX: e.clientX - note.x, offY: e.clientY - note.y };
    e.currentTarget.setPointerCapture(e.pointerId);
    rootRef.current.classList.add('is-dragging');
  }

  function handlePointerMove(e) {
    if (!drag.current) return;
    onMove(note.id, e.clientX - drag.current.offX, e.clientY - drag.current.offY);
  }

  function endDrag() {
    drag.current = null;
    rootRef.current?.classList.remove('is-dragging');
  }

  return (
    <div
      ref={rootRef}
      className="note"
      data-type={note.type}
      style={{
        left: note.x,
        top: note.y,
        width: config.width,
        zIndex: note.z,
        transform: `rotate(${note.rotation}deg)`,
        '--note-inset': config.inset.map(v => `${v}%`).join(' '),
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <img className="note-paper" src={config.src} alt="" draggable={false} />

      <textarea
        className="note-text"
        placeholder="Write something..."
        aria-label="Note text"
        value={note.text}
        autoFocus={autoFocus}
        onChange={e => onText(note.id, e.target.value)}
        onFocus={() => onFront(note.id)}
      />

      <button
        type="button"
        className="note-delete"
        aria-label="Delete note"
        onClick={() => onDelete(note.id)}
      >
        ✕
      </button>
    </div>
  );
}

// memo: while one note is dragged or typed in, the others don't re-render
export default memo(Note);