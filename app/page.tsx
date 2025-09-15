'use client'
import dynamic from 'next/dynamic'
import React from 'react'


const PianoRoll = dynamic(() => import('../components/PianoRoll'), { ssr: false })


export default function Page() {
  return (
    <main style={{ padding: 20, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <h1>Lightweight Piano Roll — Starter</h1>
      <p>Draw notes, play them, export MIDI. Minimal and fast.</p>
      <PianoRoll />
    </main>
  )
}