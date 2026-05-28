'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Product, Order } from '@/lib/types'

const TODAY = new Date().toISOString().slice(0, 10)
function fmtYM(ym: string) { const [y,m] = ym.split('-'); return `${y}оны ${parseInt(m)}р сар` }
function fmt(n: number) { return n.toLocaleString() }

export default function DashPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [flash, setFlash] = useState('')
  const [phoneFilter, setPhoneFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  // Order form
  const [oDate, setODate] = useState(TODAY)
  const [oPhone, setOPhone] = useState('')
  const [oAddr, setOAddr] = useState('')
  const [oDelv, setODelv] = useState('')
  const [oItems, setOItems] = useState([{ product_id: '', product_name: '', qty: '1', price: '' }])

  const showFlash = (m: string) => { setFlash(m); setTimeout(() => setFlash(''), 3000) }

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [{ data: prods }, { data: ords }] = await Promise.all([
      supabase.from('products').select('*').eq('user_id', user.id).order('name'),
      supabase.from('orders').select('*, order_items(*)').eq('user_id', user.id).order('date', { ascending: false }).order('day_seq', { ascending: false })
    ])
    setProducts(prods || [])
    setOrders(ords || [])
    if (prods && prods.length > 0) {
      setOItems(i => i.map((it, idx) => idx === 0 && !it.product_id ? { ...it, product_id: prods[0].id, product_name: prods[0].name, price: String(prods[0].unit_price) } : it))
    }
  }, [])

  useEffect(() => { load() }, [load])

  function addItem() { setOItems(i => [...i, { product_id: products[0]?.id || '', product_name: products[0]?.name || '', qty: '1', price: String(products[0]?.unit_price || '') }]) }
  function removeItem(idx: number) { setOItems(i => i.filter((_, j) => j !== idx)) }
  function setItem(idx: number, key: string, val: string) {
    setOItems(items => items.map((it, i) => {
      if (i !== idx) return it
      if (key === 'product_id') {
        const p = products.find(x => x.id === val)
        return { ...it, product_id: val, product_name: p?.name || '', price: String(p?.unit_price || '') }
      }
      return { ...it, [key]: val }
    }))
  }

  const gross = oItems.reduce((a, i) => a + (Number(i.qty) || 0) * (Number(i.price) || 0), 0)
  const net = gross - (Number(oDelv) || 0)

  async function submitOrder() {
    if (!oPhone || !oAddr) { showFlash('Утас, хаяг оруулна уу'); return }
    if (oItems.some(i => !i.product_id)) { showFlash('Бараа сонгоно уу'); return }
    const { data: { user } } = await supabase.auth.getUser()

    // stock check
    for (const it of oItems) {
      const p = products.find(x => x.id === it.product_id)
      if (!p || p.stock < Number(it.qty)) { showFlash((p?.name || 'Бараа') + ' хүрэлцэхгүй! Үлдэгдэл: ' + (p?.stock || 0)); return }
    }

    // day_seq
    const { data: seqData } = await supabase.rpc('get_day_seq', { p_user_id: user!.id, p_date: oDate || TODAY })

    const { data: order } = await supabase.from('orders').insert({
      user_id: user!.id, date: oDate || TODAY, day_seq: seqData || 1,
      phone: oPhone, address: oAddr, delivery_fee: Number(oDelv) || 0, status: 'pending'
    }).select().single()

    if (order) {
      await supabase.from('order_items').insert(
        oItems.map(it => ({ order_id: order.id, product_id: it.product_id, product_name: it.product_name, quantity: Number(it.qty), unit_price: Number(it.price) }))
      )
      // deduct stock
      for (const it of oItems) {
        const p = products.find(x => x.id === it.product_id)!
        await supabase.from('products').update({ stock: p.stock - Number(it.qty) }).eq('id', it.product_id)
        await supabase.from('restock_log').insert({ user_id: user!.id, product_id: it.product_id, product_name: it.product_name, quantity: Number(it.qty), type: 'out', note: 'Захиалга', date: oDate || TODAY })
      }
    }

    setOPhone(''); setOAddr(''); setODelv('')
    setOItems([{ product_id: products[0]?.id || '', product_name: products[0]?.name || '', qty: '1', price: String(products[0]?.unit_price || '') }])
    showFlash('Захиалга бүртгэгдлээ ✓'); load()
  }

  async function toggleStatus(id: string, cur: string) {
    const next = cur === 'pending' ? 'delivered' : 'pending'
    await supabase.from('orders').update({ status: next }).eq('id', id)
    showFlash(next === 'delivered' ? 'Хүргэгдсэн ✓' : 'Хүлээгдэж байна болгов'); load()
  }

  const filtered = orders.filter(o => {
    if (phoneFilter && !o.phone.includes(phoneFilter)) return false
    if (statusFilter !== 'all' && o.status !== statusFilter) return false
    return true
  })
  const groups: Record<string, Order[]> = {}
  filtered.forEach(o => { const ym = o.date.slice(0,7); if (!groups[ym]) groups[ym]=[]; groups[ym].push(o) })

  const totalStock = products.reduce((a,p) => a+p.stock, 0)
  const pending = orders.filter(o => o.status==='pending').length

  return (
    <div className="space-y-5">
      {flash && <div className="fixed top-4 right-4 bg-emerald-700 text-white text-sm px-4 py-2 rounded-lg shadow-lg z-50">{flash}</div>}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[['Нийт үлдэгдэл', String(totalStock), 'text-emerald-700'],['Хүлээгдэж байна', String(pending), 'text-amber-600'],['Нийт захиалга', String(orders.length), 'text-gray-700']].map(([l,v,c]) => (
          <div key={l} className="card text-center py-3">
            <div className="text-xs text-gray-400 mb-1">{l}</div>
            <div className={`text-2xl font-bold ${c}`}>{v}</div>
          </div>
        ))}
      </div>

      {/* Order form */}
      <div className="card">
        <h2 className="font-semibold text-gray-800 mb-4 text-base">➕ Шинэ захиалга</h2>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Огноо</label><input type="date" className="input" value={oDate} onChange={e => setODate(e.target.value)} /></div>
          <div><label className="label">Утасны дугаар</label><input className="input" placeholder="89639100" value={oPhone} onChange={e => setOPhone(e.target.value)} /></div>
        </div>
        <label className="label">Хаяг</label>
        <input className="input" placeholder="Дүүрэг, хороо, байр..." value={oAddr} onChange={e => setOAddr(e.target.value)} />

        <label className="label">Захиалсан бараанууд</label>
        <div className="border border-gray-100 rounded-lg p-3 bg-gray-50 space-y-2 mb-2">
          {oItems.map((it, idx) => (
            <div key={idx} className="grid grid-cols-[1fr_70px_100px_32px] gap-2 items-center">
              <select className="input text-sm" value={it.product_id} onChange={e => setItem(idx,'product_id',e.target.value)}>
                {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.stock}ш)</option>)}
              </select>
              <input type="number" className="input text-sm" min="1" value={it.qty} onChange={e => setItem(idx,'qty',e.target.value)} />
              <input type="number" className="input text-sm" value={it.price} onChange={e => setItem(idx,'price',e.target.value)} placeholder="Үнэ" />
              {oItems.length > 1 && <button onClick={() => removeItem(idx)} className="btn btn-danger px-2 py-1.5 text-xs">✕</button>}
            </div>
          ))}
        </div>
        <button onClick={addItem} className="btn btn-ghost text-xs mb-3">＋ Бараа нэмэх</button>

        <div className="max-w-xs">
          <label className="label">Хүргэлтийн үнэ (₮) <span className="text-amber-600 text-xs">— нийлбэрээс хасагдана</span></label>
          <input type="number" className="input" placeholder="0" value={oDelv} onChange={e => setODelv(e.target.value)} />
        </div>
        {gross > 0 && (
          <div className="mt-2 text-sm font-medium text-emerald-700">
            Барааны нийт: {fmt(gross)}₮{Number(oDelv) > 0 ? ` − ${fmt(Number(oDelv))}₮ = ${fmt(net)}₮ цэвэр` : ''}
          </div>
        )}
        <div className="flex gap-2 justify-end mt-4">
          <button onClick={submitOrder} className="btn btn-primary">✓ Захиалга бүртгэх</button>
        </div>
      </div>

      {/* Orders list */}
      <div className="card">
        <h2 className="font-semibold text-gray-800 mb-3 text-base">📋 Захиалгын бүртгэл</h2>
        <div className="flex gap-2 mb-4 flex-wrap">
          <input className="input flex-1 min-w-0" style={{maxWidth:200}} placeholder="Утасны дугаараар шүүх..." value={phoneFilter} onChange={e => setPhoneFilter(e.target.value)} />
          <select className="input" style={{width:'auto'}} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">Бүх статус</option>
            <option value="pending">Хүлээгдэж байна</option>
            <option value="delivered">Хүргэгдсэн</option>
          </select>
        </div>
        {Object.keys(groups).sort((a,b) => b.localeCompare(a)).map(ym => {
          const grp = groups[ym]
          const tot = grp.reduce((a,o) => a+(o.order_items||[]).reduce((s:number,i:any)=>s+i.quantity*i.unit_price,0), 0)
          return (
            <div key={ym} className="mb-5">
              <div className="flex justify-between py-1.5 border-b border-gray-100 mb-2">
                <span className="text-xs font-semibold text-gray-500">{fmtYM(ym)}</span>
                <span className="text-xs text-gray-400">{grp.length} захиалга · {fmt(tot)}₮</span>
              </div>
              <div className="space-y-2">
                {grp.map(o => {
                  const gross = (o.order_items||[]).reduce((a:number,i:any)=>a+i.quantity*i.unit_price,0)
                  const net = gross - o.delivery_fee
                  const itemsStr = (o.order_items||[]).map((i:any)=>`${i.product_name}×${i.quantity}`).join(', ')
                  return (
                    <div key={o.id} className={`rounded-lg border p-3 ${o.status==='delivered'?'border-emerald-100 bg-emerald-50/30':'border-gray-100'}`}>
                      <div className="flex justify-between items-start gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-gray-700 text-sm">№{o.day_seq}</span>
                          <span className="text-xs text-gray-400">{o.date}</span>
                          <span className="text-sm font-medium">{o.phone}</span>
                        </div>
                        <button onClick={() => toggleStatus(o.id, o.status)}
                          className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-all ${o.status==='delivered'?'bg-emerald-100 text-emerald-700 border-emerald-200':'bg-gray-100 text-gray-500 border-gray-200'}`}>
                          {o.status==='delivered'?'✓ Хүргэгдсэн':'○ Хүлээгдэж байна'}
                        </button>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">{o.address}</div>
                      <div className="text-xs text-gray-600 mt-1">{itemsStr}</div>
                      <div className="text-sm font-semibold text-emerald-700 mt-1">
                        {fmt(gross)}₮{o.delivery_fee>0?` − ${fmt(o.delivery_fee)}₮ = ${fmt(net)}₮`:''}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
        {filtered.length===0 && <p className="text-center text-gray-400 text-sm py-8">Захиалга олдсонгүй</p>}
      </div>
    </div>
  )
}
