'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, usePathname } from 'next/navigation'

const TABS = [
  { href: '/app', label: 'Самбар', icon: '📋' },
  { href: '/app/stock', label: 'Агуулах', icon: '📦' },
  { href: '/app/history', label: 'Түүх', icon: '📜' },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const path = usePathname()
  const [bizName, setBizName] = useState('')
  const [subStatus, setSubStatus] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/'); return }
    })
    supabase.from('profiles').select('business_name,subscription_status,trial_ends_at,subscription_ends_at')
      .single().then(({ data }) => {
        if (data) {
          setBizName(data.business_name || '')
          setSubStatus(data.subscription_status)
        }
      })
  }, [router])

  async function logout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  const expiredOrTrial = subStatus === 'expired'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">📦</span>
            <span className="font-semibold text-gray-800 text-sm">{bizName || 'Агуулах'}</span>
            {subStatus === 'trial' && <span className="badge badge-amber">Туршилт</span>}
            {subStatus === 'active' && <span className="badge badge-green">Идэвхтэй</span>}
            {subStatus === 'expired' && <span className="badge badge-red">Дууссан</span>}
          </div>
          <button onClick={logout} className="text-xs text-gray-400 hover:text-gray-600">Гарах</button>
        </div>
        {expiredOrTrial && subStatus === 'expired' && (
          <div className="bg-red-50 border-b border-red-100 px-4 py-2 text-center text-xs text-red-700">
            ⚠ Таны эрх дууссан байна. <a href="/app/payment" className="underline font-medium">Төлбөр төлөх</a>
          </div>
        )}
      </header>

      {/* Main */}
      <main className="max-w-4xl mx-auto px-4 py-5 pb-24">{children}</main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-10">
        <div className="max-w-4xl mx-auto flex">
          {TABS.map(t => (
            <button key={t.href} onClick={() => router.push(t.href)}
              className={`flex-1 py-3 flex flex-col items-center gap-0.5 text-xs transition-colors ${
                path === t.href ? 'text-emerald-700 font-medium' : 'text-gray-400'
              }`}>
              <span className="text-lg">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
