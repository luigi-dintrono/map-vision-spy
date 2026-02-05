import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'SAM3 Map Demo',
  description: 'Object detection on maps using SAM3',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
