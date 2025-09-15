'use client'
import React, { useEffect, useRef, useState } from 'react'
import * as Tone from 'tone'
import { writeMidi } from '../lib/midi'


// Types for notes
type Note = { id: string; tick: number; length: number; midi: number; vel: number }


const PPQ = 480 // ticks per quarter for MIDI export
const BPM = 120


export default function PianoRoll() {
    const canvasRef = useRef<HTMLCanvasElement | null>(null)
    const [notes, setNotes] = useState<Note[]>([])
    const [cursorTick, setCursorTick] = useState(0)
    const [isPlaying, setIsPlaying] = useState(false)
    const [zoom, setZoom] = useState(1) // 1 = 4 bars visible
    const [selectedInstrument, setSelectedInstrument] = useState('piano')
    const synthRef = useRef<Tone.PolySynth | Tone.Sampler | null>(null)
    const timelineRef = useRef<number | null>(null)
    const selectedRef = useRef<string | null>(null)
    const dragInfo = useRef<{
        isDragging: boolean;
        isResizing: boolean;
        noteId: string;
        startX: number;
        startY: number;
        originalTick: number;
        originalMidi: number;
        originalLength: number;
    } | null>(null)
    const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set())
    const [samplesLoaded, setSamplesLoaded] = useState(false)
    const fileInputRef = useRef<HTMLInputElement | null>(null)
    
    // Available instruments
    const instruments = {
        piano: () => {
            // Create an enhanced piano using FMSynth for richer harmonics
            const piano = new Tone.PolySynth(Tone.FMSynth, {
                harmonicity: 2.5,
                modulationIndex: 12,
                oscillator: {
                    type: 'triangle'
                },
                envelope: {
                    attack: 0.01,
                    decay: 0.5,
                    sustain: 0.4,
                    release: 2.5
                },
                modulation: {
                    type: 'sine'
                },
                modulationEnvelope: {
                    attack: 0.008,
                    decay: 0.2,
                    sustain: 0.3,
                    release: 1.5
                }
            })
            
            // High-quality reverb for natural ambience
            const reverb = new Tone.Reverb({
                decay: 2.2,
                wet: 0.3
            })
            
            // Subtle compression for consistency  
            const compressor = new Tone.Compressor({
                threshold: -18,
                ratio: 2.5,
                attack: 0.005,
                release: 0.15
            })
            
            // EQ for piano character
            const eq = new Tone.EQ3({
                low: 1.5,
                mid: 0.5,
                high: -0.5
            })
            
            // Chorus for richness
            const chorus = new Tone.Chorus({
                frequency: 2,
                delayTime: 2.5,
                depth: 0.3,
                wet: 0.15
            })
            
            // Connect effects chain
            piano.connect(compressor)
            compressor.connect(chorus)
            chorus.connect(eq)  
            eq.connect(reverb)
            reverb.toDestination()
            
            // Mark as loaded immediately since no external samples needed
            setTimeout(() => setSamplesLoaded(true), 100)
            
            return piano
        },
        guitar: () => new Tone.PolySynth(Tone.Synth).set({
            oscillator: { type: 'sawtooth' },
            envelope: { attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.8 }
        }),
        bass: () => {
            const bass = new Tone.PolySynth(Tone.Synth).set({
                oscillator: { type: 'square' },
                envelope: { attack: 0.1, decay: 0.3, sustain: 0.4, release: 1.2 }
            })
            
            const bassFilter = new Tone.Filter({
                type: 'lowpass',
                frequency: 300,
                rolloff: -12
            })
            
            bass.connect(bassFilter)
            bassFilter.toDestination()
            
            return bass
        },
        bell: () => new Tone.PolySynth(Tone.FMSynth),
        pad: () => new Tone.PolySynth(Tone.AMSynth)
    }


    const visibleBeats = 16 // four bars of 4/4 by default
    const pianoWidth = 100 // width for piano keys
    const canvasWidth = 1200
    const canvasHeight = 400
    const totalKeys = 88 // Full piano range (A0 to C8)
    const keyCount = 36 // Visible keys at once
    const [scrollOffset, setScrollOffset] = useState(24) // Start at middle of piano
    const topMidi = 108 - scrollOffset // Adjust based on scroll
    
    // Keyboard mapping like FL Studio
    const keyboardMap: { [key: string]: number } = {
        // Bottom row (white keys) - C major scale
        'z': 60, // C4
        'x': 62, // D4
        'c': 64, // E4
        'v': 65, // F4
        'b': 67, // G4
        'n': 69, // A4
        'm': 71, // B4
        ',': 72, // C5
        '.': 74, // D5
        '/': 76, // E5
        
        // Top row (black keys)
        's': 61, // C#4
        'd': 63, // D#4
        'g': 66, // F#4
        'h': 68, // G#4
        'j': 70, // A#4
        'l': 73, // C#5
        ';': 75, // D#5
        
        // Q row for higher octave
        'q': 72, // C5
        'w': 74, // D5
        'e': 76, // E5
        'r': 77, // F5
        't': 79, // G5
        'y': 81, // A5
        'u': 83, // B5
        
        // Numbers for black keys in higher octave
        '2': 73, // C#5
        '3': 75, // D#5
        '5': 78, // F#5
        '6': 80, // G#5
        '7': 82, // A#5
    }

    // Helper function to get note name from MIDI number
    const getNoteFromMidi = (midi: number) => {
        const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
        const octave = Math.floor(midi / 12) - 1
        const noteName = notes[midi % 12]
        return `${noteName}${octave}`
    }

    // Helper function to check if note is black key
    const isBlackKey = (midi: number) => {
        const noteIndex = midi % 12
        return [1, 3, 6, 8, 10].includes(noteIndex) // C#, D#, F#, G#, A#
    }


    useEffect(() => {
        // Initialize synth based on selected instrument
        if (synthRef.current) {
            synthRef.current.dispose()
        }
        
        // Reset loading state when switching instruments
        if (selectedInstrument === 'piano') {
            setSamplesLoaded(false)
        } else {
            setSamplesLoaded(true) // Other instruments don't need loading
        }
        
        synthRef.current = instruments[selectedInstrument as keyof typeof instruments]().toDestination()
        Tone.Transport.bpm.value = BPM
        return () => {
            Tone.Transport.stop()
        }
    }, [selectedInstrument])

    // Keyboard event handlers
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const key = e.key.toLowerCase()
            if (keyboardMap[key] && !pressedKeys.has(key)) {
                e.preventDefault()
                const midi = keyboardMap[key]
                const velocity = 0.5 + Math.random() * 0.3
                
                // Only play if samples are loaded (for piano) or if it's not piano
                if (selectedInstrument !== 'piano' || samplesLoaded) {
                    const note = Tone.Frequency(midi, 'midi').toNote()
                    synthRef.current?.triggerAttack(note, undefined, velocity)
                }
                
                setPressedKeys(prev => new Set(prev.add(key)))
            }
        }
        
        const handleKeyUp = (e: KeyboardEvent) => {
            const key = e.key.toLowerCase()
            if (keyboardMap[key] && pressedKeys.has(key)) {
                e.preventDefault()
                const midi = keyboardMap[key]
                
                // Only release if samples are loaded (for piano) or if it's not piano
                if (selectedInstrument !== 'piano' || samplesLoaded) {
                    const note = Tone.Frequency(midi, 'midi').toNote()
                    synthRef.current?.triggerRelease(note)
                }
                
                setPressedKeys(prev => {
                    const newSet = new Set(prev)
                    newSet.delete(key)
                    return newSet
                })
            }
        }
        
        window.addEventListener('keydown', handleKeyDown)
        window.addEventListener('keyup', handleKeyUp)
        
        return () => {
            window.removeEventListener('keydown', handleKeyDown)
            window.removeEventListener('keyup', handleKeyUp)
        }
    }, [pressedKeys, keyboardMap, selectedInstrument, samplesLoaded])

    // Piano roll keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if typing in an input
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return
            
            switch (e.key) {
                case 'Delete':
                case 'Backspace':
                    if (selectedRef.current) {
                        setNotes(prevNotes => prevNotes.filter(note => note.id !== selectedRef.current))
                        selectedRef.current = null
                    }
                    break
                case 'Escape':
                    selectedRef.current = null
                    dragInfo.current = null
                    break
                case 'a':
                case 'A':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault()
                        // Select all notes (future implementation)
                        console.log('Select all - not implemented yet')
                    }
                    break
            }
        }
        
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [])


    // Setup canvas size (separate from drawing)
    useEffect(() => {
        const cvs = canvasRef.current
        if (!cvs) return
        
        // Fix blurriness on high-DPI displays
        const dpr = window.devicePixelRatio || 1
        const rect = cvs.getBoundingClientRect()
        cvs.width = rect.width * dpr
        cvs.height = rect.height * dpr
        cvs.getContext('2d')?.scale(dpr, dpr)
        cvs.style.width = rect.width + 'px'
        cvs.style.height = rect.height + 'px'
    }, []) // Only run once on mount

    // draw canvas
    useEffect(() => {
        const cvs = canvasRef.current
        if (!cvs) return
        const ctx = cvs.getContext('2d')!
        
        ctx.clearRect(0, 0, canvasWidth, canvasHeight)

        const w = canvasWidth
        const h = canvasHeight


        // Background - FL Studio blue-gray
        ctx.fillStyle = '#3c4043'
        ctx.fillRect(0, 0, w, h)

        // Draw piano keys sidebar
        const keyHeight = h / keyCount
        
        // First draw all white keys
        for (let i = 0; i < keyCount; i++) {
            const midi = topMidi - i
            const y = i * keyHeight
            const isBlack = isBlackKey(midi)
            
            if (!isBlack) {
                // Check if key is being pressed via keyboard
                const isPressed = Object.entries(keyboardMap).some(([key, keyMidi]) => 
                    keyMidi === midi && pressedKeys.has(key)
                )
                
                // White key background - highlight if pressed
                ctx.fillStyle = isPressed ? '#d4627a' : '#e8eaf0'
                ctx.fillRect(0, y, pianoWidth, keyHeight)
                
                // White key border
                ctx.strokeStyle = isPressed ? '#c55569' : '#c0c4cc'
                ctx.lineWidth = isPressed ? 2 : 1
                ctx.strokeRect(0, y, pianoWidth, keyHeight)
                
                // Note label for white keys
                ctx.fillStyle = isPressed ? '#ffffff' : '#2d3142'
                ctx.font = '10px Arial, sans-serif'
                ctx.textAlign = 'right'
                ctx.fillText(getNoteFromMidi(midi), pianoWidth - 8, y + keyHeight / 2 + 3)
            }
        }
        
        // Then draw black keys on top
        for (let i = 0; i < keyCount; i++) {
            const midi = topMidi - i
            const y = i * keyHeight
            const isBlack = isBlackKey(midi)
            
            if (isBlack) {
                // Check if key is being pressed via keyboard
                const isPressed = Object.entries(keyboardMap).some(([key, keyMidi]) => 
                    keyMidi === midi && pressedKeys.has(key)
                )
                
                // Black key - smaller and offset
                const blackKeyWidth = pianoWidth * 0.6
                ctx.fillStyle = isPressed ? '#7fb069' : '#2d3142'
                ctx.fillRect(0, y, blackKeyWidth, keyHeight)
                
                // Black key border
                ctx.strokeStyle = isPressed ? '#6a9655' : '#1a1d29'
                ctx.lineWidth = isPressed ? 2 : 1
                ctx.strokeRect(0, y, blackKeyWidth, keyHeight)
                
                // Note label for black keys
                ctx.fillStyle = isPressed ? '#ffffff' : '#9ba3af'
                ctx.font = '9px Arial, sans-serif'
                ctx.textAlign = 'right'
                ctx.fillText(getNoteFromMidi(midi), blackKeyWidth - 4, y + keyHeight / 2 + 3)
            }
        }

        // Grid area (right of piano keys)
        const gridX = pianoWidth
        const gridWidth = w - pianoWidth
        const totalTicks = PPQ * 4 * (visibleBeats / 4) / zoom
        const pixelsPerTick = gridWidth / totalTicks
        
        // Horizontal grid lines (piano roll rows)
        for (let i = 0; i < keyCount; i++) {
            const y = i * keyHeight
            const midi = topMidi - i
            const isBlack = isBlackKey(midi)
            
            // Row background - FL Studio style
            ctx.fillStyle = isBlack ? '#434951' : '#4a5058'
            ctx.fillRect(gridX, y, gridWidth, keyHeight)
            
            // Horizontal line
            ctx.strokeStyle = '#5a6068'
            ctx.lineWidth = 0.5
            ctx.beginPath()
            ctx.moveTo(gridX, y)
            ctx.lineTo(w, y)
            ctx.stroke()
        }
        
        // Vertical grid lines (beats)
        for (let beat = 0; beat <= visibleBeats; beat++) {
            const x = gridX + (beat * PPQ * pixelsPerTick)
            
            if (beat % 4 === 0) {
                // Bar lines (stronger) - FL Studio orange-ish
                ctx.strokeStyle = '#7a6855'
                ctx.lineWidth = 1.5
            } else {
                // Beat lines (lighter)
                ctx.strokeStyle = '#5a6068'
                ctx.lineWidth = 0.8
            }
            
            ctx.beginPath()
            ctx.moveTo(x, 0)
            ctx.lineTo(x, h)
            ctx.stroke()
        }
        
        // Sub-beat lines (16th notes)
        for (let subBeat = 0; subBeat < visibleBeats * 4; subBeat++) {
            const x = gridX + (subBeat * PPQ / 4 * pixelsPerTick)
            
            ctx.strokeStyle = '#4a5058'
            ctx.lineWidth = 0.3
            ctx.beginPath()
            ctx.moveTo(x, 0)
            ctx.lineTo(x, h)
            ctx.stroke()
        }


        // Draw notes - FL Studio style
        notes.forEach((n) => {
            const x = gridX + n.tick * pixelsPerTick
            const noteW = n.length * pixelsPerTick
            const noteIndex = topMidi - n.midi
            const noteY = noteIndex * keyHeight + 2
            const noteH = keyHeight - 4
            
            // Note background - FL Studio green/red style with drag feedback
            const isDragging = dragInfo.current?.noteId === n.id
            if (selectedRef.current === n.id || isDragging) {
                // Selected/dragging note - red/pink with glow effect
                ctx.fillStyle = isDragging ? '#e44d6d' : '#d4627a'
                ctx.fillRect(x, noteY, noteW, noteH)
                ctx.strokeStyle = isDragging ? '#ff5577' : '#c55569'
                
                // Add glow effect when dragging
                if (isDragging) {
                    ctx.shadowColor = '#ff5577'
                    ctx.shadowBlur = 8
                    ctx.fillRect(x, noteY, noteW, noteH)
                    ctx.shadowBlur = 0
                }
            } else {
                // Unselected note - green
                ctx.fillStyle = '#7fb069'
                ctx.fillRect(x, noteY, noteW, noteH)
                ctx.strokeStyle = '#6a9655'
            }
            
            // Note border
            ctx.lineWidth = 1
            ctx.strokeRect(x, noteY, noteW, noteH)
            
            // Note name label (like in FL Studio)
            const noteName = getNoteFromMidi(n.midi)
            ctx.fillStyle = '#2d3142'
            ctx.font = '10px Arial, sans-serif'
            ctx.textAlign = 'left'
            if (noteW > 30) { // Only show label if note is wide enough
                ctx.fillText(noteName, x + 4, noteY + noteH / 2 + 3)
            }
        })

        // Draw playhead cursor
        if (isPlaying) {
            const cursorX = gridX + cursorTick * pixelsPerTick
            ctx.strokeStyle = '#ff4444'
            ctx.lineWidth = 2
            ctx.beginPath()
            ctx.moveTo(cursorX, 0)
            ctx.lineTo(cursorX, h)
            ctx.stroke()
            ctx.lineWidth = 1
        }
    }, [notes, cursorTick, isPlaying, zoom, pressedKeys, dragInfo.current, scrollOffset])

    const handleCanvasMouseDown = (e: React.MouseEvent) => {
        const canvas = canvasRef.current
        if (!canvas) return
        
        const rect = canvas.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top
        
        // Handle piano key clicks to play notes
        if (x < pianoWidth) {
            const keyIndex = Math.floor(y / (canvasHeight / keyCount))
            const midi = topMidi - keyIndex
            
            // Play the note immediately with velocity sensitivity
            const velocity = 0.3 + Math.random() * 0.4 // Random velocity for realistic feel
            
            // Only play if samples are loaded (for piano) or if it's not piano
            if (selectedInstrument !== 'piano' || samplesLoaded) {
                const note = Tone.Frequency(midi, 'midi').toNote()
                synthRef.current?.triggerAttackRelease(note, '8n', undefined, velocity)
            }
            return
        }
        
        // Check if clicking on an existing note
        const gridX = x - pianoWidth
        const totalTicks = PPQ * 4 * (visibleBeats / 4) / zoom
        const pixelsPerTick = (canvasWidth - pianoWidth) / totalTicks
        
        const clickedNote = notes.find(note => {
            const noteX = note.tick * pixelsPerTick
            const noteW = note.length * pixelsPerTick
            const noteIndex = topMidi - note.midi
            const noteY = noteIndex * (canvasHeight / keyCount)
            const noteH = canvasHeight / keyCount - 4
            
            return gridX >= noteX && gridX <= noteX + noteW && 
                   y >= noteY && y <= noteY + noteH
        })
        
        if (clickedNote) {
            // Start dragging existing note
            selectedRef.current = clickedNote.id
            dragInfo.current = {
                isDragging: true,
                isResizing: false,
                noteId: clickedNote.id,
                startX: x,
                startY: y,
                originalTick: clickedNote.tick,
                originalMidi: clickedNote.midi,
                originalLength: clickedNote.length
            }
        } else {
            // Create new note
            const tick = Math.floor(gridX / pixelsPerTick)
            const keyIndex = Math.floor(y / (canvasHeight / keyCount))
            const midi = topMidi - keyIndex
            
            // Snap to grid (16th notes)
            const snappedTick = Math.floor(tick / (PPQ / 4)) * (PPQ / 4)
            
            const newNote: Note = {
                id: Date.now().toString(),
                tick: snappedTick,
                length: PPQ / 4, // quarter note
                midi,
                vel: 80
            }
            
            setNotes([...notes, newNote])
        }
    }

    const handleCanvasMouseMove = (e: React.MouseEvent) => {
        if (!dragInfo.current?.isDragging) return
        
        const canvas = canvasRef.current
        if (!canvas) return
        
        const rect = canvas.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top
        
        const deltaX = x - dragInfo.current.startX
        const deltaY = y - dragInfo.current.startY
        
        const totalTicks = PPQ * 4 * (visibleBeats / 4) / zoom
        const pixelsPerTick = (canvasWidth - pianoWidth) / totalTicks
        const keyHeight = canvasHeight / keyCount
        
        // Calculate new position
        const tickDelta = Math.floor(deltaX / pixelsPerTick)
        const midiDelta = -Math.floor(deltaY / keyHeight) // Negative because Y increases downward
        
        const newTick = Math.max(0, dragInfo.current.originalTick + tickDelta)
        const newMidi = Math.max(21, Math.min(108, dragInfo.current.originalMidi + midiDelta)) // Full 88-key range
        
        // Snap to grid
        const snappedTick = Math.floor(newTick / (PPQ / 4)) * (PPQ / 4)
        
        // Update the note position
        setNotes(prevNotes => 
            prevNotes.map(note => 
                note.id === dragInfo.current?.noteId 
                    ? { ...note, tick: snappedTick, midi: newMidi }
                    : note
            )
        )
    }

    const handleCanvasMouseUp = () => {
        dragInfo.current = null
        // Don't clear selection here - keep selected note for deletion
    }

    const handleCanvasWheel = (e: React.WheelEvent) => {
        e.preventDefault()
        
        // Vertical scrolling for piano keys
        const scrollDelta = Math.sign(e.deltaY) * 3
        setScrollOffset(prev => {
            const newOffset = Math.max(0, Math.min(totalKeys - keyCount, prev + scrollDelta))
            return newOffset
        })
    }

    const handleCanvasRightClick = (e: React.MouseEvent) => {
        e.preventDefault()
        
        const canvas = canvasRef.current
        if (!canvas) return
        
        const rect = canvas.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top
        
        // Skip piano keys area
        if (x < pianoWidth) return
        
        // Find note at right-click position
        const gridX = x - pianoWidth
        const totalTicks = PPQ * 4 * (visibleBeats / 4) / zoom
        const pixelsPerTick = (canvasWidth - pianoWidth) / totalTicks
        
        const clickedNote = notes.find(note => {
            const noteX = note.tick * pixelsPerTick
            const noteW = note.length * pixelsPerTick
            const noteIndex = topMidi - note.midi
            const noteY = noteIndex * (canvasHeight / keyCount)
            const noteH = canvasHeight / keyCount - 4
            
            return gridX >= noteX && gridX <= noteX + noteW && 
                   y >= noteY && y <= noteY + noteH
        })
        
        if (clickedNote) {
            // Delete the right-clicked note
            setNotes(prevNotes => prevNotes.filter(note => note.id !== clickedNote.id))
            selectedRef.current = null
        }
    }

    const playNotes = () => {
        if (isPlaying) {
            // Stop playback
            Tone.Transport.stop()
            Tone.Transport.cancel() // Clear all scheduled events
            setIsPlaying(false)
            setCursorTick(0)
            if (timelineRef.current) {
                clearInterval(timelineRef.current)
                timelineRef.current = null
            }
            return
        }

        // Start playback
        setIsPlaying(true)
        setCursorTick(0)
        Tone.Transport.cancel() // Clear any existing scheduled events
        Tone.Transport.position = 0 // Reset transport position
        
        // Schedule notes
        notes.forEach(note => {
            const time = (note.tick / PPQ) * (60 / BPM)
            const duration = (note.length / PPQ) * (60 / BPM)
            
            Tone.Transport.schedule((time) => {
                // Use note velocity for dynamic playing (vel ranges 0-127, normalize to 0-1)
                const velocity = note.vel / 127
                const noteName = Tone.Frequency(note.midi, 'midi').toNote()
                synthRef.current?.triggerAttackRelease(noteName, duration, time, velocity)
            }, time)
        })

        Tone.Transport.start()
        
        // Update cursor using Tone.Transport time for perfect sync
        const maxTicks = PPQ * 16 // 4 bars * 4 beats
        
        timelineRef.current = window.setInterval(() => {
            if (!isPlaying) return // Safety check
            
            const transportSeconds = Tone.Transport.seconds
            const currentTick = (transportSeconds / 60) * BPM * PPQ
            
            if (currentTick <= maxTicks) {
                setCursorTick(currentTick)
            } else {
                // Auto-stop when reaching end
                Tone.Transport.stop()
                Tone.Transport.cancel()
                setIsPlaying(false)
                setCursorTick(0)
                if (timelineRef.current) {
                    clearInterval(timelineRef.current)
                    timelineRef.current = null
                }
            }
        }, 50)
    }

    const exportMIDI = () => {
        const midiData = writeMidi(notes, BPM, PPQ)
        const blob = new Blob([midiData], { type: 'application/octet-stream' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'pianoroll.mid'
        a.click()
        URL.revokeObjectURL(url)
    }

    const clearNotes = () => {
        setNotes([])
        if (isPlaying) {
            Tone.Transport.stop()
            Tone.Transport.cancel()
            setIsPlaying(false)
            setCursorTick(0)
            if (timelineRef.current) {
                clearInterval(timelineRef.current)
                timelineRef.current = null
            }
        }
    }

    const importMIDI = () => {
        fileInputRef.current?.click()
    }

    const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        try {
            const arrayBuffer = await file.arrayBuffer()
            const midiData = new Uint8Array(arrayBuffer)
            
            // Basic MIDI parsing - looking for note events
            const importedNotes: Note[] = []
            let currentTick = 0
            let ticksPerQuarter = PPQ
            
            // Simple MIDI parsing for note events (0x90 = note on, 0x80 = note off)
            for (let i = 0; i < midiData.length - 3; i++) {
                const byte = midiData[i]
                
                // Note On event (0x90-0x9F)
                if ((byte & 0xF0) === 0x90) {
                    const note = midiData[i + 1] // MIDI note number
                    const velocity = midiData[i + 2] // Velocity
                    
                    if (velocity > 0 && note >= 21 && note <= 108) { // Full 88-key range
                        const newNote: Note = {
                            id: `imported_${Date.now()}_${i}`,
                            tick: currentTick,
                            length: PPQ / 4, // Default quarter note length
                            midi: note,
                            vel: velocity
                        }
                        importedNotes.push(newNote)
                    }
                    currentTick += PPQ / 8 // Advance time
                }
            }
            
            if (importedNotes.length > 0) {
                setNotes(importedNotes)
                alert(`Imported ${importedNotes.length} notes from MIDI file!`)
            } else {
                alert('No valid notes found in MIDI file')
            }
        } catch (error) {
            alert('Error reading MIDI file: ' + (error as Error).message)
        }
        
        // Reset file input
        e.target.value = ''
    }

    return (
        <div style={{ marginTop: 20 }}>
            <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <select 
                    value={selectedInstrument} 
                    onChange={(e) => setSelectedInstrument(e.target.value)}
                    style={{ 
                        padding: '8px 12px', 
                        borderRadius: '4px',
                        border: '1px solid #ccc',
                        backgroundColor: 'white',
                        fontSize: '14px'
                    }}
                >
                    <option value="piano">Piano</option>
                    <option value="guitar">Guitar</option>
                    <option value="bass">Bass</option>
                    <option value="bell">Bell</option>
                    <option value="pad">Pad</option>
                </select>
                
                <button onClick={playNotes} style={{ padding: '8px 16px', marginRight: '8px' }}>
                    {isPlaying ? 'Stop' : 'Play'}
                </button>
                <button onClick={exportMIDI} style={{ padding: '8px 16px', marginRight: '8px' }}>
                    Export MIDI
                </button>
                <button onClick={importMIDI} style={{ padding: '8px 16px', marginRight: '8px' }}>
                    Import MIDI
                </button>
                <button onClick={clearNotes} style={{ padding: '8px 16px', marginRight: '8px' }}>
                    Clear
                </button>
                
                <label style={{ marginLeft: 20, display: 'flex', alignItems: 'center', gap: '10px' }}>
                    Zoom: 
                    <input
                        type="range"
                        min="0.5"
                        max="4"
                        step="0.5"
                        value={zoom}
                        onChange={(e) => setZoom(Number(e.target.value))}
                    />
                    <span>{zoom}x</span>
                </label>
            </div>
            <canvas
                ref={canvasRef}
                width={canvasWidth}
                height={canvasHeight}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={handleCanvasMouseUp}
                onContextMenu={handleCanvasRightClick}
                onWheel={handleCanvasWheel}
                style={{
                    border: '1px solid #5a6068',
                    borderRadius: 2,
                    cursor: dragInfo.current?.isDragging ? 'grabbing' : 'crosshair',
                    backgroundColor: '#3c4043',
                    display: 'block'
                }}
            />
            <div style={{ marginTop: 10, color: '#666', fontSize: 14 }}>
                <p>Click on the grid to add notes • Notes: {notes.length}</p>
                {selectedInstrument === 'piano' && !samplesLoaded && (
                    <p style={{ marginTop: 5, color: '#ff6b6b' }}>
                        <strong>Loading piano samples...</strong> Please wait before playing.
                    </p>
                )}
                <p style={{ marginTop: 5 }}>
                    <strong>Keyboard shortcuts:</strong> ZXCVBNM (white keys) • SDGHJ (black keys) • QWERTY (higher octave)
                </p>
                <p style={{ marginTop: 5, fontSize: 12 }}>
                    <strong>Piano Roll:</strong> Click = Add note • Drag = Move note • Right-click = Delete • Del/Backspace = Delete selected • Scroll = Change octave
                </p>
            </div>
            
            {/* Hidden file input for MIDI import */}
            <input
                ref={fileInputRef}
                type="file"
                accept=".mid,.midi"
                onChange={handleFileImport}
                style={{ display: 'none' }}
            />
        </div>
    )
}