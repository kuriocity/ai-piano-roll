// MIDI note numbers and their corresponding note names
export const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const PIANO_KEYS = [
  { note: 'C', type: 'white', midiNote: 60 },
  { note: 'C#', type: 'black', midiNote: 61 },
  { note: 'D', type: 'white', midiNote: 62 },
  { note: 'D#', type: 'black', midiNote: 63 },
  { note: 'E', type: 'white', midiNote: 64 },
  { note: 'F', type: 'white', midiNote: 65 },
  { note: 'F#', type: 'black', midiNote: 66 },
  { note: 'G', type: 'white', midiNote: 67 },
  { note: 'G#', type: 'black', midiNote: 68 },
  { note: 'A', type: 'white', midiNote: 69 },
  { note: 'A#', type: 'black', midiNote: 70 },
  { note: 'B', type: 'white', midiNote: 71 },
];

// Generate piano keys for multiple octaves
export const generatePianoKeys = (startOctave: number = 3, numOctaves: number = 3) => {
  const keys = [];
  for (let octave = startOctave; octave < startOctave + numOctaves; octave++) {
    for (const key of PIANO_KEYS) {
      keys.push({
        ...key,
        midiNote: key.midiNote + (octave - 4) * 12,
        octave,
        displayName: `${key.note}${octave}`
      });
    }
  }
  return keys.reverse(); // Higher notes at top
};

export const midiNoteToNoteName = (midiNote: number): string => {
  const noteIndex = midiNote % 12;
  const octave = Math.floor(midiNote / 12) - 1;
  return `${NOTES[noteIndex]}${octave}`;
};

export const noteNameToMidiNote = (noteName: string): number => {
  const match = noteName.match(/^([A-G]#?)(\d+)$/);
  if (!match) return 60; // Default to middle C
  
  const [, note, octaveStr] = match;
  const octave = parseInt(octaveStr);
  const noteIndex = NOTES.indexOf(note);
  
  return (octave + 1) * 12 + noteIndex;
};