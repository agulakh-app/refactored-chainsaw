'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useOwnerId, useActiveStore } from '../client-layout'
import type { Order } from '@/lib/types'

function fmt(n: number) { return n.toLocaleString() }
function fmtD(d: string) { if(!d) return ''; const [y,m,day]=d.split('-'); return m+'/'+day }
const TODAY = new Date().toISOString().slice(0,10)

export default function ReconcilePage() {
  const ownerId = useOwnerId()
  const activeStoreId = useActiveStore()
  const [orders, setOrders] = useState<Order[]>([])
  const [recs, setRecs] = useState<any[]>([])
  const [showAll, setShowAll] = useState(false)
  const [recFrom, setRecFrom] = useState(TODAY)
  const [recTo, setRecTo] = useState(TODAY)
  const [recSource, setRecSource] = useState('')
  const [recReceived, setRecReceived] = useState('')
  const [recNote, setRecNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [flash, setFlash] = useState('')
  const [editId, setEditId] = useState<string|null>(null)
  const [editData, setEditData] = useState<any>({})
  const [sourceDropOpen, setSourceDropOpen] = useState(false)
  const [hiddenSources, setHiddenSources] = useState<string[]>([])
  const sourceRef = useRef<HTMLDivElement>(null)

  const showFlash = (m: string) => { setFlash(m); setTimeout(()=>setFlash(''),2500) }

  // Өмнө ашигласан эх үүсвэрүүд
  const savedSources: string[] = Array.from(new Set(recs.map((r:any)=>r.courier).filter(Boolean))).filter((s:any)=>!hiddenSources.includes(s)) as string[]

  const load = useCallback(async () => {
    const { data:{ user } } = await supabase.auth.getUser()
    const targetId = ownerId || user?.id
    if(!targetId) return
    // 1. Бүх delivered захиалга татна (nested order_items ашиглахгүй — 1000 row limit-аас сэргийлнэ)
    const allOrds:any[]=[]
    let pg=0
    while(true){
      const q = supabase.from('orders').select('id,date,delivery_fee,status,store_id').eq('user_id',targetId).eq('status','delivered').order('date',{ascending:false}).range(pg*1000,(pg+1)*1000-1)
      const { data: pageOrds } = activeStoreId ? await q.eq('store_id',activeStoreId) : await q
      if(!pageOrds||pageOrds.length===0) break
      allOrds.push(...pageOrds)
      if(pageOrds.length<1000) break
      pg++
    }
    // 2. order_items-г 500-аар batch татна
    const allIds=allOrds.map((o:any)=>o.id)
    const itemMap:any={}
    for(let i=0;i<allIds.length;i+=500){
      const {data:items}=await supabase.from('order_items').select('order_id,quantity,unit_price').in('order_id',allIds.slice(i,i+500)).limit(5000)
      for(const it of (items||[])){
        if(!itemMap[it.order_id]) itemMap[it.order_id]=[]
        itemMap[it.order_id].push(it)
      }
    }
    setOrders(allOrds.map((o:any)=>({...o,order_items:itemMap[o.id]||[]})))
    const { data: rs } = await supabase.from('delivery_reconciliations')
      .select('*').eq('user_id', targetId).order('date_from',{ascending:false})
    setRecs(rs||[])
  },[ownerId, activeStoreId])

  useEffect(()=>{ load() },[load])

  // Orders болон order_items өөрчлөгдөхөд автоматаар шинэчлэх
  useEffect(()=>{
    const channel = supabase.channel('reconcile-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, ()=>{ load() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, ()=>{ load() })
      .subscribe()
    return ()=>{ supabase.removeChannel(channel) }
  },[load])

  useEffect(()=>{
    function handleClick(e: MouseEvent){
      if(sourceRef.current&&!sourceRef.current.contains(e.target as Node)) setSourceDropOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return()=>document.removeEventListener('mousedown', handleClick)
  },[])

  const calcSystemAmt = (from: string, to: string) =>
    orders.filter(o=>{ const d=o.date||''; return d>=from&&d<=to })
      .reduce((sum,o)=>{
        const gross=(o.order_items||[]).reduce((a:number,it:any)=>a+it.quantity*it.unit_price,0)
        return sum+gross-(o.delivery_fee||0)
      },0)

  const systemAmt = calcSystemAmt(recFrom, recTo)
  const recOrderCount = orders.filter(o=>{ const d=o.date||''; return d>=recFrom&&d<=recTo }).length
  const received = Number(recReceived.replace(/[^0-9]/g,''))||0
  const diff = received - systemAmt

  async function save() {
    if(!recSource||!recReceived) return
    const { data:{ user } } = await supabase.auth.getUser()
    const targetId = ownerId || user?.id
    if(!targetId) return
    setSaving(true)
    const status = diff===0?'matched':diff>0?'surplus':'shortage'
    await supabase.from('delivery_reconciliations').insert({
      user_id:targetId, store_id:activeStoreId||null,
      date_from:recFrom, date_to:recTo,
      courier:recSource, system_amount:systemAmt,
      received_amount:received, note:recNote, status
    })
    setRecSource(''); setRecReceived(''); setRecNote('')
    setSaving(false); showFlash('Хадгалагдлаа ✓'); load()
  }

  async function saveEdit(id: string) {
    const recv = Number(String(editData.received_amount||'').replace(/[^0-9]/g,''))
    const sys = calcSystemAmt(editData.date_from, editData.date_to)
    const d = recv - sys
    const status = d===0?'matched':d>0?'surplus':'shortage'
    await supabase.from('delivery_reconciliations').update({
      date_from:editData.date_from, date_to:editData.date_to,
      courier:editData.courier, system_amount:sys,
      received_amount:recv, note:editData.note||'', status
    }).eq('id', id)
    setEditId(null); showFlash('Засварлагдлаа ✓'); load()
  }

  async function deleteRec(id: string) {
    await supabase.from('delivery_reconciliations').delete().eq('id',id)
    showFlash('Устгагдлаа'); load()
  }

  const filteredSources = savedSources.filter(s=>s.toLowerCase().includes(recSource.toLowerCase())&&s!==recSource)
  const visibleRecs = showAll ? recs : recs.slice(0,5)

  return (
    <div className="space-y-4">
      {flash&&<div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none"><div className="bg-gray-900 text-white text-sm px-6 py-3 rounded-2xl shadow-2xl animate-bounce-once">{flash}</div></div>}

      <div className="grid gap-4 items-start" style={{gridTemplateColumns:'2fr 3fr'}}>
        {/* Зүүн: Форм — 1/5 хасаад */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
          <h2 className="font-semibold text-gray-800 text-sm">Тооцоо бүртгэх</h2>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Эхлэх</label>
              <input type="date" className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs"
                value={recFrom} onChange={e=>setRecFrom(e.target.value)}/>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Дуусах</label>
              <input type="date" className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs"
                value={recTo} onChange={e=>setRecTo(e.target.value)}/>
            </div>
          </div>

          <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2.5">
            <div className="text-xs text-gray-400 mb-0.5">Тооцоолсон орлого</div>
            <div className="text-lg font-bold text-emerald-600">{fmt(systemAmt)}₮</div>
            <div className="text-xs text-gray-400">{recOrderCount} хүргэгдсэн захиалга</div>
          </div>

          {/* Эх үүсвэр — dropdown + x */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Орлого тушаасан</label>
            <div className="relative" ref={sourceRef}>
              <div className="flex items-center gap-1">
                <input
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm"
                  placeholder="Супердэлив, худалдагч..."
                  value={recSource}
                  onChange={e=>{ setRecSource(e.target.value); setSourceDropOpen(true) }}
                  onFocus={()=>setSourceDropOpen(true)}
                />
                {recSource&&(
                  <button onClick={()=>setRecSource('')}
                    className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 flex-shrink-0">
                    ✕
                  </button>
                )}
              </div>
              {sourceDropOpen&&filteredSources.length>0&&(
                <div className="absolute top-full left-0 right-0 z-30 bg-white border border-gray-200 rounded-lg mt-1 shadow-lg overflow-hidden">
                  {filteredSources.map(s=>(
                    <div key={s} className="flex items-center hover:bg-emerald-50 group">
                      <button onMouseDown={()=>{ setRecSource(s); setSourceDropOpen(false) }}
                        className="flex-1 text-left px-3 py-2 text-sm text-gray-700 group-hover:text-emerald-700">
                        {s}
                      </button>
                      <button onMouseDown={(e)=>{
                        e.preventDefault()
                        setHiddenSources(prev=>[...prev,s])
                        setSourceDropOpen(false)
                      }}
                        className="px-2 py-2 text-gray-300 hover:text-red-400 text-xs">✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Тушаасан дүн (₮)</label>
            <input type="text" inputMode="numeric" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
              placeholder="0" value={recReceived} onChange={e=>setRecReceived(e.target.value)}/>
          </div>

          {recReceived&&(
            <div className={`rounded-lg px-3 py-2 text-sm font-medium flex items-center justify-between ${
              diff===0?'bg-emerald-50 text-emerald-700':diff>0?'bg-blue-50 text-blue-700':'bg-red-50 text-red-600'}`}>
              <span>{diff===0?'✅ Таарсан':diff>0?'Илүү':'Дутуу'}</span>
              {diff!==0&&<span className="font-bold">{fmt(Math.abs(diff))}₮</span>}
            </div>
          )}

          <div>
            <label className="block text-xs text-gray-400 mb-1">Тэмдэглэл</label>
            <textarea className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none" rows={2}
              placeholder="Буцаасан бараа, тайлбар..." value={recNote} onChange={e=>setRecNote(e.target.value)}/>
          </div>

          <button onClick={save} disabled={saving||!recSource||!recReceived}
            className="w-full py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-40">
            {saving?'Хадгалж байна...':'Хадгалах'}
          </button>
        </div>

        {/* Баруун: Жагсаалт */}
        <div className="flex-1 bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-gray-400 font-medium">
                <th className="text-left px-3 py-2.5 whitespace-nowrap">Огноо</th>
                <th className="text-right px-3 py-2.5 whitespace-nowrap">Тооцоолсон</th>
                <th className="text-right px-3 py-2.5 whitespace-nowrap">Тушаасан</th>
                <th className="text-left px-3 py-2.5 whitespace-nowrap">Эх үүсвэр</th>
                <th className="text-right px-3 py-2.5 whitespace-nowrap">Зөрүү</th>
                <th className="text-left px-3 py-2.5 w-full">Тэмдэглэл</th>
                <th className="px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
          {recs.length===0?(
            <tr><td colSpan={7} className="py-12 text-center text-gray-400">Тооцоо бүртгэл байхгүй</td></tr>
          ):(
            <>
              {visibleRecs.map(r=>{
                const liveSys = calcSystemAmt(r.date_from, r.date_to)
                const d = r.received_amount - liveSys
                const isEdit = editId===r.id
                return(
                  <tr key={r.id} className="border-b border-gray-100 last:border-0">
                    {!isEdit?(
                      <>
                        <td className="px-3 py-2.5 font-medium text-gray-700 whitespace-nowrap">
                          {fmtD(r.date_from)}{r.date_from!==r.date_to&&<span className="text-gray-400">–{fmtD(r.date_to)}</span>}
                        </td>
                        <td className="px-3 py-2.5 text-right text-gray-500 whitespace-nowrap">{fmt(liveSys)}₮</td>
                        <td className="px-3 py-2.5 text-right font-medium text-gray-800 whitespace-nowrap">{fmt(r.received_amount)}₮</td>
                        <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap">{r.courier}</td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap">
                          {d===0?(
                            <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">Таарсан</span>
                          ):(
                            <span className={`font-bold ${d>0?'text-blue-600':'text-red-500'}`}>
                              {d>0?'+':''}{fmt(d)}₮
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-gray-400 max-w-0"><div className="truncate">{r.note||'—'}</div></td>
                        <td className="px-3 py-2.5">
                          <div className="flex gap-1 justify-end whitespace-nowrap">
                          <button onClick={()=>{ setEditId(r.id); setEditData({...r,received_amount:String(r.received_amount)}) }}
                            className="text-gray-400 hover:text-gray-700 px-1.5 py-1 rounded hover:bg-gray-100">Засах</button>
                          <button onClick={()=>deleteRec(r.id)}
                            className="text-gray-300 hover:text-red-400 px-1.5 py-1 rounded hover:bg-red-50">✕</button>
                          </div>
                        </td>
                      </>
                    ):(
                      <td colSpan={7} className="px-4 py-3 bg-gray-50/50">
                        <div className="space-y-2">
                        <div className="grid gap-2" style={{gridTemplateColumns:'1fr 1fr 1fr 1fr 1fr'}}>
                          <div>
                            <label className="block text-xs text-gray-400 mb-1">Эхлэх</label>
                            <input type="date" className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs"
                              value={editData.date_from} onChange={e=>setEditData((p:any)=>({...p,date_from:e.target.value}))}/>
                          </div>
                          <div>
                            <label className="block text-xs text-gray-400 mb-1">Дуусах</label>
                            <input type="date" className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs"
                              value={editData.date_to} onChange={e=>setEditData((p:any)=>({...p,date_to:e.target.value}))}/>
                          </div>
                          <div>
                            <label className="block text-xs text-gray-400 mb-1">Систем дүн (шинэчлэгдсэн)</label>
                            <div className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs bg-gray-100 text-gray-500">
                              {fmt(calcSystemAmt(editData.date_from, editData.date_to))}₮
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs text-gray-400 mb-1">Тушаасан (₮)</label>
                            <input type="text" inputMode="numeric" className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs"
                              value={editData.received_amount} onChange={e=>setEditData((p:any)=>({...p,received_amount:e.target.value}))}/>
                          </div>
                          <div>
                            <label className="block text-xs text-gray-400 mb-1">Эх үүсвэр</label>
                            <input className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs"
                              value={editData.courier} onChange={e=>setEditData((p:any)=>({...p,courier:e.target.value}))}/>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Тэмдэглэл</label>
                          <input className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs"
                            value={editData.note||''} onChange={e=>setEditData((p:any)=>({...p,note:e.target.value}))}/>
                        </div>
                        <div className="flex gap-2 justify-end">
                          <button onClick={()=>setEditId(null)} className="px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 rounded-lg">Болих</button>
                          <button onClick={()=>saveEdit(r.id)} className="px-3 py-1.5 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">Хадгалах</button>
                        </div>
                      </div>
                      </td>
                    )}
                  </tr>
                )
              })}
              {recs.length>5&&(
                <tr><td colSpan={7} className="px-4 py-2.5 text-center border-t border-gray-100">
                  <button onClick={()=>setShowAll(!showAll)}
                    className="text-xs text-emerald-600 hover:underline">
                    {showAll?'Хураах':`Дэлгэх (${recs.length-5} үлдсэн)`}
                  </button>
                </td></tr>
              )}
            </>
          )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
