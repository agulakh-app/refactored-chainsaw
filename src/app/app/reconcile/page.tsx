'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useOwnerId, useActiveStore } from '../client-layout'
import type { Order } from '@/lib/types'

function fmt(n: number) { return n.toLocaleString() }
function fmtD(d: string) { if(!d) return ''; const [y,m,day]=d.split('-'); return y+'/'+m+'/'+day }

export default function ReconcilePage() {
  const ownerId = useOwnerId()
  const activeStoreId = useActiveStore()
  const [orders, setOrders] = useState<Order[]>([])
  const [reconciliations, setReconciliations] = useState<any[]>([])
  const [tab, setTab] = useState<'new'|'list'>('list')
  const [recFrom, setRecFrom] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0,10))
  const [recTo, setRecTo] = useState(new Date().toISOString().slice(0,10))
  const [recCourier, setRecCourier] = useState('')
  const [recReceived, setRecReceived] = useState('')
  const [recNote, setRecNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [flash, setFlash] = useState('')

  const showFlash = (m: string) => { setFlash(m); setTimeout(()=>setFlash(''),2500) }

  const load = useCallback(async () => {
    const { data:{ user } } = await supabase.auth.getUser()
    const targetId = ownerId || user?.id
    if(!targetId) return
    const q = supabase.from('orders').select('*, order_items(*)')
      .eq('user_id', targetId).eq('status','delivered')
    const { data: ords } = activeStoreId ? await q.eq('store_id', activeStoreId) : await q
    setOrders(ords||[])
    const { data: recs } = await supabase.from('delivery_reconciliations')
      .select('*').eq('user_id', targetId)
      .order('created_at',{ascending:false})
    setReconciliations(recs||[])
  },[ownerId, activeStoreId])

  useEffect(()=>{ load() },[load])

  async function save() {
    if(!recCourier||!recReceived) return
    const { data:{ user } } = await supabase.auth.getUser()
    const targetId = ownerId || user?.id
    if(!targetId) return
    setSaving(true)
    const systemAmt = orders.filter(o=>{ const d=o.date||''; return d>=recFrom&&d<=recTo })
      .reduce((sum,o)=>{
        const gross=(o.order_items||[]).reduce((a:number,it:any)=>a+it.quantity*it.unit_price,0)
        return sum+gross-(o.delivery_fee||0)
      },0)
    const received = Number(recReceived.replace(/[^0-9]/g,''))
    const status = received===systemAmt?'matched':received>systemAmt?'surplus':'shortage'
    await supabase.from('delivery_reconciliations').insert({
      user_id:targetId, store_id:activeStoreId||null,
      date_from:recFrom, date_to:recTo,
      courier:recCourier, system_amount:systemAmt,
      received_amount:received, note:recNote, status
    })
    setRecCourier(''); setRecReceived(''); setRecNote('')
    setSaving(false); setTab('list')
    showFlash('Тулгалт хадгалагдлаа ✓')
    load()
  }

  async function deleteRec(id: string) {
    await supabase.from('delivery_reconciliations').delete().eq('id',id)
    showFlash('Устгагдлаа'); load()
  }

  // Шинэ тулгалтын системийн дүн
  const recOrders = orders.filter(o=>{ const d=o.date||''; return d>=recFrom&&d<=recTo })
  const systemAmt = recOrders.reduce((sum,o)=>{
    const gross=(o.order_items||[]).reduce((a:number,it:any)=>a+it.quantity*it.unit_price,0)
    return sum+gross-(o.delivery_fee||0)
  },0)

  return (
    <div className="space-y-4">
      {flash&&<div className="fixed top-4 right-4 bg-gray-900 text-white text-sm px-4 py-2 rounded-lg z-50">{flash}</div>}

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-medium text-gray-800 text-sm">🚚 Хүргэлтийн тооцоо тулгалт</h2>
          <div className="flex gap-2">
            <button onClick={()=>setTab('list')} className={`text-xs px-3 py-1.5 rounded-lg ${tab==='list'?'bg-gray-900 text-white':'text-gray-500 hover:bg-gray-50'}`}>Бүртгэл</button>
            <button onClick={()=>setTab('new')} className={`text-xs px-3 py-1.5 rounded-lg ${tab==='new'?'bg-emerald-600 text-white':'text-gray-500 hover:bg-gray-50'}`}>＋ Шинэ</button>
          </div>
        </div>

        {tab==='new'&&(
          <div className="p-4 space-y-4 max-w-lg">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Эхлэх огноо</label>
                <input type="date" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                  value={recFrom} onChange={e=>setRecFrom(e.target.value)}/>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Дуусах огноо</label>
                <input type="date" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                  value={recTo} onChange={e=>setRecTo(e.target.value)}/>
              </div>
            </div>

            <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
              <div className="text-xs text-emerald-600 mb-1">Системийн хүргэгдсэн захиалгын нийт орлого</div>
              <div className="text-2xl font-bold text-emerald-700">{fmt(systemAmt)}₮</div>
              <div className="text-xs text-gray-400 mt-1">{recOrders.length} захиалга · {fmtD(recFrom)} — {fmtD(recTo)}</div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Хүргэлтийн компани</label>
                <input className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                  placeholder="Супердэлив, Муур..." value={recCourier} onChange={e=>setRecCourier(e.target.value)}/>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Тушаасан орлого (₮)</label>
                <input type="text" inputMode="numeric" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                  placeholder="0" value={recReceived} onChange={e=>setRecReceived(e.target.value)}/>
              </div>
            </div>

            {recReceived&&(()=>{
              const recv=Number(recReceived.replace(/[^0-9]/g,''))
              const diff=recv-systemAmt
              return(
                <div className={`rounded-xl p-3 border text-sm font-medium flex items-center justify-between ${
                  diff===0?'bg-emerald-50 border-emerald-200 text-emerald-700':
                  diff>0?'bg-blue-50 border-blue-200 text-blue-700':
                  'bg-red-50 border-red-200 text-red-700'}`}>
                  <span>{diff===0?'✅ Таарсан':diff>0?'📈 Илүү':'⚠️ Дутуу'}</span>
                  <span>{diff===0?'Тооцоо таарав':fmt(Math.abs(diff))+'₮ '+(diff>0?'илүү':'дутуу')}</span>
                </div>
              )
            })()}

            <div>
              <label className="block text-xs text-gray-500 mb-1">Тэмдэглэл</label>
              <textarea className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none" rows={2}
                placeholder="Буцаасан бараа, хаяг буруу г.м..." value={recNote} onChange={e=>setRecNote(e.target.value)}/>
            </div>

            <button onClick={save} disabled={saving||!recCourier||!recReceived}
              className="w-full py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium disabled:opacity-50">
              {saving?'Хадгалж байна...':'Хадгалах'}
            </button>
          </div>
        )}

        {tab==='list'&&(
          reconciliations.length===0?(
            <p className="text-center text-gray-400 text-sm py-8">Тулгалт байхгүй байна</p>
          ):(
            <div className="divide-y divide-gray-100">
              {reconciliations.map(r=>{
                const diff=r.received_amount-r.system_amount
                return(
                  <div key={r.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm text-gray-800">{r.courier}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            r.status==='matched'?'bg-emerald-100 text-emerald-700':
                            r.status==='surplus'?'bg-blue-100 text-blue-700':
                            'bg-red-100 text-red-600'}`}>
                            {r.status==='matched'?'✅ Таарсан':r.status==='surplus'?'📈 Илүү':'⚠️ Дутуу'}
                          </span>
                        </div>
                        <div className="text-xs text-gray-400">{fmtD(r.date_from)} — {fmtD(r.date_to)}</div>
                        <div className="grid grid-cols-3 gap-2 mt-2">
                          <div><div className="text-xs text-gray-400">Системийн дүн</div><div className="text-sm font-medium">{fmt(r.system_amount)}₮</div></div>
                          <div><div className="text-xs text-gray-400">Тушаасан</div><div className="text-sm font-medium">{fmt(r.received_amount)}₮</div></div>
                          <div><div className="text-xs text-gray-400">Зөрүү</div>
                            <div className={`text-sm font-medium ${diff===0?'text-emerald-600':diff>0?'text-blue-600':'text-red-500'}`}>
                              {diff===0?'—':(diff>0?'+':'')+fmt(diff)+'₮'}
                            </div>
                          </div>
                        </div>
                        {r.note&&<div className="text-xs text-gray-400 mt-1 italic">"{r.note}"</div>}
                      </div>
                      <button onClick={()=>deleteRec(r.id)} className="text-gray-300 hover:text-red-400 text-xs">✕</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        )}
      </div>
    </div>
  )
}
