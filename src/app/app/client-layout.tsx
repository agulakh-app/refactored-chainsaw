'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, usePathname } from 'next/navigation'
import { createContext, useContext } from 'react'

type Plan = 'basic' | 'standard' | 'full'

export const GuestContext = createContext<{
  guestRole: string | null
  ownerId: string | null
  activeStoreId: string | null
  setActiveStoreId: (id: string | null) => void
  plan: Plan
}>({ guestRole: null, ownerId: null, activeStoreId: null, setActiveStoreId: () => {}, plan: 'basic' })
export function useGuestRole() { return useContext(GuestContext).guestRole }
export function useOwnerId() { return useContext(GuestContext).ownerId }
export function useActiveStore() { return useContext(GuestContext).activeStoreId }
export function useSetActiveStore() { return useContext(GuestContext).setActiveStoreId }
// Хэрэглэгчийн эрхийн төрөл: 'basic' | 'standard' | 'full'
export function useUserPlan() { return useContext(GuestContext).plan }

const TABS = [
  { href:'/app',           label:'Самбар',   icon:'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { href:'/app/stock',     label:'Агуулах',  icon:'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
  { href:'/app/history',   label:'Түүх',     icon:'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
  { href:'/app/analytics', label:'Тайлан',   icon:'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { href:'/app/settings',  label:'Тохиргоо', icon:'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
]


function timeLeft(d: string | null) {
  if (!d) return ''
  const ms = new Date(d).getTime() - Date.now()
  if (ms <= 0) return '0 мин'
  const days = Math.floor(ms / 86400000)
  const hours = Math.floor(ms / 3600000)
  const mins = Math.floor(ms / 60000)
  if (days >= 2) return `${days} өдөр`
  if (hours >= 1) return `${hours} цаг`
  return `${mins} мин`
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const path = usePathname()

  // Хуудас хадгалах
  useEffect(()=>{
    if(path&&path.startsWith('/app')) localStorage.setItem('olula_path',path)
  },[path])
  const [bizName, setBizName] = useState('')
  const [subStatus, setSubStatus] = useState('trial')
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null)
  const [subEndsAt, setSubEndsAt] = useState<string | null>(null)
  const [plan, setPlan] = useState<Plan>('basic')
  const [ready, setReady] = useState(false)
  const [guestRole, setGuestRole] = useState<string | null>(null)
  const [ownerId, setOwnerId] = useState<string | null>(null)
  const [ownerName, setOwnerName] = useState('')
  const [stores, setStores] = useState<any[]>([])
  const [activeStoreId, setActiveStoreIdRaw] = useState<string | null>(()=>{
    if(typeof window==='undefined') return null
    return localStorage.getItem('olula_store')||null
  })
  function setActiveStoreId(id: string|null){
    setActiveStoreIdRaw(id)
    if(typeof window!=='undefined'){
      if(id) localStorage.setItem('olula_store',id)
      else localStorage.removeItem('olula_store')
    }
  }
  const [installPrompt, setInstallPrompt] = useState<any>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [adminUser, setAdminUser] = useState(false)
  const [storeOpen, setStoreOpen] = useState(false)

  useEffect(()=>{
    supabase.auth.getUser().then(({data:{user}})=>{
      if(user) setAdminUser(user.email==='88118270@agulakh.app'||user.email==='hardworkingfmly@gmail.com')
    })
  },[])

  useEffect(() => {
    // PWA install prompt
    const handler = (e: any) => {
      e.preventDefault()
      setInstallPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)

    // Аль хэдийн суулгагдсан эсэх
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
    }

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function installApp() {
    if (!installPrompt) return
    installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'accepted') {
      setInstallPrompt(null)
      setIsInstalled(true)
    }
  }

  useEffect(() => {
    async function init() {
      const guestCookie = document.cookie.split(';').find(c => c.trim().startsWith('guest_access='))
      if (guestCookie) {
        try {
          const access = JSON.parse(decodeURIComponent(guestCookie.split('=').slice(1).join('=')))
          setGuestRole(access.role)
          setOwnerId(access.owner_id)
          // Зочин — тодорхой 1 дэлгүүрт уясан бол switcher-гүйгээр зөвхөн тэр дэлгүүрийг харна
          if (access.store_id) setActiveStoreId(access.store_id)
          // Зочин — эзэмшигчийн эрхийн төрлөөр хязгаарлагдана
          const { data: ownerProfile } = await supabase.from('profiles')
            .select('business_name,plan').eq('id', access.owner_id).single()
          setOwnerName(ownerProfile?.business_name || 'OLULA')
          setPlan((ownerProfile?.plan as Plan) || 'basic')
          setReady(true)
          return
        } catch {}
      }
      const { data } = await supabase.auth.getUser()
      if (!data.user) { router.push('/'); return }
      const [{ data: p }, { data: sts }] = await Promise.all([
        supabase.from('profiles')
          .select('business_name,subscription_status,trial_ends_at,subscription_ends_at,plan')
          .eq('id', data.user.id).single(),
        supabase.from('stores').select('*').eq('user_id', data.user.id).order('created_at')
      ])
      if (p) {
        setBizName(p.business_name || '')
        setSubStatus(p.subscription_status)
        setTrialEndsAt(p.trial_ends_at || null)
        setSubEndsAt(p.subscription_ends_at || null)
        setPlan((p.plan as Plan) || 'basic')
        if (p.subscription_status === 'expired') { router.push('/pricing'); return }
        const storeList = sts || []
        setStores(storeList)
        // Хадгалсан дэлгүүр сэргээх
        const savedStore = localStorage.getItem('olula_store')
        if(savedStore && storeList.find((s:any)=>s.id===savedStore)){
          setActiveStoreId(savedStore)
        } else if (storeList.length > 0) {
          setActiveStoreId(storeList[0].id)
        }
        // Хадгалсан хуудас руу шилжих
        const savedPath = localStorage.getItem('olula_path')
        if(savedPath && savedPath !== path && savedPath.startsWith('/app')){
          router.replace(savedPath)
        }
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
  const visibleTabs = TABS.filter(t => {
    if (isGuest && (t.href === '/app/settings' || t.href === '/app/analytics')) return false
    return true
  })
  const showStoreSwitcher = !isGuest && stores.length > 1

  return (
    <div className="min-h-screen bg-gray-50 flex">

      {/* ── DESKTOP SIDEBAR ── */}
      <aside className="hidden md:flex flex-col w-[200px] bg-[#0a2e24] flex-shrink-0 fixed top-0 left-0 bottom-0 z-20" style={{overflowY:'auto'}}>

        {/* Logo + хугацаа */}
        <div className="px-5 pt-4 pb-3 border-b border-white/10">
          <span className="relative inline-flex items-center">
            <span className="font-extrabold text-lg tracking-tight text-[#07e6ae]">OLULA</span>
            <span className="absolute top-0.5 -right-1 w-1.5 h-1.5 rounded-full bg-[#07e6ae] shadow-[0_0_8px_rgba(7,230,174,0.9)]"/>
          </span>
          {!isGuest&&subStatus==='active'&&(
            <div className="text-[11px] text-[#07e6ae]/60 mt-1">Идэвхтэй · {timeLeft(subEndsAt)}</div>
          )}
          {!isGuest&&subStatus==='trial'&&(
            <div className="text-[11px] text-amber-300/60 mt-1">Туршилт · {timeLeft(trialEndsAt)}</div>
          )}
          {isGuest&&(
            <div className="text-[11px] text-blue-300/60 mt-1">{guestRole==='editor'?'Засварлагч':'Харах'}</div>
          )}
        </div>

        {/* Дэлгүүр dropdown */}
        {showStoreSwitcher&&(
          <div className="px-3 pt-3 pb-2 border-b border-white/10">
            <button onClick={()=>setStoreOpen(!storeOpen)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all text-left bg-white/6 hover:bg-white/10">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-1.5 h-1.5 rounded-full bg-[#07e6ae] flex-shrink-0"/>
                <span className="text-white font-medium truncate">
                  {activeStoreId?stores.find(s=>s.id===activeStoreId)?.name||'Дэлгүүр':'Бүгд'}
                </span>
              </div>
              <span className="text-white/30 text-[10px] ml-1 flex-shrink-0">{storeOpen?'▲':'▾'}</span>
            </button>
            {storeOpen&&(
              <div className="mt-1 rounded-lg overflow-hidden border border-white/10">
                <button onClick={()=>{setActiveStoreId(null);setStoreOpen(false)}}
                  className={`w-full text-left px-3 py-2 text-xs transition-all flex items-center gap-2 ${
                    activeStoreId===null?'bg-[#07e6ae]/15 text-[#07e6ae] font-medium':'text-white/50 hover:bg-white/6'
                  }`}>
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${activeStoreId===null?'bg-[#07e6ae]':'bg-white/20'}`}/>
                  Бүгд
                </button>
                {stores.map(s=>(
                  <button key={s.id} onClick={()=>{setActiveStoreId(s.id);setStoreOpen(false)}}
                    className={`w-full text-left px-3 py-2 text-xs transition-all flex items-center gap-2 ${
                      activeStoreId===s.id?'bg-[#07e6ae]/15 text-[#07e6ae] font-medium':'text-white/50 hover:bg-white/6'
                    }`}>
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${activeStoreId===s.id?'bg-[#07e6ae]':'bg-white/20'}`}/>
                    {s.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Nav items */}
        <nav className="flex-1 px-3 py-3 space-y-0.5">
          {visibleTabs.map(t=>{
            const active=path===t.href
            return(
              <button key={t.href} onClick={()=>router.push(t.href)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all text-left ${
                  active?'bg-[#07e6ae] text-[#0a2e24] font-medium':'text-white/60 hover:bg-white/8 hover:text-white/90'
                }`}>
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={active?2:1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d={t.icon}/>
                </svg>
                {t.label}
              </button>
            )
          })}
        </nav>

        {/* Доод хэсэг: Admin + Гарах */}
        <div className="px-3 py-3 border-t border-white/10 space-y-1">
          {adminUser&&(
            <a href="/admin"
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/60 hover:bg-white/8 hover:text-white/90 transition-all">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/>
              </svg>
              Админ
            </a>
          )}
          {installPrompt&&!isInstalled&&(
            <button onClick={installApp}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/60 hover:bg-white/8 transition-all">
              Апп суулгах
            </button>
          )}
          <button onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/40 hover:bg-white/8 hover:text-white/70 transition-all text-left">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
            </svg>
            Гарах
          </button>
        </div>
      </aside>

      {/* ── MOBILE HEADER (хэвийн байдлаар хэвээр) ── */}
      <div className="flex-1 flex flex-col min-w-0 md:ml-[200px]">
        <header className="md:hidden bg-[#0a2e24] sticky top-0 z-20">
          <div className="px-4">
            <div className="flex items-center justify-between py-3 border-b border-white/10">
              <span className="relative inline-flex items-center">
                <span className="font-extrabold text-xl tracking-tight text-[#07e6ae]">OLULA</span>
                <span className="absolute top-0.5 -right-1 w-1.5 h-1.5 rounded-full bg-[#07e6ae] shadow-[0_0_8px_rgba(7,230,174,0.9)]"/>
              </span>
              <div className="flex items-center gap-2">
                {!isGuest&&subStatus==='active'&&(
                  <span className="px-2 py-0.5 rounded-full text-xs bg-[#07e6ae]/15 text-[#07e6ae] border border-[#07e6ae]/25">
                    Идэвхтэй · {timeLeft(subEndsAt)}
                  </span>
                )}
                <button onClick={logout} className="text-xs text-white/40 hover:text-white/70 px-2 py-1">Гарах</button>
              </div>
            </div>
            {showStoreSwitcher&&(
              <div className="flex gap-1 py-2 border-t border-white/10">
                <button onClick={()=>setActiveStoreId(null)}
                  className={`px-3 py-1 rounded-lg text-xs transition-all ${activeStoreId===null?'bg-white/15 text-white':'text-white/45'}`}>Бүгд</button>
                {stores.map(s=>(
                  <button key={s.id} onClick={()=>setActiveStoreId(s.id)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${activeStoreId===s.id?'bg-[#07e6ae] text-[#0a2e24]':'bg-white/8 text-white/60'}`}>{s.name}</button>
                ))}
              </div>
            )}
          </div>
        </header>

        {isGuest&&guestRole==='viewer'&&(
          <div className="bg-[#0a2e24] border-t border-white/10 px-4 py-2 text-center text-xs text-white/40">
            Зөвхөн харах эрхтэй зочноор нэвтэрсэн байна
          </div>
        )}

        <main className="flex-1 px-4 py-4">
          <GuestContext.Provider value={{guestRole,ownerId,activeStoreId,setActiveStoreId,plan}}>
            {children}
          </GuestContext.Provider>
        </main>

        {/* Mobile bottom nav */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-30">
          <div className="flex items-center justify-start px-2 py-1 gap-0">
            {visibleTabs.map(t=>{
              const active=path===t.href
              return(
                <button key={t.href} onClick={()=>router.push(t.href)}
                  className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all min-w-0 ${active?'text-[#07e6ae]':'text-gray-400'}`}>
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={active?2:1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d={t.icon}/>
                  </svg>
                  <span className={`text-xs truncate ${active?'font-medium':''}`}>{t.label}</span>
                  {active&&<div className="w-1 h-1 bg-[#07e6ae] rounded-full"/>}
                </button>
              )
            })}
            {adminUser&&(
              <button onClick={()=>router.push('/admin')}
                className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all min-w-0 ${path==='/admin'?'text-[#07e6ae]':'text-gray-400'}`}>
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={path==='/admin'?2:1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                </svg>
                <span className={`text-xs truncate ${path==='/admin'?'font-medium':''}`}>Админ</span>
                {path==='/admin'&&<div className="w-1 h-1 bg-[#07e6ae] rounded-full"/>}
              </button>
            )}
          </div>
        </nav>
      </div>
    </div>
  )
}
