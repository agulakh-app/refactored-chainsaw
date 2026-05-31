// src/app/app/layout.tsx
// ✅ Server Component (use client БАЙХГҮЙ - энэ зөв!)
import ClientLayout from './client-layout'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <ClientLayout>{children}</ClientLayout>
}
