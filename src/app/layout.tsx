import type { Metadata } from 'next'
import './globals.css'
import { SettingsProvider } from '@/context/SettingsContext'

export const metadata: Metadata = {
  title: 'Storage Performance Dashboard',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;450;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <SettingsProvider>{children}</SettingsProvider>
      </body>
    </html>
  )
}
