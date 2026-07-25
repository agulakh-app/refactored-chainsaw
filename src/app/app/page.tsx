'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { Product, Order } from '@/lib/types'
import { consumeOrderItems, releaseOrderItems, insertOrderOutLogs, deleteOrderOutLogs, updateOrderOutLogsDate } from '@/lib/stockMovement'
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
  const [editPaid,setEditPaid]=useState(false)
  const [editItems,setEditItems]=useState<any[]>([])
  const [oDate,setODate]=useState(TODAY)
  const [oPhone,setOPhone]=useState('')
  const [oAddr,setOAddr]=useState('')
  const [oDelv,setODelv]=useState('')
  const [oPaid,setOPaid]=useState(false)
  const [oPaidLocked,setOPaidLocked]=useState(false)
  const [oStore,setOStore]=useState('')
  const [oItems,setOItems]=useState([{product_id:'',product_name:'',qty:'1',price:'',variant_label:''}])
  const [oItemSearch,setOItemSearch]=useState<string[]>([])
  const [oItemOpen,setOItemOpen]=useState<boolean[]>([])
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
      (activeStoreId ? supabase.from('orders').select('*, order_items(*)').eq('user_id',targetId).eq('store_id',activeStoreId).order('date',{ascending:false}).order('day_seq',{ascending:false}).limit(5000) : supabase.from('orders').select('*, order_items(*)').eq('user_id',targetId).order('date',{ascending:false}).order('day_seq',{ascending:false}).limit(5000)),
      supabase.from('stores').select('*').eq('user_id',targetId).order('created_at'),
    ])
    setProducts(prods||[])
    setOrders(ords||[])
    setStores(sts||[])
    // Log-оос тооцоолсон stock
    if(prods&&prods.length>0){
      const pids=(prods||[]).map((p:any)=>p.id)
      // restock_log татах
      const {data:rlogs}=await (activeStoreId
        ? supabase.from('restock_log').select('product_id,variant_label,quantity').eq('user_id',targetId).eq('store_id',activeStoreId).eq('type','in')
        : supabase.from('restock_log').select('product_id,variant_label,quantity').eq('user_id',targetId).eq('type','in'))
      // delivered order_items татах — pagination
      const allDelivIds:string[]=[]
      let pg=0
      while(true){
        const {data:dords}=await (activeStoreId
          ? supabase.from('orders').select('id').eq('user_id',targetId).eq('store_id',activeStoreId).eq('status','delivered').range(pg*1000,(pg+1)*1000-1)
          : supabase.from('orders').select('id').eq('user_id',targetId).eq('status','delivered').range(pg*1000,(pg+1)*1000-1))
        if(!dords||dords.length===0) break
        allDelivIds.push(...dords.map((o:any)=>o.id))
        if(dords.length<1000) break
        pg++
      }
      const soldMap:any={}
      if(allDelivIds.length>0){
        for(let i=0;i<pids.length;i+=200){
          const pb=pids.slice(i,i+200)
          for(let j=0;j<allDelivIds.length;j+=500){
            const ob=allDelivIds.slice(j,j+500)
            const {data:oi}=await supabase.from('order_items').select('product_id,variant_label,quantity').in('product_id',pb).in('order_id',ob).limit(5000)
            for(const it of (oi||[])){
              const k=it.product_id+'|||'+(it.variant_label||'')
              soldMap[k]=(soldMap[k]||0)+it.quantity
            }
          }
        }
      }
      const rstMap:any={}
      for(const l of (rlogs||[])){
        const k=l.product_id+'|||'+(l.variant_label||'')
        rstMap[k]=(rstMap[k]||0)+l.quantity
      }
      const calcStock=(pid:string,vl:string='')=>(rstMap[pid+'|||'+vl]||0)-(soldMap[pid+'|||'+vl]||0)
      setProducts((prods||[]).map((p:any)=>{
        const pvs=p.variants||[]
        if(pvs.length>0){
          const nv=pvs.map((v:any)=>{const lbl=[v.size,v.color].filter(Boolean).join(' / ');return{...v,stock:calcStock(p.id,lbl)}})
          return{...p,variants:nv,stock:nv.reduce((a:number,v:any)=>a+v.stock,0)}
        }
        return{...p,stock:calcStock(p.id)}
      }))
    }
    if(prods&&prods.length>0){
      setOItems(i=>i.map((it,idx)=>idx===0&&!it.product_id?{...it,product_id:prods[0].id,product_name:prods[0].name,price:String(prods[0].unit_price)}:it))
    }
    if(activeStoreId){
      const{data:storeData}=await supabase.from('stores').select('variant_enabled').eq('id',activeStoreId).single()
      setVariantEnabled(storeData?.variant_enabled||false)
    } else { setVariantEnabled(false) }
  },[ownerId, activeStoreId])

  useEffect(()=>{load()},[load])

  useEffect(()=>{
    const ch = supabase.channel('orders-products-watch')
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'products'},()=>load())
      .on('postgres_changes',{event:'DELETE',schema:'public',table:'products'},()=>load())
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'products'},()=>load())
      .subscribe()
    return ()=>{supabase.removeChannel(ch)}
  },[load])

  function addItem(){setOItems(i=>[...i,{product_id:products[0]?.id||'',product_name:products[0]?.name||'',qty:'1',price:String(products[0]?.unit_price||''),variant_label:''}]);setOItemSearch(s=>[...s,'']);setOItemOpen(o=>[...o,false])}
  function removeItem(idx:number){setOItems(i=>i.filter((_,j)=>j!==idx));setOItemSearch(s=>s.filter((_,j)=>j!==idx));setOItemOpen(o=>o.filter((_,j)=>j!==idx))}
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
      // Stock хасах + 'out' хөдөлгөөний бүртгэл — нэгдсэн логикоор (store_id, variant_label бүрэн)
      const movItems=oItems.map(it=>({product_id:it.product_id,product_name:it.product_name,variant_label:it.variant_label||null,quantity:Number(it.qty)}))
      await consumeOrderItems(movItems)
      await insertOrderOutLogs(targetId,activeStoreId||null,oDate||TODAY,movItems)
    }
    setOPhone('');setOAddr('');setODelv(String(defaultDelivery))
    setOItems([{product_id:products[0]?.id||'',product_name:products[0]?.name||'',qty:'1',price:String(products[0]?.unit_price||''),variant_label:''}])
    setOItemSearch([])
    setOItemOpen([])
    setOPaid(false); setOPaidLocked(false)
    showFlash('Захиалга бүртгэгдлээ ✓');load()
  }

  async function setOrderStatus(id:string,status:string){
    const o=orders.find(x=>x.id===id)
    if(o&&o.status!==status){
      // Ерөнхий дүрэм: cancelled ≠ агуулахаас хасагдсан.
      // pending/delivered → cancelled: stock буцааж, out-лог арилгана.
      // cancelled → pending/delivered: stock дахин хасаж, out-лог сэргээнэ.
      const wasHeld=o.status!=='cancelled'
      const nowHeld=status!=='cancelled'
      const{data:{user}}=await supabase.auth.getUser()
      const targetId=ownerId||user?.id
      const items=(o.order_items||[]) as any[]
      if(wasHeld&&!nowHeld){
        await releaseOrderItems(items)
        if(targetId) await deleteOrderOutLogs(targetId,o.date,items)
      } else if(!wasHeld&&nowHeld){
        await consumeOrderItems(items)
        if(targetId) await insertOrderOutLogs(targetId,(o as any).store_id||null,o.date,items)
      }
    }
    await supabase.from('orders').update({status}).eq('id',id)
    setOpenDropdown(null)
    showFlash(status==='delivered'?'Хүргэгдсэн ✓':status==='cancelled'?'Цуцлагдлаа':'Хүлээгдэж байна болгов')
    load()
  }

  async function saveEditOrder(){
    if(!editOrder) return
    const{data:{user}}=await supabase.auth.getUser()
    const targetId=ownerId||user?.id
    const origItems=(editOrder.order_items||[]) as any[]
    // Огноо өөрчлөгдвөл out-логийн огноог шинэчилнэ
    if(targetId&&editDate&&editDate!==editOrder.date&&editOrder.status!=='cancelled'){
      await updateOrderOutLogsDate(targetId,origItems,editOrder.date,editDate)
    }
    // Байгаа бараа шинэчлэх
    for(const it of editItems){
      if(String(it.id).startsWith('new_')){
        // Шинэ бараа insert
        await supabase.from('order_items').insert({
          order_id:editOrder.id,
          product_id:it.product_id,
          product_name:it.product_name||products.find((p:any)=>p.id===it.product_id)?.name||'',
          quantity:Number(it.quantity)||1,
          unit_price:Number(it.price)||0,
          variant_label:it.variant_label||null,
        })
      } else {
        await supabase.from('order_items').update({
          unit_price:Number(it.price)||0,
          quantity:Number(it.quantity)||1,
        }).eq('id',it.id)
      }
    }
    // Устгасан бараа delete
    const editIds=editItems.filter(it=>!String(it.id).startsWith('new_')).map(it=>it.id)
    for(const orig of origItems){
      if(!editIds.includes(orig.id)){
        await supabase.from('order_items').delete().eq('id',orig.id)
      }
    }
    const {error}=await supabase.from('orders').update({
      phone:editPhone,
      address:editPaid?'[PAID]'+(editAddr?(' '+editAddr):''):editAddr,
      delivery_fee:Number(editDelv)||0,
      date:editDate,
    }).eq('id',editOrder.id)
    if(error){showFlash('Алдаа: '+error.message);return}
    setEditOrder(null);showFlash('Засварлагдлаа ✓');load()
  }

  async function deleteOrder(o:Order, silent=false){
    const doDelete=async()=>{
      // pending болон delivered хоёуланд stock буцааж, 'out' хөдөлгөөний
      // бүртгэлийг хамт устгана (cancelled-д stock аль хэдийн буцсан, лог арилсан)
      if(o.status==='pending'||o.status==='delivered'){
        const{data:{user}}=await supabase.auth.getUser()
        const targetId=ownerId||user?.id
        const items=(o.order_items||[]) as any[]
        await releaseOrderItems(items)
        if(targetId) await deleteOrderOutLogs(targetId,o.date,items)
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
      {flash&&<div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none"><div className="bg-gray-900 text-white text-sm px-6 py-3 rounded-2xl shadow-2xl animate-bounce-once">{flash}</div></div>}

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
            <button onClick={()=>{setEditOrder(o);setEditPhone(o.phone);setEditAddr((o.address||'').replace('[PAID]','').trim());setEditDate(o.date||TODAY);setEditStatus(o.status);setEditDelv(String(o.delivery_fee||''));setEditPaid((o.address||'').startsWith('[PAID]'));setEditItems((o.order_items||[]).map((it:any)=>({...it,price:String(it.unit_price)})));setOpenDropdown(null)}} className="w-full text-left px-4 py-2.5 text-xs text-gray-600 hover:bg-gray-50">Засах</button>
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
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl">
            <h3 className="font-medium text-gray-800 mb-4 text-sm">Захиалга засварлах</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div><label className="block text-xs text-gray-500 mb-1">Утасны дугаар</label>
                  <input className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                    value={editPhone} onChange={e=>setEditPhone(e.target.value)}/></div>
                <div><label className="block text-xs text-gray-500 mb-1">Огноо</label>
                  <div className="overflow-hidden rounded-lg border border-gray-200 bg-white h-[38px] flex items-center">
                    <input type="date" className="w-full px-2 text-sm bg-white appearance-none"
                      style={{WebkitAppearance:'none'}} value={editDate} onChange={e=>setEditDate(e.target.value)}/>
                  </div></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="block text-xs text-gray-500 mb-1">Хүргэлт (₮)</label>
                  <input type="number" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                    value={editDelv} onChange={e=>setEditDelv(e.target.value)}/></div>
                <div><label className="block text-xs text-gray-500 mb-1">Төлбөр</label>
                  <div onClick={()=>setEditPaid(p=>!p)}
                    className={`h-[38px] w-full flex items-center gap-2 px-3 rounded-lg border cursor-pointer transition-all ${editPaid?'border-emerald-300 bg-emerald-50':'border-gray-200 bg-white'}`}>
                    <div className={`w-4 h-4 rounded flex items-center justify-center border-2 flex-shrink-0 ${editPaid?'bg-emerald-500 border-emerald-500':'border-gray-300'}`}>
                      {editPaid&&<span className="text-white text-[10px] font-bold">✓</span>}
                    </div>
                    <span className={`text-xs ${editPaid?'text-emerald-600 font-medium':'text-gray-500'}`}>{editPaid?'Төлсөн':'Төлөөгүй'}</span>
                  </div></div>
              </div>
              <div>
                <div className="grid gap-2 mb-1" style={{gridTemplateColumns:'1fr 70px 90px 24px'}}>
                  <span className="text-xs text-gray-400">Бараа нэр</span>
                  <span className="text-xs text-gray-400 text-center">Тоо</span>
                  <span className="text-xs text-gray-400 text-right">Үнэ (₮)</span>
                  <span></span>
                </div>
                <div className="space-y-1.5">
                  {editItems.map((it,i)=>(
                    <div key={i} className="grid gap-1.5 items-center" style={{gridTemplateColumns:'1fr 70px 90px 24px'}}>
                      <select className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs bg-white truncate"
                        value={it.product_id||''}
                        onChange={e=>{
                          const p=products.find(x=>x.id===e.target.value)
                          setEditItems(prev=>prev.map((x,j)=>j===i?{...x,product_id:e.target.value,product_name:p?.name||x.product_name,price:String(p?.unit_price||x.price)}:x))
                        }}>
                        {products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      <input type="number" min="1"
                        className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs text-center"
                        value={it.quantity}
                        onChange={e=>setEditItems(prev=>prev.map((x,j)=>j===i?{...x,quantity:Math.max(1,Number(e.target.value)||1)}:x))}/>
                      <input type="text" inputMode="numeric"
                        className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs text-right"
                        value={it.price?Number(it.price).toLocaleString():''}
                        onChange={e=>setEditItems(prev=>prev.map((x,j)=>j===i?{...x,price:e.target.value.replace(/[^0-9]/g,'')}:x))}/>
                      {editItems.length>1&&<button type="button" onClick={()=>setEditItems(prev=>prev.filter((_,j)=>j!==i))}
                        className="w-5 h-5 flex items-center justify-center text-gray-300 hover:text-red-400 text-xs">✕</button>}
                      {editItems.length===1&&<span></span>}
                    </div>
                  ))}
                </div>
                <button type="button" onClick={()=>setEditItems(prev=>[...prev,{id:'new_'+Date.now(),product_id:products[0]?.id||'',product_name:products[0]?.name||'',quantity:1,price:String(products[0]?.unit_price||''),variant_label:null}])}
                  className="mt-1.5 text-xs text-emerald-600 hover:underline">+ Бараа нэмэх</button>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={()=>setEditOrder(null)} className="flex-1 py-2 rounded-xl border border-gray-200 text-sm text-gray-600">Болих</button>
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
                    const srch=oItemSearch[idx]||''
                    const filtered=products.filter(p=>!srch||p.name.toLowerCase().includes(srch.toLowerCase()))
                    return(
                    <div key={idx} className="space-y-1.5">
                      <div className="flex gap-2 items-center">
                        <div className="flex-1 relative">
                          <input className="w-full px-2 py-2 rounded-lg border border-gray-200 text-sm bg-white"
                            placeholder="Бараа хайх..."
                            value={srch!==''?srch:(oItemOpen[idx]?'':selProd?.name||'')}
                            onChange={e=>{const s=e.target.value;setOItemSearch(prev=>{const n=[...prev];n[idx]=s;return n})}}
                            onFocus={()=>{setOItemSearch(prev=>{const n=[...prev];n[idx]='';return n});setOItemOpen(prev=>{const n=[...prev];n[idx]=true;return n})}}
                            onBlur={()=>setTimeout(()=>setOItemOpen(prev=>{const n=[...prev];n[idx]=false;return n}),150)}
                          />
                          {(srch||oItemOpen[idx])&&(
                            <div className="absolute top-full left-0 right-0 z-50 bg-white border border-gray-200 rounded-lg mt-1 max-h-48 overflow-y-auto shadow-lg">
                              {filtered.map(p=>(
                                <button key={p.id} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-emerald-50 flex justify-between"
                                  onMouseDown={()=>{setItem(idx,'product_id',p.id);setOItemSearch(prev=>{const n=[...prev];n[idx]='';return n});setOItemOpen(prev=>{const n=[...prev];n[idx]=false;return n})}}>
                                  <span>{p.name}</span>
                                  <span className="text-xs text-gray-400">{p.stock}ш</span>
                                </button>
                              ))}
                              {filtered.length===0&&<div className="px-3 py-2 text-xs text-gray-400">Олдсонгүй</div>}
                            </div>
                          )}
                        </div>
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
                    <div onClick={()=>{if(!oPaidLocked){const n=!oPaid;setOPaid(n);setOPaidLocked(n)}}}
                      className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-all ${oPaid?'bg-emerald-500 border-emerald-500':'border-gray-300 bg-white'} ${oPaidLocked?'opacity-60 cursor-not-allowed':'cursor-pointer'}`}>
                      {oPaid&&<span className="text-white text-xs font-bold">✓</span>}
                    </div>
                    <span className={`text-xs ${oPaidLocked?'text-emerald-600 font-medium':'text-gray-500'}`}>Төлбөр төлөгдсөн</span>
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
                <label className={`flex items-center gap-2 h-[38px] px-3 rounded-lg border w-full transition-all ${oPaidLocked?'border-emerald-200 bg-emerald-50 cursor-not-allowed':'border-gray-200 bg-white cursor-pointer'}`}
                  onClick={()=>{
                    if(oPaidLocked) return
                    const next=!oPaid; setOPaid(next); setOPaidLocked(next)
                    if(next) setOItems(items=>items.map(it=>({...it,price:'0'})))
                    else setOItems(items=>items.map(it=>{
                      const p=products.find(x=>x.id===it.product_id)
                      return {...it,price:String(p?.unit_price||'')}
                    }))
                  }}>
                  <div className={`w-4 h-4 rounded flex items-center justify-center border-2 transition-all flex-shrink-0 ${oPaid?'bg-emerald-500 border-emerald-500':'border-gray-300 bg-white'}`}>
                    {oPaid&&<span className="text-white text-[10px] font-bold">✓</span>}
                  </div>
                  <span className={`text-xs whitespace-nowrap ${oPaidLocked?'text-emerald-600 font-medium':'text-gray-600'}`}>Төлбөр төлөгдсөн</span>
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
                    const srch=oItemSearch[idx]||''
                    const filtered=products.filter(p=>!srch||p.name.toLowerCase().includes(srch.toLowerCase()))
                    return(
                    <div key={idx} className="space-y-1.5">
                      <div className="grid grid-cols-[1fr_46px_72px_20px] gap-1.5 items-center">
                        <div className="relative">
                          <input className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm bg-white"
                            placeholder="Бараа хайх..."
                            value={srch!==''?srch:(oItemOpen[idx]?'':selProd?.name||'')}
                            onChange={e=>{const s=e.target.value;setOItemSearch(prev=>{const n=[...prev];n[idx]=s;return n})}}
                            onFocus={()=>{setOItemSearch(prev=>{const n=[...prev];n[idx]='';return n});setOItemOpen(prev=>{const n=[...prev];n[idx]=true;return n})}}
                            onBlur={()=>setTimeout(()=>setOItemOpen(prev=>{const n=[...prev];n[idx]=false;return n}),150)}
                          />
                          {(srch||oItemOpen[idx])&&(
                            <div className="absolute top-full left-0 right-0 z-50 bg-white border border-gray-200 rounded-lg mt-1 max-h-48 overflow-y-auto shadow-lg">
                              {filtered.map(p=>(
                                <button key={p.id} type="button" className="w-full text-left px-3 py-1.5 text-sm hover:bg-emerald-50 flex justify-between"
                                  onMouseDown={()=>{setItem(idx,'product_id',p.id);setOItemSearch(prev=>{const n=[...prev];n[idx]='';return n});setOItemOpen(prev=>{const n=[...prev];n[idx]=false;return n})}}>
                                  <span>{p.name}</span>
                                  <span className="text-xs text-gray-400">{p.stock}ш</span>
                                </button>
                              ))}
                              {filtered.length===0&&<div className="px-3 py-2 text-xs text-gray-400">Олдсонгүй</div>}
                            </div>
                          )}
                        </div>
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
        <div className="grid grid-cols-3 gap-2 px-3 py-3 border-b border-gray-100 bg-gray-50">
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
                      <td className="py-2.5 px-2 align-middle text-xs text-gray-400 leading-relaxed">{(o.address||"").replace("[PAID]","").trim()}</td>
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
