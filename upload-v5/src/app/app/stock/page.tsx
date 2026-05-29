'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Product, RestockLog } from '@/lib/types'

const TODAY = new Date().toISOString().slice(0, 10)
function fmtYM(ym: string) { const [y, m] = ym.split('-'); return `${y}оны ${parseInt(m)}р сар` }
function fmtDate(d: string) { if (!d) return ''; const [y, m, day] = d.split('-'); return `${y}.${m}.${day}` }
function fmt(n: number) { return n.toLocaleString() }

export default function StockPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [logs, setLogs] = useState<RestockLog[]>([])
  const [flash, setFlash] = useState('')
  const [flashErr, setFlashErr] = useState(false)
  const [logFilter, setLogFilter] = useState('all')

  // New product form
  const [nName, setNName] = useState('')
  const [nPrice, setNPrice] = useState('')
  const [nQty, setNQty] = useState('0')
  const [nDate, setNDate] = useState(TODAY)
  const [nNote, setNNote] = useState('')

  // Restock form
  const [rProd, setRProd] = useState('')
  const [rQty, setRQty] = useState('1')
  const [rDate, setRDate] = useState(TODAY)
  const [rNote, setRNote] = useState('')

  // Edit log modal
  const [editLog, setEditLog] = useState<RestockLog | null>(null)
  const [editQty, setEditQty] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editNote, setEditNote] = useState('')

  const showFlash = (msg: string, err = false) => {
    setFlash(msg); setFlashErr(err)
    setTimeout(() => setFlash(''), 2500)
  }

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [{ data: prods }, { data: ls }] = await Promise.all([
      supabase.from('products').select('*').eq('user_id', user.id).order('name'),
      supabase.from('restock_log').select('*').eq('user_id', user.id).order('date', { ascending: false }).order('created_at', { ascending: false })
    ])
    setProducts(prods || [])
    setLogs(ls || [])
    if (prods && prods.length > 0 && !rProd) setRProd(prods[0].id)
  }, [rProd])

  useEffect(() => { load() }, [load])

  async function addRestock() {
    const p = products.find(x => x.id === rProd)
    if (!p) return
    const { data: { user } } = await supabase.auth.getUser()
    await Promise.all([
      supabase.from('products').update({ stock: p.stock + Number(rQty) }).eq('id', rProd),
      supabase.from('restock_log').insert({
        user_id: user!.id, product_id: rProd, product_name: p.name,
        quantity: Number(rQty), type: 'in', note: rNote || 'Цэнэглэлт', date: rDate
      })
    ])
    setRQty('1'); setRNote(''); setRDate(TODAY)
    showFlash(p.name + ': +' + rQty + ' нэмэгдлээ ✓')
    load()
  }

  async function addNewProduct() {
    if (!nName.trim()) { showFlash('Нэр оруулна уу', true); return }
    const { data: { user } } = await supabase.auth.getUser()
    const { data: prod } = await supabase.from('products').insert({
      user_id: user!.id, name: nName.trim(),
      unit_price: Number(nPrice) || 0, stock: Number(nQty) || 0, added_date: nDate
    }).select().single()
    if (prod && Number(nQty) > 0) {
      await supabase.from('restock_log').insert({
        user_id: user!.id, product_id: prod.id, product_name: nName.trim(),
        quantity: Number(nQty), type: 'in', note: nNote || 'Шинэ бараа', date: nDate
      })
    }
    const saved = nName
    setNName(''); setNPrice(''); setNQty('0'); setNNote(''); setNDate(TODAY)
    showFlash(saved + ' нэмэгдлээ ✓'); load()
  }

  // Edit log entry
  function openEditLog(r: RestockLog) {
    setEditLog(r); setEditQty(String(r.quantity)); setEditDate(r.date); setEditNote(r.note || '')
  }

  async function saveEditLog() {
    if (!editLog) return
    const oldQty = editLog.quantity
    const newQty = Number(editQty)
    const diff = newQty - oldQty
    // Update log
    await supabase.from('restock_log').update({
      quantity: newQty, date: editDate, note: editNote
    }).eq('id', editLog.id)
    // Adjust product stock if qty changed
    if (diff !== 0) {
      const p = products.find(x => x.name === editLog.product_name)
      if (p) {
        const adj = editLog.type === 'in' ? diff : -diff
        await supabase.from('products').update({ stock: Math.max(0, p.stock + adj) }).eq('id', p.id)
      }
    }
    setEditLog(null)
    showFlash('Бүртгэл шинэчлэгдлээ ✓')
    load()
  }

  async function deleteLog(r: RestockLog) {
    if (!confirm(`"${r.product_name}" — ${r.quantity}ш бүртгэлийг устгах уу?`)) return
    await supabase.from('restock_log').delete().eq('id', r.id)
    // Revert stock
    const p = products.find(x => x.name === r.product_name)
    if (p) {
      const adj = r.type === 'in' ? -r.quantity : r.quantity
      await supabase.from('products').update({ stock: Math.max(0, p.stock + adj) }).eq('id', p.id)
    }
    showFlash('Устгагдлаа')
    load()
  }

  const filteredLogs = logFilter === 'all' ? logs : logs.filter(l => l.product_name === logFilter)
  const logGroups: Record<string, RestockLog[]> = {}
  filteredLogs.forEach(l => {
    const ym = l.date.slice(0, 7)
    if (!logGroups[ym]) logGroups[ym] = []
    logGroups[ym].push(l)
  })

  const zeros = products.filter(p => p.stock === 0)
  const warns = products.filter(p => p.stock > 0 && p.stock <= 10)
  const sc = (s: number) => s === 0 ? 'text-red-600' : s <= 10 ? 'text-amber-600' : 'text-emerald-700'

  return (
    <div className="space-y-5">
      {flash && (
        <div className={`fixed top-4 right-4 text-white text-sm px-4 py-2 rounded-lg shadow-lg z-50 transition-all ${flashErr ? 'bg-red-600' : 'bg-emerald-700'}`}>
          {flash}
        </div>
      )}

      {/* Edit log modal */}
      {editLog && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-6 w-full max-w-sm shadow-xl">
            <h3 className="font-semibold text-gray-800 mb-4">Бүртгэл засах — {editLog.product_name}</h3>
            <label className="label">Тоо ширхэг</label>
            <input type="number" className="input" min="1" value={editQty} onChange={e => setEditQty(e.target.value)} />
            <label className="label">Огноо</label>
            <input type="date" className="input" value={editDate} onChange={e => setEditDate(e.target.value)} />
            <label className="label">Тэмдэглэл</label>
            <input className="input" value={editNote} onChange={e => setEditNote(e.target.value)} placeholder="..." />
            <div className="flex gap-2 mt-5">
              <button onClick={() => setEditLog(null)} className="flex-1 btn btn-ghost">Болих</button>
              <button onClick={saveEditLog} className="flex-1 btn btn-primary">Хадгалах</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ 1. ЦЭНЭГЛЭЛТ НЭМЭХ ══ */}
      <div className="card">
        <h2 className="font-semibold text-gray-800 mb-4 text-base">📅 Цэнэглэлтийн бүртгэл</h2>
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className="label">Бараа</label>
              <select className="input" value={rProd} onChange={e => setRProd(e.target.value)}>
                {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.stock}ш)</option>)}
              </select>
            </div>
            <div>
              <label className="label">Тоо ширхэг</label>
              <input type="number" className="input" min="1" value={rQty} onChange={e => setRQty(e.target.value)} />
            </div>
            <div>
              <label className="label">Огноо</label>
              <input type="date" className="input" value={rDate} onChange={e => setRDate(e.target.value)} />
            </div>
          </div>
          <div className="mt-3">
            <label className="label">Тэмдэглэл</label>
            <input className="input" placeholder="Нийлүүлэгч, партийн №..." value={rNote} onChange={e => setRNote(e.target.value)} />
          </div>
          <div className="flex justify-end mt-3">
            <button onClick={addRestock} className="btn btn-primary">+ Цэнэглэлт бүртгэх</button>
          </div>
        </div>

        {/* Log list */}
        <div className="flex justify-between items-center mt-5 mb-3">
          <span className="text-sm font-medium text-gray-700">Бүртгэл</span>
          <select className="input text-xs" style={{ width: 'auto' }} value={logFilter} onChange={e => setLogFilter(e.target.value)}>
            <option value="all">Бүх бараа</option>
            {products.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
          </select>
        </div>

        {Object.keys(logGroups).sort((a, b) => b.localeCompare(a)).map(ym => {
          const grp = logGroups[ym]
          const totalIn = grp.filter(r => r.type === 'in').reduce((a, r) => a + r.quantity, 0)
          return (
            <div key={ym} className="mb-5">
              {/* Month header — тод, ялгагдахуйц */}
              <div className="flex justify-between items-center px-3 py-2 bg-emerald-50 border border-emerald-100 rounded-lg mb-2">
                <span className="text-sm font-bold text-emerald-800">📅 {fmtYM(ym)}</span>
                <span className="text-xs font-medium text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">+{totalIn} ш нэмэгдсэн</span>
              </div>
              {grp.map(r => (
                <div key={r.id} className="flex justify-between items-center py-2.5 px-2 border-b border-gray-50 last:border-0 hover:bg-gray-50 rounded-lg group">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800">{r.product_name}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{fmtDate(r.date)}{r.note ? ' · ' + r.note : ''}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`text-lg font-bold ${r.type === 'in' ? 'text-emerald-700' : 'text-red-600'}`}>
                      {r.type === 'in' ? '+' : '-'}{r.quantity} ш
                    </div>
                    {/* Edit / Delete buttons */}
                    <button onClick={() => openEditLog(r)}
                      className="opacity-0 group-hover:opacity-100 text-xs px-2 py-1 rounded border border-gray-200 text-gray-500 hover:bg-gray-100 transition-all">
                      ✏
                    </button>
                    <button onClick={() => deleteLog(r)}
                      className="opacity-0 group-hover:opacity-100 text-xs px-2 py-1 rounded border border-red-100 text-red-500 hover:bg-red-50 transition-all">
                      🗑
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        })}
        {filteredLogs.length === 0 && <p className="text-center text-gray-400 text-sm py-6">Бүртгэл алга</p>}
      </div>

      {/* ══ 2. ШИНЭ БАРАА ══ */}
      <div className="card">
        <h2 className="font-semibold text-gray-800 mb-4 text-base">🆕 Шинэ бараа оруулах</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div><label className="label">Барааны нэр</label><input className="input" placeholder="Нэр..." value={nName} onChange={e => setNName(e.target.value)} /></div>
          <div><label className="label">Нэгж үнэ (₮)</label><input type="number" className="input" placeholder="0" value={nPrice} onChange={e => setNPrice(e.target.value)} /></div>
          <div><label className="label">Анхны тоо</label><input type="number" className="input" min="0" value={nQty} onChange={e => setNQty(e.target.value)} /></div>
          <div><label className="label">Огноо</label><input type="date" className="input" value={nDate} onChange={e => setNDate(e.target.value)} /></div>
          <div className="col-span-2 sm:col-span-2"><label className="label">Тэмдэглэл</label><input className="input" placeholder="Нийлүүлэгч..." value={nNote} onChange={e => setNNote(e.target.value)} /></div>
        </div>
        <div className="flex justify-end mt-4"><button onClick={addNewProduct} className="btn btn-primary">+ Нэмэх</button></div>
      </div>

      {/* ══ 3. АНХААРУУЛГА ══ */}
      {(zeros.length > 0 || warns.length > 0) && (
        <div className="card border-amber-200 bg-amber-50/30">
          <h2 className="font-semibold text-amber-700 mb-4 text-base">⚠️ Цэнэглэх шаардлагатай</h2>
          {zeros.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-red-600 mb-2">🔴 Дууссан</p>
              <div className="flex flex-wrap gap-2">{zeros.map(p => <span key={p.id} className="badge badge-red px-3 py-1">{p.name}</span>)}</div>
            </div>
          )}
          {warns.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-amber-600 mb-2">🟡 Дусах дөхсөн (10 ба доош)</p>
              <div className="flex flex-wrap gap-2">{warns.map(p => <span key={p.id} className="badge badge-amber px-3 py-1">{p.name} — {p.stock}ш</span>)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
