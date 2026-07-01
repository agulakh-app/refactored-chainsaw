'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback, useRef } from 'react'
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
  const [stockTab, setStockTab] = useState<'list'|'log'>('list')
  const [auditOrders, setAuditOrders] = useState<any[]>([])
  const [auditEdit, setAuditEdit] = useState<{productId:string,label:string,variant:string,current:number}|null>(null)
  const [auditEditVal, setAuditEditVal] = useState('')
  const [supply, setSupply] = useState<any[]>([])
  const [supplyExpanded, setSupplyExpanded] = useState<Set<string>>(new Set())
  const [showSupplyForm, setShowSupplyForm] = useState(false)
  const [fProdId, setFProdId] = useState('')
  const [fVariant, setFVariant] = useState('')
  const [fType, setFType] = useState<'ordered'|'received'>('ordered')
  const [fQty, setFQty] = useState('')
  const [fDate, setFDate] = useState(TODAY)
  const [fNote, setFNote] = useState('')
  const [fSaving, setFSaving] = useState(false)

  // Цэнэглэлт
  const [rProd, setRProd] = useState('')
  const [rProdSearch, setRProdSearch] = useState('')
  const [rProdOpen, setRProdOpen] = useState(false)
  const [rVariantIdx, setRVariantIdx] = useState<number>(-1)
  const [rQty, setRQty] = useState('1')
  const [rDate, setRDate] = useState(TODAY)
  const [rNote, setRNote] = useState('')
  const [rAction, setRAction] = useState<'restock'|'ordered'|'received'>('restock')

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
  const [editCost, setEditCost] = useState('')

  // Edit product (stock + price + cost), variant эсвэл variant-гүй аль аль нь
  const [editProd, setEditProd] = useState<Product|null>(null)
  const [editVariantStocks, setEditVariantStocks] = useState<number[]>([])
  const [editVariantPrices, setEditVariantPrices] = useState<string[]>([])
  const [editVariantCosts, setEditVariantCosts] = useState<string[]>([])
  const [editUnitPrice, setEditUnitPrice] = useState('')
  const [editUnitCost, setEditUnitCost] = useState('')
  const [openDropdown, setOpenDropdown] = useState<string|null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const showFlash = (m: string) => { setFlash(m); setTimeout(()=>setFlash(''),2500) }

  useEffect(()=>{
    function handleClick(e:MouseEvent){
      if(dropdownRef.current&&!dropdownRef.current.contains(e.target as Node)) setOpenDropdown(null)
    }
    document.addEventListener('mousedown',handleClick)
    return()=>document.removeEventListener('mousedown',handleClick)
  },[])

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
    // Аудитын захиалгууд татах
    if(targetId){
      const oq = supabase.from('orders').select('*, order_items(*)').eq('user_id',targetId).in('status',['pending','delivered'])
      const { data: ords } = activeStoreId ? await oq.eq('store_id',activeStoreId) : await oq
      setAuditOrders(ords||[])
      const { data: sup } = await supabase.from('supply_log').select('*').eq('user_id',targetId).order('date',{ascending:false})
      setSupply(sup||[])
      if(!fProdId&&prods&&prods.length>0) setFProdId(prods[0].id)
    }
  },[rProd, ownerId, activeStoreId])

  useEffect(()=>{ load() },[load])

  // Агуулахад бараа нэмэх — variant stock шинэчлэх
  async function saveSupply() {
    if(!fProdId||!fQty) return
    const { data:{ user } } = await supabase.auth.getUser()
    const targetId = ownerId || user?.id
    if(!targetId) return
    setFSaving(true)
    const prod = products.find(p=>p.id===fProdId)
    await supabase.from('supply_log').insert({
      user_id:targetId, store_id:activeStoreId||null,
      product_id:fProdId, product_name:prod?.name||'',
      variant_label:fVariant||null, type:fType,
      quantity:parseInt(fQty)||0, date:fDate, note:fNote||null
    })
    setFQty(''); setFNote('')
    setFSaving(false); showFlash('Хадгалагдлаа ✓'); load()
  }

  async function addRestock() {
    const qty = Number(rQty)
    if (qty===0) { showFlash('Тоо оруулна уу'); return }
    const p = products.find(x=>x.id===rProd)
    if (!p) return
    const { data:{ user } } = await supabase.auth.getUser()
    const targetId = ownerId || user?.id
    if (!targetId) return
    const absQty = Math.abs(qty)
    const pvs: Variant[] = p.variants || []
    let variantLabel = ''
    if (variantEnabled && pvs.length > 0) {
      if (rVariantIdx < 0) { showFlash('Variant сонгоно уу'); return }
      const v = pvs[rVariantIdx]
      if (!v) return
      variantLabel = [v.size, v.color].filter(Boolean).join(' / ')
    }

    // Захиалсан / Ирсэн — зөвхөн бүртгэл, stock-д нөлөөлөхгүй
    if (rAction === 'ordered' || rAction === 'received') {
      await supabase.from('supply_log').insert({
        user_id: targetId, store_id: activeStoreId||null,
        product_id: rProd, product_name: p.name,
        variant_label: variantLabel||null,
        type: rAction, quantity: absQty, date: rDate, note: rNote||null
      })
      setRQty('1'); setRNote('')
      showFlash((rAction==='ordered'?'Захиалсан':'Ирсэн')+' бүртгэгдлээ ✓')
      load()
      return
    }

    // Цэнэглэлт — stock-г өөрчилнө
    const isNeg = qty < 0
    if (variantEnabled && pvs.length > 0) {
      const v = pvs[rVariantIdx]
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
      variant_label: variantLabel||null,
      quantity: absQty, type: isNeg ? 'out' : 'in',
      note: rNote||(isNeg?'Гараар хасалт':'Цэнэглэлт'), date: rDate, store_id: activeStoreId||null,
    })

    setRQty('1'); setRNote(''); setRVariantIdx(-1)
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

    const updateData: any = { quantity: newQty, date: editDate, note: editNote }
    if (editCost) updateData.unit_cost = Number(editCost)
    await supabase.from('restock_log').update(updateData).eq('id', editLog.id)
    // Өртөг өөрчлөгдсөн бол бараанд шинэчлэнэ
    if(editCost){
      const prod=products.find(p=>p.name===editLog.product_name.split(' · ')[0])
      if(prod) await supabase.from('products').update({unit_cost:Number(editCost)}).eq('id',prod.id)
    }
    setEditLog(null); showFlash('Засварлагдлаа ✓'); load()
  }

  let filteredLogs = logs
  if (logFilter !== 'all') filteredLogs = filteredLogs.filter(l => l.product_name.startsWith(logFilter))
  if (dateFilter) filteredLogs = filteredLogs.filter(l => l.date === dateFilter)

  const logGroups: Record<string, RestockLog[]> = {}
  filteredLogs.forEach(l => { if(!logGroups[l.date]) logGroups[l.date]=[]; logGroups[l.date].push(l) })

  const rProdData = products.find(p => p.id === rProd)
  const rVariants = (rProdData?.variants || []) as Variant[]

  return (
    <div className="space-y-4">
      {flash && <div className="fixed top-4 right-4 bg-gray-900 text-white text-sm px-4 py-2 rounded-lg z-50">{flash}</div>}

      {/* Tab товчнууд */}
      <div className="flex gap-2 border-b border-gray-100 pb-0">
        {([['list','Бараа бүртгэл'],['log','Бүртгэл']] as const).map(([t,l])=>(
          <button key={t} onClick={()=>setStockTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-all ${stockTab===t?'border-emerald-600 text-emerald-700':'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {l}
          </button>
        ))}
      </div>
      {auditEdit&&(
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-xs shadow-xl">
            <h3 className="font-semibold text-gray-800 mb-1">{auditEdit.label}</h3>
            {auditEdit.variant&&<p className="text-xs text-gray-400 mb-4">{auditEdit.variant}</p>}
            <p className="text-xs text-gray-500 mb-3">Одоогийн систем дэх тоо: <span className="font-medium text-gray-800">{auditEdit.current}ш</span></p>
            <label className="block text-xs text-gray-500 mb-1">Шинэ тоо</label>
            <input type="number" autoFocus
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm mb-4"
              value={auditEditVal}
              onChange={e=>setAuditEditVal(e.target.value)}
              onKeyDown={async e=>{ if(e.key==='Enter') document.getElementById('audit-save-btn')?.click() }}
            />
            <div className="flex gap-2">
              <button onClick={()=>setAuditEdit(null)}
                className="flex-1 py-2 rounded-xl border border-gray-200 text-sm text-gray-600">Болих</button>
              <button id="audit-save-btn" onClick={async()=>{
                const ns = parseInt(auditEditVal)||0
                const prod = products.find(p=>p.id===auditEdit.productId)
                if(!prod){setAuditEdit(null);return}
                const pvs:any[]=(prod as any).variants||[]
                if(pvs.length>0&&auditEdit.variant){
                  const nv=pvs.map((v:any)=>[v.size,v.color].filter(Boolean).join(' / ')===auditEdit.variant?{...v,stock:ns}:v)
                  const nt=nv.reduce((a:number,v:any)=>a+v.stock,0)
                  await supabase.from('products').update({variants:nv,stock:nt}).eq('id',auditEdit.productId)
                } else {
                  await supabase.from('products').update({stock:ns}).eq('id',auditEdit.productId)
                }
                setAuditEdit(null); showFlash('Засварлагдлаа ✓'); load()
              }}
                className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium">Хадгалах</button>
            </div>
          </div>
        </div>
      )}
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
            <p className="text-xs text-gray-400 mb-4 hidden"></p>

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
                <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                  <input type="date" className="w-full px-3 py-2 text-sm bg-white appearance-none" style={{WebkitAppearance:'none'}} value={editDate} onChange={e=>setEditDate(e.target.value)} />
                </div></div>
              <div><label className="block text-xs text-gray-500 mb-1">Тэмдэглэл</label>
                <input className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                  value={editNote} onChange={e=>setEditNote(e.target.value)} /></div>
              <div><label className="block text-xs text-gray-500 mb-1">Өртөг (₮) <span className="text-gray-400">— тухайн өдрийн үнэ</span></label>
                <input type="number" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                  placeholder="Хоосон бол өөрчлөгдөхгүй" value={editCost} onChange={e=>setEditCost(e.target.value)} /></div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={()=>setEditLog(null)} className="flex-1 py-2 rounded-xl border border-gray-200 text-sm">Болих</button>
              <button onClick={saveEditLog} className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium">Хадгалах</button>
            </div>
          </div>
        </div>
      )}

      {/* Агуулахад бараа нэмэх | Шинэ бараа — зэрэгцээ */}
      {!isViewer && stockTab==='list' && (
        <div className="grid grid-cols-2 gap-4 items-stretch">
        {/* Агуулахад бараа нэмэх */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-medium text-gray-800 text-sm">Бараа бүртгэх</h2>
            <select value={rAction} onChange={e=>setRAction(e.target.value as any)}
              className="text-xs px-2 py-1 rounded-lg border border-gray-200 bg-white">
              <option value="ordered">Захиалсан</option>
              <option value="received">Ирсэн / Хүлээн авсан</option>
              <option value="restock">Цэнэглэсэн</option>
            </select>
          </div>
          <div className="space-y-2 flex-1">
            {/* Мөр 1: Бараа | Тоо | Огноо */}
            <div className="grid gap-2" style={{gridTemplateColumns:'2fr 60px 140px'}}>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Бараа</label>
                <div className="relative">
                  <input
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
                    placeholder="Нэрээр хайх..."
                    value={rProdSearch||products.find(p=>p.id===rProd)?.name||''}
                    onFocus={()=>{setRProdOpen(true);setRProdSearch('')}}
                    onChange={e=>{setRProdSearch(e.target.value);setRProdOpen(true)}}
                    onBlur={()=>setTimeout(()=>setRProdOpen(false),150)}
                  />
                  {rProdOpen&&(
                    <div className="absolute top-full left-0 right-0 z-50 bg-white border border-gray-200 rounded-lg mt-1 max-h-48 overflow-y-auto shadow-lg">
                      {products
                        .filter(p=>!rProdSearch||p.name.toLowerCase().includes(rProdSearch.toLowerCase()))
                        .map(p=>(
                          <button key={p.id} type="button"
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-emerald-50 flex justify-between items-center ${p.id===rProd?'bg-emerald-50 text-emerald-700':''}`}
                            onMouseDown={()=>{setRProd(p.id);setRVariantIdx(-1);setRProdSearch('');setRProdOpen(false)}}>
                            <span>{p.name}</span>
                            <span className="text-xs text-gray-400">{p.stock}ш</span>
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Тоо</label>
                <input type="number" value={rQty} onChange={e=>setRQty(e.target.value)}
                  className={`w-full px-2 py-2 rounded-lg border text-sm text-center ${Number(rQty)<0?'border-red-200 bg-red-50 text-red-700':'border-gray-200'}`} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Огноо</label>
                <input type="date" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
                  value={rDate} onChange={e=>setRDate(e.target.value)} />
              </div>
            </div>
            {/* Мөр 2: Variant (байвал) | Тэмдэглэл | Нэмэх */}
            <div className="grid gap-2" style={{gridTemplateColumns:rVariants.length>0?'1.2fr 2fr auto':'1fr auto'}}>
              {rVariants.length > 0 && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Variant</label>
                  <select className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
                    value={rVariantIdx} onChange={e=>setRVariantIdx(Number(e.target.value))}>
                    <option value={-1}>— Сонгох —</option>
                    {rVariants.map((v,i)=>(
                      <option key={i} value={i}>{[v.size,v.color].filter(Boolean).join(' / ')} ({v.stock}ш)</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs text-gray-500 mb-1">Тэмдэглэл</label>
                <input className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                  placeholder="Нийлүүлэгч..." value={rNote} onChange={e=>setRNote(e.target.value)} />
              </div>
              <div className="flex items-end">
                <button onClick={addRestock}
                  className={`px-4 py-2 rounded-lg text-sm font-medium text-white whitespace-nowrap ${Number(rQty)<0?'bg-red-500 hover:bg-red-600':'bg-emerald-600 hover:bg-emerald-700'}`}>
                  {rAction!=='restock' ? 'Хадгалах' : (Number(rQty)<0?'Хасах':'Нэмэх')}
                </button>
              </div>
            </div>
          </div>
          {Number(rQty)<0&&<p className="mt-2 text-xs text-red-500">{Math.abs(Number(rQty))}ш агуулахаас хасагдана</p>}
        </div>
        {/* Шинэ бараа оруулах */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 flex flex-col">
          <h2 className="font-medium text-gray-800 mb-4 text-sm">Шинэ бараа оруулах</h2>

          {/* Нэр + Зарах үнэ */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Барааны нэр</label>
              <input className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                placeholder="Барааны нэр" value={nName} onChange={e=>setNName(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Зарах үнэ (₮)</label>
              <input type="text" inputMode="numeric" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                placeholder="59,000" value={nPrice?Number(nPrice).toLocaleString():''} onChange={e=>setNPrice(e.target.value.replace(/[^0-9]/g,''))} />
            </div>
          </div>

          {/* Variant хэсэг */}
          {variantEnabled && (
            <div className="flex-1">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-gray-400">Variant</span>
                <button onClick={()=>setNVariants(v=>[...v,{size:'',color:'',price:'',stock:'0',cost:''}])}
                  className="text-xs text-emerald-600 hover:underline">＋ Нэмэх</button>
              </div>
              {nVariants.length>0&&(
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-separate" style={{borderSpacing:'0 6px'}}>
                    <thead>
                      <tr>
                        <th className="text-left text-xs text-gray-400 font-normal pb-1 pr-2">Хэмжээ</th>
                        <th className="text-left text-xs text-gray-400 font-normal pb-1 pr-2">Өнгө</th>
                        <th className="text-left text-xs text-gray-400 font-normal pb-1 pr-2">Үнэ (₮)</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {nVariants.map((v,i)=>(
                        <tr key={i}>
                          <td className="pr-2"><input className="w-full px-2 py-2 rounded-lg border border-gray-200 text-sm"
                            placeholder="L3..." value={v.size}
                            onChange={e=>setNVariants(vs=>vs.map((x,j)=>j===i?{...x,size:e.target.value}:x))}/></td>
                          <td className="pr-2"><input className="w-full px-2 py-2 rounded-lg border border-gray-200 text-sm"
                            placeholder="Цагаан..." value={v.color}
                            onChange={e=>setNVariants(vs=>vs.map((x,j)=>j===i?{...x,color:e.target.value}:x))}/></td>
                          <td className="pr-2"><input type="text" inputMode="numeric" className="w-full px-2 py-2 rounded-lg border border-gray-200 text-sm"
                            placeholder="59,000" value={v.price?Number(v.price).toLocaleString():''}
                            onChange={e=>setNVariants(vs=>vs.map((x,j)=>j===i?{...x,price:e.target.value.replace(/[^0-9]/g,'')}:x))}/></td>
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

          <div className="flex justify-end mt-auto pt-3">
            <button onClick={addNewProduct} className="px-5 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700">Нэмэх</button>
          </div>
        </div>

        </div>
      )}

      {/* Барааны нэгдсэн хяналт */}
      {stockTab==='list' && (() => {
        // Захиалгаас variant бүрийн зарагдсан тоог тооцоолох
        const soldMap: Record<string, Record<string, number>> = {}
        for(const o of auditOrders){
          if(!['pending','delivered'].includes(o.status)) continue
          for(const it of (o.order_items||[])){
            const pid = it.product_id
            const vl = it.variant_label||'__total__'
            if(!soldMap[pid]) soldMap[pid]={}
            soldMap[pid][vl] = (soldMap[pid][vl]||0) + it.quantity
          }
        }
        // Цэнэглэсэн тоо restock_log-оос
        const restockMap: Record<string, Record<string, number>> = {}
        for(const l of logs){
          if(l.type!=='in') continue
          const pid = l.product_id
          // variant_label шинэ column, эсвэл product_name-с задлах (жишээ: "Битүү · 40/41 / Ягаан")
          const vl = (l as any).variant_label || 
            (l.product_name.includes(' · ') ? l.product_name.split(' · ').slice(1).join(' · ') : '__total__')
          if(!restockMap[pid]) restockMap[pid]={}
          restockMap[pid][vl] = (restockMap[pid][vl]||0) + l.quantity
        }

        const rows: any[] = []
        for(const p of products){
          const pvs: any[] = (p as any).variants||[]
          if(pvs.length>0){
            for(const v of pvs){
              const vl = [v.size,v.color].filter(Boolean).join(' / ')
              const restocked = restockMap[p.id]?.[vl]||0
              const sold = soldMap[p.id]?.[vl]||0
              const expected = Math.max(0, restocked - sold)
              const actual = v.stock||0
              const diff = actual - expected
              rows.push({name:p.id, label:p.name, variant:vl, restocked, sold, expected, actual, diff})
            }
          } else {
            const restocked = restockMap[p.id]?.['__total__']||0
            const sold = soldMap[p.id]?.['__total__']||0
            const expected = Math.max(0, restocked - sold)
            const actual = p.stock||0
            const diff = actual - expected
            rows.push({name:p.id, label:p.name, variant:'', restocked, sold, expected, actual, diff})
          }
        }

        const hasIssue = rows.some(r=>r.diff!==0)

        // Нийлүүлэлт нэгтгэл
        type PK = {id:string;label:string;variant:string}
        const prodKeys: PK[] = []
        for(const p of products){
          const pvs:any[]=p.variants||[]
          if(pvs.length>0) pvs.forEach((v:any)=>prodKeys.push({id:p.id,label:p.name,variant:[v.size,v.color].filter(Boolean).join(' / ')}))
          else prodKeys.push({id:p.id,label:p.name,variant:''})
        }
        function getSupSummary(pk:PK){
          const ms=(s:any)=>s.product_id===pk.id&&(pk.variant?s.variant_label===pk.variant:!s.variant_label||s.variant_label==='')
          const ml=(l:any)=>l.product_id===pk.id&&(pk.variant?l.variant_label===pk.variant:!l.variant_label||l.variant_label==='')
          const ordered=supply.filter(s=>ms(s)&&s.type==='ordered').reduce((a:number,s:any)=>a+s.quantity,0)
          const received=supply.filter(s=>ms(s)&&s.type==='received').reduce((a:number,s:any)=>a+s.quantity,0)
          const restocked=logs.filter((l:any)=>l.type==='in'&&ml(l)).reduce((a:number,l:any)=>a+l.quantity,0)
          const sold=(soldMap[pk.id]?.[pk.variant||'__total__'])||0
          const stock=pk.variant?(products.find(p=>p.id===pk.id)?.variants||[]).find((v:any)=>[v.size,v.color].filter(Boolean).join(' / ')===pk.variant)?.stock||0:products.find(p=>p.id===pk.id)?.stock||0
          return {ordered,received,restocked,sold,stock}
        }
        function getSupDetail(pk:PK){
          const ms=(s:any)=>s.product_id===pk.id&&(pk.variant?s.variant_label===pk.variant:!s.variant_label||s.variant_label==='')
          const ml=(l:any)=>l.product_id===pk.id&&(pk.variant?l.variant_label===pk.variant:!l.variant_label||l.variant_label==='')
          return [
            ...supply.filter(ms).map((s:any)=>({id:s.id,date:s.date,type:s.type,qty:s.quantity,note:s.note,del:true})),
            ...logs.filter((l:any)=>l.type==='in'&&ml(l)).map((l:any)=>({id:l.id,date:l.date,type:'restocked',qty:l.quantity,note:l.note,del:false})),
          ].sort((a,b)=>b.date.localeCompare(a.date))
        }
        const supKeys=prodKeys.filter(pk=>{const s=getSupSummary(pk);return s.ordered>0||s.received>0||s.restocked>0})
        const tlabel:Record<string,string>={ordered:'Захиалсан',received:'Ирсэн',restocked:'Цэнэглэсэн'}
        const tcolor:Record<string,string>={ordered:'text-blue-600 bg-blue-50',received:'text-emerald-700 bg-emerald-50',restocked:'text-orange-600 bg-orange-50'}
        const fmtD2=(d:string)=>{if(!d)return'';const[,m,day]=d.split('-');return m+'/'+day}
        const selFProd=products.find(p=>p.id===fProdId)
        const fVariants:any[]=selFProd?.variants||[]

        return (
          <div className="space-y-4">
          {/* Барааны нэгдсэн хяналт хүснэгт */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="font-medium text-gray-800 text-sm">Барааны нэгдсэн хяналт</h2>
              <p className="text-xs text-gray-400 mt-0.5">Захиалсан → Ирсэн → Цэнэглэсэн → Зарагдсан</p>
            </div>

            {supKeys.length===0?(
              <p className="text-center text-gray-400 text-sm py-8">Бүртгэл байхгүй</p>
            ):(
              <div>
                <div className="grid text-xs text-gray-400 font-medium px-4 py-2 bg-gray-50 border-b border-gray-100"
                  style={{gridTemplateColumns:'1.6fr 70px 70px 80px 70px 70px 70px 50px 20px'}}>
                  <div>Барааны нэр</div>
                  <div className="text-right">Захиалсан</div>
                  <div className="text-right">Ирсэн</div>
                  <div className="text-right">Цэнэглэсэн</div>
                  <div className="text-right">Зарагдсан</div>
                  <div className="text-right">Үлдэгдэл</div>
                  <div className="text-right">Зөрүү</div>
                  <div></div>
                  <div></div>
                </div>
                <div className="divide-y divide-gray-100">
                  {supKeys.map((pk,i)=>{
                    const s=getSupSummary(pk)
                    const det=getSupDetail(pk)
                    const ekey=pk.id+pk.variant
                    const isExp=supplyExpanded.has(ekey)
                    const fullProd=products.find(p=>p.id===pk.id)
                    // Зөрүү: байх ёстой (цэнэглэсэн-зарагдсан) vs систем дэх тоо
                    const expected=Math.max(0, s.restocked-s.sold)
                    const zoruu=s.stock-expected
                    return(
                      <div key={i} className={zoruu!==0?'bg-red-50/20':''}>
                        <div className="grid items-center px-4 py-2.5 hover:bg-gray-50/50"
                          style={{gridTemplateColumns:'1.6fr 70px 70px 80px 70px 70px 70px 50px 20px'}}>
                          <div className="cursor-pointer select-none" onClick={()=>{const n=new Set(supplyExpanded);n.has(ekey)?n.delete(ekey):n.add(ekey);setSupplyExpanded(n)}}>
                            <span className="text-sm font-medium text-gray-700">{pk.label}</span>
                            {pk.variant&&<span className="text-xs text-gray-400 ml-1.5">{pk.variant}</span>}
                          </div>
                          <div className="text-right text-xs font-medium text-blue-600">{s.ordered>0?s.ordered+'ш':'—'}</div>
                          <div className="text-right text-xs font-medium text-emerald-600">{s.received>0?s.received+'ш':'—'}</div>
                          <div className="text-right text-xs font-medium text-orange-500">{s.restocked>0?s.restocked+'ш':'—'}</div>
                          <div className="text-right text-xs text-gray-600">{s.sold>0?s.sold+'ш':'—'}</div>
                          <div className="text-right text-xs font-bold text-gray-800">{s.stock}ш</div>
                          <div className="text-right text-xs font-bold">
                            {zoruu===0
                              ? <span className="text-emerald-500">✓</span>
                              : <span className={zoruu>0?'text-blue-500':'text-red-500'}>{zoruu>0?'+':''}{zoruu}ш</span>
                            }
                          </div>
                          <div className="text-right">
                            {!isViewer&&!pk.variant&&fullProd&&(
                              <button onClick={()=>openEditProd(fullProd)} className="text-xs text-gray-400 hover:text-gray-700">Засах</button>
                            )}
                          </div>
                          <div className="text-xs text-gray-300 text-right cursor-pointer" onClick={()=>{const n=new Set(supplyExpanded);n.has(ekey)?n.delete(ekey):n.add(ekey);setSupplyExpanded(n)}}>{isExp?'▲':'▼'}</div>
                        </div>
                        {isExp&&(
                          <div className="border-t border-gray-100 bg-gray-50/30">
                            {det.map((d:any,j:number)=>(
                              <div key={j} className="flex items-center gap-3 px-6 py-2 border-b border-gray-100 last:border-0">
                                <span className="text-xs text-gray-400 w-10 flex-shrink-0">{fmtD2(d.date)}</span>
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${tcolor[d.type]}`}>{tlabel[d.type]}</span>
                                <span className="text-xs font-bold text-gray-700 w-10 text-right flex-shrink-0">+{d.qty}ш</span>
                                <span className="text-xs text-gray-400 italic flex-1">{d.note||''}</span>
                                {d.del&&<button onClick={async e=>{e.stopPropagation();await supabase.from('supply_log').delete().eq('id',d.id);load()}} className="text-gray-300 hover:text-red-400 text-xs">✕</button>}
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
          </div>
        )
      })()}

      {/* Цэнэглэлтийн бүртгэл */}
      {stockTab==='log' && <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-medium text-gray-800 text-sm">Агуулах цэнэглэлт</h2>
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
        <div className="flex gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50 flex-wrap items-center">
          <select className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white" value={logFilter} onChange={e=>setLogFilter(e.target.value)}>
            <option value="all">Бүх бараа</option>
            {products.map(p=><option key={p.id} value={p.name}>{p.name}</option>)}
          </select>
          <div className="flex items-center gap-2">
            <input type="date" className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
              value={dateFilter} onChange={e=>setDateFilter(e.target.value)} />
            {dateFilter&&<button onClick={()=>setDateFilter('')} className="px-2 py-2 rounded-lg border border-gray-200 text-xs text-gray-500 bg-white">✕</button>}
          </div>
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
                          {r.note&&r.note!=='Цэнэглэлт'&&r.note!=='Гараар хасалт'?r.note:''}
                          {(r as any).cost_per_unit&&<span className="ml-2 text-orange-500">өртөг: {Number((r as any).cost_per_unit).toLocaleString()}₮/ш</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-medium ${r.type==='in'?'text-emerald-600':'text-red-500'}`}>
                        {r.type==='in'?'+':'-'}{r.quantity}ш
                      </span>
                      {!isViewer&&!selectMode&&(
                        <div className="relative" ref={openDropdown===r.id?dropdownRef:null}>
                          <button onClick={()=>setOpenDropdown(openDropdown===r.id?null:r.id)}
                            className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50">
                            Үйлдэл ▾
                          </button>
                          {openDropdown===r.id&&(
                            <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl z-30 min-w-[120px] overflow-hidden shadow-lg">
                              <button onClick={()=>{
                                setEditLog(r);setEditQty(String(r.quantity));setEditDate(r.date);setEditNote(r.note||'');
                                const prod=products.find(p=>p.name===r.product_name.split(' · ')[0])
                                setEditCost((prod as any)?.unit_cost?String((prod as any).unit_cost):'')
                                setOpenDropdown(null)}}
                                className="w-full text-left px-4 py-2.5 text-xs text-gray-600 hover:bg-gray-50">Засах</button>
                              <button onClick={()=>{deleteLog(r);setOpenDropdown(null)}}
                                className="w-full text-left px-4 py-2.5 text-xs text-red-500 hover:bg-red-50 border-t border-gray-100">Устгах</button>
                            </div>
                          )}
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
      </div>}
    </div>
  )
}
