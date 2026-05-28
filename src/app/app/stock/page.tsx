'use client'
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
  const [saving, setSaving] = useState<string | null>(null)
  const [flash, setFlash] = useState('')
  const [logFilter, setLogFilter] = useState('all')
  const [nName, setNName] = useState('')
  const [nPrice, setNPrice] = useState('')
  const [nQty, setNQty] = useState('0')
  const [nDate, setNDate] = useState(TODAY)
  const [nNote, setNNote] = useState('')
  const [rProd, setRProd] = useState('')
  const [rQty, setRQty] = useState('1')
  const [rDate, setRDate] = useState(TODAY)
  const [rNote, setRNote] = useState('')

  const showFlash = (msg: string) => { setFlash(msg); setTimeout(() => setFlash(''), 2500) }

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [{ data: prods }, { data: ls }] = await Promise.all([
      supabase.from('products').select('*').eq('user_id', user.id).order('name'),
      supabase.from('restock_log').select('*').eq('user_id', user.id).order('date', { ascending: false })
    ])
    setProducts(prods || [])
    setLogs(ls || [])
    if (prods && prods.length > 0 && !rProd) setRProd(prods[0].id)
  }, [rProd])

  useEffect(() => { load() }, [load])

  async function saveProduct(p: Product, field: 'name' | 'unit_price' | 'stock', val: string) {
    setSaving(p.id)
    await supabase.from('products').update({ [field]: field === 'name' ? val : Number(val) }).eq('id', p.id)
    if (field === 'stock') {
      const diff = Number(val) - p.stock
      if (diff !== 0) {
        const { data: { user } } = await supabase.auth.getUser()
        await supabase.from('restock_log').insert({ user_id: user!.id, product_id: p.id, product_name: p.name, quantity: Math.abs(diff), type: diff > 0 ? 'in' : 'out', note: 'Гараар засварлалт', date: TODAY })
      }
    }
    setSaving(null); showFlash('Хадгалагдлаа ✓'); load()
  }

  async function addNewProduct() {
    if (!nName.trim()) { showFlash('Нэр оруулна уу'); return }
    const { data: { user } } = await supabase.auth.getUser()
    const { data: prod } = await supabase.from('products').insert({ user_id: user!.id, name: nName.trim(), unit_price: Number(nPrice) || 0, stock: Number(nQty) || 0, added_date: nDate }).select().single()
    if (prod && Number(nQty) > 0) await supabase.from('restock_log').insert({ user_id: user!.id, product_id: prod.id, product_name: nName.trim(), quantity: Number(nQty), type: 'in', note: nNote || 'Шинэ бараа', date: nDate })
    setNName(''); setNPrice(''); setNQty('0'); setNNote(''); setNDate(TODAY)
    showFlash(nName + ' нэмэгдлээ ✓'); load()
  }

  async function addRestock() {
    const p = products.find(x => x.id === rProd)
    if (!p) return
    const { data: { user } } = await supabase.auth.getUser()
    await Promise.all([
      supabase.from('products').update({ stock: p.stock + Number(rQty) }).eq('id', rProd),
      supabase.from('restock_log').insert({ user_id: user!.id, product_id: rProd, product_name: p.name, quantity: Number(rQty), type: 'in', note: rNote || 'Цэнэглэлт', date: rDate })
    ])
    setRQty('1'); setRNote(''); setRDate(TODAY)
    showFlash(p.name + ': +' + rQty + ' нэмэгдлээ ✓'); load()
  }

  const filteredLogs = logFilter === 'all' ? logs : logs.filter(l => l.product_name === logFilter)
  const logGroups: Record<string, RestockLog[]> = {}
  filteredLogs.forEach(l => { const ym = l.date.slice(0, 7); if (!logGroups[ym]) logGroups[ym] = []; logGroups[ym].push(l) })

  const zeros = products.filter(p => p.stock === 0)
  const warns = products.filter(p => p.stock > 0 && p.stock <= 10)
  const sc = (s: number) => s === 0 ? 'text-red-600' : s <= 10 ? 'text-amber-600' : 'text-emerald-700'

  return (
    <div className="space-y-5">
      {flash && <div className="fixed top-4 right-4 bg-emerald-700 text-white text-sm px-4 py-2 rounded-lg shadow-lg z-50">{flash}</div>}

      {/* 1. БАРААНЫ ЖАГСААЛТ */}
      <div className="card">
        <h2 className="font-semibold text-gray-800 mb-4 text-base flex items-center gap-2">
          📦 Барааны жагсаалт
          <span className="text-xs font-normal text-gray-400">нэр, үнэ, үлдэгдэл дарж засна</span>
        </h2>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 mb-5">
          {products.map(p => (
            <div key={p.id} className={`rounded-lg p-2 text-center border ${p.stock===0?'bg-red-50 border-red-100':p.stock<=10?'bg-amber-50 border-amber-100':'bg-gray-50 border-gray-100'}`}>
              <div className="text-xs text-gray-500 truncate mb-1">{p.name}</div>
              <div className={`text-2xl font-bold ${sc(p.stock)}`}>{p.stock}</div>
              <div className="text-xs text-gray-400">ш</div>
            </div>
          ))}
        </div>
        <div className="overflow-x-auto rounded-lg border border-gray-100">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-3 py-2.5 text-xs font-medium text-gray-500 text-left">Барааны нэр</th>
                <th className="px-3 py-2.5 text-xs font-medium text-gray-500 text-left">Нэгж үнэ (₮)</th>
                <th className="px-3 py-2.5 text-xs font-medium text-gray-500 text-center">Үлдэгдэл</th>
                <th className="px-3 py-2.5 text-xs font-medium text-gray-500 text-right">Нийт дүн</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p, i) => (
                <tr key={p.id} className={`border-t border-gray-100 ${p.stock===0?'bg-red-50/40':p.stock<=10?'bg-amber-50/40':i%2===0?'':'bg-gray-50/30'}`}>
                  <td className="px-3 py-2">
                    <input defaultValue={p.name} className="w-full bg-transparent border-b border-transparent hover:border-gray-200 focus:border-emerald-400 outline-none py-0.5 font-medium text-gray-800"
                      onBlur={e => { if (e.target.value !== p.name) saveProduct(p, 'name', e.target.value) }} />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" defaultValue={p.unit_price} className="w-full bg-transparent border-b border-transparent hover:border-gray-200 focus:border-emerald-400 outline-none py-0.5 text-gray-700"
                      onBlur={e => { if (Number(e.target.value) !== p.unit_price) saveProduct(p, 'unit_price', e.target.value) }} />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input type="number" defaultValue={p.stock} className={`w-16 text-center bg-transparent border-b border-transparent hover:border-gray-200 focus:border-emerald-400 outline-none py-0.5 text-xl font-bold ${sc(p.stock)}`}
                      onBlur={e => { if (Number(e.target.value) !== p.stock) saveProduct(p, 'stock', e.target.value) }} />
                  </td>
                  <td className="px-3 py-2 text-right text-sm text-gray-500">{saving===p.id?'...':fmt(p.unit_price*p.stock)+'₮'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. ШИНЭ БАРАА */}
      <div className="card">
        <h2 className="font-semibold text-gray-800 mb-4 text-base">🆕 Шинэ бараа оруулах</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div><label className="label">Барааны нэр</label><input className="input" placeholder="Нэр..." value={nName} onChange={e => setNName(e.target.value)} /></div>
          <div><label className="label">Нэгж үнэ (₮)</label><input type="number" className="input" placeholder="0" value={nPrice} onChange={e => setNPrice(e.target.value)} /></div>
          <div><label className="label">Анхны тоо</label><input type="number" className="input" min="0" value={nQty} onChange={e => setNQty(e.target.value)} /></div>
          <div><label className="label">Огноо</label><input type="date" className="input" value={nDate} onChange={e => setNDate(e.target.value)} /></div>
          <div className="col-span-2 sm:col-span-2"><label className="label">Тэмдэглэл</label><input className="input" placeholder="Нийлүүлэгч, партийн №..." value={nNote} onChange={e => setNNote(e.target.value)} /></div>
        </div>
        <div className="flex justify-end mt-4"><button onClick={addNewProduct} className="btn btn-primary">+ Нэмэх</button></div>
      </div>

      {/* 3. ЦЭНЭГЛЭЛТ */}
      <div className="card">
        <h2 className="font-semibold text-gray-800 mb-4 text-base">📅 Цэнэглэлтийн бүртгэл</h2>
        <div className="bg-gray-50 rounded-lg p-4 mb-5 border border-gray-100">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div><label className="label">Бараа</label><select className="input" value={rProd} onChange={e => setRProd(e.target.value)}>{products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.stock}ш)</option>)}</select></div>
            <div><label className="label">Тоо ширхэг</label><input type="number" className="input" min="1" value={rQty} onChange={e => setRQty(e.target.value)} /></div>
            <div><label className="label">Огноо</label><input type="date" className="input" value={rDate} onChange={e => setRDate(e.target.value)} /></div>
          </div>
          <div className="mt-3"><label className="label">Тэмдэглэл</label><input className="input" placeholder="Нийлүүлэгч..." value={rNote} onChange={e => setRNote(e.target.value)} /></div>
          <div className="flex justify-end mt-3"><button onClick={addRestock} className="btn btn-primary">+ Цэнэглэлт бүртгэх</button></div>
        </div>
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm font-medium text-gray-600">Бүртгэл</span>
          <select className="input text-xs" style={{width:'auto'}} value={logFilter} onChange={e => setLogFilter(e.target.value)}>
            <option value="all">Бүх бараа</option>
            {products.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
          </select>
        </div>
        {Object.keys(logGroups).sort((a,b) => b.localeCompare(a)).map(ym => {
          const grp = logGroups[ym]
          const totalIn = grp.filter(r => r.type==='in').reduce((a,r) => a+r.quantity, 0)
          return (
            <div key={ym} className="mb-4">
              <div className="flex justify-between py-1.5 border-b border-gray-100 mb-1">
                <span className="text-xs font-semibold text-gray-500">{fmtYM(ym)}</span>
                <span className="text-xs text-gray-400">+{totalIn} ш</span>
              </div>
              {grp.map(r => (
                <div key={r.id} className="flex justify-between items-start py-2.5 border-b border-gray-50 last:border-0">
                  <div>
                    <div className="text-sm font-medium text-gray-800">{r.product_name}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{fmtDate(r.date)}{r.note?' · '+r.note:''}</div>
                  </div>
                  <div className={`text-lg font-semibold ${r.type==='in'?'text-emerald-700':'text-red-600'}`}>{r.type==='in'?'+':'-'}{r.quantity} ш</div>
                </div>
              ))}
            </div>
          )
        })}
        {filteredLogs.length===0 && <p className="text-center text-gray-400 text-sm py-6">Бүртгэл алга</p>}
      </div>

      {/* 4. АНХААРУУЛГА */}
      {(zeros.length>0||warns.length>0) && (
        <div className="card border-amber-200 bg-amber-50/30">
          <h2 className="font-semibold text-amber-700 mb-4 text-base">⚠️ Цэнэглэх шаардлагатай</h2>
          {zeros.length>0 && <div className="mb-4"><p className="text-xs font-semibold text-red-600 mb-2">🔴 Дууссан</p><div className="flex flex-wrap gap-2">{zeros.map(p => <span key={p.id} className="badge badge-red px-3 py-1">{p.name}</span>)}</div></div>}
          {warns.length>0 && <div><p className="text-xs font-semibold text-amber-600 mb-2">🟡 Дусах дөхсөн</p><div className="flex flex-wrap gap-2">{warns.map(p => <span key={p.id} className="badge badge-amber px-3 py-1">{p.name} — {p.stock}ш</span>)}</div></div>}
        </div>
      )}
    </div>
  )
}
