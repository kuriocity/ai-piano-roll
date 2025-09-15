'use client'

import PianoRoll from '@/components/PianoRoll'

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-center mb-8 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
          AI Piano Roll
        </h1>
        <p className="text-center text-gray-300 mb-8">
          Create groovy melodies with AI-powered note suggestions
        </p>
        <PianoRoll />
      </div>
    </main>
  )
}