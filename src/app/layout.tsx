import './globals.css'
export const metadata = { title: 'Olula App', description: 'Refactored Chainsaw App' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="mn">
      <body>
        {children}
      </body>
    </html>
  )
}
