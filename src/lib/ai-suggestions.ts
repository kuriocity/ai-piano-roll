import { Note, AISuggestion } from '@/types';

// Musical scales and patterns for AI suggestions
const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
const MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10];
const PENTATONIC_SCALE = [0, 2, 4, 7, 9];

// Common chord progressions
const CHORD_PROGRESSIONS = [
  [0, 4, 7], // Major triad
  [0, 3, 7], // Minor triad
  [0, 4, 7, 11], // Major 7th
  [0, 3, 7, 10], // Minor 7th
];

export class AINoteSuggester {
  private getLastNotes(notes: Note[], count: number = 4): Note[] {
    return notes
      .sort((a, b) => a.start - b.start)
      .slice(-count);
  }

  private analyzeKey(notes: Note[]): { key: number; isMinor: boolean } {
    if (notes.length === 0) return { key: 60, isMinor: false }; // Default to C major

    // Count note occurrences
    const noteCounts: { [key: number]: number } = {};
    notes.forEach(note => {
      const pitchClass = note.pitch % 12;
      noteCounts[pitchClass] = (noteCounts[pitchClass] || 0) + 1;
    });

    // Find most common note as probable key
    const mostCommonNote = Object.entries(noteCounts)
      .reduce((a, b) => noteCounts[parseInt(a[0])] > noteCounts[parseInt(b[0])] ? a : b)[0];
    
    const key = parseInt(mostCommonNote);
    
    // Simple heuristic: if minor third is present more than major third, assume minor
    const minorThird = (key + 3) % 12;
    const majorThird = (key + 4) % 12;
    const isMinor = (noteCounts[minorThird] || 0) > (noteCounts[majorThird] || 0);

    return { key, isMinor };
  }

  private generateMelodyPattern(
    lastNotes: Note[], 
    key: number, 
    isMinor: boolean,
    nextPosition: number
  ): Note[] {
    const scale = isMinor ? MINOR_SCALE : MAJOR_SCALE;
    const suggestions: Note[] = [];

    if (lastNotes.length === 0) {
      // If no notes, suggest a simple pattern in the key
      const rootNote = 60 + key; // Middle C + key offset
      suggestions.push({
        id: `ai-${Date.now()}-1`,
        pitch: rootNote,
        start: nextPosition,
        duration: 1,
        velocity: 80
      });
      return suggestions;
    }

    const lastNote = lastNotes[lastNotes.length - 1];
    const lastPitchClass = lastNote.pitch % 12;
    const currentScaleIndex = scale.indexOf((lastPitchClass - key + 12) % 12);

    // Generate melodic suggestions based on musical rules
    const possibleMoves = [
      // Step up/down in scale
      currentScaleIndex + 1,
      currentScaleIndex - 1,
      // Skip up/down
      currentScaleIndex + 2,
      currentScaleIndex - 2,
      // Return to tonic
      0
    ].filter(index => index >= 0 && index < scale.length);

    possibleMoves.forEach((scaleIndex, i) => {
      const interval = scale[scaleIndex];
      const newPitch = Math.floor(lastNote.pitch / 12) * 12 + key + interval;
      
      // Keep within reasonable range
      if (newPitch >= 48 && newPitch <= 84) {
        suggestions.push({
          id: `ai-${Date.now()}-${i}`,
          pitch: newPitch,
          start: nextPosition,
          duration: 1,
          velocity: Math.max(60, lastNote.velocity - 10 + Math.random() * 20)
        });
      }
    });

    return suggestions.slice(0, 3); // Return top 3 suggestions
  }

  private generateHarmonyPattern(
    notes: Note[],
    key: number,
    isMinor: boolean,
    nextPosition: number
  ): Note[] {
    const scale = isMinor ? MINOR_SCALE : MAJOR_SCALE;
    const suggestions: Note[] = [];

    // Find notes at the current position
    const currentNotes = notes.filter(note => 
      note.start <= nextPosition && note.start + note.duration > nextPosition
    );

    if (currentNotes.length === 0) return [];

    // Generate harmony based on common chord tones
    currentNotes.forEach((note, i) => {
      const pitchClass = note.pitch % 12;
      const scaleIndex = scale.indexOf((pitchClass - key + 12) % 12);
      
      if (scaleIndex !== -1) {
        // Add third above
        const thirdIndex = (scaleIndex + 2) % scale.length;
        const thirdPitch = Math.floor(note.pitch / 12) * 12 + key + scale[thirdIndex];
        
        if (thirdPitch !== note.pitch && thirdPitch >= 48 && thirdPitch <= 84) {
          suggestions.push({
            id: `ai-harmony-${Date.now()}-${i}`,
            pitch: thirdPitch,
            start: nextPosition,
            duration: note.duration,
            velocity: Math.max(50, note.velocity - 20)
          });
        }
      }
    });

    return suggestions;
  }

  public generateSuggestions(notes: Note[], currentPosition: number): AISuggestion[] {
    const lastNotes = this.getLastNotes(notes, 4);
    const { key, isMinor } = this.analyzeKey(notes);
    const nextPosition = Math.max(currentPosition + 1, 
      notes.length > 0 ? Math.max(...notes.map(n => n.start + n.duration)) : 0);

    const melodySuggestions = this.generateMelodyPattern(lastNotes, key, isMinor, nextPosition);
    const harmonySuggestions = this.generateHarmonyPattern(notes, key, isMinor, currentPosition);

    const suggestions: AISuggestion[] = [];

    if (melodySuggestions.length > 0) {
      suggestions.push({
        notes: melodySuggestions,
        confidence: 0.8,
        style: 'melody'
      });
    }

    if (harmonySuggestions.length > 0) {
      suggestions.push({
        notes: harmonySuggestions,
        confidence: 0.7,
        style: 'harmony'
      });
    }

    return suggestions;
  }
}