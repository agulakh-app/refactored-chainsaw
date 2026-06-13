'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { RestockLog } from '@/lib/types'
import { useGuestRole, useOwnerId, useActiveStore } from '../client-layout'

const TODAY = new Date().toISOString().slice(0,10)
function fmtD(d: string) { if(!d) return ''; const [y,m,day]=d.split('-'); return `${y}/${m}/${day}` }
function fmt(n: number) { return n.toLocaleString() }

type Variant = { size: string; color: string; price: number; stock: number; cost?: number }
type Product = { id: string; name: string; stock: number; unit_price: number; store_id?: string|null; variants?: Variant[]|null; cost?: number|null }

export default function StockPage() {
  const guestRole = useGuestRole()
  const ownerId = useOwnerId()
  const activeStoreId = useActiveStore()
  const isViewer = guestRole === 'viewer'

  const [products, setProducts] = useState<Product[]>([])
  const [logs, setLogs] = useState<RestockLog[]>([])
  const [flash, setFlash] = useState('')
  const [confirmModal, setConfirmModal] = useState<{msg:string,onOk:()=>void}|null>(null)
  const [logFilter, setLogFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('')
  const [variantEnabled, setVariantEnabled] = useState(false)

  // Цэнэглэлт
  const [rProd, setRProd] = useState('')
  const [rVariantIdx, setRVariantIdx] = useState<number>(-1)
  const [rQty, setRQty] = useState('1')
  const [rDate, setRDate] = useState(TODAY)
  const [rNote, setRNote] = useState('')

  // Шинэ бараа
  const [nName, setNName] = useState('')
  const [nPrice, setNPrice] = useState('')
  const [nQty, setNQty] = useState('0')
  const [nDate, setNDate] = useState(TODAY)
  const [nVariants, setNVariants] = useState<{size:string,color:string,price:string,stock:string,cost:string}[]>([])
  const [nCost, setNCost] = useState('')

  // Edit log
  const [editLog, setEditLog] = useState<RestockLog|null>(null)
  const [selectedLogs, setSelectedLogs] = useState<Set<string>>(new Set())
  const [selectMode, setSelectMode] = useState(false)
  const [editQty, setEditQty] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editNote, setEditNote] = useState('')

  // Edit product (stock + price + cost), variant эсвэл variant-гүй аль аль нь
  const [editProd, setEditProd] = useState<Product|null>(null)
  const [editVariantStocks, setEditVariantStocks] = useState<number[]>([])
  const [editVariantPrices, setEditVariantPrices] = useState<string[]>([])
  const [editVariantCosts, setEditVariantCosts] = useState<string[]>([])
  const [editUnitPrice, setEditUnitPrice] = useState('')
  const [editUnitCost, setEditUnitCost] = useState('')

  const showFlash = (m: string) => { setFlash(m); setTimeout(()=>setFlash(''),2500) }

  const load = useCallback(async () => {
    const { data:{ user } } = await supabase.auth.getUser()
    const targetId = ownerId || user?.id
    if (!targetId) return
    const [{ data: prods },{ data: ls },{ data: storeData }] = await Promise.all([
      activeStoreId
        ? supabase.from('products').select('*').eq('user_id',targetId).eq('store_id',activeStoreId).order('name')
        : supabase.from('products').select('*').eq('user_id',targetId).order('name'),
      activeStoreId
        ? supabase.from('restock_log').select('*').eq('user_id',targetId).eq('store_id',activeStoreId).neq('note','Захиалга').order('date',{ascending:false}).order('created_at',{ascending:false})
        : supabase.from('restock_log').select('*').eq('user_id',targetId).neq('note','Захиалга').order('date',{ascending:false}).order('created_at',{ascending:false}),
      activeStoreId
        ? supabase.from('stores').select('variant_enabled').eq('id',activeStoreId).single()
        : Promise.resolve({ data: null })
    ])
    setProducts(prods||[])
    setLogs(ls||[])
    setVariantEnabled(storeData?.variant_enabled || false)
    if (prods&&prods.length>0&&!rProd) setRProd(prods[0].id)
  },[rProd, ownerId, activeStoreId])

  useEffect(()=>{ load() },[load])

  // Агуулахад бараа нэмэх — variant stock шинэчлэх
  async function addRestock() {
    const qty = Number(rQty)
    if (qty===0) { showFlash('Тоо оруулна уу'); return }
    const p = products.find(x=>x.id===rProd)
    if (!p) return
    const { data:{ user } } = await supabase.auth.getUser()
    const targetId = ownerId || user?.id
    if (!targetId) return
    const isNeg = qty < 0
    const absQty = Math.abs(qty)

    const pvs: Variant[] = p.variants || []
    let variantLabel = ''

    if (variantEnabled && pvs.length > 0) {
      if (rVariantIdx < 0) { showFlash('Variant сонгоно уу'); return }
      const v = pvs[rVariantIdx]
      if (!v) return
      variantLabel = [v.size, v.color].filter(Boolean).join(' / ')
      const newVStock = isNeg ? Math.max(0, v.stock - absQty) : v.stock + absQty
      const newVariants = pvs.map((vv, i) => i === rVariantIdx ? {...vv, stock: newVStock} : vv)
      const newTotalStock = newVariants.reduce((a, vv) => a + vv.stock, 0)
      await supabase.from('products').update({ variants: newVariants, stock: newTotalStock }).eq('id', rProd)
    } else {
      const newStock = isNeg ? Math.max(0, p.stock - absQty) : p.stock + absQty
      await supabase.from('products').update({ stock: newStock }).eq('id', rProd)
    }

    await supabase.from('restock_log').insert({
      user_id: targetId, product_id: rProd,
      product_name: p.name + (variantLabel ? ' · ' + variantLabel : ''),
      quantity: absQty, type: isNeg ? 'out' : 'in',
      note: rNote||(isNeg?'Гараар хасалт':'Цэнэглэлт'), date: rDate, store_id: activeStoreId||null,
    })

    setRQty('1'); setRNote(''); setRDate(TODAY); setRVariantIdx(-1)
    showFlash(p.name+(variantLabel?' · '+variantLabel:'')+(isNeg?`: −${absQty}ш хасагдлаа`:`+${absQty}ш нэмэгдлээ`)+' ✓')
    load()
  }

  // Шинэ бараа нэмэх
  async function addNewProduct() {
    if (!nName.trim()) { showFlash('Нэр оруулна уу'); return }
    const { data:{ user } } = await supabase.auth.getUser()
    const targetId = ownerId || user?.id
    if (!targetId) return

    const validVariants: Variant[] = nVariants
      .filter(v => v.size.trim() || v.color.trim())
      .map(v => ({
        size: v.size.trim(),
        color: v.color.trim(),
        price: Number(v.price) || 0,
        stock: Number(v.stock) || 0,
        cost: Number(v.cost) || 0
      }))

    const totalStock = validVariants.length > 0
      ? validVariants.reduce((a, v) => a + v.stock, 0)
      : Number(nQty) || 0

    // variant-гүй бараанд cost хадгалах
    const noVariantCost = validVariants.length === 0 && nCost ? Number(nCost) : null

    const { data: prod, error } = await supabase
  .from('products')
  .insert({
    user_id: targetId,
    name: nName.trim(),
    unit_price: Number(nPrice) || 0,
    stock: totalStock,
    added_date: nDate,
    store_id: activeStoreId || null,
    variants: validVariants.length > 0 ? validVariants : null,
    cost: noVariantCost
  })
  .select()
  .single()

if (error) {
  console.error(error)
  alert(error.message)
  return
}

    if (prod && totalStock > 0) {
      await supabase.from('restock_log').insert({
        user_id: targetId, product_id: prod.id,
        product_name: nName.trim(), quantity: totalStock,
        type: 'in', note: 'Шинэ бараа', date: nDate, store_id: activeStoreId||null
      })
    }

    setNName(''); setNPrice(''); setNQty('0'); setNDate(TODAY); setNVariants([]); setNCost('')
    showFlash(nName + ' нэмэгдлээ ✓'); load()
  }

  async function deleteProduct(id: string, name: string) {
    setConfirmModal({msg: name+' устгах уу?', onOk: async()=>{
      await supabase.from('products').delete().eq('id', id)
      showFlash(name+' устгагдлаа'); load()
    }})
  }

  function openEditProd(p: Product) {
    setEditProd(p)
    const pvs: Variant[] = p.variants || []
    if (pvs.length > 0) {
      setEditVariantStocks(pvs.map(v=>v.stock))
      setEditVariantPrices(pvs.map(v=>String(v.price ?? '')))
      setEditVariantCosts(pvs.map(v=>String((v as any).cost ?? '')))
    } else {
      setEditUnitPrice(String(p.unit_price ?? ''))
      setEditUnitCost(String(p.cost ?? ''))
    }
  }

  async function saveEditVariants() {
    if (!editProd) return
    const pvs: Variant[] = editProd.variants || []
    if (pvs.length > 0) {
      const newVariants = pvs.map((v, i) => ({
        ...v,
        stock: editVariantStocks[i] ?? v.stock,
        price: editVariantPrices[i] !== undefined && editVariantPrices[i] !== '' ? Number(editVariantPrices[i]) : v.price,
        cost: editVariantCosts[i] !== undefined && editVariantCosts[i] !== '' ? Number(editVariantCosts[i]) : (v as any).cost,
      }))
      const newTotal = newVariants.reduce((a, v) => a + v.stock, 0)
      await supabase.from('products').update({ variants: newVariants, stock: newTotal }).eq('id', editProd.id)
    } else {
      await supabase.from('products').update({
        unit_price: Number(editUnitPrice) || 0,
        cost: editUnitCost ? Number(editUnitCost) : null,
      }).eq('id', editProd.id)
    }
    setEditProd(null)
    showFlash(editProd.name + ' шинэчлэгдлээ ✓')
    load()
  }

  async function bulkDeleteLogs() {
    if (selectedLogs.size === 0) return
    setConfirmModal({msg:`${selectedLogs.size} бүртгэл устгах уу?`, onOk: async()=>{
    for (const id of Array.from(selectedLogs)) {
      await supabase.from('restock_log').delete().eq('id', id)
    }
      setSelectedLogs(new Set())
      setSelectMode(false)
      load()
    }})
  }

  async function deleteLog(log: RestockLog) {
    setConfirmModal({msg:'Энэ бүртгэлийг устгах уу?', onOk: async()=>{
      await supabase.from('restock_log').delete().eq('id', log.id)
      showFlash('Устгагдлаа'); load()
    }})
  }

  async function saveEditLog() {
    if (!editLog) return
    const { data:{ user } } = await supabase.auth.getUser()
    const targetId = ownerId || user?.id
    if (!targetId) return
    const oldQty = editLog.quantity
    const newQty = Number(editQty)
    const diff = newQty - oldQty

    // product stock-ийг засах
    if (diff !== 0) {
      const prod = products.find(p => p.name === editLog.product_name.split(' · ')[0])
      if (prod) {
        const variantLabel = editLog.product_name.includes(' · ') ? editLog.product_name.split(' · ')[1] : null
        const pvs: Variant[] = prod.variants || []
        if (variantLabel && pvs.length > 0) {
          const newVariants = pvs.map(v => [v.size, v.color].filter(Boolean).join(' / ') === variantLabel
            ? { ...v, stock: Math.max(0, v.stock + (editLog.type === 'in' ? diff : -diff)) }
            : v
          )
          const newTotal = newVariants.reduce((a, v) => a + v.stock, 0)
          await supabase.from('products').update({ variants: newVariants, stock: newTotal }).eq('id', prod.id)
        } else {
          await supabase.from('products').update({
            stock: Math.max(0, prod.stock + (editLog.type === 'in' ? diff : -diff))
          }).eq('id', prod.id)
        }
      }
    }

    await supabase.from('restock_log').update({
      quantity: newQty, date: editDate, note: editNote
    }).eq('id', editLog.id)
    setEditLog(null); showFlash('Засварлагдлаа ✓'); load()
  }

  let filteredLogs = logs
  if (logFilter !== 'all') filteredLogs = filteredLogs.filter(l => l.product_name.startsWith(logFilter))
  if (dateFilter) filteredLogs = filteredLogs.filter(l => l.date === dateFilter)

  const logGroups: Record<string, RestockLog[]> = {}
  filteredLogs.forEach(l => { if(!logGroups[l.date]) logGroups[l.date]=[]; logGroups[l.date].push(l) })

  const rProdData = products.find(p => p.id === rProd)
  const rVariants: Variant[] = rProdData?.variants || []

  return (
    <div className="space-y-4">
      {flash && <div className="fixed top-4 right-4 bg-gray-900 text-white text-sm px-4 py-2 rounded-lg z-50">{flash}</div>}
      {confirmModal&&(
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-xs shadow-xl">
            <p className="text-sm text-gray-700 text-center mb-5">{confirmModal.msg}</p>
            <div className="flex gap-3">
              <button onClick={()=>setConfirmModal(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Болих</button>
              <button onClick={()=>{confirmModal.onOk();setConfirmModal(null)}}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600">Устгах</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit product modal — stock, зарах үнэ, өртөг */}
      {!isViewer && editProd && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h3 className="font-medium text-gray-800 mb-1">{editProd.name}</h3>
            <p className="text-xs text-gray-400 mb-4">Үлдэгдэл, зарах үнэ, өртөгийг засна</p>

            {(editProd.variants||[]).length > 0 ? (
              <div className="space-y-3 mb-5 max-h-80 overflow-y-auto">
                {(editProd.variants||[]).map((v, i) => (
                  <div key={i} className="border border-gray-100 rounded-lg p-2.5">
                    <div className="text-sm text-gray-600 mb-2">{[v.size,v.color].filter(Boolean).join(' / ')}</div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Тоо</label>
                        <input type="number" min="0"
                          className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm text-center"
                          value={editVariantStocks[i] ?? v.stock}
                          onChange={e=>{
                            const arr = [...editVariantStocks]
                            arr[i] = Number(e.target.value)
                            setEditVariantStocks(arr)
                          }} />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Зарах (₮)</label>
                        <input type="text" inputMode="numeric"
                          className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm"
                          value={editVariantPrices[i] ? Number(editVariantPrices[i]).toLocaleString() : ''}
                          onChange={e=>{
                            const arr=[...editVariantPrices]
                            arr[i]=e.target.value.replace(/[^0-9]/g,'')
                            setEditVariantPrices(arr)
                          }} />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Өртөг (₮)</label>
                        <input type="text" inputMode="numeric"
                          className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm"
                          value={editVariantCosts[i] ? Number(editVariantCosts[i]).toLocaleString() : ''}
                          onChange={e=>{
                            const arr=[...editVariantCosts]
                            arr[i]=e.target.value.replace(/[^0-9]/g,'')
                            setEditVariantCosts(arr)
                          }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 mb-5">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Зарах үнэ (₮)</label>
                  <input type="text" inputMode="numeric"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                    placeholder="59,000"
                    value={editUnitPrice ? Number(editUnitPrice).toLocaleString() : ''}
                    onChange={e=>setEditUnitPrice(e.target.value.replace(/[^0-9]/g,''))} />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Өртөг (₮)</label>
                  <input type="text" inputMode="numeric"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                    placeholder="37,000"
                    value={editUnitCost ? Number(editUnitCost).toLocaleString() : ''}
                    onChange={e=>setEditUnitCost(e.target.value.replace(/[^0-9]/g,''))} />
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={()=>setEditProd(null)} className="flex-1 py-2 rounded-xl border border-gray-200 text-sm">Болих</button>
              <button onClick={saveEditVariants} className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium">Хадгалах</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {!isViewer && editLog && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h3 className="font-medium text-gray-800 mb-4">Цэнэглэлт засварлах</h3>
            <div className="space-y-3">
              <div><label className="block text-xs text-gray-500 mb-1">Бараа</label>
                <div className="text-sm bg-gray-50 px-3 py-2 rounded-lg text-gray-700">{editLog.product_name}</div></div>
              <div><label className="block text-xs text-gray-500 mb-1">Тоо ширхэг</label>
                <input type="number" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                  value={editQty} onChange={e=>setEditQty(e.target.value)} /></div>
              <div><label className="block text-xs text-gray-500 mb-1">Огноо</label>
                <input type="date" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
                  value={editDate} onChange={e=>setEditDate(e.target.value)} /></div>
              <div><label className="block text-xs text-gray-500 mb-1">Тэмдэглэл</label>
                <input className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                  value={editNote} onChange={e=>setEditNote(e.target.value)} /></div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={()=>setEditLog(null)} className="flex-1 py-2 rounded-xl border border-gray-200 text-sm">Болих</button>
              <button onClick={saveEditLog} className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium">Хадгалах</button>
            </div>
          </div>
        </div>
      )}

      {/* Агуулахад бараа нэмэх */}
      {!isViewer && (
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <h2 className="font-medium text-gray-800 mb-4 text-sm">Агуулахад бараа нэмэх</h2>
          <div className="flex flex-wrap gap-2 mb-2">
            <div className="flex-1 min-w-[140px]">
              <label className="block text-xs text-gray-500 mb-1">Бараа</label>
              <select className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
                value={rProd} onChange={e=>{setRProd(e.target.value);setRVariantIdx(-1)}}>
                {products.map(p=><option key={p.id} value={p.id}>{p.name} ({p.stock}ш)</option>)}
              </select>
            </div>
            {variantEnabled && rVariants.length > 0 && (
              <div className="flex-1 min-w-[140px]">
                <label className="block text-xs text-gray-500 mb-1">Хэмжээ / Өнгө</label>
                <select className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
                  value={rVariantIdx} onChange={e=>setRVariantIdx(Number(e.target.value))}>
                  <option value={-1}>— Сонгох —</option>
                  {rVariants.map((v, i) => (
                    <option key={i} value={i}>
                      {[v.size, v.color].filter(Boolean).join(' / ')} ({v.stock}ш)
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="w-20">
              <label className="block text-xs text-gray-500 mb-1">Тоо</label>
              <input type="number" value={rQty} onChange={e=>setRQty(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg border text-sm ${Number(rQty)<0?'border-red-200 bg-red-50 text-red-700':'border-gray-200'}`} />
            </div>
            <div className="w-36">
              <label className="block text-xs text-gray-500 mb-1">Огноо</label>
              <input type="date" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
                value={rDate} onChange={e=>setRDate(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Тэмдэглэл</label>
            <input className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
              placeholder="Нийлүүлэгч, нэхэмжлэл дугаар..." value={rNote} onChange={e=>setRNote(e.target.value)} />
          </div>
          {Number(rQty)<0&&<p className="mt-2 text-xs text-red-500">{Math.abs(Number(rQty))}ш агуулахаас хасагдана</p>}
          <div className="flex justify-end mt-3">
            <button onClick={addRestock}
              className={`px-5 py-2 rounded-lg text-sm font-medium text-white ${Number(rQty)<0?'bg-red-500 hover:bg-red-600':'bg-emerald-600 hover:bg-emerald-700'}`}>
              {Number(rQty)<0?'Хасах':'Агуулахад бараа нэмэх'}
            </button>
          </div>
        </div>
      )}

      {/* Шинэ бараа */}
      {!isViewer && (
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <h2 className="font-medium text-gray-800 mb-4 text-sm">Шинэ бараа оруулах</h2>
          {/* Variant байхгүй — нэг мөрт */}
          {!variantEnabled && (
            <div className="grid gap-2" style={{gridTemplateColumns:'2fr 0.8fr 1.3fr 1.3fr 1.3fr'}}>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Барааны нэр</label>
                <input className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                  placeholder="Барааны нэр" value={nName} onChange={e=>setNName(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Тоо</label>
                <input type="number" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-center"
                  min="0" value={nQty} onChange={e=>setNQty(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Зарах үнэ (₮)</label>
                <input type="text" inputMode="numeric" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                  placeholder="59,000" value={nPrice?Number(nPrice).toLocaleString():''} onChange={e=>setNPrice(e.target.value.replace(/[^0-9]/g,''))} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Өртөг (₮)</label>
                <input type="text" inputMode="numeric" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                  placeholder="37,000" value={nCost?Number(nCost).toLocaleString():''} onChange={e=>setNCost(e.target.value.replace(/[^0-9]/g,''))} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Огноо</label>
                <input type="date" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
                  value={nDate} onChange={e=>setNDate(e.target.value)} />
              </div>
            </div>
          )}
          {/* Variant байгаа — нэр + огноо дээр, variant table доор */}
          {variantEnabled && (
            <div className="grid gap-2 mb-3" style={{gridTemplateColumns:'1fr 1fr'}}>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Барааны нэр</label>
                <input className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                  placeholder="Барааны нэр" value={nName} onChange={e=>setNName(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Огноо</label>
                <input type="date" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
                  value={nDate} onChange={e=>setNDate(e.target.value)} />
              </div>
            </div>
          )}
          {variantEnabled && (
            <div className="mt-4">
              <div className="flex justify-end mb-1">
                <button onClick={()=>setNVariants(v=>[...v,{size:'',color:'',price:'',stock:'0',cost:''}])}
                  className="text-xs text-emerald-600 hover:underline whitespace-nowrap">＋ Variant нэмэх</button>
              </div>

              {nVariants.length===0 && (
                <p className="text-xs text-gray-400">Variant байхгүй бол хоосон орхино</p>
              )}
              {nVariants.length>0&&(
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-separate" style={{borderSpacing:'0 6px'}}>
                    <thead>
                      <tr>
                        <th className="text-left text-xs text-gray-400 font-normal pb-1 pr-2">Хэмжээ</th>
                        <th className="text-left text-xs text-gray-400 font-normal pb-1 pr-2">Өнгө</th>
                        <th className="text-left text-xs text-gray-400 font-normal pb-1 pr-2">Зарах үнэ (₮)</th>
                        <th className="text-left text-xs text-gray-400 font-normal pb-1 pr-2">Өртөг (₮)</th>
                        <th className="text-left text-xs text-gray-400 font-normal pb-1 pr-2">Тоо</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {nVariants.map((v,i)=>(
                        <tr key={i}>
                          <td className="pr-2"><input className="w-full px-2 py-2.5 rounded-lg border border-gray-200 text-sm py-2.5"
                            placeholder="150x200..." value={v.size}
                            onChange={e=>setNVariants(vs=>vs.map((x,j)=>j===i?{...x,size:e.target.value}:x))}/></td>
                          <td className="pr-2"><input className="w-full px-2 py-2 rounded-lg border border-gray-200 text-sm py-2.5"
                            placeholder="Цагаан..." value={v.color}
                            onChange={e=>setNVariants(vs=>vs.map((x,j)=>j===i?{...x,color:e.target.value}:x))}/></td>
                          <td className="pr-2"><input type="text" inputMode="numeric" className="w-full px-2 py-2 rounded-lg border border-gray-200 text-sm py-2.5"
                            placeholder="59,000" value={v.price?Number(v.price).toLocaleString():''}
                            onChange={e=>setNVariants(vs=>vs.map((x,j)=>j===i?{...x,price:e.target.value.replace(/[^0-9]/g,'')}:x))}/></td>
                          <td className="pr-2"><input type="text" inputMode="numeric" className="w-full px-2 py-2 rounded-lg border border-gray-200 text-sm py-2.5"
                            placeholder="37,000" value={v.cost?Number(v.cost).toLocaleString():''}
                            onChange={e=>setNVariants(vs=>vs.map((x,j)=>j===i?{...x,cost:e.target.value.replace(/[^0-9]/g,'')}:x))}/></td>
                          <td className="pr-2" style={{width:70}}><input type="number" className="w-full px-2 py-2 rounded-lg border border-gray-200 text-sm text-center py-2.5"
                            placeholder="0" min="0" value={v.stock}
                            onChange={e=>setNVariants(vs=>vs.map((x,j)=>j===i?{...x,stock:e.target.value}:x))}/></td>
                          <td style={{width:32}}><button onClick={()=>setNVariants(vs=>vs.filter((_,j)=>j!==i))}
                            className="w-7 h-7 flex items-center justify-center bg-red-50 text-red-400 rounded-lg text-xs hover:bg-red-100">✕</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
          <div className="flex justify-end mt-3">
            <button onClick={addNewProduct} className="px-5 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700">Нэмэх</button>
          </div>
        </div>
      )}

      {/* Бараа жагсаалт */}
      {products.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="font-medium text-gray-800 text-sm">Бараа жагсаалт</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {products.map(p => {
              const pvs: Variant[] = p.variants || []
              return (
                <div key={p.id} className="px-4 py-3 hover:bg-gray-50">
                  <div className="flex items-center justify-between mb-1">
  <div className="flex items-center gap-2 flex-1 min-w-0">
    <span className="text-sm font-medium text-gray-700 truncate">{p.name}</span>
    {p.stock === 0 && <span className="text-xs px-1.5 py-0.5 bg-red-50 text-red-500 border border-red-100 rounded flex-shrink-0">Дууссан</span>}
    {p.stock > 0 && p.stock <= 10 && <span className="text-xs px-1.5 py-0.5 bg-amber-50 text-amber-500 border border-amber-100 rounded flex-shrink-0">Цөөн</span>}
  </div>
  <div className="flex items-center gap-3 flex-shrink-0">
    {pvs.length===0 && (
      <span className="text-xs text-gray-400 hidden sm:inline">
        {fmt(p.unit_price)}₮{p.cost?<span className="text-orange-400 ml-1">(өртөг {fmt(p.cost)}₮)</span>:null}
      </span>
    )}
    <span className="text-sm text-gray-500 w-16 text-right">{p.stock}ш</span>
                      {!isViewer && (
                        <div className="flex items-center gap-1">
                          <button onClick={()=>openEditProd(p)}
                            className="text-xs text-gray-400 hover:text-blue-600 px-2 py-1 rounded hover:bg-blue-50">засах</button>
                          <button onClick={()=>deleteProduct(p.id, p.name)}
                            className="text-xs text-gray-400 hover:text-red-500 px-2 py-1 rounded hover:bg-red-50">устгах</button>
                        </div>
                      )}
                    </div>
                  </div>
                  {pvs.length > 0 && (
                    <div className="mt-1.5 space-y-1">
                      {pvs.map((v, i) => (
  <div key={i} className="flex items-center justify-between text-xs py-0.5">
    <span className="text-gray-500 w-32 truncate">{[v.size, v.color].filter(Boolean).join(' / ')}</span>
    <div className="flex items-center gap-3 flex-shrink-0">
      {(v as any).cost>0&&<span className="text-gray-400 w-24 text-right">өртөг: {fmt(Number((v as any).cost))}₮</span>}
      <span className="text-emerald-600 w-20 text-right">{fmt(Number(v.price))}₮</span>
      <span className={`w-10 text-right font-medium ${v.stock===0?'text-red-500':v.stock<=5?'text-amber-500':'text-gray-600'}`}>{v.stock}ш</span>
    </div>
  </div>
))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Цэнэглэлтийн бүртгэл */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-medium text-gray-800 text-sm">Агуулах дахь бараа</h2>
          {!isViewer&&(
            <div className="flex items-center gap-2">
              {selectMode&&selectedLogs.size>0&&(
                <button onClick={bulkDeleteLogs}
                  className="px-3 py-1 bg-red-50 text-red-500 rounded-lg text-xs font-medium hover:bg-red-100">
                  {selectedLogs.size}ш устгах
                </button>
              )}
              {selectMode&&filteredLogs.length>0&&(
                <button onClick={()=>setSelectedLogs(
                  selectedLogs.size===filteredLogs.length
                    ? new Set()
                    : new Set(filteredLogs.map((l:any)=>l.id))
                )}
                  className="px-3 py-1 border border-gray-200 text-gray-500 rounded-lg text-xs hover:bg-gray-50">
                  {selectedLogs.size===filteredLogs.length?'Болих':'Бүгд'}
                </button>
              )}
              <button onClick={()=>{setSelectMode((s:boolean)=>!s);setSelectedLogs(new Set())}}
                className={`px-3 py-1 rounded-lg text-xs ${selectMode?'bg-gray-200 text-gray-700':'border border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                {selectMode?'Болих':'Сонгох'}
              </button>
            </div>
          )}
        </div>
        <div className="flex gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50 flex-wrap">
          <select className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white" value={logFilter} onChange={e=>setLogFilter(e.target.value)}>
            <option value="all">Бүх бараа</option>
            {products.map(p=><option key={p.id} value={p.name}>{p.name}</option>)}
          </select>
          <input type="date" className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
            value={dateFilter} onChange={e=>setDateFilter(e.target.value)} />
          {dateFilter&&<button onClick={()=>setDateFilter('')} className="px-2 py-2 rounded-lg border border-gray-200 text-xs text-gray-500 bg-white">✕</button>}
        </div>
        {Object.keys(logGroups).sort((a,b)=>b.localeCompare(a)).map(date=>{
          const grp = logGroups[date]
          const totalIn = grp.filter(r=>r.type==='in').reduce((a,r)=>a+r.quantity,0)
          const totalOut = grp.filter(r=>r.type==='out').reduce((a,r)=>a+r.quantity,0)
          return (
            <div key={date}>
              <div className="px-4 py-2 bg-gray-100 border-y border-gray-200 flex justify-between items-center">
                <span className="text-xs font-medium text-gray-600">{fmtD(date)}</span>
                <div className="flex gap-2">
                  {totalIn>0&&<span className="text-xs text-emerald-600">+{totalIn}ш</span>}
                  {totalOut>0&&<span className="text-xs text-red-500">−{totalOut}ш</span>}
                </div>
              </div>
              <div className="divide-y divide-gray-50">
                {grp.map(r=>(
                  <div key={r.id} className={`flex justify-between items-center py-2.5 px-4 hover:bg-gray-50 group ${selectMode&&selectedLogs.has(r.id)?'bg-blue-50':''}`}
                    onClick={selectMode?()=>setSelectedLogs(s=>{const n=new Set(s);n.has(r.id)?n.delete(r.id):n.add(r.id);return n}):undefined}
                    style={selectMode?{cursor:'pointer'}:{}}>
                    <div className="flex items-center gap-3">
                      {selectMode&&(
                        <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${selectedLogs.has(r.id)?'bg-emerald-500 border-emerald-500':'border-gray-300'}`}>
                          {selectedLogs.has(r.id)&&<span className="text-white text-xs">✓</span>}
                        </div>
                      )}
                      <div>
                        <div className="text-sm text-gray-700">{r.product_name}</div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {r.note}
                          {(r as any).cost_per_unit&&<span className="ml-2 text-orange-500">өртөг: {Number((r as any).cost_per_unit).toLocaleString()}₮/ш</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-medium ${r.type==='in'?'text-emerald-600':'text-red-500'}`}>
                        {r.type==='in'?'+':'-'}{r.quantity}ш
                      </span>
                      {!isViewer&&!selectMode&&(
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={()=>{setEditLog(r);setEditQty(String(r.quantity));setEditDate(r.date);setEditNote(r.note||'')}}
                            className="px-2 py-1 rounded-lg text-xs text-gray-400 hover:text-blue-600 hover:bg-blue-50">засах</button>
                          <button onClick={()=>deleteLog(r)}
                            className="px-2 py-1 rounded-lg text-xs text-gray-400 hover:text-red-500 hover:bg-red-50">устгах</button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
        {filteredLogs.length===0&&<p className="text-center text-gray-400 text-sm py-8">Бүртгэл алга</p>}
      </div>
    </div>
  )
}
