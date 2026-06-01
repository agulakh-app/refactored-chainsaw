// src/app/layout.tsx
import AppLayoutClient from './AppLayoutClient'
import './globals.css' // Хэрэв таны css файл өөр газар байвал замыг нь тааруулаарай

export const metadata = {
  title: 'Olula App',
  description: 'Refactored Chainsaw App',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="mn">
      <body>
        <AppLayoutClient>{children}</AppLayoutClient>
      </body>
    </html>
  )
}
