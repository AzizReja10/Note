import { memo, useEffect, useRef, useState } from 'react';
import { useCharTags } from './useCharTags';
import { annotate } from 'rough-notation';

// Classes to style: .note  .note-paper  .note-text  .note-render  .note-input
//                   .ch  .ch-new  .note-delete  .is-dragging

function Note({
  note,
  config,
  autoFocus,
  onText,
  onMove,
  onMoveTextArea,
  onResizeTextArea,
  onRotateTextArea,
  onResize,
  onRotate,
  isNoteTransformActive = false,
  isTextTransformActive = false,
  onToggleNoteTransform,
  onToggleTextTransform,
  isPreviewActive = false,
  onFront,
  onDelete,
  onSelectNote,
  isHighlighterActive = false,
  highlighterColor = '#facc15',
  highlighterType = 'highlight',
  highlighterMode = 'draw', // 'draw' | 'eraser'
  onAddHighlight,
  onRemoveHighlight,
  onClearHighlights,
}) {
  if (!config) return null;
  const [isFocused, setIsFocused] = useState(false);
  const [isSelected, setIsSelected] = useState(false);
  const drag = useRef(null); // { offX, offY } while dragging note
  const textDrag = useRef(null); // { startX, startY, initialOffsetX, initialOffsetY } while dragging textarea
  const textResizeDrag = useRef(null);
  const textRotateDrag = useRef(null);
  const textContainerRef = useRef(null);
  const resizeDrag = useRef(null);
  const rotateDrag = useRef(null);
  const rootRef = useRef(null);
  const renderRef = useRef(null); // the mirror layer that shows animated characters
  const chars = useCharTags(note.text, note.textColor || '#3a3a3a');

  // Unselect when clicking outside this note
  useEffect(() => {
    function handleGlobalPointerDown(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setIsSelected(false);
      }
    }
    window.addEventListener('pointerdown', handleGlobalPointerDown);
    return () => window.removeEventListener('pointerdown', handleGlobalPointerDown);
  }, []);

  function handleNotePointerDown(e) {
    // If clicking inside textarea, buttons, or controls, do not trigger note drag or note transform
    if (e.target.closest('textarea, button, .text-drag-handle, .text-control-handle, .note-control-handle')) return;

    onFront(note.id);
    setIsSelected(true);
    if (onSelectNote) onSelectNote(note.id);
    drag.current = { offX: e.clientX - note.x, offY: e.clientY - note.y };
    e.currentTarget.setPointerCapture(e.pointerId);
    rootRef.current.classList.add('is-dragging');
  }

  function handleNoteDoubleClick(e) {
    if (e.target.closest('textarea, button, .text-drag-handle, .text-control-handle, .note-control-handle')) return;
    e.stopPropagation();
    e.preventDefault();
    onFront(note.id);
    setIsSelected(true);
    if (onSelectNote) onSelectNote(note.id);
    if (onToggleNoteTransform) {
      onToggleNoteTransform(note.id);
    }
  }

  // Highlight drawing state
  const isHighlightDrawing = useRef(false);
  const highlightStartCharIndex = useRef(null);
  const [activeHighlightRange, setActiveHighlightRange] = useState(null); // { start, end }
  const annotationsRef = useRef([]); // holds active rough-notation instances

  // Re-render Rough Annotations whenever note.highlights, note.text, or size changes
  useEffect(() => {
    // Clear old rough-notation instances
    annotationsRef.current.forEach((ann) => {
      try {
        ann.remove();
      } catch (err) {
        // ignore
      }
    });
    annotationsRef.current = [];

    if (!note.highlights || note.highlights.length === 0 || !renderRef.current) return;

    // For each saved highlight, find the start and end span, wrap in an annotation-wrapper span, and attach annotate()
    const spans = Array.from(renderRef.current.querySelectorAll('.note-char-span'));
    if (spans.length === 0) return;

    note.highlights.forEach((hl) => {
      const startIndex = Math.max(0, Math.min(spans.length - 1, hl.startIndex));
      const endIndex = Math.max(0, Math.min(spans.length - 1, hl.endIndex));
      if (startIndex > endIndex) return;

      const rangeSpans = spans.slice(startIndex, endIndex + 1);
      if (rangeSpans.length === 0) return;

      // Group consecutive spans on each visual line to annotate cleanly
      // Or annotate the first and last span to highlight individual words/lines
      // To ensure text is fully visible, we create an inline wrapper around the highlighted character group
      try {
        // Group by line: detect line wraps by comparing rect top
        let currentLine = [rangeSpans[0]];
        const lines = [currentLine];

        for (let i = 1; i < rangeSpans.length; i++) {
          const prevRect = rangeSpans[i - 1].getBoundingClientRect();
          const currRect = rangeSpans[i].getBoundingClientRect();
          // If vertical difference is greater than 10px, it wrapped to the next line
          if (Math.abs(currRect.top - prevRect.top) > 10) {
            currentLine = [rangeSpans[i]];
            lines.push(currentLine);
          } else {
            currentLine.push(rangeSpans[i]);
          }
        }

        lines.forEach((lineSpans) => {
          const first = lineSpans[0];
          const last = lineSpans[lineSpans.length - 1];

          const parentRect = renderRef.current.getBoundingClientRect();
          const firstRect = first.getBoundingClientRect();
          const lastRect = last.getBoundingClientRect();

          const targetEl = document.createElement('span');
          targetEl.className = 'rough-target-span';
          targetEl.style.position = 'absolute';
          // Neatly sized target element tightly matching character bounds
          targetEl.style.top = `${firstRect.top - parentRect.top}px`;
          targetEl.style.left = `${firstRect.left - parentRect.left - 1}px`;
          targetEl.style.width = `${Math.max(8, lastRect.right - firstRect.left + 2)}px`;
          targetEl.style.height = `${Math.max(14, Math.max(firstRect.height, lastRect.height))}px`;

          renderRef.current.appendChild(targetEl);

          // For highlight type, use semi-transparent rgba or pastel colors so letters are 100% visible
          let hlColor = hl.color || '#fde047';
          // If it's a 6-digit hex color, convert to 65% opacity rgba for highlight background
          if (hl.type === 'highlight' && hlColor.startsWith('#') && hlColor.length === 7) {
            const r = parseInt(hlColor.slice(1, 3), 16);
            const g = parseInt(hlColor.slice(3, 5), 16);
            const b = parseInt(hlColor.slice(5, 7), 16);
            hlColor = `rgba(${r}, ${g}, ${b}, 0.65)`;
          }

          const ann = annotate(targetEl, {
            type: hl.type || 'highlight',
            color: hlColor,
            animate: false,
            multiline: false,
            padding: hl.type === 'highlight' ? [1, 3] : [0, 2],
            strokeWidth: hl.type === 'highlight' ? 1.5 : 2,
            iterations: 1, // Single crisp iteration avoids giant slanted stacked blocks
          });
          ann.show();

          annotationsRef.current.push({
            remove: () => {
              try {
                ann.remove();
              } catch (e) {}
              if (targetEl.parentNode) targetEl.parentNode.removeChild(targetEl);
            },
          });
        });
      } catch (err) {
        console.error('Error creating rough-notation annotation:', err);
      }
    });

    return () => {
      annotationsRef.current.forEach((ann) => {
        try {
          ann.remove();
        } catch (err) {
          // ignore
        }
      });
      annotationsRef.current = [];
    };
  }, [note.highlights, note.text, note.width, note.textWidth, note.textHeight]);

  // Helper to find char index from coordinates within renderRef
  const getCharIndexFromPoint = (clientX, clientY) => {
    if (!renderRef.current) return -1;
    const spans = Array.from(renderRef.current.querySelectorAll('.note-char-span'));
    if (spans.length === 0) return -1;

    // Check closest span by Euclidean distance
    let closestIndex = -1;
    let minDistance = Infinity;

    for (let i = 0; i < spans.length; i++) {
      const rect = spans[i].getBoundingClientRect();
      // Check if point is inside this character rect
      if (
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom
      ) {
        return i;
      }
      // Calculate distance to center
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const dist = Math.hypot(clientX - centerX, clientY - centerY);
      if (dist < minDistance) {
        minDistance = dist;
        closestIndex = i;
      }
    }

    return minDistance < 40 ? closestIndex : -1;
  };

  // Highlighter Pen Pointer Event Handlers
  // Highlighter Pen / Eraser Pointer Event Handlers
  const handleHighlighterPointerDown = (e) => {
    e.stopPropagation();
    e.preventDefault();
    onFront(note.id);
    setIsSelected(true);
    if (onSelectNote) onSelectNote(note.id);

    const charIndex = getCharIndexFromPoint(e.clientX, e.clientY);
    if (charIndex !== -1) {
      if (highlighterMode === 'eraser') {
        // Find if this character is within any highlight and remove it immediately
        if (note.highlights && note.highlights.length > 0) {
          const hitHighlight = note.highlights.find(
            (hl) => charIndex >= hl.startIndex && charIndex <= hl.endIndex
          );
          if (hitHighlight && onRemoveHighlight) {
            onRemoveHighlight(note.id, hitHighlight.id);
          }
        }
        isHighlightDrawing.current = true;
        highlightStartCharIndex.current = charIndex;
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }

      isHighlightDrawing.current = true;
      highlightStartCharIndex.current = charIndex;
      setActiveHighlightRange({ start: charIndex, end: charIndex });
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  };

  const handleHighlighterPointerMove = (e) => {
    if (!isHighlightDrawing.current) return;
    const charIndex = getCharIndexFromPoint(e.clientX, e.clientY);
    if (charIndex !== -1) {
      if (highlighterMode === 'eraser') {
        // Erase any highlight that the eraser crosses over while moving
        if (note.highlights && note.highlights.length > 0) {
          const hitHighlight = note.highlights.find(
            (hl) => charIndex >= hl.startIndex && charIndex <= hl.endIndex
          );
          if (hitHighlight && onRemoveHighlight) {
            onRemoveHighlight(note.id, hitHighlight.id);
          }
        }
        return;
      }

      const start = Math.min(highlightStartCharIndex.current, charIndex);
      const end = Math.max(highlightStartCharIndex.current, charIndex);
      setActiveHighlightRange({ start, end });
    }
  };

  const handleHighlighterPointerUp = (e) => {
    if (!isHighlightDrawing.current) return;
    isHighlightDrawing.current = false;

    if (highlighterMode === 'eraser') {
      highlightStartCharIndex.current = null;
      return;
    }

    if (activeHighlightRange && activeHighlightRange.start !== -1) {
      let startIndex = activeHighlightRange.start;
      let endIndex = activeHighlightRange.end;

      // If user simply clicked on a word without dragging, expand to highlight the whole word or character
      if (startIndex === endIndex && note.text) {
        const text = note.text;
        // Expand left to start of word
        while (startIndex > 0 && !/\s/.test(text[startIndex - 1])) {
          startIndex--;
        }
        // Expand right to end of word
        while (endIndex < text.length - 1 && !/\s/.test(text[endIndex + 1])) {
          endIndex++;
        }
      }

      if (onAddHighlight) {
        onAddHighlight(note.id, {
          id: crypto.randomUUID(),
          startIndex,
          endIndex,
          color: highlighterColor || '#fde047',
          type: highlighterType || 'highlight', // Rough highlight
          createdAt: Date.now(),
        });
      }
    }

    setActiveHighlightRange(null);
    highlightStartCharIndex.current = null;
  };

  // Double-click specifically on textarea: toggles textarea rotate/resize without selecting text
  function handleTextareaPointerDown(e) {
    if (isHighlighterActive) {
      handleHighlighterPointerDown(e);
      return;
    }
    onFront(note.id);
    setIsSelected(true);
    if (onSelectNote) onSelectNote(note.id);
  }

  function handleTextareaDoubleClick(e) {
    if (isHighlighterActive) return;
    e.preventDefault();
    e.stopPropagation();
    // Remove browser default double-click text highlight
    if (window.getSelection) {
      window.getSelection().removeAllRanges();
    }
    onFront(note.id);
    setIsSelected(true);
    if (onSelectNote) onSelectNote(note.id);
    if (onToggleTextTransform) {
      onToggleTextTransform(note.id);
    }
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

  // Textarea resize handler (drag bottom-right corner of text box)
  function handleTextResizeStart(e) {
    e.stopPropagation();
    e.preventDefault();
    onFront(note.id);
    setIsSelected(true);
    const rect = textContainerRef.current?.getBoundingClientRect();
    textResizeDrag.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialWidth: rect ? rect.width : (note.textWidth || 200),
      initialHeight: rect ? rect.height : (note.textHeight || 150),
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handleTextResizeMove(e) {
    if (!textResizeDrag.current || !onResizeTextArea) return;
    const dx = e.clientX - textResizeDrag.current.startX;
    const dy = e.clientY - textResizeDrag.current.startY;
    const nextW = Math.max(90, Math.round(textResizeDrag.current.initialWidth + dx));
    const nextH = Math.max(50, Math.round(textResizeDrag.current.initialHeight + dy));
    onResizeTextArea(note.id, nextW, nextH);
  }

  function handleTextResizeEnd() {
    textResizeDrag.current = null;
  }

  // Textarea rotation handler (drag top handle of text box)
  function handleTextRotateStart(e) {
    e.stopPropagation();
    e.preventDefault();
    onFront(note.id);
    setIsSelected(true);
    const rect = textContainerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const initialAngle = (Math.atan2(e.clientY - centerY, e.clientX - centerX) * 180) / Math.PI;
    textRotateDrag.current = {
      centerX,
      centerY,
      initialAngle,
      initialRotation: note.textRotation || 0,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handleTextRotateMove(e) {
    if (!textRotateDrag.current || !onRotateTextArea) return;
    const { centerX, centerY, initialAngle, initialRotation } = textRotateDrag.current;
    const currentAngle = (Math.atan2(e.clientY - centerY, e.clientX - centerX) * 180) / Math.PI;
    let nextRotation = initialRotation + (currentAngle - initialAngle);
    if (Math.abs(nextRotation) < 3) nextRotation = 0;
    onRotateTextArea(note.id, Math.round(nextRotation * 10) / 10);
  }

  function handleTextRotateEnd() {
    textRotateDrag.current = null;
  }

  // Resizing handler (drag bottom-right corner)
  function handleResizeStart(e) {
    e.stopPropagation();
    e.preventDefault();
    onFront(note.id);
    setIsSelected(true);
    const rect = rootRef.current?.getBoundingClientRect();
    const currentW = note.width || config.width || 380;
    resizeDrag.current = {
      startX: e.clientX,
      initialWidth: currentW,
      // store center of note to calculate projected diagonal distance if rotated
      centerX: rect ? rect.left + rect.width / 2 : note.x + currentW / 2,
      centerY: rect ? rect.top + rect.height / 2 : note.y + 150,
      initialDist: rect ? Math.hypot(e.clientX - (rect.left + rect.width / 2), e.clientY - (rect.top + rect.height / 2)) : 1,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handleResizeMove(e) {
    if (!resizeDrag.current || !onResize) return;
    const { centerX, centerY, initialDist, initialWidth } = resizeDrag.current;
    const currentDist = Math.hypot(e.clientX - centerX, e.clientY - centerY);
    const scale = currentDist / (initialDist || 1);
    const nextW = Math.round(initialWidth * scale);
    const clampedW = Math.max(140, Math.min(900, nextW));
    onResize(note.id, clampedW);
  }

  function handleResizeEnd() {
    resizeDrag.current = null;
  }

  // Rotation handler (drag top rotation handle or header)
  function handleRotateStart(e) {
    e.stopPropagation();
    e.preventDefault();
    onFront(note.id);
    setIsSelected(true);
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const initialPointerAngle = (Math.atan2(e.clientY - centerY, e.clientX - centerX) * 180) / Math.PI;
    rotateDrag.current = {
      centerX,
      centerY,
      initialPointerAngle,
      initialRotation: note.rotation || 0,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handleRotateMove(e) {
    if (!rotateDrag.current || !onRotate) return;
    const { centerX, centerY, initialPointerAngle, initialRotation } = rotateDrag.current;
    const currentAngle = (Math.atan2(e.clientY - centerY, e.clientX - centerX) * 180) / Math.PI;
    const deltaAngle = currentAngle - initialPointerAngle;
    let nextRotation = initialRotation + deltaAngle;
    // Snap to 0 deg if within ±3 degrees
    if (Math.abs(nextRotation) < 3) nextRotation = 0;
    onRotate(note.id, Math.round(nextRotation * 10) / 10);
  }

  function handleRotateEnd() {
    rotateDrag.current = null;
  }

  const textTransformParts = [];
  if (note.textOffsetX || note.textOffsetY) {
    textTransformParts.push(`translate3d(${note.textOffsetX || 0}px, ${note.textOffsetY || 0}px, 0)`);
  }
  if (note.textRotation) {
    textTransformParts.push(`rotate(${note.textRotation}deg)`);
  }
  const customTextTransform = textTransformParts.length > 0 ? textTransformParts.join(' ') : undefined;

  const customTextSizeStyle = {
    ...(note.textWidth ? { width: `${note.textWidth}px` } : {}),
    ...(note.textHeight ? { height: `${note.textHeight}px` } : {}),
  };

  // Responsive width & centered clamping for rendering
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
  const noteWidth = note.width || config.width || 380;
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

  const textareaRef = useRef(null);

  // Dynamic max characters calculation based on actual width & height of the text area
  // Font is Patrick Hand 22px / line-height 1.5 (33px per line).
  // Characters average ~9.5px in width.
  const effectiveTextW = note.textWidth || Math.round(renderedWidth * (1 - (config.inset[1] + config.inset[3]) / 100));
  const effectiveTextH = note.textHeight || Math.round((config.height || (renderedWidth * 0.9)) * (1 - (config.inset[0] + config.inset[2]) / 100));
  
  // Calculate character limit: lines * chars_per_line * safety factor (0.92) to guarantee no overflow
  const charsPerLine = Math.max(8, Math.floor(effectiveTextW / 10.5));
  const visibleLines = Math.max(2, Math.floor(effectiveTextH / 32));
  const maxCharLimit = Math.max(30, Math.floor(charsPerLine * visibleLines * 0.92));

  function handleTextChange(e) {
    const val = e.target.value;
    const el = e.target;
    
    // Check both character count limit and physical scroll height overflow
    if (val.length > maxCharLimit && val.length > (note.text?.length || 0)) {
      return; // prevent exceeding character limit
    }
    
    // Check if adding this text would cause textarea content to overflow vertically
    if (el.scrollHeight > el.clientHeight + 4 && val.length > (note.text?.length || 0)) {
      return;
    }

    onText(note.id, val);
  }

  const [isDeleting, setIsDeleting] = useState(false);
  const [disintegrateStyle, setDisintegrateStyle] = useState(null);

  function handleDelete(e) {
    e.stopPropagation();
    if (isDeleting) return;

    // Trigger dustbin active shake
    window.dispatchEvent(new CustomEvent('dustbin-activate'));

    // Get note coordinates and bottom-right dustbin coordinates
    const rect = rootRef.current?.getBoundingClientRect();
    const dustbinEl = document.querySelector('.dustbin-container');
    const dustbinRect = dustbinEl?.getBoundingClientRect() || {
      left: window.innerWidth - 80,
      top: window.innerHeight - 80,
      width: 72,
      height: 72,
    };

    const noteCenterX = rect ? rect.left + rect.width / 2 : renderLeft + renderedWidth / 2;
    const noteCenterY = rect ? rect.top + rect.height / 2 : note.y + 150;
    const binCenterX = dustbinRect.left + dustbinRect.width / 2;
    const binCenterY = dustbinRect.top + dustbinRect.height / 2;

    const dx = binCenterX - noteCenterX;
    const dy = binCenterY - noteCenterY;

    // Create 85+ floating luminous dust particles covering the note surface
    // They burst outward with organic drift & glow, then smoothly swoop along a natural arc into the dustbin
    const colors = [
      '#f59e0b', '#fbbf24', '#fef08a', '#fde047',
      '#fdba74', '#fb923c', '#f87171', '#f472b6',
      '#e5e7eb', '#ffffff'
    ];
    const noteW = rect?.width || 240;
    const noteH = rect?.height || 200;
    const totalParticles = 85;

    for (let i = 0; i < totalParticles; i++) {
      const p = document.createElement('div');
      p.className = 'dust-particle';
      const size = Math.random() * 6.5 + 2.5;

      // Organic radial scatter: angle + Gaussian-like distribution
      const angle = Math.random() * Math.PI * 2;
      const radius = 25 + Math.pow(Math.random(), 0.75) * (noteW * 0.7);
      const scatterX = Math.cos(angle) * radius;
      // Slight buoyant upward bias during the scatter hover
      const scatterY = Math.sin(angle) * radius - (15 + Math.random() * 25);

      // Evenly distributed origin positions across note face
      const startX = (rect?.left || noteCenterX) + (Math.random() * noteW);
      const startY = (rect?.top || noteCenterY) + (Math.random() * noteH);
      const pEndX = binCenterX - startX;
      const pEndY = binCenterY - startY;

      // Dynamic curve midpoint: arch upward and outward slightly for a graceful fluid swoop
      const midCurveX = scatterX * 0.5 + pEndX * 0.45 + (Math.random() * 40 - 20);
      const midCurveY = scatterY * 0.5 + pEndY * 0.35 - (40 + Math.random() * 50);

      // Staggered durations for natural fluid streaming
      const duration = 2.3 + (i / totalParticles) * 0.3 + (Math.random() * 0.15 - 0.075);
      const delay = Math.random() * 0.08;

      p.style.width = `${size}px`;
      p.style.height = `${size}px`;
      p.style.left = `${startX}px`;
      p.style.top = `${startY}px`;
      p.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      p.style.boxShadow = `0 0 ${Math.round(size * 1.5)}px ${colors[Math.floor(Math.random() * colors.length)]}`;
      p.style.animationDelay = `${delay}s`;
      p.style.setProperty('--dust-dur', `${duration}s`);
      p.style.setProperty('--p-scatter-x', `${scatterX}px`);
      p.style.setProperty('--p-scatter-y', `${scatterY}px`);
      p.style.setProperty('--p-mid-x', `${midCurveX}px`);
      p.style.setProperty('--p-mid-y', `${midCurveY}px`);
      p.style.setProperty('--p-dx-end', `${pEndX}px`);
      p.style.setProperty('--p-dy-end', `${pEndY}px`);

      document.body.appendChild(p);
      setTimeout(() => p.remove(), (duration + delay) * 1000 + 150);
    }

    setDisintegrateStyle({
      '--target-dx': `${Math.round(dx * 0.9)}px`,
      '--target-dy': `${Math.round(dy * 0.9)}px`,
    });
    setIsDeleting(true);

    // Remove from note store after 2.6s (1.4s in-place disintegration + 1.2s smooth fluid flight into dustbin)
    setTimeout(() => {
      onDelete(note.id);
    }, 2600);
  }

  return (
    <div
      ref={rootRef}
      className={`note ${isSelected ? 'is-selected' : ''} ${isFocused ? 'is-focused' : ''} ${isNoteTransformActive ? 'is-transforming' : ''} ${isDeleting ? 'is-disintegrating' : ''}`}
      data-type={note.type}
      style={{
        left: renderLeft,
        top: note.y,
        width: renderedWidth,
        zIndex: isDeleting ? 9999 : (isNoteTransformActive || isTextTransformActive ? 9990 : note.z),
        transform: `rotate(${note.rotation}deg)`,
        '--note-inset': config.inset.map((v) => `${v}%`).join(' '),
        ...(disintegrateStyle || {}),
      }}
      onPointerDown={handleNotePointerDown}
      onDoubleClick={handleNoteDoubleClick}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <img className="note-paper" src={config.src} alt="" draggable={false} />

      {/* Textarea positioning wrapper */}
      <div
        ref={textContainerRef}
        className={`note-text-container ${isPreviewActive ? 'is-preview-active' : ''} ${isTextTransformActive ? 'is-text-transforming' : ''}`}
        style={{
          transform: customTextTransform,
          ...customTextSizeStyle,
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

        {/* Dedicated textarea rotation and resize handles active ONLY on double-click on textarea */}
        {isTextTransformActive && (
          <>
            <div
              className="text-control-handle text-rotate-handle"
              title="Drag to rotate text area"
              data-html2canvas-ignore="true"
              onPointerDown={handleTextRotateStart}
              onPointerMove={handleTextRotateMove}
              onPointerUp={handleTextRotateEnd}
              onPointerCancel={handleTextRotateEnd}
            >
              <div className="text-rotate-line" />
              <div className="text-rotate-btn">
                <svg viewBox="0 0 24 24" width="10" height="10" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                  <path d="M21 3v5h-5" />
                </svg>
              </div>
            </div>

            <div
              className="text-control-handle text-resize-handle"
              title="Drag corner to resize text area"
              data-html2canvas-ignore="true"
              onPointerDown={handleTextResizeStart}
              onPointerMove={handleTextResizeMove}
              onPointerUp={handleTextResizeEnd}
              onPointerCancel={handleTextResizeEnd}
            >
              <svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor">
                <circle cx="18" cy="18" r="2.2" />
                <circle cx="11" cy="18" r="2.2" />
                <circle cx="18" cy="11" r="2.2" />
              </svg>
            </div>
          </>
        )}

        {/* layer 1 (visible): one <span> per character, new ones animate, individual colors preserved */}
        <div
          ref={renderRef}
          className="note-text note-render"
          style={note.fontFamily ? { fontFamily: note.fontFamily } : undefined}
          aria-hidden="true"
        >
          {chars.map((ch, idx) => {
            const isPreviewHighlighted =
              activeHighlightRange &&
              idx >= activeHighlightRange.start &&
              idx <= activeHighlightRange.end;

            return (
              <span
                key={ch.id}
                data-char-index={idx}
                className={`note-char-span ${ch.fresh ? 'ch ch-new' : 'ch'} ${isPreviewHighlighted ? 'is-preview-highlight' : ''}`}
                style={{
                  ...(ch.color ? { color: ch.color } : {}),
                  ...(isPreviewHighlighted ? { backgroundColor: `${highlighterColor}77`, borderRadius: '3px' } : {}),
                }}
              >
                {ch.c}
              </span>
            );
          })}
          {'\u200b'}
        </div>

        {/* layer 2 (on top): real textarea, transparent text, handles all input */}
        <textarea
          ref={textareaRef}
          className={`note-text note-input ${isHighlighterActive ? (highlighterMode === 'eraser' ? 'is-eraser-mode' : 'is-highlighter-mode') : ''}`}
          style={note.fontFamily ? { fontFamily: note.fontFamily } : undefined}
          spellCheck="false"
          autoCorrect="off"
          autoCapitalize="off"
          aria-label="Note text"
          value={note.text}
          maxLength={maxCharLimit}
          autoFocus={autoFocus}
          onChange={handleTextChange}
          onPointerDown={handleTextareaPointerDown}
          onPointerMove={isHighlighterActive ? handleHighlighterPointerMove : undefined}
          onPointerUp={isHighlighterActive ? handleHighlighterPointerUp : undefined}
          onPointerCancel={isHighlighterActive ? handleHighlighterPointerUp : undefined}
          onDoubleClick={handleTextareaDoubleClick}
          onFocus={() => {
            setIsFocused(true);
            onFront(note.id);
          }}
          onBlur={() => setIsFocused(false)}
          onScroll={(e) => {
            if (renderRef.current) renderRef.current.scrollTop = e.target.scrollTop;
          }}
        />
      </div>

      {/* Small green radio button indicator pinned fixed above the note paper when user is typing */}
      {isFocused && (
        <div
          className="note-typing-indicator"
          title="Typing active"
          data-html2canvas-ignore="true"
        >
          <span className="note-typing-ring" />
          <span className="note-typing-dot" />
        </div>
      )}

      {/* Clear highlights button if note has active highlights */}
      {note.highlights && note.highlights.length > 0 && isSelected && (
        <button
          type="button"
          className="note-clear-highlights-btn"
          title="Eraser: Clear all highlights on this note"
          data-html2canvas-ignore="true"
          onClick={(e) => {
            e.stopPropagation();
            if (onClearHighlights) onClearHighlights(note.id);
          }}
        >
          🧹 Clear Highlight
        </button>
      )}

      <button
        type="button"
        className="note-delete"
        aria-label="Delete note"
        data-html2canvas-ignore="true"
        onClick={handleDelete}
      >
        ✕
      </button>

      {/* Note Rotation and Resizing handles rendered ONLY when Note paper is double-clicked */}
      {isNoteTransformActive && (
        <>
          {/* Rotation handle floating above top-center of note */}
          <div
            className="note-control-handle note-rotate-handle"
            title="Drag to rotate note (Hold and move mouse)"
            data-html2canvas-ignore="true"
            onPointerDown={handleRotateStart}
            onPointerMove={handleRotateMove}
            onPointerUp={handleRotateEnd}
            onPointerCancel={handleRotateEnd}
          >
            <div className="note-rotate-line" />
            <div className="note-rotate-btn">
              <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
              </svg>
            </div>
          </div>

          {/* Resizing handle on the bottom-right corner of note */}
          <div
            className="note-control-handle note-resize-handle"
            title="Drag corner to resize note"
            data-html2canvas-ignore="true"
            onPointerDown={handleResizeStart}
            onPointerMove={handleResizeMove}
            onPointerUp={handleResizeEnd}
            onPointerCancel={handleResizeEnd}
          >
            <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
              <circle cx="19" cy="19" r="2" />
              <circle cx="13" cy="19" r="2" />
              <circle cx="19" cy="13" r="2" />
              <circle cx="7" cy="19" r="2" />
              <circle cx="13" cy="13" r="2" />
              <circle cx="19" cy="7" r="2" />
            </svg>
          </div>
        </>
      )}
    </div>
  );
}

// memo: while one note is dragged or typed in, the others don't re-render
export default memo(Note);