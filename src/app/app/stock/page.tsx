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
  const [rAction, setRAction] = useState<'restock'|'ordered'|'received'>('restock')
  const [supply, setSupply] = useState<any[]>([])
  const [supKeys2, setSupKeys2] = useState<any[]>([])
  const [hasIssue, setHasIssue] = useState(false)
  const [editDetModal, setEditDetModal] = useState<any>(null)
  const tlabel2 = {ordered:'Захиалсан',received:'Хүлээн авсан',restocked:'Цэнэглэсэн'} as any
  const tcolor2 = {ordered:'text-blue-600 bg-blue-50',received:'text-emerald-700 bg-emerald-50',restocked:'text-orange-600 bg-orange-50'} as any
  const [pItems, setPItems] = useState([{pid:'',vl:'',qty:'',recv:''}])
  const [pShip, setPShip] = useState('')
  const [pNote, setPNote] = useState('')
  const [pDate, setPDate] = useState(TODAY)
  const [pSave, setPSave] = useState(false)
  const [newN, setNewN] = useState('')
  const [supplyExpanded, setSupplyExpanded] = useState<Set<string>>(new Set())
  const [fProdId, setFProdId] = useState('')
  const [fVariant, setFVariant] = useState('')
  const [fType, setFType] = useState<'ordered'|'received'>('ordered')
  const [fQty, setFQty] = useState('')
  const [fDate, setFDate] = useState(TODAY)
  const [fNote2, setFNote2] = useState('')
  const [fSaving, setFSaving] = useState(false)
  const [auditOrders, setAuditOrders] = useState<any[]>([])
  const [auditEdit, setAuditEdit] = useState<{productId:string,label:string,variant:string,current:number}|null>(null)
  const [auditEditVal, setAuditEditVal] = useState('')

  // Цэнэглэлт
  const [rProd, setRProd] = useState('')
  const [rProdSearch, setRProdSearch] = useState('')
  const [rProdOpen, setRProdOpen] = useState(false)
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
        ? supabase.from('restock_log').select('*').eq('user_id',targetId).eq('store_id',activeStoreId).neq('note','Захиалга').order('date',{ascending:false}).order('created_at',{ascending:false}).limit(5000)
        : supabase.from('restock_log').select('*').eq('user_id',targetId).neq('note','Захиалга').order('date',{ascending:false}).order('created_at',{ascending:false}).limit(5000),
      activeStoreId
        ? supabase.from('stores').select('variant_enabled').eq('id',activeStoreId).single()
        : Promise.resolve({ data: null })
    ])
    const _prodIds=new Set((prods||[]).map((p:any)=>p.id))
    setLogs((ls||[]).filter((l:any)=>_prodIds.has(l.product_id)))
    const _existingIds=(prods||[]).map((p:any)=>p.id)
    setVariantEnabled(storeData?.variant_enabled || false)
    if (prods&&prods.length>0&&!rProd) setRProd(prods[0].id)
    if (prods&&prods.length>0&&rProd&&!prods.find((p:any)=>p.id===rProd)) setRProd(prods[0].id)
    // Аудитын захиалгууд татах
    if(targetId){
      // orders болон order_items-г тусад нь татах — nested select-д 1000 limit хамаарна
      const ordQ = activeStoreId
        ? supabase.from('orders').select('id').eq('user_id',targetId).eq('store_id',activeStoreId).eq('status','delivered').limit(5000)
        : supabase.from('orders').select('id').eq('user_id',targetId).eq('status','delivered').limit(5000)
      const {data: delivOrds} = await ordQ
      const delivIds = (delivOrds||[]).map((o:any)=>o.id)
      // 500-аас дээш ID байвал batch хийж татна
      const _sm2:any={}
      if(delivIds.length>0){
        const batchSize=500
        for(let i=0;i<delivIds.length;i+=batchSize){
          const batch=delivIds.slice(i,i+batchSize)
          const {data:batchItems}=await supabase.from('order_items').select('product_id,variant_label,quantity').in('order_id',batch).limit(10000)
          for(const it2 of (batchItems||[])){
            if(!_sm2[it2.product_id]) _sm2[it2.product_id]={}
            const vl2=(it2.variant_label&&it2.variant_label.trim())||'__total__'
            _sm2[it2.product_id][vl2]=(_sm2[it2.product_id][vl2]||0)+it2.quantity
          }
        }
      }
      const {data: supData} = _existingIds.length>0
        ? await supabase.from('supply_log').select('id,product_id,variant_label,type,quantity,date,note').eq('user_id',targetId).in('product_id',_existingIds).order('date',{ascending:false}).limit(5000)
        : {data:[]}
      setAuditOrders(delivOrds||[])
      const _sup2=supData||[]
      setSupply(_sup2)
      // _sm2 аль хэдийн тооцоологдсон
      const _pks2:any[]=[]; const _prods2=prods||[]; const _ls2=ls||[]
      for(const _p2 of _prods2){
        const _pvs2=_p2.variants||[]
        if(_pvs2.length>0) _pvs2.forEach((_v2:any)=>_pks2.push({id:_p2.id,label:_p2.name,variant:[_v2.size,_v2.color].filter(Boolean).join(' / ')}))
        else _pks2.push({id:_p2.id,label:_p2.name,variant:''})
      }
      const _getSS2=(_pk2:any)=>{
        const _ms2=(_s2:any)=>_s2.product_id===_pk2.id&&(_pk2.variant?_s2.variant_label===_pk2.variant:!_s2.variant_label||_s2.variant_label==='')
        const _ml2=(_l2:any)=>_l2.product_id===_pk2.id&&(_pk2.variant?_l2.variant_label===_pk2.variant:!_l2.variant_label||_l2.variant_label==='')
        const _ord2=_sup2.filter((_s2:any)=>_ms2(_s2)&&_s2.type==='ordered').reduce((_a2:number,_s2:any)=>_a2+_s2.quantity,0)
        const _rec2=_sup2.filter((_s2:any)=>_ms2(_s2)&&_s2.type==='received').reduce((_a2:number,_s2:any)=>_a2+_s2.quantity,0)
        const _rst2=_ls2.filter((_l2:any)=>_l2.type==='in'&&_ml2(_l2)).reduce((_a2:number,_l2:any)=>_a2+_l2.quantity,0)
        const _manualOut2=_ls2.filter((_l2:any)=>_l2.type==='out'&&_ml2(_l2)).reduce((_a2:number,_l2:any)=>_a2+_l2.quantity,0)
        const _vkey=(_pk2.variant&&_pk2.variant.trim())||'__total__'
        const _sold2=_pk2.variant
          ?((_sm2[_pk2.id]&&_sm2[_pk2.id][_vkey])||0)+((_sm2[_pk2.id]&&_sm2[_pk2.id]['__total__'])||0)
          :((_sm2[_pk2.id]&&_sm2[_pk2.id]['__total__'])||0)
        const _prod2=_prods2.find((_p2:any)=>_p2.id===_pk2.id)
        const _stk2=_pk2.variant?(_prod2&&_prod2.variants||[]).find((_v2:any)=>[_v2.size,_v2.color].filter(Boolean).join(' / ')===_pk2.variant)?.stock||0:_prod2?.stock||0
        const _expectedStk=_rst2-_sold2-_manualOut2
        return {ordered:_ord2,received:_rec2,restocked:_rst2,sold:_sold2,manualOut:_manualOut2,stock:_expectedStk,expected:_expectedStk,zoruu:0}
      }
      const _getSD2=(_pk2:any)=>{
        const _ms2=(_s2:any)=>_s2.product_id===_pk2.id&&(_pk2.variant?_s2.variant_label===_pk2.variant:!_s2.variant_label||_s2.variant_label==='')
        const _ml2=(_l2:any)=>_l2.product_id===_pk2.id&&(_pk2.variant?_l2.variant_label===_pk2.variant:!_l2.variant_label||_l2.variant_label==='')
        const _fd2=(_d2:string)=>{if(!_d2)return'';const[,_m2,_day2]=_d2.split('-');return _m2+'/'+_day2}
        return[..._sup2.filter(_ms2).map((_s2:any)=>({id:_s2.id,date:_s2.date,type:_s2.type,qty:_s2.quantity,note:_s2.note,del:true,fmtD:_fd2(_s2.date)})),..._ls2.filter((_l2:any)=>_l2.type==='in'&&_ml2(_l2)).map((_l2:any)=>({id:_l2.id,date:_l2.date,type:'restocked',qty:_l2.quantity,note:_l2.note,del:false,fmtD:_fd2(_l2.date)}))].sort((_a2:any,_b2:any)=>_b2.date.localeCompare(_a2.date))
      }
      const _filteredKeys=_pks2.filter(_pk2=>{const _s2=_getSS2(_pk2);return _s2.ordered>0||_s2.received>0||_s2.restocked>0})
      setSupKeys2(_filteredKeys.map(_pk2=>({..._pk2,_ss:_getSS2(_pk2),_sd:_getSD2(_pk2)})))
      setHasIssue(_filteredKeys.some(_pk2=>_getSS2(_pk2).zoruu!==0||_getSS2(_pk2).expected<0))
      // Products-д тооцоолсон stock-г шинэчлэх — dropdown-д зөв тоо харагдана
      setProducts((_prods2).map((p:any)=>{
        const pvs=p.variants||[]
        if(pvs.length>0){
          const nv=pvs.map((v:any)=>{
            const lbl=[v.size,v.color].filter(Boolean).join(' / ')
            const pk={id:p.id,variant:lbl}
            const ss=_getSS2(pk)
            return {...v,stock:ss.expected}
          })
          return {...p,variants:nv,stock:nv.reduce((a:number,v:any)=>a+v.stock,0)}
        }
        const pk={id:p.id,variant:''}
        const ss=_getSS2(pk)
        return {...p,stock:ss.expected}
      }))
      if(!fProdId&&prods&&prods.length>0) setFProdId(prods[0].id)
    } else {
      setProducts(prods||[])
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
    const prod = products.find((p:any)=>p.id===fProdId)
    await supabase.from('supply_log').insert({
      user_id:targetId, store_id:activeStoreId||null,
      product_id:fProdId, product_name:prod?.name||'',
      variant_label:fVariant||null, type:fType,
      quantity:parseInt(fQty)||0, date:fDate, note:fNote2||null
    })
    setFQty(''); setFNote2('')
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
    const pvs2: Variant[] = p.variants || []
    let variantLabel2 = ''
    if (variantEnabled && pvs2.length > 0) {
      if (rVariantIdx < 0) { showFlash('Variant сонгоно уу'); return }
      const v2 = pvs2[rVariantIdx]
      if (!v2) return
      variantLabel2 = [v2.size, v2.color].filter(Boolean).join(' / ')
    }
    if (rAction === 'ordered' || rAction === 'received') {
      await supabase.from('supply_log').insert({
        user_id: targetId, store_id: activeStoreId||null,
        product_id: rProd, product_name: p.name,
        variant_label: variantLabel2||null,
        type: rAction, quantity: absQty, date: rDate, note: rNote||null
      })
      setRQty('1'); setRNote('')
      showFlash((rAction==='ordered'?'Захиалсан':'Ирсэн')+' бүртгэгдлээ ✓')
      load()
      return
    }
    const isNeg = qty < 0

    const pvs: Variant[] = p.variants || []
    let variantLabel = variantLabel2

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
    setConfirmModal({msg: name+' устгах уу?\n\nЗахиалгын түүхэнд хадгалагдана.', onOk: async()=>{
      // Бараатай холбоотой бүх лог устга
      await supabase.from('supply_log').delete().eq('product_id', id)
      await supabase.from('restock_log').delete().eq('product_id', id)
      await supabase.from('products').delete().eq('id', id)
      showFlash(name+' архивлагдлаа'); load()
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
      // Устгагдсан variant-ийн label-уудыг олох
      const newLabels = new Set(newVariants.map(v => [v.size,v.color].filter(Boolean).join(' / ')))
      const removedLabels = pvs
        .map(v => [v.size,v.color].filter(Boolean).join(' / '))
        .filter(lbl => !newLabels.has(lbl))
      // Устгагдсан variant-ийн log бичлэгийг цэвэрлэх
      for (const lbl of removedLabels) {
        await supabase.from('restock_log').delete().eq('product_id', editProd.id).eq('variant_label', lbl)
        await supabase.from('supply_log').delete().eq('product_id', editProd.id).eq('variant_label', lbl)
      }
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
  const rVariants: Variant[] = rProdData?.variants || []

  return (
    <div className="space-y-4">
      {flash && <div className="fixed top-4 right-4 bg-gray-900 text-white text-sm px-4 py-2 rounded-lg z-50">{flash}</div>}

      {/* Tab товчнууд */}
      <div className="flex gap-2 border-b border-gray-100 pb-0">
        {(['list','log'] as Array<'list'|'log'>).map(t=>(
          <button key={t} onClick={()=>setStockTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-all ${stockTab===t?'border-emerald-600 text-emerald-700':'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t==='list'?'Бараа бүртгэл':'Агуулах цэнэглэлт'}
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
            <p className="text-sm text-gray-700 text-center mb-5">{confirmModal?.msg}</p>
            <div className="flex gap-3">
              <button onClick={()=>setConfirmModal(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Болих</button>
              <button onClick={()=>{const ok=confirmModal?.onOk; setConfirmModal(null); ok&&ok()}}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600">Устгах</button>
            </div>
          </div>
        </div>
      )}

      {editDetModal&&(
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl">
            <h3 className="font-medium text-gray-800 text-sm mb-4">
              {editDetModal.type==='ordered'?'Захиалсан':editDetModal.type==='received'?'Ирсэн':'Цэнэглэсэн'} бүртгэл засах
            </h3>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Огноо</label>
                <input type="date" className="w-full px-2 py-2 rounded-lg border border-gray-200 text-sm bg-white"
                  value={editDetModal.date}
                  onChange={e=>setEditDetModal((m:any)=>({...m,date:e.target.value}))}/>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Тоо</label>
                <input type="number" className="w-full px-2 py-2 rounded-lg border border-gray-200 text-sm text-center"
                  value={editDetModal.qty}
                  onChange={e=>setEditDetModal((m:any)=>({...m,qty:Number(e.target.value)}))}/>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Тэмдэглэл</label>
                <input className="w-full px-2 py-2 rounded-lg border border-gray-200 text-sm"
                  value={editDetModal.note||''}
                  onChange={e=>setEditDetModal((m:any)=>({...m,note:e.target.value}))}/>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={()=>setEditDetModal(null)}
                className="flex-1 py-2 rounded-xl border border-gray-200 text-sm text-gray-600">Болих</button>
              <button onClick={async()=>{
                const m=editDetModal
                if(!m.qty||Number(m.qty)<=0){showFlash('Тоо 0-ээс их байх ёстой');return}
                let err=null
                const {data:{user}}=await supabase.auth.getUser()
                const uid=ownerId||user?.id
                const updateData={quantity:Number(m.qty),date:m.date,note:m.note||''}
                if(m.del){
                  const {error}=await supabase.from('supply_log').update(updateData).eq('id',m.id).eq('user_id',uid)
                  err=error
                } else {
                  const {error}=await supabase.from('restock_log').update(updateData).eq('id',m.id).eq('user_id',uid)
                  err=error
                }
                if(err){showFlash('Алдаа: '+err.message);return}
                setEditDetModal(null); showFlash('Засварлагдлаа ✓'); load()
              }} className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium">Хадгалах</button>
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

      {!isViewer && stockTab==='list' && (
        <div className="grid gap-4 items-start" style={{gridTemplateColumns:'2fr 3fr'}}>
        <div className="space-y-3">
        {/* 1. Агуулах цэнэглэлт */}
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <h2 className="font-medium text-gray-800 text-sm mb-3">Агуулах цэнэглэлт</h2>
          <div className="space-y-2">
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
                          <div key={p.id} className={`flex items-center px-3 py-2 text-sm hover:bg-emerald-50 ${p.id===rProd?'bg-emerald-50 text-emerald-700':''}`}>
                            <button type="button" className="flex-1 text-left flex justify-between items-center"
                              onMouseDown={()=>{setRProd(p.id);setRVariantIdx(-1);setRProdSearch('');setRProdOpen(false)}}>
                              <span>{p.name}</span>
                              <span className="text-xs text-gray-400 mr-2">{p.stock}ш</span>
                            </button>
                            <button type="button" onMouseDown={(e)=>{e.stopPropagation();setRProdOpen(false);setConfirmModal({msg:p.name+' устгах уу?',onOk:async()=>{await supabase.from('supply_log').delete().eq('product_id',p.id);await supabase.from('restock_log').delete().eq('product_id',p.id);await supabase.from('products').delete().eq('id',p.id);if(rProd===p.id)setRProd('');load()}})}}
                              className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-red-100 text-gray-300 hover:text-red-400 flex-shrink-0 text-xs">✕</button>
                          </div>
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
                  {Number(rQty)<0?'Хасах':'Нэмэх'}
                </button>
              </div>
            </div>
          </div>
          {Number(rQty)<0&&<p className="mt-2 text-xs text-red-500">{Math.abs(Number(rQty))}ш агуулахаас хасагдана</p>}
        </div>
        {/* 2. Бараа татан авалт */}
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <h2 className="font-medium text-gray-800 text-sm mb-2">Бараа татан авалт</h2>
          <div className="grid gap-1 mb-1 text-xs text-gray-400" style={{gridTemplateColumns:'1fr 1fr 1fr'}}>
            <div>Барааны нэр</div>
            <div className="text-center">Захиалсан тоо</div>
            <div className="text-center">Хүлээн авсан</div>
          </div>
          <div className="space-y-2 mb-2">
            {pItems.map((it,idx)=>{
              const pp=products.find(p=>p.id===it.pid)
              const pvs=pp&&pp.variants?pp.variants:[]
              const hv=pvs.length>0
              const tQ=pItems.reduce((a,x)=>a+(parseInt(x.qty)||0),0)
              const sh=parseInt(pShip)||0
              const spp=tQ>0&&it.qty?Math.round(sh*(parseInt(it.qty)||0)/tQ):0
              return(
                <div key={idx}>
                  <div className="grid gap-1.5 items-center" style={{gridTemplateColumns:hv?'1fr 1fr 1fr 1fr':'1fr 1fr 1fr'}}>
                    <select value={it.pid} onChange={e=>setPItems(prev=>prev.map((x,i)=>i===idx?{...x,pid:e.target.value,vl:''}:x))}
                      className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs bg-white">
                      <option value="">— Сонгох —</option>
                      {products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    {hv&&(
                      <select value={it.vl} onChange={e=>setPItems(prev=>prev.map((x,i)=>i===idx?{...x,vl:e.target.value}:x))}
                        className="w-full px-2 py-1.5 rounded-lg border border-gray-100 bg-gray-50 text-xs">
                        <option value="">— Variant —</option>
                        {pvs.map((v,vi)=><option key={vi} value={[v.size,v.color].filter(Boolean).join(' / ')}>{[v.size,v.color].filter(Boolean).join(' / ')}</option>)}
                      </select>
                    )}
                    <input type="number" placeholder="0" value={it.qty}
                      onChange={e=>setPItems(prev=>prev.map((x,i)=>i===idx?{...x,qty:e.target.value}:x))}
                      className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs text-center"/>
                    <input type="number" placeholder="0" value={it.recv}
                      onChange={e=>setPItems(prev=>prev.map((x,i)=>i===idx?{...x,recv:e.target.value}:x))}
                      className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs text-center bg-emerald-50"/>
                  </div>
                  {spp>0&&<div className="text-xs text-orange-400 mt-0.5">+{spp.toLocaleString()}₮/ш тээвэр</div>}
                </div>
              )
            })}
            <button onClick={()=>setPItems(prev=>[...prev,{pid:'',vl:'',qty:'',recv:''}])}
              className="text-xs text-emerald-600 hover:underline">+ Нэмэх</button>
          </div>
          <div className="grid gap-2 items-end" style={{gridTemplateColumns:'1fr 1fr 110px auto'}}>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Тээвэр (₮)</label>
              <input type="number" placeholder="0" value={pShip} onChange={e=>setPShip(e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm"/>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Тэмдэглэл</label>
              <input placeholder="..." value={pNote} onChange={e=>setPNote(e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm"/>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Огноо</label>
              <input type="date" value={pDate} onChange={e=>setPDate(e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm bg-white"/>
            </div>
            <button onClick={async()=>{
              const vld=pItems.filter(it=>it.pid&&it.qty)
              if(!vld.length) return
              const {data:{user}}=await supabase.auth.getUser()
              const uid=ownerId||user?.id
              if(!uid) return
              setPSave(true)
              const tQ2=vld.reduce((a,it)=>a+(parseInt(it.qty)||0),0)
              const sh2=parseInt(pShip)||0
              const {data:ord}=await supabase.from('procurement_orders').insert({user_id:uid,store_id:activeStoreId||null,date:pDate,type:'ordered',shipping_cost:sh2,note:pNote||null}).select().single()
              if(ord){for(const it of vld){const qty=parseInt(it.qty)||0;const recv=parseInt(it.recv)||0;const sp2=tQ2>0?Math.round(sh2*qty/tQ2):0;const pp=products.find(p=>p.id===it.pid);await supabase.from('procurement_items').insert({order_id:ord.id,product_id:it.pid,product_name:pp?pp.name:'',variant_label:it.vl||null,quantity:qty,unit_cost:sp2});await supabase.from('supply_log').insert({user_id:uid,store_id:activeStoreId||null,product_id:it.pid,product_name:pp?pp.name:'',variant_label:it.vl||null,type:'ordered',quantity:qty,date:pDate,note:pNote||null});if(recv>0)await supabase.from('supply_log').insert({user_id:uid,store_id:activeStoreId||null,product_id:it.pid,product_name:pp?pp.name:'',variant_label:it.vl||null,type:'received',quantity:recv,date:pDate,note:'Хүлээн авсан'})}}
              setPItems([{pid:'',vl:'',qty:'',recv:''}]);setPShip('');setPNote('');setPSave(false);showFlash('Татан авалт ✓');load()
            }} disabled={pSave||!pItems.some(it=>it.pid&&it.qty)}
              className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium disabled:opacity-40">
              {pSave?'...':'Хадгалах'}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <h2 className="font-medium text-gray-800 text-sm mb-3">Шинэ бараа</h2>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm pr-7"
                placeholder="Барааны нэр" value={newN} onChange={e=>setNewN(e.target.value)}
                onKeyDown={async e=>{if(e.key==='Enter'&&newN.trim()){const {data:{user}}=await supabase.auth.getUser();const uid=ownerId||user?.id;if(uid){await supabase.from('products').insert({user_id:uid,store_id:activeStoreId||null,name:newN.trim(),stock:0});setNewN('');showFlash(newN+' нэмэгдлээ ✓');load()}}}}/>
              {newN&&<button type="button" onClick={()=>setNewN('')} className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full bg-gray-200 hover:bg-gray-300 text-gray-500 text-xs leading-none">✕</button>}
            </div>
            <button onClick={async()=>{if(!newN.trim())return;const {data:{user}}=await supabase.auth.getUser();const uid=ownerId||user?.id;if(uid){await supabase.from('products').insert({user_id:uid,store_id:activeStoreId||null,name:newN.trim(),stock:0});setNewN('');showFlash(newN+' нэмэгдлээ ✓');load()}}}
              disabled={!newN.trim()} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium disabled:opacity-40">Нэмэх</button>
          </div>
        </div>

        </div>
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="space-y-4">
          {/* Нэгдсэн хяналт хүснэгт */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="font-medium text-gray-800 text-sm">Барааны нэгдсэн хяналт</h2>
                </div>
              {hasIssue&&<span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full">⚠️ Зөрүү илэрсэн</span>}
            </div>
            {supKeys2.length===0?(
              <p className="text-center text-gray-400 text-sm py-8">Бүртгэл байхгүй — Бараа бүртгэх дарж эхлэнэ</p>
            ):(
              <div>
                <div className="grid text-xs text-gray-400 font-medium px-4 py-2 bg-gray-50 border-b border-gray-100"
                  style={{gridTemplateColumns:'1.5fr 55px 55px 70px 60px 70px 70px 55px 36px 20px'}}>
                  <div>Барааны нэр</div>
                  <div className="text-right">Захиалсан</div>
                  <div className="text-right">Ирсэн</div>
                  <div className="text-right">Цэнэглэсэн</div>
                  <div className="text-right text-red-500">Хасалт</div>
                  <div className="text-right">Зарагдсан</div>
                  <div className="text-right">Үлдэгдэл</div>
                  <div className="text-right">Зөрүү</div>
                  <div></div>
                  <div></div>
                </div>
                <div className="divide-y divide-gray-100">
                  {supKeys2.map((pk,i)=>{
                    const s=pk._ss
                    const det=pk._sd
                    const ekey=pk.id+pk.variant
                    const isExp=supplyExpanded.has(ekey)
                    const fullProd=products.find(p=>p.id===pk.id)
                    return(
                      <div key={i} className={s.zoruu!==0?'bg-red-50/20':''}>
                        <div className="grid items-center px-4 py-2.5 hover:bg-gray-50/50"
                          style={{gridTemplateColumns:'1.5fr 55px 55px 70px 60px 70px 70px 55px 36px 20px'}}>
                          <div className="cursor-pointer" onClick={()=>{const n=new Set(supplyExpanded);n.has(ekey)?n.delete(ekey):n.add(ekey);setSupplyExpanded(n)}}>
                            <span className="text-sm font-medium text-gray-700">{pk.label}</span>
                            {pk.variant&&<span className="text-xs text-gray-400 ml-1.5">{pk.variant}</span>}
                          </div>
                          <div className="text-right text-xs font-medium text-blue-600">{s.ordered>0?s.ordered+'ш':'—'}</div>
                          <div className="text-right text-xs font-medium text-emerald-600">{s.received>0?s.received+'ш':'—'}</div>
                          <div className="text-right text-xs font-medium text-emerald-600">{s.restocked>0?s.restocked+'ш':'—'}</div>
                          <div className="text-right text-xs font-medium text-red-500">{s.manualOut>0?'-'+s.manualOut+'ш':'—'}</div>
                          <div className="text-right text-xs text-gray-600">{s.sold>0?s.sold+'ш':'—'}</div>
                          <div className={`text-right text-xs font-bold ${s.expected<0?'text-red-500':'text-gray-800'}`}>{s.expected}ш</div>
                          <div className="text-right text-xs font-bold">
                            {s.zoruu===0?<span className="text-emerald-500">✓</span>:<span className={s.zoruu>0?'text-blue-500':'text-red-500'}>{s.zoruu>0?'+':''}{s.zoruu}ш</span>}
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
                            {det.map((d:any,j:number)=>{
                              const typeName=d.type==='ordered'?'Захиалсан':d.type==='received'?'Ирсэн':'Цэнэглэсэн'
                              const noteText=(d.note&&d.note!==typeName&&d.note!=='Хүлээн авсан'&&d.note!=='Захиалсан'&&d.note!=='Цэнэглэсэн'&&d.note!=='Цэнэглэлт'&&d.note!=='Шинэ бараа'&&d.note!=='Захиалга')?d.note:''
                              return(
                              <div key={j} className="grid items-center gap-2 px-6 py-2 border-b border-gray-100 last:border-0 text-xs"
                                style={{gridTemplateColumns:'40px 70px 50px 1fr auto'}}>
                                <span className="text-gray-400">{d.fmtD}</span>
                                <span className="text-gray-600">{typeName}</span>
                                <span className="font-bold text-gray-700 text-right">{d.qty}ш</span>
                                <span className="text-gray-400 italic truncate">{noteText}</span>
                                <div className="flex gap-1 items-center">
                                  {!isViewer&&<button onClick={(e:any)=>{e.stopPropagation();setEditDetModal({...d,note:noteText})}} className="text-gray-300 hover:text-blue-400">Засах</button>}
                                  {<button onClick={(e:any)=>{e.stopPropagation();setConfirmModal({msg:'Энэ бүртгэлийг устгах уу?',onOk:async()=>{await supabase.from(d.del?'supply_log':'restock_log').delete().eq('id',d.id);load()}})}} className="text-gray-300 hover:text-red-400">✕</button>}
                                </div>
                              </div>
                            )})}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
          </div>
        </div>
        </div>
      )}


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
