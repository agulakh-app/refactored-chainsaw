'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Product, RestockLog } from '@/lib/types'

const TODAY = new Date().toISOString().slice(0,10)
function fmtD(d: string) { if(!d) return ''; const [y,m,day]=d.split('-'); return `${y}/${m}/${day}` }

export default function StockPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [logs, setLogs] = useState<RestockLog[]>([])
  const [flash, setFlash] = useState('')
  const [logFilter, setLogFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('')
  const [rProd, setRProd] = useState('')
  const [rQty, setRQty] = useState('1')
  const [rDate, setRDate] = useState(TODAY)
  const [rNote, setRNote] = useState('')
  const [nName, setNName] = useState('')
  const [nPrice, setNPrice] = useState('')
  const [nQty, setNQty] = useState('0')
  const [nDate, setNDate] = useState(TODAY)
  const [editLog, setEditLog] = useState<RestockLog|null>(null)
  const [editQty, setEditQty] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editNote, setEditNote] = useState('')

  const showFlash = (m: string) => { setFlash(m); setTimeout(()=>setFlash(''),2500) }

  const load = useCallback(async () => {
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user) return
    const [{ data: prods },{ data: ls }] = await Promise.all([
      supabase.from('products').select('*').eq('user_id',user.id).order('name'),
      // Зөвхөн 'Захиалга' бус бүртгэлийг харуулна
      supabase.from('restock_log').select('*').eq('user_id',user.id)
        .neq('note','Захиалга')
        .order('date',{ascending:false}).order('created_at',{ascending:false})
    ])
    setProducts(prods||[])
    setLogs(ls||[])
    if (prods&&prods.length>0&&!rProd) setRProd(prods[0].id)
  },[rProd])

  useEffect(()=>{ load() },[load])

  async function addRestock() {
    const qty = Number(rQty)
    if (qty===0) { showFlash('Тоо оруулна уу'); return }
    const p = products.find(x=>x.id===rProd)
    if (!p) return
    const { data:{ user } } = await supabase.auth.getUser()
    const isNeg = qty < 0
    const absQty = Math.abs(qty)
    const newStock = isNeg ? Math.max(0, p.stock-absQty) : p.stock+absQty
    await Promise.all([
      supabase.from('products').update({stock:newStock}).eq('id',rProd),
      supabase.from('restock_log').insert({
        user_id:user!.id, product_id:rProd, product_name:p.name,
        quantity:absQty, type:isNeg?'out':'in',
        note:rNote||(isNeg?'Гараар хасалт':'Цэнэглэлт'), date:rDate
      })
    ])
    setRQty('1'); setRNote(''); setRDate(TODAY)
    showFlash(p.name+(isNeg?`: −${absQty}ш хасагдлаа`:`+${absQty}ш нэмэгдлээ`)+' ✓')
    load()
  }

  async function addNewProduct() {
    if (!nName.trim()) { showFlash('Нэр оруулна уу'); return }
    const { data:{ user } } = await supabase.auth.getUser()
    const { data: prod } = await supabase.from('products').insert({
      user_id:user!.id, name:nName.trim(), unit_price:Number(nPrice)||0,
      stock:Number(nQty)||0, added_date:nDate
    }).select().single()
    if (prod&&Number(nQty)>0) await supabase.from('restock_log').insert({
      user_id:user!.id, product_id:prod.id, product_name:nName.trim(),
      quantity:Number(nQty), type:'in', note:'Шинэ бараа', date:nDate
    })
    setNName(''); setNPrice(''); setNQty('0'); setNDate(TODAY)
    showFlash(nName+' нэмэгдлээ ✓'); load()
  }

  async function deleteLog(log: RestockLog) {
    if (!confirm('Энэ бүртгэлийг устгах уу?')) return
    const p = products.find(x=>x.id===log.product_id)
    if (p) await supabase.from('products').update({
      stock: Math.max(0, log.type==='in'?p.stock-log.quantity:p.stock+log.quantity)
    }).eq('id',p.id)
    await supabase.from('restock_log').delete().eq('id',log.id)
    showFlash('Устгагдлаа'); load()
  }

  async function saveEditLog() {
    if (!editLog) return
    const newQty = Number(editQty)
    const diff = newQty-editLog.quantity
    const p = products.find(x=>x.id===editLog.product_id)
    if (p&&diff!==0) await supabase.from('products').update({
      stock: Math.max(0, p.stock+(editLog.type==='in'?diff:-diff))
    }).eq('id',p.id)
    await supabase.from('restock_log').update({quantity:newQty,date:editDate,note:editNote}).eq('id',editLog.id)
    setEditLog(null); showFlash('Засварлагдлаа ✓'); load()
  }

  // Filter logs
  let filteredLogs = logs
  if (logFilter!=='all') filteredLogs = filteredLogs.filter(l=>l.product_name===logFilter)
  if (dateFilter) filteredLogs = filteredLogs.filter(l=>l.date===dateFilter)

  // Group by DATE
  const logGroups: Record<string,RestockLog[]> = {}
  filteredLogs.forEach(l=>{ if(!logGroups[l.date])logGroups[l.date]=[]; logGroups[l.date].push(l) })

  const zeros = products.filter(p=>p.stock===0)
  const warns = products.filter(p=>p.stock>0&&p.stock<=10)

  return (
    <div className="space-y-5">
      {flash&&<div className="fixed top-4 right-4 bg-emerald-700 text-white text-sm px-4 py-2 rounded-lg shadow-lg z-50">{flash}</div>}

      {/* Edit modal */}
      {editLog&&(
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="font-semibold text-gray-800 mb-4">Цэнэглэлт засварлах</h3>
            <div className="space-y-3">
              <div><label className="block text-xs text-gray-500 mb-1">Бараа</label>
                <div className="text-sm font-medium bg-gray-50 px-3 py-2 rounded-lg">{editLog.product_name}</div></div>
              <div><label className="block text-xs text-gray-500 mb-1">Тоо ширхэг</label>
                <input type="number" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  value={editQty} onChange={e=>setEditQty(e.target.value)} /></div>
              <div><label className="block text-xs text-gray-500 mb-1">Огноо</label>
                <input type="date" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  value={editDate} onChange={e=>setEditDate(e.target.value)} /></div>
              <div><label className="block text-xs text-gray-500 mb-1">Тэмдэглэл</label>
                <input className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  value={editNote} onChange={e=>setEditNote(e.target.value)} /></div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={()=>setEditLog(null)} className="flex-1 py-2 rounded-xl border border-gray-200 text-sm">Болих</button>
              <button onClick={saveEditLog} className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold">Хадгалах</button>
            </div>
          </div>
        </div>
      )}

      {/* 1. ЦЭНЭГЛЭЛТ */}
      <div className="card">
        <h2 className="font-semibold text-gray-800 mb-4 text-base">📅 Цэнэглэлтийн бүртгэл</h2>
        <div className="bg-gray-50 rounded-xl p-4 mb-5 border border-gray-100">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div><label className="block text-xs text-gray-500 mb-1">Бараа</label>
              <select className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" value={rProd} onChange={e=>setRProd(e.target.value)}>
                {products.map(p=><option key={p.id} value={p.id}>{p.name} ({p.stock}ш)</option>)}
              </select></div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Тоо ширхэг <span className="text-gray-400">(−тоо бичвэл хасна)</span>
              </label>
              <input type="number" value={rQty} onChange={e=>setRQty(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg border text-sm ${Number(rQty)<0?'border-red-300 bg-red-50 text-red-700 font-semibold':'border-gray-200'}`} />
            </div>
            <div><label className="block text-xs text-gray-500 mb-1">Огноо</label>
              <input type="date" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                value={rDate} onChange={e=>setRDate(e.target.value)} /></div>
          </div>
          <div className="mt-3"><label className="block text-xs text-gray-500 mb-1">Тэмдэглэл</label>
            <input className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
              placeholder="Нийлүүлэгч..." value={rNote} onChange={e=>setRNote(e.target.value)} /></div>
          {Number(rQty)<0&&(
            <div className="mt-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-xs text-red-600">
              ⚠ {Math.abs(Number(rQty))}ш агуулахаас хасагдана
            </div>
          )}
          <div className="flex justify-end mt-3">
            <button onClick={addRestock}
              className={`px-5 py-2 rounded-xl text-sm font-medium text-white transition-all ${Number(rQty)<0?'bg-red-500 hover:bg-red-600':'bg-emerald-600 hover:bg-emerald-700'}`}>
              {Number(rQty)<0?'− Хасах':'+ Цэнэглэлт бүртгэх'}
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-3 flex-wrap items-center">
          <select className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs" value={logFilter} onChange={e=>setLogFilter(e.target.value)}>
            <option value="all">Бүх бараа</option>
            {products.map(p=><option key={p.id} value={p.name}>{p.name}</option>)}
          </select>
          <input type="date" className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs"
            value={dateFilter} onChange={e=>setDateFilter(e.target.value)} title="Өдрөөр шүүх" />
          {dateFilter&&<button onClick={()=>setDateFilter('')} className="px-2 py-1 rounded-lg border border-gray-200 text-xs text-gray-500 hover:bg-gray-50">✕</button>}
        </div>

        {/* Grouped by DATE */}
        {Object.keys(logGroups).sort((a,b)=>b.localeCompare(a)).map(date=>{
          const grp = logGroups[date]
          const totalIn = grp.filter(r=>r.type==='in').reduce((a,r)=>a+r.quantity,0)
          const totalOut = grp.filter(r=>r.type==='out').reduce((a,r)=>a+r.quantity,0)
          return (
            <div key={date} className="mb-4">
              <div className="flex justify-between items-center bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 mb-1.5">
                <span className="text-sm font-bold text-emerald-800">{fmtD(date)}</span>
                <div className="flex gap-2">
                  {totalIn>0&&<span className="text-xs font-medium text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">+{totalIn}ш</span>}
                  {totalOut>0&&<span className="text-xs font-medium text-red-500 bg-red-50 px-2 py-0.5 rounded-full">−{totalOut}ш</span>}
                </div>
              </div>
              {grp.map(r=>(
                <div key={r.id} className="flex justify-between items-center py-2.5 px-2 border-b border-gray-50 last:border-0 hover:bg-gray-50 rounded-lg group">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-800">{r.product_name}</div>
                    {r.note&&<div className="text-xs text-gray-400 mt-0.5">{r.note}</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`text-lg font-semibold ${r.type==='in'?'text-emerald-700':'text-red-500'}`}>
                      {r.type==='in'?'+':'-'}{r.quantity}ш
                    </div>
                    <button onClick={()=>{setEditLog(r);setEditQty(String(r.quantity));setEditDate(r.date);setEditNote(r.note||'')}}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-blue-50 text-blue-500 transition-all text-xs">✏️</button>
                    <button onClick={()=>deleteLog(r)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition-all text-xs">🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          )
        })}
        {filteredLogs.length===0&&<p className="text-center text-gray-400 text-sm py-6">Бүртгэл алга</p>}
      </div>

      {/* 2. ШИНЭ БАРАА */}
      <div className="card">
        <h2 className="font-semibold text-gray-800 mb-4 text-base">🆕 Шинэ бараа оруулах</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div><label className="block text-xs text-gray-500 mb-1">Барааны нэр</label>
            <input className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" placeholder="Нэр..."
              value={nName} onChange={e=>setNName(e.target.value)} /></div>
          <div><label className="block text-xs text-gray-500 mb-1">Нэгж үнэ (₮)</label>
            <input type="number" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
              placeholder="0" value={nPrice} onChange={e=>setNPrice(e.target.value)} /></div>
          <div><label className="block text-xs text-gray-500 mb-1">Анхны тоо</label>
            <input type="number" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
              min="0" value={nQty} onChange={e=>setNQty(e.target.value)} /></div>
          <div><label className="block text-xs text-gray-500 mb-1">Огноо</label>
            <input type="date" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
              value={nDate} onChange={e=>setNDate(e.target.value)} /></div>
        </div>
        <div className="flex justify-end mt-4">
          <button onClick={addNewProduct} className="px-5 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700">+ Нэмэх</button>
        </div>
      </div>

      {/* 3. АНХААРУУЛГА */}
      {(zeros.length>0||warns.length>0)&&(
        <div className="card border-amber-200 bg-amber-50/30">
          <h2 className="font-semibold text-amber-700 mb-3 text-base">⚠️ Цэнэглэх шаардлагатай</h2>
          {zeros.length>0&&<div className="mb-3">
            <p className="text-xs font-semibold text-red-600 mb-2">🔴 Дууссан</p>
            <div className="flex flex-wrap gap-2">{zeros.map(p=><span key={p.id} className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">{p.name}</span>)}</div>
          </div>}
          {warns.length>0&&<div>
            <p className="text-xs font-semibold text-amber-600 mb-2">🟡 Дусах дөхсөн</p>
            <div className="flex flex-wrap gap-2">{warns.map(p=><span key={p.id} className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">{p.name} — {p.stock}ш</span>)}</div>
          </div>}
        </div>
      )}
    </div>
  )
}
