'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const ADMIN_EMAIL = 'hardworkingfmly@gmail.com'
const ADMIN_PHONE_EMAIL = '88118270@agulakh.app'

function fmt(n: number) { return n.toLocaleString() }
function fmtD(d: string) { if(!d) return ''; const [y,m,day]=d.split('T')[0].split('-'); return `${y}/${m}/${day}` }

export default function AdminPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [users, setUsers] = useState<any[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [tab, setTab] = useState<'users'|'payments'|'stats'>('users')
  const [flash, setFlash] = useState('')

  const showFlash = (m: string) => { setFlash(m); setTimeout(()=>setFlash(''),3000) }

  const load = useCallback(async () => {
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user || (user.email !== ADMIN_EMAIL && user.email !== ADMIN_PHONE_EMAIL)) {
      router.push('/'); return
    }
    setReady(true)

    // Load profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
    setUsers(profiles || [])

    // Load payments
    const { data: pays } = await supabase
      .from('payments')
      .select('*')
      .order('created_at', { ascending: false })
    setPayments(pays || [])

    // Load orders count per user
    const { data: ords } = await supabase
      .from('orders')
      .select('user_id')
    setOrders(ords || [])
  }, [router])

  useEffect(() => { load() }, [load])

  async function confirmPayment(payId: string, userId: string, periodEnd: string) {
    await supabase.from('payments').update({
      status: 'confirmed',
      confirmed_at: new Date().toISOString()
    }).eq('id', payId)

    await supabase.from('profiles').update({
      subscription_status: 'active',
      subscription_ends_at: periodEnd
    }).eq('id', userId)

    showFlash("✓ Төлбөр баталгаажлаа — имэйл илгээгдлээ")
    load()
  }

  async function rejectPayment(payId: string) {
    await supabase.from('payments').update({ status: 'failed' }).eq('id', payId)
    showFlash('Төлбөр цуцлагдлаа')
    load()
  }

  async function toggleAccess(userId: string, currentStatus: string) {
    const newStatus = currentStatus === 'expired' ? 'active' : 'expired'
    await supabase.from('profiles').update({
      subscription_status: newStatus
    }).eq('id', userId)
    showFlash(newStatus === 'active' ? '✓ Эрх нээгдлээ' : 'Эрх хаагдлаа')
    load()
  }

  async function extendTrial(userId: string) {
    const newEnd = new Date(Date.now() + 7*86400000).toISOString()
    await supabase.from('profiles').update({
      subscription_status: 'trial',
      trial_ends_at: newEnd
    }).eq('id', userId)
    showFlash('✓ Туршилт 7 хоногоор сунгагдлаа')
    load()
  }

  const pendingPayments = payments.filter(p => p.status === 'pending')
  const totalRevenue = payments.filter(p => p.status === 'confirmed').reduce((a,p) => a+p.amount, 0)
  const activeUsers = users.filter(u => u.subscription_status === 'active').length
  const trialUsers = users.filter(u => u.subscription_status === 'trial').length

  if (!ready) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-gray-400">Ачааллаж байна...</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {flash && <div className="fixed top-4 right-4 bg-emerald-700 text-white text-sm px-4 py-2 rounded-lg shadow-lg z-50">{flash}</div>}

      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">🔐</span>
            <span className="font-bold text-gray-800">Admin самбар</span>
            <span className="text-xs text-gray-400 hidden sm:block">— Агуулахын систем</span>
          </div>
          <div className="flex items-center gap-3">
            <a href="/app" className="text-xs text-emerald-600 hover:underline">Апп руу →</a>
            <button onClick={async () => { await supabase.auth.signOut(); router.push('/') }}
              className="text-xs text-gray-400 hover:text-gray-600">Гарах</button>
          </div>
        </div>
        {/* Tabs */}
        <div className="max-w-6xl mx-auto px-4 flex border-t border-gray-50">
          {([['users','👥 Хэрэглэгчид'],['payments','💳 Төлбөрүүд'],['stats','📊 Статистик']] as const).map(([t,l])=>(
            <button key={t} onClick={()=>setTab(t)}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-all ${tab===t?'border-emerald-600 text-emerald-700':'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {l}
              {t==='payments'&&pendingPayments.length>0&&(
                <span className="ml-1.5 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{pendingPayments.length}</span>
              )}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">

        {/* Stats overview */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            ['Нийт хэрэглэгч', String(users.length), 'text-gray-700'],
            ['Идэвхтэй', String(activeUsers), 'text-emerald-700'],
            ['Туршилт', String(trialUsers), 'text-amber-600'],
            ['Нийт орлого', fmt(totalRevenue)+'₮', 'text-emerald-700'],
          ].map(([l,v,c])=>(
            <div key={l} className="bg-white rounded-xl border border-gray-100 p-4 text-center">
              <div className="text-xs text-gray-400 mb-1">{l}</div>
              <div className={`text-xl font-bold ${c}`}>{v}</div>
            </div>
          ))}
        </div>

        {/* USERS TAB */}
        {tab==='users' && (
          <div className="bg-white rounded-2xl border border-gray-100">
            <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center">
              <h2 className="font-semibold text-gray-800">Бүх хэрэглэгчид ({users.length})</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    {['Имэйл / Утас','Бизнес','Статус','Туршилт дуусах','Захиалга','Үйлдэл'].map(h=>(
                      <th key={h} className="px-4 py-3 text-xs font-medium text-gray-500 text-left whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map(u=>{
                    const userOrders = orders.filter(o=>o.user_id===u.id).length
                    const statusBadge = u.subscription_status==='active'
                      ? <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">Идэвхтэй</span>
                      : u.subscription_status==='trial'
                      ? <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">Туршилт</span>
                      : <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">Дууссан</span>
                    return (
                      <tr key={u.id} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-800 text-xs">{u.email||'—'}</div>
                          {u.phone&&<div className="text-xs text-gray-400">{u.phone}</div>}
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-xs">{u.business_name||'—'}</td>
                        <td className="px-4 py-3">{statusBadge}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {u.subscription_status==='trial'&&u.trial_ends_at?fmtD(u.trial_ends_at):
                           u.subscription_ends_at?fmtD(u.subscription_ends_at):'—'}
                        </td>
                        <td className="px-4 py-3 text-center text-gray-700 font-medium">{userOrders}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1.5 flex-wrap">
                            <button onClick={()=>toggleAccess(u.id,u.subscription_status)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                                u.subscription_status==='expired'
                                  ?'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                                  :'bg-red-50 text-red-500 hover:bg-red-100'}`}>
                              {u.subscription_status==='expired'?'Нээх':'Хаах'}
                            </button>
                            <button onClick={()=>extendTrial(u.id)}
                              className="px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-50 text-amber-600 hover:bg-amber-100">
                              +7 хоног
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

        {/* PAYMENTS TAB */}
        {tab==='payments' && (
          <div className="space-y-4">
            {pendingPayments.length>0&&(
              <div className="bg-white rounded-2xl border border-amber-200">
                <div className="px-5 py-4 border-b border-amber-100 flex items-center gap-2">
                  <span className="text-amber-600 font-semibold">⏳ Хүлээгдэж буй төлбөрүүд ({pendingPayments.length})</span>
                </div>
                <div className="divide-y divide-gray-100">
                  {pendingPayments.map(p=>{
                    const u = users.find(u=>u.id===p.user_id)
                    return (
                      <div key={p.id} className="px-5 py-4 flex justify-between items-center flex-wrap gap-3">
                        <div>
                          <div className="font-medium text-gray-800">{u?.email||u?.phone||p.user_id.slice(0,8)}</div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            Дүн: <b>{fmt(p.amount)}₮</b> · Гүйлгээ: <b>{p.reference_code}</b>
                          </div>
                          <div className="text-xs text-gray-400">
                            {fmtD(p.created_at)} · {p.period_start} → {p.period_end}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={()=>confirmPayment(p.id,p.user_id,p.period_end)}
                            className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700">
                            ✓ Баталгаажуулах
                          </button>
                          <button onClick={()=>rejectPayment(p.id)}
                            className="px-4 py-2 bg-red-50 text-red-500 rounded-xl text-sm font-medium hover:bg-red-100">
                            ✕ Цуцлах
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-gray-100">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-800">Бүх төлбөрүүд ({payments.length})</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      {['Хэрэглэгч','Дүн','Гүйлгээний №','Хугацаа','Огноо','Статус'].map(h=>(
                        <th key={h} className="px-4 py-3 text-xs font-medium text-gray-500 text-left whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map(p=>{
                      const u = users.find(u=>u.id===p.user_id)
                      const badge = p.status==='confirmed'
                        ?<span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs">Баталгаажсан</span>
                        :p.status==='pending'
                        ?<span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs">Хүлээгдэж байна</span>
                        :<span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs">Цуцлагдсан</span>
                      return (
                        <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
                          <td className="px-4 py-3 text-xs">{u?.email||u?.phone||p.user_id.slice(0,8)}</td>
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

        {/* STATS TAB */}
        {tab==='stats' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-800 mb-4">👥 Хэрэглэгчдийн статус</h3>
              <div className="space-y-3">
                {[
                  ['Идэвхтэй', activeUsers, '#10B981'],
                  ['Туршилт', trialUsers, '#F59E0B'],
                  ['Дууссан', users.filter(u=>u.subscription_status==='expired').length, '#EF4444'],
                ].map(([l,v,c])=>(
                  <div key={String(l)} className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">{l}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-gray-100 rounded-full h-2">
                        <div className="h-2 rounded-full" style={{width:users.length?`${Math.round(Number(v)/users.length*100)}%`:'0%',background:String(c)}} />
                      </div>
                      <span className="text-sm font-semibold text-gray-800 w-6 text-right">{v}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-800 mb-4">💰 Орлогын дүгнэлт</h3>
              <div className="space-y-2">
                {[
                  ['Нийт баталгаажсан', fmt(totalRevenue)+'₮'],
                  ['Хүлээгдэж буй', fmt(payments.filter(p=>p.status==='pending').reduce((a,p)=>a+p.amount,0))+'₮'],
                  ['Нийт төлбөр', String(payments.length)],
                  ['Нийт захиалга', String(orders.length)],
                ].map(([l,v])=>(
                  <div key={String(l)} className="flex justify-between py-1.5 border-b border-gray-50 last:border-0">
                    <span className="text-sm text-gray-500">{l}</span>
                    <span className="text-sm font-semibold text-gray-800">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
