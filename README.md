# Piano Roll Starter

A minimal Next.js TypeScript project implementing a Canvas piano roll + Tone.js playback + MIDI export. Good starting point for adding AI-based melody suggestions.

## Run

1. `npm install`
2. `npm run dev`
3. Open `http://localhost:3000`

## Notes

- This is intentionally small and minimal. Replace the `writeMidi` helper with `@tonejs/midi` or other libraries for better MIDI fidelity.
- Add undo/redo, snapping, selection rectangles, copy/paste as next steps.
