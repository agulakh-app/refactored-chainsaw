'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, usePathname } from 'next/navigation'
import { createContext, useContext } from 'react'

export const GuestContext = createContext<{
  guestRole: string | null
  ownerId: string | null
  activeStoreId: string | null
  setActiveStoreId: (id: string | null) => void
}>({ guestRole: null, ownerId: null, activeStoreId: null, setActiveStoreId: () => {} })
export function useGuestRole() { return useContext(GuestContext).guestRole }
export function useOwnerId() { return useContext(GuestContext).ownerId }
export function useActiveStore() { return useContext(GuestContext).activeStoreId }
export function useSetActiveStore() { return useContext(GuestContext).setActiveStoreId }

const TABS = [
  { href:'/app',           label:'Самбар'   },
  { href:'/app/stock',     label:'Агуулах'  },
  { href:'/app/history',   label:'Түүх'     },
  { href:'/app/analytics', label:'Тайлан'   },
  { href:'/app/settings',  label:'Тохиргоо' },
]

function timeLeft(d: string | null) {
  if (!d) return ''
  const ms = new Date(d).getTime() - Date.now()
  if (ms <= 0) return '0 минут үлдсэн'
  const mins = Math.floor(ms / 60000)
  const hours = Math.floor(ms / 3600000)
  const days = Math.floor(ms / 86400000)
  if (days >= 2) return `${days} өдөр үлдсэн`
  if (hours >= 1) return `${hours} цаг үлдсэн`
  return `${mins} минут үлдсэн`
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const path = usePathname()
  const [bizName, setBizName] = useState('')
  const [subStatus, setSubStatus] = useState('trial')
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null)
  const [subEndsAt, setSubEndsAt] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [guestRole, setGuestRole] = useState<string | null>(null)
  const [ownerId, setOwnerId] = useState<string | null>(null)
  const [ownerName, setOwnerName] = useState('')
  const [stores, setStores] = useState<any[]>([])
  const [activeStoreId, setActiveStoreId] = useState<string | null>(null)

  useEffect(() => {
    async function init() {
      const guestCookie = document.cookie.split(';').find(c => c.trim().startsWith('guest_access='))
      if (guestCookie) {
        try {
          const access = JSON.parse(decodeURIComponent(guestCookie.split('=').slice(1).join('=')))
          setGuestRole(access.role)
          setOwnerId(access.owner_id)
          const { data: ownerProfile } = await supabase.from('profiles')
            .select('business_name')
            .eq('id', access.owner_id)
            .single()
          setOwnerName(ownerProfile?.business_name || 'OLULA')
          setReady(true)
          return
        } catch {}
      }

      const { data } = await supabase.auth.getUser()
      if (!data.user) { router.push('/'); return }

      const [{ data: p }, { data: sts }] = await Promise.all([
        supabase.from('profiles')
          .select('business_name,subscription_status,trial_ends_at,subscription_ends_at')
          .eq('id', data.user.id)
          .single(),
        supabase.from('stores').select('*').eq('user_id', data.user.id).order('created_at')
      ])

      if (p) {
        setBizName(p.business_name || '')
        setSubStatus(p.subscription_status)
        setTrialEndsAt(p.trial_ends_at || null)
        setSubEndsAt(p.subscription_ends_at || null)
        if (p.subscription_status === 'expired') {
          router.push('/pricing')
          return
        }
        const storeList = sts || []
        setStores(storeList)
        if (storeList.length > 0) setActiveStoreId(storeList[0].id)
        setReady(true)
        return
      }

      router.push('/')
    }
    init()
  }, [router])

  async function logout() {
    document.cookie = 'guest_access=; path=/; max-age=0'
    await supabase.auth.signOut()
    router.push('/')
  }

  if (!ready) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-gray-400 text-sm">Ачааллаж байна...</div>
    </div>
  )

  const isGuest = !!guestRole
  const visibleTabs = isGuest
    ? TABS.filter(t => t.href !== '/app/settings' && t.href !== '/app/analytics')
    : TABS

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex items-center justify-between py-3 border-b border-gray-50">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-0.5 h-7 bg-emerald-500 rounded-full"/>
                <div className="leading-tight">
                  <div className="font-medium text-gray-900 text-base">
                    {isGuest ? ownerName : (bizName || 'OLULA')}
                  </div>
                  <div className="text-xs text-gray-400">Агуулахаа гартаа атга</div>
                </div>
              </div>
              {isGuest && (
                <span className="px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-600 border border-blue-100">
                  {guestRole === 'editor' ? 'Засварлагч' : 'Харагч'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {!isGuest && subStatus === 'trial' && (
                <span className="px-2 py-0.5 rounded-full text-xs bg-amber-50 text-amber-600 border border-amber-100">
                  Туршилт · {timeLeft(trialEndsAt)}
                </span>
              )}
              {!isGuest && subStatus === 'active' && (
                <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-50 text-emerald-600 border border-emerald-100">
                  Идэвхтэй · {timeLeft(subEndsAt)}
                </span>
              )}
              <button onClick={logout} className="text-xs text-gray-400 hover:text-gray-600">
                Гарах
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex overflow-x-auto">
              {visibleTabs.map(t => (
                <button
                  key={t.href}
                  onClick={() => router.push(t.href)}
                  className={`px-4 py-2.5 text-sm border-b-2 transition-all whitespace-nowrap ${
                    path === t.href
                      ? 'border-emerald-600 text-emerald-700 font-medium'
                      : 'border-transparent text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {!isGuest && stores.length > 1 && (
              <div className="flex gap-1 pb-1">
                <button
                  onClick={() => setActiveStoreId(null)}
                  className={`px-3 py-1 rounded-lg text-xs transition-all whitespace-nowrap ${
                    activeStoreId === null
                      ? 'bg-gray-800 text-white'
                      : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                  }`}
                >
                  Бүгд
                </button>
                {stores.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setActiveStoreId(s.id)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                      activeStoreId === s.id
                        ? 'bg-emerald-600 text-white'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {isGuest && guestRole === 'viewer' && (
        <div className="border-b border-gray-100 px-4 py-2 text-center text-xs text-gray-400">
          Зөвхөн харах эрхтэй зочноор нэвтэрсэн байна
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 py-5">
        <GuestContext.Provider value={{ guestRole, ownerId, activeStoreId, setActiveStoreId }}>
          {children}
        </GuestContext.Provider>
      </main>
    </div>
  )
}
