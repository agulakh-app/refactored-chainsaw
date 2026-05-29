'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Product, RestockLog } from '@/lib/types'

const TODAY = new Date().toISOString().slice(0,10)
function fmtDate(d: string) { if(!d) return ''; const [y,m,day]=d.split('-'); return `${y}.${m}.${day}` }
function fmt(n: number) { return n.toLocaleString() }

export default function StockPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [logs, setLogs] = useState<RestockLog[]>([])
  const [flash, setFlash] = useState('')
  const [logFilter, setLogFilter] = useState('all')
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
  const [role, setRole] = useState('owner')

  const showFlash = (m: string) => { setFlash(m); setTimeout(()=>setFlash(''),2500) }

  const load = useCallback(async () => {
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user) return
    // Check role from profile metadata
    const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (prof?.role) setRole(prof.role)
    const [{ data: prods },{ data: ls }] = await Promise.all([
      supabase.from('products').select('*').eq('user_id', user.id).order('name'),
      supabase.from('restock_log').select('*').eq('user_id', user.id).order('date',{ascending:false}).order('created_at',{ascending:false})
    ])
    setProducts(prods||[])
    setLogs(ls||[])
    if (prods&&prods.length>0&&!rProd) setRProd(prods[0].id)
  }, [rProd])

  useEffect(()=>{ load() },[load])

  const isReadOnly = role === 'viewer'

  async function addRestock() {
    if (isReadOnly) return
    const p = products.find(x=>x.id===rProd)
    if (!p) return
    const { data:{ user } } = await supabase.auth.getUser()
    await Promise.all([
      supabase.from('products').update({ stock: p.stock+Number(rQty) }).eq('id',rProd),
      supabase.from('restock_log').insert({ user_id:user!.id, product_id:rProd, product_name:p.name, quantity:Number(rQty), type:'in', note:rNote||'Цэнэглэлт', date:rDate })
    ])
    setRQty('1'); setRNote(''); setRDate(TODAY)
    showFlash(p.name+': +'+rQty+' нэмэгдлээ ✓'); load()
  }

  async function addNewProduct() {
    if (isReadOnly) return
    if (!nName.trim()) { showFlash('Нэр оруулна уу'); return }
    const { data:{ user } } = await supabase.auth.getUser()
    const { data: prod } = await supabase.from('products').insert({ user_id:user!.id, name:nName.trim(), unit_price:Number(nPrice)||0, stock:Number(nQty)||0, added_date:nDate }).select().single()
    if (prod&&Number(nQty)>0) await supabase.from('restock_log').insert({ user_id:user!.id, product_id:prod.id, product_name:nName.trim(), quantity:Number(nQty), type:'in', note:'Шинэ бараа', date:nDate })
    setNName(''); setNPrice(''); setNQty('0'); setNDate(TODAY)
    showFlash(nName+' нэмэгдлээ ✓'); load()
  }

  async function deleteLog(log: RestockLog) {
    if (isReadOnly) return
    if (!confirm('Энэ бүртгэлийг устгах уу?')) return
    const p = products.find(x=>x.id===log.product_id)
    if (p) await supabase.from('products').update({ stock: Math.max(0, log.type==='in'?p.stock-log.quantity:p.stock+log.quantity) }).eq('id',p.id)
    await supabase.from('restock_log').delete().eq('id',log.id)
    showFlash('Устгагдлаа'); load()
  }

  async function saveEditLog() {
    if (!editLog) return
    const diff = Number(editQty)-editLog.quantity
    const p = products.find(x=>x.id===editLog.product_id)
    if (p&&diff!==0) await supabase.from('products').update({ stock: Math.max(0,p.stock+(editLog.type==='in'?diff:-diff)) }).eq('id',p.id)
    await supabase.from('restock_log').update({ quantity:Number(editQty), date:editDate, note:editNote }).eq('id',editLog.id)
    setEditLog(null); showFlash('Засварлагдлаа ✓'); load()
  }

  // Group by DATE (not month)
  const filteredLogs = logFilter==='all' ? logs : logs.filter(l=>l.product_name===logFilter)
  const logGroups: Record<string,RestockLog[]> = {}
  filteredLogs.forEach(l => { const d=l.date; if(!logGroups[d])logGroups[d]=[]; logGroups[d].push(l) })

  const zeros = products.filter(p=>p.stock===0)
  const warns = products.filter(p=>p.stock>0&&p.stock<=10)

  return (
    <div className="space-y-5">
      {flash && <div className="fixed top-4 right-4 bg-emerald-700 text-white text-sm px-4 py-2 rounded-lg shadow-lg z-50">{flash}</div>}

      {isReadOnly && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-700 flex items-center gap-2">
          👁 Зочин горим — зөвхөн харах боломжтой
        </div>
      )}

      {/* Edit modal */}
      {editLog && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="font-semibold text-gray-800 mb-4">Цэнэглэлт засварлах</h3>
            <div className="space-y-3">
              <div><label className="block text-xs text-gray-500 mb-1">Бараа</label>
                <div className="text-sm font-medium bg-gray-50 px-3 py-2 rounded-lg">{editLog.product_name}</div></div>
              <div><label className="block text-xs text-gray-500 mb-1">Тоо ширхэг</label>
                <input type="number" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" value={editQty} onChange={e=>setEditQty(e.target.value)} /></div>
              <div><label className="block text-xs text-gray-500 mb-1">Огноо</label>
                <input type="date" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" value={editDate} onChange={e=>setEditDate(e.target.value)} /></div>
              <div><label className="block text-xs text-gray-500 mb-1">Тэмдэглэл</label>
                <input className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" value={editNote} onChange={e=>setEditNote(e.target.value)} /></div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={()=>setEditLog(null)} className="flex-1 py-2 rounded-xl border border-gray-200 text-sm">Болих</button>
              <button onClick={saveEditLog} className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold">Хадгалах</button>
            </div>
          </div>
        </div>
      )}

      {/* 1. ЦЭНЭГЛЭЛТИЙН БҮРТГЭЛ */}
      <div className="card">
        <h2 className="font-semibold text-gray-800 mb-4 text-base">📅 Цэнэглэлтийн бүртгэл</h2>
        {!isReadOnly && (
          <div className="bg-gray-50 rounded-xl p-4 mb-5 border border-gray-100">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div><label className="block text-xs text-gray-500 mb-1">Бараа</label>
                <select className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" value={rProd} onChange={e=>setRProd(e.target.value)}>
                  {products.map(p=><option key={p.id} value={p.id}>{p.name} ({p.stock}ш)</option>)}</select></div>
              <div><label className="block text-xs text-gray-500 mb-1">Тоо ширхэг</label>
                <input type="number" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" min="1" value={rQty} onChange={e=>setRQty(e.target.value)} /></div>
              <div><label className="block text-xs text-gray-500 mb-1">Огноо</label>
                <input type="date" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" value={rDate} onChange={e=>setRDate(e.target.value)} /></div>
            </div>
            <div className="mt-3"><label className="block text-xs text-gray-500 mb-1">Тэмдэглэл</label>
              <input className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" placeholder="Нийлүүлэгч..." value={rNote} onChange={e=>setRNote(e.target.value)} /></div>
            <div className="flex justify-end mt-3">
              <button onClick={addRestock} className="px-5 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700">+ Цэнэглэлт бүртгэх</button>
            </div>
          </div>
        )}

        <div className="flex justify-between items-center mb-3">
          <span className="text-sm font-medium text-gray-600">Бүртгэл</span>
          <select className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs" value={logFilter} onChange={e=>setLogFilter(e.target.value)}>
            <option value="all">Бүх бараа</option>
            {products.map(p=><option key={p.id} value={p.name}>{p.name}</option>)}
          </select>
        </div>

        {/* Grouped by DATE */}
        {Object.keys(logGroups).sort((a,b)=>b.localeCompare(a)).map(date => {
          const grp = logGroups[date]
          const totalIn = grp.filter(r=>r.type==='in').reduce((a,r)=>a+r.quantity,0)
          const [y,m,d] = date.split('-')
          return (
            <div key={date} className="mb-4">
              <div className="flex justify-between items-center bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 mb-1.5">
                <span className="text-sm font-bold text-emerald-800">{y}оны {parseInt(m)}р сарын {parseInt(d)}</span>
                <span className="text-xs font-medium text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">+{totalIn} ш</span>
              </div>
              {grp.map(r=>(
                <div key={r.id} className="flex justify-between items-center py-2.5 px-2 border-b border-gray-50 last:border-0 hover:bg-gray-50 rounded-lg group">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-800">{r.product_name}</div>
                    {r.note && <div className="text-xs text-gray-400 mt-0.5">{r.note}</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`text-lg font-semibold ${r.type==='in'?'text-emerald-700':'text-red-600'}`}>
                      {r.type==='in'?'+':'-'}{r.quantity} ш
                    </div>
                    {!isReadOnly && <>
                      <button onClick={()=>{ setEditLog(r); setEditQty(String(r.quantity)); setEditDate(r.date); setEditNote(r.note||'') }}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-blue-50 text-blue-500 transition-all text-xs">✏️</button>
                      <button onClick={()=>deleteLog(r)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition-all text-xs">🗑️</button>
                    </>}
                  </div>
                </div>
              ))}
            </div>
          )
        })}
        {filteredLogs.length===0 && <p className="text-center text-gray-400 text-sm py-6">Бүртгэл алга</p>}
      </div>

      {/* 2. ШИНЭ БАРАА */}
      {!isReadOnly && (
        <div className="card">
          <h2 className="font-semibold text-gray-800 mb-4 text-base">🆕 Шинэ бараа оруулах</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div><label className="block text-xs text-gray-500 mb-1">Барааны нэр</label>
              <input className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" placeholder="Нэр..." value={nName} onChange={e=>setNName(e.target.value)} /></div>
            <div><label className="block text-xs text-gray-500 mb-1">Нэгж үнэ (₮)</label>
              <input type="number" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" placeholder="0" value={nPrice} onChange={e=>setNPrice(e.target.value)} /></div>
            <div><label className="block text-xs text-gray-500 mb-1">Анхны тоо</label>
              <input type="number" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" min="0" value={nQty} onChange={e=>setNQty(e.target.value)} /></div>
            <div><label className="block text-xs text-gray-500 mb-1">Огноо</label>
              <input type="date" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" value={nDate} onChange={e=>setNDate(e.target.value)} /></div>
          </div>
          <div className="flex justify-end mt-4">
            <button onClick={addNewProduct} className="px-5 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700">+ Нэмэх</button>
          </div>
        </div>
      )}

      {/* 3. АНХААРУУЛГА */}
      {(zeros.length>0||warns.length>0) && (
        <div className="card border-amber-200 bg-amber-50/30">
          <h2 className="font-semibold text-amber-700 mb-3 text-base">⚠️ Цэнэглэх шаардлагатай</h2>
          {zeros.length>0 && <div className="mb-3"><p className="text-xs font-semibold text-red-600 mb-2">🔴 Дууссан</p>
            <div className="flex flex-wrap gap-2">{zeros.map(p=><span key={p.id} className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">{p.name}</span>)}</div></div>}
          {warns.length>0 && <div><p className="text-xs font-semibold text-amber-600 mb-2">🟡 Дусах дөхсөн</p>
            <div className="flex flex-wrap gap-2">{warns.map(p=><span key={p.id} className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">{p.name} — {p.stock}ш</span>)}</div></div>}
        </div>
      )}
    </div>
  )
}
