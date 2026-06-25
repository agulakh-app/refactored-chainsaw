'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useOwnerId, useActiveStore } from '../client-layout'
import type { Order } from '@/lib/types'

function fmt(n: number) { return n.toLocaleString() }
function fmtD(d: string) { if(!d) return ''; const [y,m,day]=d.split('-'); return m+'/'+day }

export default function ReconcilePage() {
  const ownerId = useOwnerId()
  const activeStoreId = useActiveStore()
  const [orders, setOrders] = useState<Order[]>([])
  const [recs, setRecs] = useState<any[]>([])
  const [tab, setTab] = useState<'new'|'list'>('list')
  const [recFrom, setRecFrom] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0,10))
  const [recTo, setRecTo] = useState(new Date().toISOString().slice(0,10))
  const [recCourier, setRecCourier] = useState('')
  const [recReceived, setRecReceived] = useState('')
  const [recNote, setRecNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [flash, setFlash] = useState('')
  const [editId, setEditId] = useState<string|null>(null)
  const [editData, setEditData] = useState<any>({})

  const showFlash = (m: string) => { setFlash(m); setTimeout(()=>setFlash(''),2500) }

  const load = useCallback(async () => {
    const { data:{ user } } = await supabase.auth.getUser()
    const targetId = ownerId || user?.id
    if(!targetId) return
    const q = supabase.from('orders').select('*, order_items(*)').eq('user_id', targetId).eq('status','delivered')
    const { data: ords } = activeStoreId ? await q.eq('store_id', activeStoreId) : await q
    setOrders(ords||[])
    const { data: rs } = await supabase.from('delivery_reconciliations')
      .select('*').eq('user_id', targetId).order('date_from',{ascending:false})
    setRecs(rs||[])
  },[ownerId, activeStoreId])

  useEffect(()=>{ load() },[load])

  const calcSystemAmt = (from: string, to: string) =>
    orders.filter(o=>{ const d=o.date||''; return d>=from&&d<=to })
      .reduce((sum,o)=>{
        const gross=(o.order_items||[]).reduce((a:number,it:any)=>a+it.quantity*it.unit_price,0)
        return sum+gross-(o.delivery_fee||0)
      },0)

  async function save() {
    if(!recCourier||!recReceived) return
    const { data:{ user } } = await supabase.auth.getUser()
    const targetId = ownerId || user?.id
    if(!targetId) return
    setSaving(true)
    const systemAmt = calcSystemAmt(recFrom, recTo)
    const received = Number(recReceived.replace(/[^0-9]/g,''))
    const diff = received - systemAmt
    const status = diff===0?'matched':diff>0?'surplus':'shortage'
    await supabase.from('delivery_reconciliations').insert({
      user_id:targetId, store_id:activeStoreId||null,
      date_from:recFrom, date_to:recTo,
      courier:recCourier, system_amount:systemAmt,
      received_amount:received, note:recNote, status
    })
    setRecCourier(''); setRecReceived(''); setRecNote('')
    setSaving(false); setTab('list')
    showFlash('Хадгалагдлаа ✓'); load()
  }

  async function saveEdit(id: string) {
    const received = Number(String(editData.received_amount||'').replace(/[^0-9]/g,''))
    const system = Number(editData.system_amount||0)
    const diff = received - system
    const status = diff===0?'matched':diff>0?'surplus':'shortage'
    await supabase.from('delivery_reconciliations').update({
      date_from: editData.date_from,
      date_to: editData.date_to,
      courier: editData.courier,
      system_amount: system,
      received_amount: received,
      note: editData.note||'',
      status
    }).eq('id', id)
    setEditId(null); showFlash('Засварлагдлаа ✓'); load()
  }

  async function deleteRec(id: string) {
    await supabase.from('delivery_reconciliations').delete().eq('id',id)
    showFlash('Устгагдлаа'); load()
  }

  const systemAmt = calcSystemAmt(recFrom, recTo)
  const recOrders = orders.filter(o=>{ const d=o.date||''; return d>=recFrom&&d<=recTo })

  return (
    <div className="space-y-4">
      {flash&&<div className="fixed top-4 right-4 bg-gray-900 text-white text-sm px-4 py-2 rounded-lg z-50">{flash}</div>}

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-800">Тооцоо бүртгэл</h2>
            <p className="text-xs text-gray-400 mt-0.5">Хүргэлтийн компанийн тушаасан орлогын тулгалт</p>
          </div>
          <button onClick={()=>setTab(tab==='new'?'list':'new')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab==='new'?'bg-gray-100 text-gray-600':'bg-[#0a2e24] text-white'}`}>
            {tab==='new'?'Болих':'＋ Шинэ тулгалт'}
          </button>
        </div>

        {/* Шинэ тулгалт форм */}
        {tab==='new'&&(
          <div className="p-5 space-y-4 max-w-xl">
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

            {/* Системийн дүн */}
            <div className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3 flex items-center justify-between">
              <div>
                <div className="text-xs text-gray-400 mb-0.5">Системийн тооцоолсон дүн</div>
                <div className="text-xl font-bold text-gray-800">{fmt(systemAmt)}₮</div>
                <div className="text-xs text-gray-400 mt-0.5">{recOrders.length} хүргэгдсэн захиалга</div>
              </div>
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Хүргэлтийн компани</label>
                <input className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                  placeholder="Супердэлив..." value={recCourier} onChange={e=>setRecCourier(e.target.value)}/>
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
                <div className={`rounded-xl p-3 flex items-center justify-between text-sm font-medium ${
                  diff===0?'bg-emerald-50 text-emerald-700':diff>0?'bg-blue-50 text-blue-700':'bg-red-50 text-red-600'}`}>
                  <span>{diff===0?'✅ Тооцоо таарав':diff>0?'📈 Илүү орлоо':'⚠️ Дутуу'}</span>
                  {diff!==0&&<span className="font-bold">{fmt(Math.abs(diff))}₮</span>}
                </div>
              )
            })()}

            <div>
              <label className="block text-xs text-gray-500 mb-1">Тэмдэглэл</label>
              <textarea className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none" rows={2}
                placeholder="Буцаасан бараа, хаяг буруу г.м..." value={recNote} onChange={e=>setRecNote(e.target.value)}/>
            </div>

            <button onClick={save} disabled={saving||!recCourier||!recReceived}
              className="w-full py-2.5 bg-[#0a2e24] text-white rounded-xl text-sm font-medium hover:bg-[#0d3d2f] disabled:opacity-40">
              {saving?'Хадгалж байна...':'Хадгалах'}
            </button>
          </div>
        )}
      </div>

      {/* Бүртгэлийн хүснэгт */}
      {tab==='list'&&recs.length>0&&(
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          {/* Толгой */}
          <div className="grid text-xs text-gray-400 font-medium px-4 py-2.5 bg-gray-50 border-b border-gray-100"
            style={{gridTemplateColumns:'90px 1fr 1fr 1fr 1fr auto'}}>
            <div>Огноо</div>
            <div>Компани</div>
            <div className="text-right">Тооцоолсон</div>
            <div className="text-right">Орлого</div>
            <div className="text-right">Зөрүү</div>
            <div></div>
          </div>

          <div className="divide-y divide-gray-100">
            {recs.map(r=>{
              const diff = r.received_amount - r.system_amount
              const isEdit = editId===r.id
              return(
                <div key={r.id}>
                  {!isEdit?(
                    <div className="grid items-center px-4 py-3 hover:bg-gray-50/50 transition-colors"
                      style={{gridTemplateColumns:'90px 1fr 1fr 1fr 1fr auto'}}>
                      <div>
                        <div className="text-xs font-medium text-gray-700">{fmtD(r.date_from)}</div>
                        <div className="text-xs text-gray-400">{fmtD(r.date_to)}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-700">{r.courier}</div>
                        {r.note&&<div className="text-xs text-gray-400 truncate max-w-[160px]">{r.note}</div>}
                      </div>
                      <div className="text-right text-sm text-gray-600">{fmt(r.system_amount)}₮</div>
                      <div className="text-right text-sm font-medium text-gray-800">{fmt(r.received_amount)}₮</div>
                      <div className="text-right">
                        {diff===0?(
                          <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">Таарсан</span>
                        ):(
                          <span className={`text-sm font-bold ${diff>0?'text-blue-600':'text-red-500'}`}>
                            {diff>0?'+':''}{fmt(diff)}₮
                          </span>
                        )}
                      </div>
                      <div className="flex gap-1 pl-2">
                        <button onClick={()=>{ setEditId(r.id); setEditData({...r, received_amount:String(r.received_amount)}) }}
                          className="text-xs text-gray-400 hover:text-gray-600 px-1.5 py-1 rounded hover:bg-gray-100">Засах</button>
                        <button onClick={()=>deleteRec(r.id)}
                          className="text-xs text-gray-300 hover:text-red-400 px-1.5 py-1 rounded hover:bg-red-50">✕</button>
                      </div>
                    </div>
                  ):(
                    <div className="px-4 py-3 bg-blue-50/30 space-y-3">
                      <div className="grid gap-2" style={{gridTemplateColumns:'1fr 1fr 1fr 1fr'}}>
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Эхлэх огноо</label>
                          <input type="date" className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs"
                            value={editData.date_from} onChange={e=>setEditData((p:any)=>({...p,date_from:e.target.value}))}/>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Дуусах огноо</label>
                          <input type="date" className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs"
                            value={editData.date_to} onChange={e=>setEditData((p:any)=>({...p,date_to:e.target.value}))}/>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Компани</label>
                          <input className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs"
                            value={editData.courier} onChange={e=>setEditData((p:any)=>({...p,courier:e.target.value}))}/>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Тушаасан (₮)</label>
                          <input type="text" inputMode="numeric" className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs"
                            value={editData.received_amount} onChange={e=>setEditData((p:any)=>({...p,received_amount:e.target.value}))}/>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Тэмдэглэл</label>
                        <input className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs"
                          value={editData.note||''} onChange={e=>setEditData((p:any)=>({...p,note:e.target.value}))}/>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button onClick={()=>setEditId(null)} className="px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 rounded-lg">Болих</button>
                        <button onClick={()=>saveEdit(r.id)} className="px-3 py-1.5 text-xs bg-[#0a2e24] text-white rounded-lg">Хадгалах</button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {tab==='list'&&recs.length===0&&(
        <div className="bg-white rounded-xl border border-gray-100 py-12 text-center">
          <div className="text-gray-300 text-4xl mb-3">📋</div>
          <p className="text-gray-400 text-sm">Тулгалт байхгүй байна</p>
          <button onClick={()=>setTab('new')} className="mt-3 text-sm text-emerald-600 hover:underline">＋ Шинэ тулгалт нэмэх</button>
        </div>
      )}
    </div>
  )
}
