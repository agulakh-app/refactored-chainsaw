'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, usePathname } from 'next/navigation'

const TABS = [
  { href:'/app',            label:'Самбар',   icon:'📋' },
  { href:'/app/stock',      label:'Агуулах',  icon:'📦' },
  { href:'/app/history',    label:'Түүх',     icon:'📜' },
  { href:'/app/analytics',  label:'Тайлан',   icon:'📊' },
  { href:'/app/settings',   label:'Тохиргоо', icon:'⚙️' },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const path = usePathname()
  const [bizName, setBizName] = useState('')
  const [subStatus, setSubStatus] = useState('trial')
  const [ready, setReady] = useState(false)

  useEffect(()=>{
    supabase.auth.getUser().then(({data})=>{
      if (!data.user) { router.push('/'); return }
      setReady(true)
      supabase.from('profiles').select('business_name,subscription_status').eq('id',data.user.id).single()
        .then(({data:p})=>{ if(p){setBizName(p.business_name||'');setSubStatus(p.subscription_status)} })
    })
  },[router])

  async function logout() { await supabase.auth.signOut(); router.push('/') }

  if (!ready) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-gray-400 text-sm">Ачааллаж байна...</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex items-center justify-between py-2.5 border-b border-gray-50">
            <div className="flex items-center gap-2">
              <span className="text-lg">📦</span>
              <span className="font-semibold text-gray-800 text-sm">{bizName||'OLULA'}</span>
              {subStatus==='trial'&&<span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Туршилт</span>}
              {subStatus==='active'&&<span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Идэвхтэй</span>}
              {subStatus==='expired'&&<span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Дууссан</span>}
            </div>
            <div className="flex items-center gap-3">
              {subStatus==='expired'&&<a href="/pricing" className="text-xs font-medium text-emerald-600 hover:underline">💳 Сунгах</a>}
              <button onClick={logout} className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded hover:bg-gray-50">Гарах</button>
            </div>
          </div>
          {/* Tabs */}
          <div className="flex overflow-x-auto">
            {TABS.map(t=>(
              <button key={t.href} onClick={()=>router.push(t.href)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                  path===t.href?'border-emerald-600 text-emerald-700':'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-200'
                }`}>
                <span>{t.icon}</span>{t.label}
              </button>
            ))}
          </div>
        </div>
      </header>
      {subStatus==='expired'&&(
        <div className="bg-red-50 border-b border-red-100 px-4 py-2 text-center text-xs text-red-700">
          ⚠ Таны эрх дууссан. <a href="/pricing" className="underline font-medium">Сунгах →</a>
        </div>
      )}
      <main className="max-w-5xl mx-auto px-4 py-5">{children}</main>
    </div>
  )
}
