'use client'

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Note, PianoRollState, AISuggestion } from '@/types';
import { generatePianoKeys, midiNoteToNoteName } from '@/lib/music';
import { AINoteSuggester } from '@/lib/ai-suggestions';
import { Play, Pause, Square, Lightbulb, Volume2 } from 'lucide-react';

const GRID_WIDTH = 32; // Number of time steps
const GRID_HEIGHT = 36; // Number of piano keys to show
const CELL_SIZE = 24; // Size of each grid cell in pixels

const PianoRoll: React.FC = () => {
  const [state, setState] = useState<PianoRollState>({
    notes: [],
    isPlaying: false,
    currentPosition: 0,
    bpm: 120,
    gridSize: 16,
    selectedNotes: []
  });

  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);

  const aiSuggester = useRef(new AINoteSuggester());
  const playIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pianoKeys = generatePianoKeys(2, 3); // 3 octaves starting from C2

  // Audio context for simple playback
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    // Initialize audio context
    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const playNote = useCallback((midiNote: number, duration: number = 0.2) => {
    if (!audioContextRef.current) return;

    const ctx = audioContextRef.current;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    // Convert MIDI note to frequency
    const frequency = 440 * Math.pow(2, (midiNote - 69) / 12);
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
    
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration);
  }, []);

  const generateAISuggestions = useCallback(() => {
    const suggestions = aiSuggester.current.generateSuggestions(state.notes, state.currentPosition);
    setAiSuggestions(suggestions);
    setShowSuggestions(true);
  }, [state.notes, state.currentPosition]);

  const addNote = useCallback((pitch: number, start: number, duration: number = 1) => {
    const newNote: Note = {
      id: `note-${Date.now()}-${Math.random()}`,
      pitch,
      start,
      duration,
      velocity: 80
    };

    setState(prev => ({
      ...prev,
      notes: [...prev.notes, newNote]
    }));

    // Play the note
    playNote(pitch);
  }, [playNote]);

  const removeNote = useCallback((noteId: string) => {
    setState(prev => ({
      ...prev,
      notes: prev.notes.filter(note => note.id !== noteId)
    }));
  }, []);

  const applySuggestion = useCallback((suggestion: AISuggestion) => {
    setState(prev => ({
      ...prev,
      notes: [...prev.notes, ...suggestion.notes]
    }));
    setShowSuggestions(false);
    
    // Play the suggested notes
    suggestion.notes.forEach((note, index) => {
      setTimeout(() => playNote(note.pitch, 0.3), index * 100);
    });
  }, [playNote]);

  const togglePlayback = useCallback(() => {
    setState(prev => {
      const newIsPlaying = !prev.isPlaying;
      
      if (newIsPlaying) {
        // Start playback
        const stepDuration = (60 / prev.bpm / 4) * 1000; // Duration of each step in ms
        
        playIntervalRef.current = setInterval(() => {
          setState(current => {
            const nextPosition = (current.currentPosition + 1) % GRID_WIDTH;
            
            // Play notes at current position
            const notesToPlay = current.notes.filter(note => 
              note.start === current.currentPosition
            );
            
            notesToPlay.forEach(note => {
              playNote(note.pitch, note.duration * stepDuration / 1000);
            });
            
            return {
              ...current,
              currentPosition: nextPosition
            };
          });
        }, stepDuration);
      } else {
        // Stop playback
        if (playIntervalRef.current) {
          clearInterval(playIntervalRef.current);
          playIntervalRef.current = null;
        }
      }
      
      return { ...prev, isPlaying: newIsPlaying };
    });
  }, [playNote]);

  const stopPlayback = useCallback(() => {
    setState(prev => ({ ...prev, isPlaying: false, currentPosition: 0 }));
    if (playIntervalRef.current) {
      clearInterval(playIntervalRef.current);
      playIntervalRef.current = null;
    }
  }, []);

  const handleGridClick = useCallback((x: number, y: number) => {
    const pitch = pianoKeys[y]?.midiNote;
    if (pitch) {
      // Check if there's already a note at this position
      const existingNote = state.notes.find(note => 
        note.pitch === pitch && note.start === x
      );
      
      if (existingNote) {
        removeNote(existingNote.id);
      } else {
        addNote(pitch, x);
      }
    }
  }, [state.notes, pianoKeys, addNote, removeNote]);

  const handleMouseDown = useCallback((x: number, y: number) => {
    setIsDrawing(true);
    setDragStart({ x, y });
    handleGridClick(x, y);
  }, [handleGridClick]);

  const handleMouseUp = useCallback(() => {
    setIsDrawing(false);
    setDragStart(null);
  }, []);

  const clearAll = useCallback(() => {
    setState(prev => ({ ...prev, notes: [] }));
    setAiSuggestions([]);
    setShowSuggestions(false);
  }, []);

  const renderGrid = () => {
    const grid = [];
    
    for (let y = 0; y < pianoKeys.length; y++) {
      const key = pianoKeys[y];
      const row = [];
      
      for (let x = 0; x < GRID_WIDTH; x++) {
        const hasNote = state.notes.some(note => 
          note.pitch === key.midiNote && note.start === x
        );
        
        const hasSuggestion = showSuggestions && aiSuggestions.some(suggestion =>
          suggestion.notes.some(note => note.pitch === key.midiNote && note.start === x)
        );
        
        const isCurrentPosition = state.currentPosition === x && state.isPlaying;
        
        row.push(
          <div
            key={`${x}-${y}`}
            className={`
              w-6 h-6 border border-gray-700 cursor-pointer relative
              ${hasNote ? 'bg-purple-500 hover:bg-purple-400' : 'bg-gray-800 hover:bg-gray-700'}
              ${hasSuggestion ? 'ring-2 ring-yellow-400 bg-yellow-500/30' : ''}
              ${isCurrentPosition ? 'ring-2 ring-blue-400' : ''}
            `}
            onMouseDown={() => handleMouseDown(x, y)}
            onMouseUp={handleMouseUp}
          >
            {hasNote && (
              <div className="absolute inset-0 bg-purple-500 rounded-sm" />
            )}
            {hasSuggestion && (
              <div className="absolute inset-0 bg-yellow-400/50 rounded-sm animate-pulse" />
            )}
          </div>
        );
      }
      
      grid.push(
        <div key={y} className="flex">
          {/* Piano key */}
          <div
            className={`
              w-20 h-6 border-r border-gray-600 flex items-center justify-center text-xs
              ${key.type === 'black' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-black'}
              cursor-pointer hover:opacity-80
            `}
            onClick={() => playNote(key.midiNote)}
          >
            {key.displayName}
          </div>
          {/* Grid row */}
          <div className="flex">
            {row}
          </div>
        </div>
      );
    }
    
    return grid;
  };

  return (
    <div className="w-full max-w-6xl mx-auto bg-gray-800 rounded-lg p-6">
      {/* Controls */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={togglePlayback}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
          >
            {state.isPlaying ? <Pause size={20} /> : <Play size={20} />}
            <span>{state.isPlaying ? 'Pause' : 'Play'}</span>
          </button>
          
          <button
            onClick={stopPlayback}
            className="flex items-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
          >
            <Square size={20} />
            <span>Stop</span>
          </button>
          
          <button
            onClick={generateAISuggestions}
            className="flex items-center space-x-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded-lg transition-colors"
          >
            <Lightbulb size={20} />
            <span>AI Suggest</span>
          </button>
          
          <button
            onClick={clearAll}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg transition-colors"
          >
            Clear All
          </button>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Volume2 size={20} />
            <label className="text-sm">BPM:</label>
            <input
              type="number"
              value={state.bpm}
              onChange={(e) => setState(prev => ({ ...prev, bpm: parseInt(e.target.value) || 120 }))}
              className="w-16 px-2 py-1 bg-gray-700 rounded border border-gray-600 text-white"
              min="60"
              max="200"
            />
          </div>
        </div>
      </div>

      {/* AI Suggestions */}
      {showSuggestions && aiSuggestions.length > 0 && (
        <div className="mb-6 p-4 bg-yellow-600/20 rounded-lg border border-yellow-600/50">
          <h3 className="text-lg font-semibold mb-3 text-yellow-300">AI Suggestions</h3>
          <div className="space-y-2">
            {aiSuggestions.map((suggestion, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="text-sm">
                  <span className="capitalize font-medium">{suggestion.style}</span>
                  <span className="text-gray-300 ml-2">
                    ({suggestion.notes.length} notes, {Math.round(suggestion.confidence * 100)}% confidence)
                  </span>
                </div>
                <button
                  onClick={() => applySuggestion(suggestion)}
                  className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 rounded text-sm transition-colors"
                >
                  Apply
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() => setShowSuggestions(false)}
            className="mt-3 text-sm text-gray-400 hover:text-white"
          >
            Hide suggestions
          </button>
        </div>
      )}

      {/* Piano Roll Grid */}
      <div className="overflow-auto border border-gray-600 rounded">
        <div className="inline-block min-w-full">
          {/* Time ruler */}
          <div className="flex">
            <div className="w-20 h-8 border-r border-gray-600 bg-gray-700 flex items-center justify-center text-xs">
              Time
            </div>
            <div className="flex">
              {Array.from({ length: GRID_WIDTH }, (_, i) => (
                <div
                  key={i}
                  className="w-6 h-8 border-r border-gray-600 bg-gray-700 flex items-center justify-center text-xs"
                >
                  {i + 1}
                </div>
              ))}
            </div>
          </div>
          
          {/* Grid */}
          <div onMouseUp={handleMouseUp}>
            {renderGrid()}
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-6 text-sm text-gray-400">
        <p>
          <strong>Instructions:</strong> Click on the grid to add/remove notes. 
          Click piano keys to hear them. Use AI Suggest for smart note recommendations!
        </p>
      </div>
    </div>
  );
};

export default PianoRoll;