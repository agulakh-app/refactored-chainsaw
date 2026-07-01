'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { Product, Order } from '@/lib/types'
import { useGuestRole, useOwnerId, useActiveStore, useSetActiveStore } from './client-layout'

const TODAY = new Date().toISOString().slice(0,10)
function fmt(n: number) { return n.toLocaleString() }
function fmtD(d: string) {
  const [y,m,day]=d.split('-')
  return `${y}/${m}/${day}`
}

export default function DashPage() {
  const guestRole = useGuestRole()
  const ownerId = useOwnerId()
  const activeStoreId = useActiveStore()
  const isViewer = guestRole === 'viewer'
  const [products,setProducts]=useState<Product[]>([])
  const [orders,setOrders]=useState<Order[]>([])
  const [stores,setStores]=useState<any[]>([])
  const [flash,setFlash]=useState('')
  const [confirmModal,setConfirmModal]=useState<{msg:string,onOk:()=>void}|null>(null)

  function confirm2(msg:string, onOk:()=>void){ setConfirmModal({msg,onOk}) }
  const [phoneFilter,setPhoneFilter]=useState('')
  const [productFilter,setProductFilter]=useState('')
  const [storeFilter,setStoreFilter]=useState('all')
  const [statusFilter,setStatusFilter]=useState('all')
  const [dateFilter,setDateFilter]=useState('')
  const [defaultDelivery,setDefaultDelivery]=useState(0)
  const [editOrder,setEditOrder]=useState<Order|null>(null)
  const [editPhone,setEditPhone]=useState('')
  const [editAddr,setEditAddr]=useState('')
  const [editDate,setEditDate]=useState('')
  const [editStatus,setEditStatus]=useState('')
  const [editDelv,setEditDelv]=useState('')
  const [oDate,setODate]=useState(TODAY)
  const [oPhone,setOPhone]=useState('')
  const [oAddr,setOAddr]=useState('')
  const [oDelv,setODelv]=useState('')
  const [oPaid,setOPaid]=useState(false)
  const [oStore,setOStore]=useState('')
  const [oItems,setOItems]=useState([{product_id:'',product_name:'',qty:'1',price:'',variant_label:''}])
  const [variantEnabled,setVariantEnabled]=useState(false)
  const [openDropdown,setOpenDropdown]=useState<string|null>(null)
  const [dropdownPos,setDropdownPos]=useState<{top:number,left:number}>({top:0,left:0})
  const dropdownRef=useRef<HTMLDivElement>(null)
  const [bulkMode,setBulkMode]=useState(false)
  const [selectedIds,setSelectedIds]=useState<Set<string>>(new Set())

  function toggleSelect(id:string){
    setSelectedIds(prev=>{const s=new Set(prev);s.has(id)?s.delete(id):s.add(id);return s})
  }
  function toggleSelectAll(ids:string[]){
    const allSelected=ids.every(id=>selectedIds.has(id))
    setSelectedIds(prev=>{const s=new Set(prev);allSelected?ids.forEach(id=>s.delete(id)):ids.forEach(id=>s.add(id));return s})
  }
  async function bulkDelete(){
    for(const id of Array.from(selectedIds)){
      const o=orders.find(x=>x.id===id)
      if(o) await deleteOrder(o,true)
    }
    setSelectedIds(new Set());setBulkMode(false);load()
  }
  async function bulkDeliver(){
    await Promise.all(Array.from(selectedIds).map(id=>supabase.from('orders').update({status:'delivered'}).eq('id',id)))
    setSelectedIds(new Set());setBulkMode(false);load()
  }

  const showFlash=(m:string)=>{setFlash(m);setTimeout(()=>setFlash(''),2500)}

  useEffect(()=>{
    function handleClick(e:MouseEvent){
      if(dropdownRef.current&&!dropdownRef.current.contains(e.target as Node)){
        setOpenDropdown(null)
      }
    }
    document.addEventListener('mousedown',handleClick)
    return()=>document.removeEventListener('mousedown',handleClick)
  },[])

  const load=useCallback(async()=>{
    const{data:{user}}=await supabase.auth.getUser()
    const targetId=ownerId||user?.id
    if(!targetId) return
    const{data:prof}=await supabase.from('profiles').select('default_delivery_fee').eq('id',targetId).single()
    if(prof?.default_delivery_fee){
      setDefaultDelivery(prof.default_delivery_fee)
      setODelv(v=>(!v||v==='0')?String(prof.default_delivery_fee):v)
    }
    const[{data:prods},{data:ords},{data:sts}]=await Promise.all([
      (activeStoreId ? supabase.from('products').select('*').eq('user_id',targetId).eq('store_id',activeStoreId).order('name') : supabase.from('products').select('*').eq('user_id',targetId).order('name')),
      (activeStoreId ? supabase.from('orders').select('*, order_items(*)').eq('user_id',targetId).eq('store_id',activeStoreId).order('date',{ascending:false}).order('day_seq',{ascending:false}) : supabase.from('orders').select('*, order_items(*)').eq('user_id',targetId).order('date',{ascending:false}).order('day_seq',{ascending:false})),
      supabase.from('stores').select('*').eq('user_id',targetId).order('created_at'),
    ])
    setProducts(prods||[])
    setOrders(ords||[])
    setStores(sts||[])
    if(prods&&prods.length>0){
      setOItems(i=>i.map((it,idx)=>idx===0&&!it.product_id?{...it,product_id:prods[0].id,product_name:prods[0].name,price:String(prods[0].unit_price)}:it))
    }
    if(activeStoreId){
      const{data:storeData}=await supabase.from('stores').select('variant_enabled').eq('id',activeStoreId).single()
      setVariantEnabled(storeData?.variant_enabled||false)
    } else { setVariantEnabled(false) }
  },[ownerId, activeStoreId])

  useEffect(()=>{load()},[load])

  function addItem(){setOItems(i=>[...i,{product_id:products[0]?.id||'',product_name:products[0]?.name||'',qty:'1',price:String(products[0]?.unit_price||''),variant_label:''}])}
  function removeItem(idx:number){setOItems(i=>i.filter((_,j)=>j!==idx))}
  function setItem(idx:number,key:string,val:string|boolean){
    setOItems(items=>items.map((it,i)=>{
      if(i!==idx) return it
      if(key==='product_id'){const p=products.find(x=>x.id===val);return{...it,product_id:val as string,product_name:p?.name||'',price:String(p?.unit_price||''),variant_label:''}}
      return{...it,[key]:val}
    }))
  }

  const gross=oItems.reduce((a,i)=>a+(Number(i.qty)||0)*(Number(i.price)||0),0)
  const net=gross-(Number(oDelv)||0)

  async function submitOrder(){
    if(!oPhone||!oAddr){showFlash('Утас, хаяг оруулна уу');return}
    const{data:{user}}=await supabase.auth.getUser()
    const targetId=ownerId||user?.id
    if(!targetId) return
    for(const it of oItems){
      const p=products.find(x=>x.id===it.product_id)
      if(!p){showFlash('Бараа олдсонгүй');return}
      const pvs:any[]=(p as any).variants||[]
      if(pvs.length>0&&!it.variant_label){
        showFlash(p.name+' — хэмжээ/өнгө заавал сонгоно уу!'); return
      }
      if(pvs.length>0&&it.variant_label){
        const v=pvs.find((vv:any)=>[vv.size,vv.color].filter(Boolean).join(' / ')===it.variant_label)
        if(!v||v.stock<Number(it.qty)){showFlash((p.name+' · '+it.variant_label)+' хүрэлцэхгүй! '+(v?.stock||0)+'ш');return}
      } else {
        if(p.stock<Number(it.qty)){showFlash(p.name+' хүрэлцэхгүй! '+p.stock+'ш');return}
      }
    }
    const{data:seqData}=await supabase.rpc('get_day_seq',{p_user_id:targetId,p_date:oDate||TODAY})
    const{data:order}=await supabase.from('orders').insert({
      user_id:targetId,date:oDate||TODAY,day_seq:seqData||1,
      phone:oPhone,address:oAddr,delivery_fee:Number(oDelv)||0,status:'pending',
      store_id:activeStoreId||null
    }).select().single()
    if(order){
      await supabase.from('order_items').insert(oItems.map(it=>({
        order_id:order.id,
        product_id:it.product_id,
        product_name:it.product_name,
        quantity:Number(it.qty),
        unit_price:(it as any).paid?0:Number(it.price),
        variant_label:it.variant_label||null
      })))
      for(const it of oItems){
        const p=products.find(x=>x.id===it.product_id)!
        const pvs:any[]=(p as any).variants||[]
        if(pvs.length>0&&it.variant_label){
          const newVariants=pvs.map((vv:any)=>[vv.size,vv.color].filter(Boolean).join(' / ')===it.variant_label?{...vv,stock:Math.max(0,vv.stock-Number(it.qty))}:vv)
          const newTotal=newVariants.reduce((a:number,vv:any)=>a+vv.stock,0)
          await supabase.from('products').update({variants:newVariants,stock:newTotal}).eq('id',it.product_id)
        } else {
          await supabase.from('products').update({stock:p.stock-Number(it.qty)}).eq('id',it.product_id)
        }
        await supabase.from('restock_log').insert({user_id:targetId,product_id:it.product_id,product_name:it.product_name+(it.variant_label?' · '+it.variant_label:''),quantity:Number(it.qty),type:'out',note:'Захиалга',date:oDate||TODAY})
      }
    }
    setOPhone('');setOAddr('');setODelv(String(defaultDelivery))
    setOItems([{product_id:products[0]?.id||'',product_name:products[0]?.name||'',qty:'1',price:String(products[0]?.unit_price||''),variant_label:''}])
    showFlash('Захиалга бүртгэгдлээ ✓');load()
  }

  async function setOrderStatus(id:string,status:string){
    const o=orders.find(x=>x.id===id)
    if(o){
      const wasPending=o.status==='pending'
      const nowCancelled=status==='cancelled'
      const wasCancelled=o.status==='cancelled'
      const nowPending=status==='pending'
      // pending → cancelled: stock буцаана
      if(wasPending&&nowCancelled){
        for(const it of(o.order_items||[])){
          const pid=(it as any).product_id
          const qty=(it as any).quantity
          const variantLabel=(it as any).variant_label
          if(!pid) continue
          const {data:prod}=await supabase.from('products').select('*').eq('id',pid).single()
          if(!prod) continue
          if(Array.isArray(prod.variants)&&prod.variants.length>0&&variantLabel){
            const vIdx=prod.variants.findIndex((v:any)=>[v.size,v.color].filter(Boolean).join(' / ')===variantLabel)
            if(vIdx>=0){
              const nv=[...prod.variants]
              nv[vIdx]={...nv[vIdx],stock:(nv[vIdx].stock||0)+qty}
              const nt=nv.reduce((a:number,v:any)=>a+(v.stock||0),0)
              await supabase.from('products').update({variants:nv,stock:nt}).eq('id',pid)
            }
          } else {
            await supabase.from('products').update({stock:(prod.stock||0)+qty}).eq('id',pid)
          }
        }
      }
      // cancelled → pending: stock дахин хасна
      if(wasCancelled&&nowPending){
        for(const it of(o.order_items||[])){
          const pid=(it as any).product_id
          const qty=(it as any).quantity
          const variantLabel=(it as any).variant_label
          if(!pid) continue
          const {data:prod}=await supabase.from('products').select('*').eq('id',pid).single()
          if(!prod) continue
          if(Array.isArray(prod.variants)&&prod.variants.length>0&&variantLabel){
            const vIdx=prod.variants.findIndex((v:any)=>[v.size,v.color].filter(Boolean).join(' / ')===variantLabel)
            if(vIdx>=0){
              const nv=[...prod.variants]
              nv[vIdx]={...nv[vIdx],stock:Math.max(0,(nv[vIdx].stock||0)-qty)}
              const nt=nv.reduce((a:number,v:any)=>a+(v.stock||0),0)
              await supabase.from('products').update({variants:nv,stock:nt}).eq('id',pid)
            }
          } else {
            const {data:prod2}=await supabase.from('products').select('stock').eq('id',pid).single()
            if(prod2) await supabase.from('products').update({stock:Math.max(0,(prod2.stock||0)-qty)}).eq('id',pid)
          }
        }
      }
    }
    await supabase.from('orders').update({status}).eq('id',id)
    setOpenDropdown(null)
    showFlash(status==='delivered'?'Хүргэгдсэн ✓':status==='cancelled'?'Цуцлагдлаа':'Хүлээгдэж байна болгов')
    load()
  }

  async function saveEditOrder(){
    if(!editOrder) return
    await supabase.from('orders').update({phone:editPhone,address:editAddr,status:editStatus,delivery_fee:Number(editDelv)||0,date:editDate}).eq('id',editOrder.id)
    setEditOrder(null);showFlash('Засварлагдлаа ✓');load()
  }

  async function deleteOrder(o:Order, silent=false){
    const doDelete=async()=>{
      // pending болон delivered хоёуланд stock буцаана (cancelled-д буцаагаагүй тул зөвхөн тэр 2)
      if(o.status==='pending'||o.status==='delivered'){
        for(const it of(o.order_items||[])){
          const pid=(it as any).product_id
          const qty=(it as any).quantity
          const variantLabel=(it as any).variant_label
          if(!pid) continue
          const {data:prod}=await supabase.from('products').select('*').eq('id',pid).single()
          if(!prod) continue
          if(Array.isArray(prod.variants)&&prod.variants.length>0&&variantLabel){
            const vIdx=prod.variants.findIndex((v:any)=>[v.size,v.color].filter(Boolean).join(' / ')===variantLabel)
            if(vIdx>=0){
              const nv=[...prod.variants]
              nv[vIdx]={...nv[vIdx],stock:(nv[vIdx].stock||0)+qty}
              const nt=nv.reduce((a:number,v:any)=>a+(v.stock||0),0)
              await supabase.from('products').update({variants:nv,stock:nt}).eq('id',pid)
            }
          } else {
            await supabase.from('products').update({stock:(prod.stock||0)+qty}).eq('id',pid)
          }
        }
      }
      await supabase.from('order_items').delete().eq('order_id',o.id)
      await supabase.from('orders').delete().eq('id',o.id)
      if(!silent){showFlash('Устгагдлаа');load()}
    }
    if(silent) return doDelete()
    setConfirmModal({msg:'Захиалга устгах уу?',onOk:async()=>{setOpenDropdown(null);await doDelete()}})
  }

  function copyOrderInfo(o:Order){
    const text=`${o.phone} ${o.address}`
    navigator.clipboard.writeText(text).then(()=>showFlash('Хуулагдлаа ✓')).catch(()=>{})
  }

  const filtered=orders.filter(o=>{
    if(phoneFilter&&!o.phone.includes(phoneFilter)) return false
    if(statusFilter!=='all'&&o.status!==statusFilter) return false
    if(dateFilter&&o.date!==dateFilter) return false
    if(productFilter){
      const pf=productFilter.toLowerCase()
      const hasProduct=(o.order_items||[]).some((it:any)=>{
        const fullName=((it.product_name||'')+(it.variant_label?' '+it.variant_label:'')).toLowerCase()
        return fullName.includes(pf)
      })
      if(!hasProduct) return false
    }
    if(storeFilter!=='all'){
      const store=stores.find(s=>s.id===(o as any).store_id)
      if(!store||store.name!==storeFilter) return false
    }
    return true
  })
  const groups:Record<string,Order[]>={}
  filtered.forEach(o=>{if(!groups[o.date])groups[o.date]=[];groups[o.date].push(o)})
  const totalStock=products.reduce((a,p)=>a+p.stock,0)
  const pending=orders.filter(o=>o.status==='pending').length

  return (
    <div className="space-y-4">
      {flash&&<div className="fixed top-4 right-4 bg-gray-900 text-white text-sm px-4 py-2 rounded-lg z-50">{flash}</div>}

      {/* Portal dropdown */}
      {openDropdown&&(()=>{
        const o=orders.find(x=>x.id===openDropdown)
        if(!o) return null
        const isDelivered=o.status==='delivered'
        const isCancelled=o.status==='cancelled'
        return(
          <div ref={dropdownRef}
            style={{position:'fixed',top:dropdownPos.top,left:dropdownPos.left,zIndex:9999,minWidth:160,boxShadow:'0 4px 16px rgba(0,0,0,0.10)'}}
            className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {o.status!=='delivered'&&<button onClick={()=>{setOrderStatus(o.id,'delivered');setOpenDropdown(null)}} className="w-full text-left px-4 py-2.5 text-xs text-emerald-700 hover:bg-emerald-50">Хүргэгдсэн</button>}
            {o.status==='delivered'&&<button onClick={()=>{setOrderStatus(o.id,'pending');setOpenDropdown(null)}} className="w-full text-left px-4 py-2.5 text-xs text-amber-600 hover:bg-amber-50">Хүлээгдэж байна</button>}
            {o.status==='cancelled'&&<button onClick={()=>{setOrderStatus(o.id,'pending');setOpenDropdown(null)}} className="w-full text-left px-4 py-2.5 text-xs text-amber-600 hover:bg-amber-50">Буцаах</button>}
            {o.status!=='cancelled'&&<button onClick={()=>{setOrderStatus(o.id,'cancelled');setOpenDropdown(null)}} className="w-full text-left px-4 py-2.5 text-xs text-gray-500 hover:bg-gray-50">Цуцлах</button>}
            <div className="border-t border-gray-100"/>
            <button onClick={()=>{setEditOrder(o);setEditPhone(o.phone);setEditAddr(o.address);setEditDate(o.date||TODAY);setEditStatus(o.status);setEditDelv(String(o.delivery_fee||''));setOpenDropdown(null)}} className="w-full text-left px-4 py-2.5 text-xs text-gray-600 hover:bg-gray-50">Засах</button>
            <button onClick={()=>{deleteOrder(o);setOpenDropdown(null)}} className="w-full text-left px-4 py-2.5 text-xs text-red-500 hover:bg-red-50 border-t border-gray-100">Устгах</button>
          </div>
        )
      })()}

      {/* Bulk action bar - дунд гарна */}
      {selectedIds.size>0&&(
        <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
          <div className="pointer-events-auto bg-white border border-gray-200 rounded-xl overflow-hidden flex items-center" style={{boxShadow:'0 4px 16px rgba(0,0,0,0.08)'}}>
            <span className="text-xs text-gray-500 px-4 py-2.5 border-r border-gray-100">{selectedIds.size} захиалга сонгогдсон</span>
            <button onClick={bulkDeliver} className="text-xs px-4 py-2.5 text-emerald-700 hover:bg-emerald-50">✓ Бүгдийг хүргэсэн</button>
            <button onClick={()=>setConfirmModal({msg:`${selectedIds.size} захиалга устгах уу?`,onOk:bulkDelete})} className="text-xs px-4 py-2.5 text-red-500 hover:bg-red-50 border-l border-gray-100">Устгах</button>
            <button onClick={()=>setSelectedIds(new Set())} className="text-xs px-3 py-2.5 text-gray-400 hover:bg-gray-50 border-l border-gray-100">✕</button>
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

      {/* Edit modal */}
      {!isViewer&&editOrder&&(
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h3 className="font-medium text-gray-800 mb-4">Захиалга засварлах</h3>
            <div className="space-y-3">
              <div><label className="block text-xs text-gray-500 mb-1">Огноо</label>
                <div className="overflow-hidden rounded-lg border border-gray-200 bg-white h-[38px] flex items-center">
                  <input type="date" className="w-full px-3 text-sm bg-white appearance-none" style={{WebkitAppearance:'none'}} value={editDate} onChange={e=>setEditDate(e.target.value)}/>
                </div></div>
              <div><label className="block text-xs text-gray-500 mb-1">Утас</label>
                <input className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" value={editPhone} onChange={e=>setEditPhone(e.target.value)}/></div>
              <div><label className="block text-xs text-gray-500 mb-1">Хаяг</label>
                <input className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" value={editAddr} onChange={e=>setEditAddr(e.target.value)}/></div>
              <div><label className="block text-xs text-gray-500 mb-1">Хүргэлт (₮)</label>
                <input type="number" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" value={editDelv} onChange={e=>setEditDelv(e.target.value)}/></div>
              <div><label className="block text-xs text-gray-500 mb-1">Статус</label>
                <select className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white" value={editStatus} onChange={e=>setEditStatus(e.target.value)}>
                  <option value="pending">Хүлээгдэж байна</option>
                  <option value="delivered">Хүргэгдсэн</option>
                  <option value="cancelled">Цуцлагдсан</option>
                </select></div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={()=>setEditOrder(null)} className="flex-1 py-2 rounded-xl border border-gray-200 text-sm">Болих</button>
              <button onClick={saveEditOrder} className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium">Хадгалах</button>
            </div>
          </div>
        </div>
      )}



      {/* Order form */}
      {!isViewer&&(
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-medium text-gray-800 text-sm text-left">Шинэ захиалга</h2>
          </div>
          <div className="space-y-3">
            {/* ── MOBILE ONLY ── */}
            <div className="sm:hidden space-y-3">
              <div><label className="block text-xs text-gray-500 mb-1">Утасны дугаар</label>
                <input className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" placeholder="89639100" value={oPhone} onChange={e=>setOPhone(e.target.value)}/></div>
              <div><label className="block text-xs text-gray-500 mb-1">Хаяг</label>
                <textarea className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none" rows={3}
                  placeholder="Дүүрэг, хороо, байр..." value={oAddr} onChange={e=>setOAddr(e.target.value)}/></div>
              <div className="flex gap-[10px]">
                <div className="flex-1 min-w-0">
                  <label className="block text-xs text-gray-500 mb-1">Огноо</label>
                  <div className="overflow-hidden rounded-lg border border-gray-200 bg-white h-[38px] flex items-center">
                    <input type="date" className="w-full px-2 text-sm bg-white appearance-none" style={{WebkitAppearance:'none'}} value={oDate} onChange={e=>setODate(e.target.value)}/>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <label className="block text-xs text-gray-500 mb-1">Хүргэлт (₮){defaultDelivery>0&&<span className="text-gray-400 ml-1">({fmt(defaultDelivery)}₮)</span>}</label>
                  <input type="number" className="w-full px-2 py-2 rounded-lg border border-gray-200 text-sm h-[38px]" value={oDelv} onChange={e=>setODelv(e.target.value)}/>
                </div>
              </div>
              <div><label className="block text-xs text-gray-500 mb-1">Захиалсан бараанууд</label>
                <div className="border border-gray-100 rounded-lg p-3 bg-gray-50 space-y-3">
                  {oItems.map((it,idx)=>{
                    const selProd=products.find(p=>p.id===it.product_id)
                    const variants:any[]=(selProd as any)?.variants||[]
                    return(
                    <div key={idx} className="space-y-1.5">
                      <div className="flex gap-2 items-center">
                        <select className="flex-1 px-2 py-2 rounded-lg border border-gray-200 text-sm bg-white" value={it.product_id} onChange={e=>setItem(idx,'product_id',e.target.value)}>
                          {products.map(p=><option key={p.id} value={p.id}>{p.name} ({p.stock}ш)</option>)}
                        </select>
                        {oItems.length>1&&<button onClick={()=>removeItem(idx)} className="w-8 h-8 flex-shrink-0 flex items-center justify-center bg-red-50 text-red-500 rounded-lg text-xs">✕</button>}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div><label className="block text-xs text-gray-400 mb-1">Тоо</label>
                          <input type="number" className="w-full px-2 py-2 rounded-lg border border-gray-200 text-sm" min="1" value={it.qty} onChange={e=>setItem(idx,'qty',e.target.value)}/></div>
                        <div><label className="block text-xs text-gray-400 mb-1">Үнэ (₮)</label>
                          <input type="number" className="w-full px-2 py-2 rounded-lg border border-gray-200 text-sm" value={it.price} onChange={e=>setItem(idx,'price',e.target.value)} placeholder="0"/></div>
                      </div>
                      {variantEnabled&&variants.length>0&&(
                        <select className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs bg-white text-gray-600"
                          value={it.variant_label} onChange={e=>{
                            const v=variants.find((v:any)=>[v.size,v.color].filter(Boolean).join(' / ')===e.target.value)
                            setItem(idx,'variant_label',e.target.value)
                            if(v?.price) setOItems(items=>items.map((it2,i2)=>i2===idx?{...it2,price:String(v.price)}:it2))
                          }}>
                          <option value="">— Хэмжээ / Өнгө сонгох —</option>
                          {variants.map((v:any,vi:number)=>(
                            <option key={vi} value={[v.size,v.color].filter(Boolean).join(' / ')}>
                              {[v.size,v.color].filter(Boolean).join(' / ')}{v.price?' — '+Number(v.price).toLocaleString()+'₮':''}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  )})}
                </div>
                <div className="flex items-center justify-between mt-2">
                  <button onClick={addItem} className="text-xs text-emerald-600 hover:underline">＋ Бараа нэмэх</button>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <div onClick={()=>setOPaid(!oPaid)}
                      className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-all ${oPaid?'bg-emerald-500 border-emerald-500':'border-gray-300 bg-white'}`}>
                      {oPaid&&<span className="text-white text-xs font-bold">✓</span>}
                    </div>
                    <span className="text-xs text-gray-500">Төлбөр төлөгдсөн</span>
                  </label>
                </div>
              </div>
              <div className="flex justify-end">
                <button onClick={submitOrder} className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700">Захиалга бүртгэх</button>
              </div>
            </div>
            {/* ── DESKTOP ONLY ── */}
            <div className="hidden sm:block space-y-2">
            {/* Мөр 1: Утас | Огноо | Төлсөн | Хүргэлт */}
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Утасны дугаар</label>
                <input className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" placeholder="89639100" value={oPhone} onChange={e=>setOPhone(e.target.value)}/>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Огноо</label>
                <input type="date" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" value={oDate} onChange={e=>setODate(e.target.value)}/>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Төлсөн</label>
                <label className="flex items-center gap-2 cursor-pointer h-[38px] px-3 rounded-lg border border-gray-200 bg-white w-full"
                  onClick={()=>{
                    const next=!oPaid; setOPaid(next)
                    if(next) setOItems(items=>items.map(it=>({...it,price:'0'})))
                    else setOItems(items=>items.map(it=>{
                      const p=products.find(x=>x.id===it.product_id)
                      return {...it,price:String(p?.unit_price||'')}
                    }))
                  }}>
                  <div className={`w-4 h-4 rounded flex items-center justify-center border-2 transition-all flex-shrink-0 ${oPaid?'bg-emerald-500 border-emerald-500':'border-gray-300 bg-white'}`}>
                    {oPaid&&<span className="text-white text-[10px] font-bold">✓</span>}
                  </div>
                  <span className="text-xs text-gray-600 whitespace-nowrap">Төлбөр төлөгдсөн</span>
                </label>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Хүргэлт (₮){defaultDelivery>0&&<span className="text-gray-400 ml-1 text-xs">({fmt(defaultDelivery)}₮)</span>}</label>
                <input type="number" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" value={oDelv} onChange={e=>setODelv(e.target.value)}/>
              </div>
            </div>
            {/* Мөр 2: Хаяг | Захиалсан бараанууд */}
            <div className="grid grid-cols-2 gap-3 items-stretch">
              <div className="flex flex-col">
                <label className="block text-xs text-gray-500 mb-1">Хаяг</label>
                <textarea className="flex-1 w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none min-h-[80px]"
                  placeholder="Дүүрэг, хороо, байр..." value={oAddr} onChange={e=>setOAddr(e.target.value)}/>
              </div>
              <div className="flex flex-col">
                <label className="block text-xs text-gray-500 mb-1">Захиалсан бараанууд</label>
                <div className="border border-gray-100 rounded-lg p-3 bg-gray-50 space-y-2 flex-1">
                  <div className="grid grid-cols-[1fr_46px_72px_20px] gap-1.5 mb-1 px-1">
                    <div className="text-xs text-gray-400">Бараа</div>
                    <div className="text-xs text-gray-400 text-center">Тоо</div>
                    <div className="text-xs text-gray-400">Үнэ (₮)</div>
                    <div></div>
                  </div>
                  {oItems.map((it,idx)=>{
                    const selProd=products.find(p=>p.id===it.product_id)
                    const variants:any[]=(selProd as any)?.variants||[]
                    return(
                    <div key={idx} className="space-y-1.5">
                      <div className="grid grid-cols-[1fr_46px_72px_20px] gap-1.5 items-center">
                        <select className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm bg-white truncate" value={it.product_id} onChange={e=>setItem(idx,'product_id',e.target.value)}>
                          {products.map(p=><option key={p.id} value={p.id}>{p.name} ({p.stock}ш)</option>)}
                        </select>
                        <input type="number" className="w-full px-1 py-1.5 rounded-lg border border-gray-200 text-sm text-center" min="1" value={it.qty} onChange={e=>setItem(idx,'qty',e.target.value)}/>
                        <input type="number" className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm" value={it.price} onChange={e=>setItem(idx,'price',e.target.value)} placeholder="0"/>
                        {oItems.length>1?<button onClick={()=>removeItem(idx)} className="w-5 h-5 flex items-center justify-center text-red-400 rounded text-xs">✕</button>:<div/>}
                      </div>
                      {variantEnabled&&variants.length>0&&(
                        <select className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs bg-white text-gray-600"
                          value={it.variant_label}
                          onChange={e=>{
                            const v=variants.find((v:any)=>[v.size,v.color].filter(Boolean).join(' / ')===e.target.value)
                            setItem(idx,'variant_label',e.target.value)
                            if(v?.price) setOItems(items=>items.map((it2,i2)=>i2===idx?{...it2,price:oPaid?'0':String(v.price)}:it2))
                          }}>
                          <option value="">— Хэмжээ / Өнгө сонгох —</option>
                          {variants.map((v:any,vi:number)=>(
                            <option key={vi} value={[v.size,v.color].filter(Boolean).join(' / ')}>
                              {[v.size,v.color].filter(Boolean).join(' / ')}{v.price?' — '+Number(v.price).toLocaleString()+'₮':''}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  )})}
                </div>
                <div className="flex items-center justify-between mt-2">
                  <button onClick={addItem} className="text-xs text-emerald-600 hover:underline">＋ Бараа нэмэх</button>
                  <button onClick={submitOrder} className="px-6 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700">Захиалга бүртгэх</button>
                </div>
              </div>
            </div>
            </div>{/* end desktop */}
          </div>
        </div>
      )}

      {/* Orders list */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="font-medium text-gray-800 text-sm text-left">Захиалгын бүртгэл</h2>
        </div>
        <div className="grid grid-cols-2 gap-2 px-3 py-3 border-b border-gray-100 bg-gray-50">
          <input className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white w-full" placeholder="Утасны дугаар..." value={phoneFilter} onChange={e=>setPhoneFilter(e.target.value)}/>
          <input className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white w-full" placeholder="Барааны нэрээр хайх..." value={productFilter} onChange={e=>setProductFilter(e.target.value)}/>
          <div className="flex items-center gap-1 w-full">
            <input type="date" className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white w-full" value={dateFilter} onChange={e=>setDateFilter(e.target.value)}/>
            {dateFilter&&<button onClick={()=>setDateFilter('')} className="text-gray-400 text-xs px-2 py-2">✕</button>}
          </div>
          {stores.length>0?(
            <select className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white w-full" value={storeFilter} onChange={e=>setStoreFilter(e.target.value)}>
              <option value="all">Бүх дэлгүүр</option>
              {stores.map(s=><option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
          ):<div/>}
        </div>

        {Object.keys(groups).sort((a,b)=>b.localeCompare(a)).map(date=>{
          const grp=groups[date]
          const dayGross=grp.reduce((a,o)=>(o.order_items||[]).reduce((s:number,i:any)=>s+i.quantity*i.unit_price,a),0)
          const dayDelv=grp.reduce((a,o)=>a+(o.delivery_fee||0),0)
          const dayNet=dayGross-dayDelv
          return (
            <div key={date}>
              <div className="px-4 py-2 bg-gray-100 border-y border-gray-200 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  {!isViewer&&(
                    <input type="checkbox"
                      checked={grp.every(o=>selectedIds.has(o.id))}
                      onChange={()=>toggleSelectAll(grp.map(o=>o.id))}
                      className="w-3.5 h-3.5 accent-emerald-500"/>
                  )}
                  <span className="text-xs font-medium text-gray-700">{fmtD(date)}</span>
                </div>
                <span className="text-xs text-gray-400 tabular-nums">{grp.length} захиалга &nbsp;·&nbsp; <span className="text-base font-bold text-emerald-700">{fmt(dayNet)}₮</span></span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse" style={{tableLayout:'fixed'}}>
                  <colgroup>
                    <col style={{width:'11%'}}/>
                    <col style={{width:'27%'}}/>
                    <col style={{width:'21%'}}/>
                    <col style={{width:'4%'}}/>
                    <col style={{width:'13%'}}/>
                    <col style={{width:'4%'}}/>
                    <col style={{width:'20%'}}/>
                  </colgroup>
                  <tbody>
                {grp.map((o,idx)=>{
                  const gross=(o.order_items||[]).reduce((a:number,i:any)=>a+i.quantity*i.unit_price,0)
                  const net=gross-(o.delivery_fee||0)
                  const storeName=stores.find(s=>s.id===(o as any).store_id)?.name
                  const showStore=storeFilter==='all'&&!!storeName
                  const isDelivered=o.status==='delivered'
                  const isCancelled=o.status==='cancelled'
                  return (
                    <tr key={o.id} className={`border-b border-gray-100 ${selectedIds.has(o.id)?'bg-emerald-50/40':''}`}>
                      {/* Утас */}
                      <td className="py-2.5 pl-4 pr-2 align-middle whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {!isViewer&&(
                            <input type="checkbox" checked={selectedIds.has(o.id)} onChange={()=>toggleSelect(o.id)}
                              className="w-3.5 h-3.5 accent-emerald-500 flex-shrink-0"/>
                          )}
                          <button onClick={()=>copyOrderInfo(o)} className="text-sm font-semibold text-gray-800 hover:text-emerald-600">
                            {o.phone}
                          </button>
                        </div>
                      </td>
                      {/* Хаяг */}
                      <td className="py-2.5 px-2 align-middle text-xs text-gray-400 leading-relaxed">{o.address}</td>
                      {/* Бараа */}
                      <td className="py-2.5 pl-8 pr-0.5 align-middle text-left">
                        {(o.order_items||[]).map((item:any,i:number)=>(
                          <div key={i} className="text-xs text-gray-700 leading-snug">
                            {item.product_name}{item.variant_label&&<span className="text-gray-400"> {item.variant_label}</span>}
                          </div>
                        ))}
                      </td>
                      {/* Тоо — баруун тийш тулгасан */}
                      <td className="py-2.5 pl-0.5 pr-1 align-middle text-right">
                        {(o.order_items||[]).map((item:any,i:number)=>(
                          <div key={i} className="text-xs text-gray-400 leading-snug tabular-nums">{item.quantity}ш</div>
                        ))}
                      </td>
                      {/* Дүн */}
                      <td className="py-2.5 px-2 align-middle text-right whitespace-nowrap">
                        <div className="text-xs text-gray-500 tabular-nums">{fmt(gross)}₮</div>
                        {o.delivery_fee>0&&<div className="text-[11px] text-gray-300 tabular-nums">−{fmt(o.delivery_fee)}₮</div>}
                        <div className={`text-xs font-semibold tabular-nums ${net<0?'text-red-500':'text-emerald-600'}`}>{fmt(net)}₮</div>
                      </td>
                      {/* Зай */}
                      <td/>
                      {/* Төлөв + dropdown */}
                      <td className="py-2.5 pl-1 pr-3 align-middle text-right">
                        {!isViewer?(
                          <button
                            onClick={(e)=>{
                              const rect=(e.currentTarget as HTMLElement).getBoundingClientRect()
                              setDropdownPos({top:rect.bottom+4,left:Math.min(rect.left,window.innerWidth-170)})
                              setOpenDropdown(openDropdown===o.id?null:o.id)
                            }}
                            className={`text-[11px] px-2 py-1 rounded-lg border flex items-center gap-0.5 whitespace-nowrap ${
                              isDelivered?'bg-emerald-50 text-emerald-600 border-emerald-200':
                              isCancelled?'bg-gray-100 text-gray-400 border-gray-200':
                              'bg-amber-50 text-amber-600 border-amber-200'
                            }`}>
                            {isDelivered?'Хүргэгдсэн':isCancelled?'Цуцлагдсан':'Хүлээгдэж байна'} ▾
                          </button>
                        ):(
                          <span className={`text-xs px-2.5 py-1 rounded-lg border ${
                            isDelivered?'bg-emerald-50 text-emerald-600 border-emerald-200':
                            isCancelled?'bg-gray-100 text-gray-400 border-gray-200':
                            'bg-amber-50 text-amber-600 border-amber-200'
                          }`}>{isDelivered?'Хүргэгдсэн':isCancelled?'Цуцлагдсан':'Хүлээгдэж байна'}</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })}
        {filtered.length===0&&<p className="text-center text-gray-400 text-sm py-10">Захиалга олдсонгүй</p>}
      </div>
    </div>
  )
}
