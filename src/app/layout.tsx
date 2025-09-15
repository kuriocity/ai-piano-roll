import './globals.css'

export const metadata = {
  title: 'AI Piano Roll',
  description: 'AI Music Sequencer to make groovy melodies',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="font-sans">{children}</body>
    </html>
  )
}