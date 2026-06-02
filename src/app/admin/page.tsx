'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const ADMIN_EMAIL = 'hardworkingfmly@gmail.com'
const ADMIN_PHONE_EMAIL = '88118270@agulakh.app'

function fmt(n: number) { return n.toLocaleString() }
function fmtD(d: string) { if(!d) return ''; return d.split('T')[0].replace(/-/g,'/') }

const PLAN_OPTIONS = [
  { label:'Туршилт +7 хоног', days:7,   status:'trial' },
  { label:'1 сар',            days:30,  status:'active' },
  { label:'3 сар',            days:90,  status:'active' },
  { label:'1 жил',            days:365, status:'active' },
]

export default function AdminPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [users, setUsers] = useState<any[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [tab, setTab] = useState<'users'|'payments'|'stats'>('users')
  const [flash, setFlash] = useState('')
  const [extendUserId, setExtendUserId] = useState<string|null>(null)
  const [extendPlan, setExtendPlan] = useState(0)

  const showFlash = (m: string) => { setFlash(m); setTimeout(()=>setFlash(''),3000) }

  const load = useCallback(async () => {
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user || (user.email !== ADMIN_EMAIL && user.email !== ADMIN_PHONE_EMAIL)) {
      router.push('/'); return
    }
    setReady(true)
    const res = await fetch('/api/admin/users')
    const data = await res.json()
    setUsers(data.profiles || [])
    setPayments(data.payments || [])
    setOrders(data.orders || [])
  }, [router])

  useEffect(() => { load() }, [load])

  async function callAdmin(action: string, id: string, data?: any) {
    await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, id, data })
    })
    load()
  }

  async function confirmPayment(payId: string, userId: string, periodEnd: string) {
    await callAdmin('confirm_payment', payId, { user_id: userId, period_end: periodEnd })
    showFlash('✓ Баталгаажлаа')
  }

  async function extendUser() {
    if (!extendUserId) return
    const plan = PLAN_OPTIONS[extendPlan]
    const now = new Date()
    const end = new Date(now.getTime() + plan.days * 86400000)
    await supabase.from('profiles').update({
      subscription_status: plan.status,
      ...(plan.status === 'trial'
        ? { trial_ends_at: end.toISOString() }
        : { subscription_ends_at: end.toISOString() }
      )
    }).eq('id', extendUserId)
    setExtendUserId(null)
    showFlash('✓ Хугацаа тохируулагдлаа')
    load()
  }

  const pendingPayments = payments.filter(p=>p.status==='pending')
  const totalRevenue = payments.filter(p=>p.status==='confirmed').reduce((a,p)=>a+p.amount,0)
  const activeUsers = users.filter(u=>u.subscription_status==='active').length
  const trialUsers = users.filter(u=>u.subscription_status==='trial').length

  if (!ready) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-gray-400">Ачааллаж байна...</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {flash&&<div className="fixed top-4 right-4 bg-emerald-700 text-white text-sm px-4 py-2 rounded-lg shadow-lg z-50">{flash}</div>}

      {extendUserId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="font-semibold text-gray-800 mb-4">⏱ Хугацаа тохируулах</h3>
            <div className="space-y-2 mb-5">
              {PLAN_OPTIONS.map((p,i)=>(
                <div key={i} onClick={()=>setExtendPlan(i)}
                  className={`px-4 py-3 rounded-xl border-2 cursor-pointer text-sm transition-all ${extendPlan===i?'border-emerald-500 bg-emerald-50':'border-gray-200 hover:border-emerald-300'}`}>
                  {p.label}
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={()=>setExtendUserId(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm">Болих</button>
              <button onClick={extendUser} className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold">Хадгалах</button>
            </div>
          </div>
        </div>
      )}

      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">🔐</span>
              <span className="font-bold text-gray-800">Admin самбар</span>
            </div>
            <div className="flex items-center gap-3">
              <a href="/app" className="text-xs text-emerald-600 hover:underline">Апп руу →</a>
              <button onClick={async()=>{ await supabase.auth.signOut(); router.push('/') }}
                className="text-xs text-gray-400 hover:text-gray-600">Гарах</button>
            </div>
          </div>
          <div className="flex border-t border-gray-50">
            {([['users','👥 Хэрэглэгчид'],['payments','💳 Төлбөрүүд'],['stats','📊 Статистик']] as const).map(([t,l])=>(
              <button key={t} onClick={()=>setTab(t)}
                className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-all ${tab===t?'border-emerald-600 text-emerald-700':'border-transparent text-gray-500'}`}>
                {l}{t==='payments'&&pendingPayments.length>0&&<span className="ml-1.5 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{pendingPayments.length}</span>}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[['Нийт хэрэглэгч',String(users.length),'text-gray-700'],['Идэвхтэй',String(activeUsers),'text-emerald-700'],['Туршилт',String(trialUsers),'text-amber-600'],['Нийт орлого',fmt(totalRevenue)+'₮','text-emerald-700']].map(([l,v,c])=>(
            <div key={l} className="bg-white rounded-xl border border-gray-100 p-4 text-center">
              <div className="text-xs text-gray-400 mb-1">{l}</div>
              <div className={`text-xl font-bold ${c}`}>{v}</div>
            </div>
          ))}
