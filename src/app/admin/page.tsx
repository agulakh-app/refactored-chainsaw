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

// payments.plan-д хадгалагдсан утга → дэлгэцэн дээр харуулах нэр
const PLAN_LABELS: Record<string, string> = {
  basic: 'Үндсэн',
  standard: 'Стандарт',
  full: 'Бүрэн эрх',
}

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

  // ── Төлбөр баталгаажуулах: эрхийн төрлийг (plan) дамжуулна ──
  async function confirmPayment(payId: string, userId: string, periodEnd: string, plan: string | null) {
    await callAdmin('confirm_payment', payId, {
      user_id: userId,
      period_end: periodEnd,
      plan: plan || 'basic', // payments.plan хоосон бол basic-р тооцно
    })
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

  // ── Хэрэглэгчийн эрхийн төрлийг шууд admin дээрээс солих ──
  async function setUserPlan(userId: string, plan: string) {
    await supabase.from('profiles').update({ plan }).eq('id', userId)
    showFlash('✓ Эрх шинэчлэгдлээ')
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
        </div>

        {tab==='users'&&(
          <div className="bg-white rounded-2xl border border-gray-100">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800">Бүх хэрэглэгчид ({users.length})</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-gray-50">
                  {['Имэйл','Утас','Эрх','Хугацаа','Статус','Тохируулга'].map(h=>(
                    <th key={h} className="px-4 py-3 text-xs font-medium text-gray-500 text-left whitespace-nowrap">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {users.map(u=>{
                    const endDate = u.subscription_status==='trial'
                      ? u.trial_ends_at
                      : u.subscription_ends_at
                    const badge = u.subscription_status==='active'
                      ? <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">Идэвхтэй</span>
                      : u.subscription_status==='trial'
                      ? <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">Туршилт</span>
                      : <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">Дууссан</span>
                    return (
                      <tr key={u.id} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="text-xs font-medium text-gray-800">{u.contact_email || u.email || '—'}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-xs text-gray-600">{u.phone || '—'}</div>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={u.plan || 'basic'}
                            onChange={e => setUserPlan(u.id, e.target.value)}
                            className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white"
                          >
                            <option value="basic">Үндсэн</option>
                            <option value="standard">Стандарт</option>
                            <option value="full">Бүрэн эрх</option>
                          </select>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {endDate ? fmtD(endDate) : '—'}
                        </td>
                        <td className="px-4 py-3">{badge}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1.5 flex-wrap">
                            <button onClick={()=>{ setExtendUserId(u.id); setExtendPlan(1) }}
                              className="px-2.5 py-1 rounded-lg text-xs bg-emerald-50 text-emerald-600 font-medium hover:bg-emerald-100">
                              Сунгах
                            </button>
                            <button onClick={()=>{ callAdmin('toggle_access',u.id,{new_status:u.subscription_status==='expired'?'active':'expired'}); showFlash(u.subscription_status==='expired'?'✓ Нээгдлээ':'Хаагдлаа') }}
                              className={`px-2.5 py-1 rounded-lg text-xs font-medium ${u.subscription_status==='expired'?'bg-emerald-50 text-emerald-600 hover:bg-emerald-100':'bg-red-50 text-red-500 hover:bg-red-100'}`}>
                              {u.subscription_status==='expired'?'Нээх':'Хаах'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {users.length===0&&<p className="text-center text-gray-400 py-8">Хэрэглэгч алга</p>}
            </div>
          </div>
        )}

        {tab==='payments'&&(
          <div className="space-y-4">
            {pendingPayments.length>0&&(
              <div className="bg-white rounded-2xl border border-amber-200">
                <div className="px-5 py-4 border-b border-amber-100">
                  <span className="font-semibold text-amber-600">⏳ Хүлээгдэж буй ({pendingPayments.length})</span>
                </div>
                {pendingPayments.map(p=>{
                  const u=users.find(u=>u.id===p.user_id)
                  return (
                    <div key={p.id} className="px-5 py-4 flex justify-between items-center flex-wrap gap-3 border-b border-gray-50 last:border-0">
                      <div>
                        <div className="font-medium text-gray-800">
                          {u?.contact_email||u?.email||p.user_id.slice(0,12)}
                          {p.plan && (
                            <span className="ml-2 px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-xs font-medium">
                              {PLAN_LABELS[p.plan] || p.plan}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">Утас: <b>{u?.phone||'—'}</b> · Дүн: <b>{fmt(p.amount)}₮</b> · Гүйлгээ: <b>{p.reference_code}</b></div>
                        <div className="text-xs text-gray-400">{fmtD(p.created_at)}</div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={()=>confirmPayment(p.id,p.user_id,p.period_end,p.plan)}
                          className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700">✓ Баталгаажуулах</button>
                        <button onClick={()=>{ callAdmin('reject_payment',p.id); showFlash('Цуцлагдлаа') }}
                          className="px-4 py-2 bg-red-50 text-red-500 rounded-xl text-sm">✕</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            <div className="bg-white rounded-2xl border border-gray-100">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-800">Бүх төлбөрүүд ({payments.length})</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="bg-gray-50">
                    {['Хэрэглэгч','Эрх','Дүн','Гүйлгээний №','Хугацаа','Огноо','Статус'].map(h=>(
                      <th key={h} className="px-4 py-3 text-xs font-medium text-gray-500 text-left whitespace-nowrap">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {payments.map(p=>{
                      const u=users.find(u=>u.id===p.user_id)
                      const badge=p.status==='confirmed'
                        ?<span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs">Баталгаажсан</span>
                        :p.status==='pending'
                        ?<span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs">Хүлээгдэж байна</span>
                        :<span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs">Цуцлагдсан</span>
                      return (
                        <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
                          <td className="px-4 py-3 text-xs">{u?.contact_email||u?.email||p.user_id.slice(0,12)}</td>
                          <td className="px-4 py-3 text-xs">{p.plan ? (PLAN_LABELS[p.plan] || p.plan) : '—'}</td>
                          <td className="px-4 py-3 font-medium">{fmt(p.amount)}₮</td>
                          <td className="px-4 py-3 text-xs text-gray-500">{p.reference_code||'—'}</td>
                          <td className="px-4 py-3 text-xs text-gray-500">{p.period_start} → {p.period_end}</td>
                          <td className="px-4 py-3 text-xs text-gray-400">{fmtD(p.created_at)}</td>
                          <td className="px-4 py-3">{badge}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {payments.length===0&&<p className="text-center text-gray-400 py-8">Төлбөр алга</p>}
              </div>
            </div>
          </div>
        )}

        {tab==='stats'&&(
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-800 mb-4">👥 Хэрэглэгчдийн статус</h3>
              {[['Идэвхтэй',activeUsers,'#10B981'],['Туршилт',trialUsers,'#F59E0B'],['Дууссан',users.filter(u=>u.subscription_status==='expired').length,'#EF4444']].map(([l,v,c])=>(
                <div key={String(l)} className="flex justify-between items-center mb-3">
                  <span className="text-sm text-gray-600">{l}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-gray-100 rounded-full h-2">
                      <div className="h-2 rounded-full" style={{width:users.length?`${Math.round(Number(v)/users.length*100)}%`:'0%',background:String(c)}}/>
                    </div>
                    <span className="text-sm font-semibold w-6 text-right">{v}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-800 mb-4">💰 Орлогын дүгнэлт</h3>
              {[['Нийт баталгаажсан',fmt(totalRevenue)+'₮'],['Хүлээгдэж буй',fmt(payments.filter(p=>p.status==='pending').reduce((a,p)=>a+p.amount,0))+'₮'],['Нийт төлбөр',String(payments.length)],['Нийт захиалга',String(orders.length)]].map(([l,v])=>(
                <div key={String(l)} className="flex justify-between py-1.5 border-b border-gray-50 last:border-0">
                  <span className="text-sm text-gray-500">{l}</span>
                  <span className="text-sm font-semibold">{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
