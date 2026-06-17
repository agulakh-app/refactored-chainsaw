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
  const [warehouses,setWarehouses]=useState<any[]>([])
  const [flash,setFlash]=useState('')
  const [confirmModal,setConfirmModal]=useState<{msg:string,onOk:()=>void}|null>(null)

  function confirm2(msg:string, onOk:()=>void){ setConfirmModal({msg,onOk}) }
  const [phoneFilter,setPhoneFilter]=useState('')
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
  const [oStore,setOStore]=useState('')
  const [oWarehouse,setOWarehouse]=useState('')
  const [oItems,setOItems]=useState([{product_id:'',product_name:'',qty:'1',price:'',variant_label:''}])
  const [variantEnabled,setVariantEnabled]=useState(false)
  const [openDropdown,setOpenDropdown]=useState<string|null>(null)
  const dropdownRef=useRef<HTMLDivElement>(null)

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
    const[{data:prods},{data:ords},{data:sts},{data:whs}]=await Promise.all([
      (activeStoreId ? supabase.from('products').select('*').eq('user_id',targetId).eq('store_id',activeStoreId).order('name') : supabase.from('products').select('*').eq('user_id',targetId).order('name')),
      (activeStoreId ? supabase.from('orders').select('*, order_items(*)').eq('user_id',targetId).eq('store_id',activeStoreId).order('date',{ascending:false}).order('day_seq',{ascending:false}) : supabase.from('orders').select('*, order_items(*)').eq('user_id',targetId).order('date',{ascending:false}).order('day_seq',{ascending:false})),
      supabase.from('stores').select('*').eq('user_id',targetId).order('created_at'),
      supabase.from('warehouses').select('*').eq('user_id',targetId).order('created_at'),
    ])
    setProducts(prods||[])
    setOrders(ords||[])
    setStores(sts||[])
    setWarehouses(whs||[])
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
  function setItem(idx:number,key:string,val:string){
    setOItems(items=>items.map((it,i)=>{
      if(i!==idx) return it
      if(key==='product_id'){const p=products.find(x=>x.id===val);return{...it,product_id:val,product_name:p?.name||'',price:String(p?.unit_price||''),variant_label:''}}
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
      if(variantEnabled&&pvs.length>0&&it.variant_label){
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
      store_id:activeStoreId||null,warehouse_id:oWarehouse||null
    }).select().single()
    if(order){
      await supabase.from('order_items').insert(oItems.map(it=>({order_id:order.id,product_id:it.product_id,product_name:it.product_name,quantity:Number(it.qty),unit_price:Number(it.price),variant_label:it.variant_label||null})))
      for(const it of oItems){
        const p=products.find(x=>x.id===it.product_id)!
        const pvs:any[]=(p as any).variants||[]
        if(variantEnabled&&pvs.length>0&&it.variant_label){
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

  async function deleteOrder(o:Order){
    setConfirmModal({msg:'Захиалга устгах уу?', onOk: async()=>{
    setOpenDropdown(null)
    if(o.status==='pending'){
      for(const it of(o.order_items||[])){
        const p=products.find(x=>x.id===(it as any).product_id)
        if(p) await supabase.from('products').update({stock:p.stock+(it as any).quantity}).eq('id',p.id)
      }
    }
    await supabase.from('order_items').delete().eq('order_id',o.id)
    await supabase.from('orders').delete().eq('id',o.id)
    showFlash('Устгагдлаа');load()
    }})
  }

  function copyOrderInfo(o:Order){
    const text=`${o.phone} ${o.address}`
    navigator.clipboard.writeText(text).then(()=>showFlash('Хуулагдлаа ✓')).catch(()=>{})
  }

  const filtered=orders.filter(o=>{
    if(phoneFilter&&!o.phone.includes(phoneFilter)) return false
    if(statusFilter!=='all'&&o.status!==statusFilter) return false
    if(dateFilter&&o.date!==dateFilter) return false
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
            <h2 className="font-medium text-gray-800 text-sm">Шинэ захиалга</h2>
            {activeStoreId&&stores.length>0&&(
              <span className="hidden sm:inline text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                {stores.find(s=>s.id===activeStoreId)?.name}
              </span>
            )}
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
              {warehouses.length>0&&(<div><label className="block text-xs text-gray-500 mb-1">Агуулах</label>
                <select className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white" value={oWarehouse} onChange={e=>setOWarehouse(e.target.value)}>
                  <option value="">— Сонгох —</option>
                  {warehouses.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}
                </select></div>)}
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
                  {gross>0&&<span className="text-xs text-gray-400">{fmt(gross)}₮{Number(oDelv)>0?` − ${fmt(Number(oDelv))}₮ = `+fmt(net)+'₮':''}</span>}
                </div>
              </div>
              <div className="flex justify-end">
                <button onClick={submitOrder} className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700">Захиалга бүртгэх</button>
              </div>
            </div>
            {/* ── DESKTOP ONLY (анхны layout) ── */}
            <div className="hidden sm:block">
            <div className="grid grid-cols-3 gap-3">
              <div><label className="block text-xs text-gray-500 mb-1">Утасны дугаар</label>
                <input className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" placeholder="89639100" value={oPhone} onChange={e=>setOPhone(e.target.value)}/></div>
              <div><label className="block text-xs text-gray-500 mb-1">Огноо</label>
                <input type="date" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" value={oDate} onChange={e=>setODate(e.target.value)}/></div>
              <div><label className="block text-xs text-gray-500 mb-1">Хүргэлт (₮){defaultDelivery>0&&<span className="text-gray-400 ml-1 text-xs">({fmt(defaultDelivery)}₮)</span>}</label>
                <input type="number" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" value={oDelv} onChange={e=>setODelv(e.target.value)}/></div>
            </div>
            {/* Мөр 2: Хаяг | Бараа — ижил өндөр */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-stretch">
              <div className="flex flex-col">
                <label className="block text-xs text-gray-500 mb-1">Хаяг</label>
                <textarea
                  className="flex-1 w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none min-h-[80px]"
                  placeholder="Дүүрэг, хороо, байр..."
                  value={oAddr} onChange={e=>setOAddr(e.target.value)}/>
                {warehouses.length>0&&(
                  <div className="mt-2"><label className="block text-xs text-gray-500 mb-1">Агуулах</label>
                    <select className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white" value={oWarehouse} onChange={e=>setOWarehouse(e.target.value)}>
                      <option value="">— Сонгох —</option>
                      {warehouses.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}
                    </select></div>
                )}
              </div>
              <div className="flex flex-col">
                <label className="block text-xs text-gray-500 mb-1">Захиалсан бараанууд</label>
                <div className="border border-gray-100 rounded-lg p-3 bg-gray-50 space-y-2 flex-1">
                  <div className="grid grid-cols-[1fr_50px_80px_28px] gap-2 mb-1 px-1">
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
                      <div className="grid grid-cols-[1fr_50px_80px_28px] gap-2 items-center">
                        <select className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm bg-white" value={it.product_id} onChange={e=>setItem(idx,'product_id',e.target.value)}>
                          {products.map(p=><option key={p.id} value={p.id}>{p.name} ({p.stock}ш)</option>)}
                        </select>
                        <input type="number" className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm text-center" min="1" value={it.qty} onChange={e=>setItem(idx,'qty',e.target.value)} style={{minWidth:52}}/>
                        <input type="number" className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm" value={it.price} onChange={e=>setItem(idx,'price',e.target.value)} placeholder="0"/>
                        {oItems.length>1&&<button onClick={()=>removeItem(idx)} className="w-7 h-7 flex items-center justify-center bg-red-50 text-red-500 rounded-lg text-xs">✕</button>}
                      </div>
                      {variantEnabled&&variants.length>0&&(
                        <select className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs bg-white text-gray-600"
                          value={it.variant_label}
                          onChange={e=>{
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
                  {gross>0&&<span className="text-xs text-gray-400">
                    {fmt(gross)}₮{Number(oDelv)>0?` − ${fmt(Number(oDelv))}₮ = `+fmt(net)+'₮':''}
                  </span>}
                </div>
                <div className="flex justify-end mt-2">
                  <button onClick={submitOrder} className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700">Захиалга бүртгэх</button>
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
          <h2 className="font-medium text-gray-800 text-sm">Захиалгын бүртгэл</h2>
        </div>
        <div className="grid grid-cols-2 gap-2 px-3 py-3 border-b border-gray-100 bg-gray-50">
          <input className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white w-full" placeholder="Утасны дугаар..." value={phoneFilter} onChange={e=>setPhoneFilter(e.target.value)}/>
          <div className="relative w-full overflow-hidden rounded-lg border border-gray-200 bg-white flex items-center">
            <input type="date" className="w-full px-3 py-2 text-sm bg-white appearance-none" style={{WebkitAppearance:'none'}} value={dateFilter} onChange={e=>setDateFilter(e.target.value)}/>
            {!dateFilter&&<span className="absolute left-0 right-6 flex items-center px-3 text-sm text-gray-400 pointer-events-none bg-white h-full">Огноо...</span>}
            {dateFilter&&<button onClick={()=>setDateFilter('')} className="absolute right-2 text-gray-400 text-xs px-1">✕</button>}
          </div>
          {stores.length>0?(
            <select className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white w-full" value={storeFilter} onChange={e=>setStoreFilter(e.target.value)}>
              <option value="all">Бүх дэлгүүр</option>
              {stores.map(s=><option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
          ):<div/>}
          <select className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white w-full" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
            <option value="all">Бүх статус</option>
            <option value="pending">Хүлээгдэж байна</option>
            <option value="delivered">Хүргэгдсэн</option>
            <option value="cancelled">Цуцлагдсан</option>
          </select>
        </div>

        {Object.keys(groups).sort((a,b)=>b.localeCompare(a)).map(date=>{
          const grp=groups[date]
          const dayGross=grp.reduce((a,o)=>(o.order_items||[]).reduce((s:number,i:any)=>s+i.quantity*i.unit_price,a),0)
          const dayDelv=grp.reduce((a,o)=>a+(o.delivery_fee||0),0)
          const dayNet=dayGross-dayDelv
          return (
            <div key={date}>
              <div className="px-4 py-2 bg-gray-100 border-y border-gray-200 flex justify-between items-center">
                <span className="text-xs font-medium text-gray-700">{fmtD(date)}</span>
                <span className="text-xs text-gray-400 tabular-nums">{grp.length} захиалга &nbsp;·&nbsp; <span className="font-semibold text-emerald-700">{fmt(dayNet)}₮</span></span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse" style={{tableLayout:'fixed'}}>
                  <colgroup>
                    <col style={{width:'12%'}}/><!-- утас -->
                    <col style={{width:'32%'}}/><!-- хаяг - багасгав -->
                    <col style={{width:'22%'}}/><!-- бараа - нэмэв -->
                    <col style={{width:'4%'}}/><!-- тоо -->
                    <col style={{width:'16%'}}/><!-- дүн - нэмэв -->
                    <col style={{width:'14%'}}/><!-- төлөв -->
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
                    <tr key={o.id} className={`border-b border-gray-100 ${idx%2===1?'bg-gray-50/40':''}`}>
                      {/* Утас */}
                      <td className="py-2.5 pl-4 pr-2 align-middle whitespace-nowrap">
                        <button onClick={()=>copyOrderInfo(o)} className="text-sm font-semibold text-gray-800 hover:text-emerald-600">
                          {o.phone}
                        </button>
                        {showStore&&<div className="text-[10px] text-gray-400 mt-0.5">{storeName}</div>}
                      </td>
                      {/* Хаяг */}
                      <td className="py-2.5 px-2 align-middle text-xs text-gray-400 leading-relaxed">{o.address}</td>
                      {/* Бараа */}
                      <td className="py-2.5 pl-2 pr-0.5 align-middle">
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
                      {/* Төлөв + dropdown */}
                      <td className="py-2.5 pl-2 pr-4 align-middle text-right whitespace-nowrap">
                        {!isViewer?(
                          <div className="relative inline-block" ref={openDropdown===o.id?dropdownRef:null}>
                            <button onClick={()=>setOpenDropdown(openDropdown===o.id?null:o.id)}
                              className={`text-xs px-2.5 py-1 rounded-lg border flex items-center gap-1 whitespace-nowrap ${
                                isDelivered?'bg-emerald-50 text-emerald-600 border-emerald-200':
                                isCancelled?'bg-gray-100 text-gray-400 border-gray-200':
                                'bg-amber-50 text-amber-600 border-amber-200'
                              }`}>
                              {isDelivered?'Хүргэгдсэн':isCancelled?'Цуцлагдсан':'Хүлээгдэж байна'} ▾
                            </button>
                            {openDropdown===o.id&&(
                              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl z-30 min-w-[160px] overflow-hidden" style={{boxShadow:'0 4px 16px rgba(0,0,0,0.08)'}}>
                                {o.status!=='delivered'&&<button onClick={()=>{setOrderStatus(o.id,'delivered');setOpenDropdown(null)}} className="w-full text-left px-4 py-2.5 text-xs text-emerald-700 hover:bg-emerald-50">✓ Хүргэгдсэн</button>}
                                {o.status==='delivered'&&<button onClick={()=>{setOrderStatus(o.id,'pending');setOpenDropdown(null)}} className="w-full text-left px-4 py-2.5 text-xs text-amber-600 hover:bg-amber-50">↩ Хүлээгдэж байна</button>}
                                {o.status==='cancelled'&&<button onClick={()=>{setOrderStatus(o.id,'pending');setOpenDropdown(null)}} className="w-full text-left px-4 py-2.5 text-xs text-amber-600 hover:bg-amber-50">↩ Буцаах</button>}
                                {o.status!=='cancelled'&&<button onClick={()=>{setOrderStatus(o.id,'cancelled');setOpenDropdown(null)}} className="w-full text-left px-4 py-2.5 text-xs text-gray-500 hover:bg-gray-50">✕ Цуцлах</button>}
                                <div className="border-t border-gray-100"/>
                                <button onClick={()=>{setEditOrder(o);setEditPhone(o.phone);setEditAddr(o.address);setEditDate(o.date||TODAY);setEditStatus(o.status);setEditDelv(String(o.delivery_fee||''));setOpenDropdown(null)}} className="w-full text-left px-4 py-2.5 text-xs text-gray-600 hover:bg-gray-50">✏️ Засах</button>
                                <button onClick={()=>{deleteOrder(o);setOpenDropdown(null)}} className="w-full text-left px-4 py-2.5 text-xs text-red-500 hover:bg-red-50">🗑 Устгах</button>
                              </div>
                            )}
                          </div>
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
