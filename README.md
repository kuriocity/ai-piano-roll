# AI Piano Roll

AI Music Sequencer to make groovy melodies with intelligent note suggestions.

## Features

- **Interactive Piano Roll**: Click and drag to create melodies
- **AI-Powered Suggestions**: Get intelligent next note recommendations based on music theory
- **Real-time Playback**: Play your compositions with adjustable BPM
- **Visual Piano Keys**: Click piano keys to hear individual notes
- **Responsive Design**: Works on desktop and mobile devices

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser

## How to Use

1. **Creating Notes**: Click on the grid to add/remove notes
2. **Playing**: Use the Play/Pause button to hear your composition
3. **AI Suggestions**: Click "AI Suggest" to get intelligent note recommendations
4. **Piano Keys**: Click on the piano keys on the left to hear individual notes
5. **BPM Control**: Adjust the tempo using the BPM input

## Technology Stack

- **Next.js 15** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Web Audio API** - Audio synthesis and playback
- **Custom AI Engine** - Music theory-based note suggestions

## AI Features

The AI suggestion system analyzes your current melody and provides:
- **Melodic continuations** based on musical scales and patterns
- **Harmonic suggestions** with chord tones and intervals
- **Key detection** to maintain musical coherence
- **Style-aware recommendations** for different musical approaches