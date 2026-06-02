'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, usePathname } from 'next/navigation'
import { createContext, useContext } from 'react'

export const GuestContext = createContext<{ guestRole: string | null }>({ guestRole: null })
export function useGuestRole() { return useContext(GuestContext).guestRole }

const TABS = [
  { href:'/app',            label:'Самбар',   icon:'📋' },
  { href:'/app/stock',      label:'Агуулах',  icon:'📦' },
  { href:'/app/history',    label:'Түүх',     icon:'📜' },
  { href:'/app/analytics',  label:'Тайлан',   icon:'📊' },
  { href:'/app/settings',   label:'Тохиргоо', icon:'⚙️' },
]

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const path = usePathname()
  const [bizName, setBizName] = useState('')
  const [subStatus, setSubStatus] = useState('trial')
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [guestRole, setGuestRole] = useState<string | null>(null)
  const [ownerName, setOwnerName] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push('/'); return }

      const { data: p } = await supabase.from('profiles')
        .select('business_name,subscription_status,trial_ends_at')
        .eq('id', data.user.id)
        .single()

      if (p) {
        setBizName(p.business_name || '')
        setSubStatus(p.subscription_status)
        setTrialEndsAt(p.trial_ends_at || null)
        if (p.subscription_status === 'expired') {
          router.push('/pricing')
          return
        }
        setReady(true)
        return
      }

      // Profile байхгүй бол зочин эсэхийг шалгах
      const { data: access } = await supabase.from('shared_access')
        .select('role, owner_id')
        .eq('viewer_email', data.user.email)
        .single()

      if (access) {
        setGuestRole(access.role)
        const { data: ownerProfile } = await supabase.from('profiles')
          .select('business_name')
          .eq('id', access.owner_id)
          .single()
        setOwnerName(ownerProfile?.business_name || 'OLULA')
        setReady(true)
        return
      }

      router.push('/')
    })
  }, [router])

  async function logout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  function trialDaysLeft() {
    if (!trialEndsAt) return null
    const diff = Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86400000)
    return diff > 0 ? diff : 0
  }

  if (!ready) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-gray-400 text-sm">Ачааллаж байна...</div>
    </div>
  )

  const daysLeft = trialDaysLeft()
  const isGuest = !!guestRole
  const visibleTabs = isGuest ? TABS.filter(t => t.href !== '/app/settings') : TABS

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex items-center justify-between py-2.5 border-b border-gray-50">
            <div className="flex items-center gap-2">
              <span className="text-lg">📦</span>
              <span className="font-semibold text-gray-800 text-sm">{isGuest ? ownerName : (bizName || 'OLULA')}</span>
              {isGuest && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                  {guestRole === 'editor' ? '✏️ Засварлагч' : '👁 Харагч'}
                </span>
              )}
              {!isGuest && subStatus === 'trial' && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                  Туршилт {daysLeft !== null ? `· ${daysLeft} өдөр үлдсэн` : ''}
                </span>
              )}
              {!isGuest && subStatus === 'active' && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Идэвхтэй</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button onClick={logout} className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded hover:bg-gray-50">
                Гарах
              </button>
            </div>
          </div>
          <div className="flex overflow-x-auto">
            {visibleTabs.map(t => (
              <button
                key={t.href}
                onClick={() => router.push(t.href)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                  path === t.href
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-200'
                }`}
              >
                <span>{t.icon}</span>{t.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {isGuest && guestRole === 'viewer' && (
        <div className="bg-blue-50 border-b border-blue-100 px-4 py-2 text-center text-xs text-blue-700">
          👁 Та зөвхөн харах эрхтэй зочноор нэвтэрсэн байна
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 py-5">
        <GuestContext.Provider value={{ guestRole }}>
          {children}
        </GuestContext.Provider>
      </main>
    </div>
  )
}
