import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Агуулахын систем',
  description: 'Захиалга, агуулах, тооцооны бүртгэл',
  viewport: 'width=device-width, initial-scale=1',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="mn">
      <body className="bg-gray-50 min-h-screen">{children}</body>
    </html>
  )
}
