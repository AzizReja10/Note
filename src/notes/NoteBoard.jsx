import React from 'react'
import {useRef,useState } from "react";
import Note from './Note';
import{NOTE_TYPE} from './noteTypes';
import {useNotes} from './useNotes';
import{localStorageAdapter} from './storage';
const NoteBoard = ({types=NOTE_TYPE,storage=localStorageAdapter}) => {
    const boardRef=useRef(null);
    const [newId,setNewId]=useState(null);
    const{notes,loaded,addNote,updateText,moveNote,bringToFront,removeNote}=useNotes(storage);
    const handleAdd=()=>{
    const el=boardRef.current;
    const w=types[type].width;
    const x = Math.max(0, (el.clientWidth - w) / 2 + (Math.random() - 0.5) * 200);
    const y = Math.max(0, el.clientHeight * 0.2 + Math.random() * 120);
    setNewId(addNote(type, { x, y }));
    }
  return (
        <>
        <div className="note-picker">
            {Object.entries(types).map(([type,cfg])=>(
                <button
                key={type}
                type='button'
                className='note-picker-item'
                datatype={type}
                aria-label={`Add ${type.replace('-', ' ')} note`}
                onClick={()=>handleAdd(type)}
                >
                    <img src={cfg.src} alt="" />
                </button>
            ))}
        </div>
        <div className="board" ref={boardRef}>
            {
                loaded&&notes.map(note=>(
                    <Note
                    key={note.id}
                    note={note}
                     config={types[note.type]}
                     autoFocus={note.id===newId}
                     onText={updateText}
                     onMove={moveNote}
                     onDelete={removeNote}
                     onFront={bringToFront}
                    />
                ))
            }
        </div>
        </>
  )
}

export default NoteBoard