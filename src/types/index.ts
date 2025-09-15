export interface Note {
  id: string;
  pitch: number; // MIDI note number (0-127)
  start: number; // Position in grid (0-based)
  duration: number; // Length in grid units
  velocity: number; // Volume (0-127)
}

export interface GridCell {
  x: number; // Time position
  y: number; // Pitch position
}

export interface PianoRollState {
  notes: Note[];
  isPlaying: boolean;
  currentPosition: number;
  bpm: number;
  gridSize: number;
  selectedNotes: string[];
}

export interface AISuggestion {
  notes: Note[];
  confidence: number;
  style: string;
}