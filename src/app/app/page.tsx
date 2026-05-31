'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Product, Order } from '@/lib/types'

const TODAY = new Date().toISOString().slice(0,10)
function fmt(n: number) { return n.toLocaleString() }
function fmtD(d: string) {
  const [y,m,day]=d.split('-')
  const today=new Date().toISOString().slice(0,10)
  const yest=new Date(Date.now()-86400000).toISOString().slice(0,10)
  const label=`${y}/${m}/${day}`
  if(d===today) return `Өнөөдөр  ${label}`
  if(d===yest) return `Өчигдөр  ${label}`
  return label
}
function copyText(t:string,cb:()=>void){navigator.clipboard.writeText(t).then(cb).catch(()=>{})}

export default function DashPage() {
  const [products,setProducts]=useState<Product[]>([])
  const [orders,setOrders]=useState<Order[]>([])
  const [stores,setStores]=useState<any[]>([])
  const [warehouses,setWarehouses]=useState<any[]>([])
  const [flash,setFlash]=useState('')
  const [phoneFilter,setPhoneFilter]=useState('')
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
  const [oItems,setOItems]=useState([{product_id:'',product_name:'',qty:'1',price:''}])

  const showFlash=(m:string)=>{setFlash(m);setTimeout(()=>setFlash(''),2500)}

  const load=useCallback(async()=>{
    const{data:{user}}=await supabase.auth.getUser()
    if(!user) return
    const{data:prof}=await supabase.from('profiles').select('default_delivery_fee').eq('id',user.id).single()
    if(prof?.default_delivery_fee){
      setDefaultDelivery(prof.default_delivery_fee)
      setODelv(v=>(!v||v==='0')?String(prof.default_delivery_fee):v)
    }
    const[{data:prods},{data:ords},{data:sts},{data:whs}]=await Promise.all([
      supabase.from('products').select('*').eq('user_id',user.id).order('name'),
      supabase.from('orders').select('*, order_items(*)').eq('user_id',user.id).order('date',{ascending:false}).order('day_seq',{ascending:false}),
      supabase.from('stores').select('*').eq('user_id',user.id).order('created_at'),
      supabase.from('warehouses').select('*').eq('user_id',user.id).order('created_at'),
    ])
    setProducts(prods||[])
    setOrders(ords||[])
    setStores(sts||[])
    setWarehouses(whs||[])
    if(prods&&prods.length>0){
      setOItems(i=>i.map((it,idx)=>idx===0&&!it.product_id?{...it,product_id:prods[0].id,product_name:prods[0].name,price:String(prods[0].unit_price)}:it))
    }
  },[])

  useEffect(()=>{load()},[load])

  function addItem(){setOItems(i=>[...i,{product_id:products[0]?.id||'',product_name:products[0]?.name||'',qty:'1',price:String(products[0]?.unit_price||'')}])}
  function removeItem(idx:number){setOItems(i=>i.filter((_,j)=>j!==idx))}
  function setItem(idx:number,key:string,val:string){
    setOItems(items=>items.map((it,i)=>{
      if(i!==idx) return it
      if(key==='product_id'){const p=products.find(x=>x.id===val);return{...it,product_id:val,product_name:p?.name||'',price:String(p?.unit_price||'')}}
      return{...it,[key]:val}
    }))
  }

  const gross=oItems.reduce((a,i)=>a+(Number(i.qty)||0)*(Number(i.price)||0),0)
  const net=gross-(Number(oDelv)||0)

  async function submitOrder(){
    if(!oPhone||!oAddr){showFlash('Утас, хаяг оруулна уу');return}
    const{data:{user}}=await supabase.auth.getUser()
    for(const it of oItems){
      const p=products.find(x=>x.id===it.product_id)
      if(!p||p.stock<Number(it.qty)){showFlash((p?.name||'Бараа')+' хүрэлцэхгүй! '+( p?.stock||0));return}
    }
    const{data:seqData}=await supabase.rpc('get_day_seq',{p_user_id:user!.id,p_date:oDate||TODAY})
    const{data:order}=await supabase.from('orders').insert({
      user_id:user!.id,date:oDate||TODAY,day_seq:seqData||1,
      phone:oPhone,address:oAddr,delivery_fee:Number(oDelv)||0,status:'pending',
      store_id:oStore||null, warehouse_id:oWarehouse||null
    }).select().single()
    if(order){
      await supabase.from('order_items').insert(oItems.map(it=>({order_id:order.id,product_id:it.product_id,product_name:it.product_name,quantity:Number(it.qty),unit_price:Number(it.price)})))
      for(const it of oItems){
        const p=products.find(x=>x.id===it.product_id)!
        await supabase.from('products').update({stock:p.stock-Number(it.qty)}).eq('id',it.product_id)
        await supabase.from('restock_log').insert({user_id:user!.id,product_id:it.product_id,product_name:it.product_name,quantity:Number(it.qty),type:'out',note:'Захиалга',date:oDate||TODAY})
      }
    }
    setOPhone('');setOAddr('');setODelv(String(defaultDelivery))
    setOItems([{product_id:products[0]?.id||'',product_name:products[0]?.name||'',qty:'1',price:String(products[0]?.unit_price||'')}])
    showFlash('Захиалга бүртгэгдлээ ✓');load()
  }

  async function toggleStatus(id:string,cur:string){
    await supabase.from('orders').update({status:cur==='pending'?'delivered':'pending'}).eq('id',id)
    showFlash(cur==='pending'?'Хүргэгдсэн ✓':'Хүлээгдэж байна болгов');load()
  }

  async function saveEditOrder(){
    if(!editOrder) return
    await supabase.from('orders').update({phone:editPhone,address:editAddr,status:editStatus,delivery_fee:Number(editDelv)||0,date:editDate}).eq('id',editOrder.id)
    setEditOrder(null);showFlash('Засварлагдлаа ✓');load()
  }

  async function deleteOrder(o:Order){
    if(!confirm('Захиалга устгах уу?')) return
    if(o.status==='pending'){
      for(const it of(o.order_items||[])){
        const p=products.find(x=>x.id===(it as any).product_id)
        if(p) await supabase.from('products').update({stock:p.stock+(it as any).quantity}).eq('id',p.id)
      }
    }
    await supabase.from('order_items').delete().eq('order_id',o.id)
    await supabase.from('orders').delete().eq('id',o.id)
    showFlash('Устгагдлаа');load()
  }

  const filtered=orders.filter(o=>{
    if(phoneFilter&&!o.phone.includes(phoneFilter)) return false
    if(statusFilter!=='all'&&o.status!==statusFilter) return false
    if(dateFilter&&o.date!==dateFilter) return false
    return true
  })
  const groups:Record<string,Order[]>={}
  filtered.forEach(o=>{if(!groups[o.date])groups[o.date]=[];groups[o.date].push(o)})
  const totalStock=products.reduce((a,p)=>a+p.stock,0)
  const pending=orders.filter(o=>o.status==='pending').length

  return (
    <div className="space-y-5">
      {flash&&<div className="fixed top-4 right-4 bg-emerald-700 text-white text-sm px-4 py-2 rounded-lg shadow-lg z-50">{flash}</div>}

      {editOrder&&(
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="font-semibold text-gray-800 mb-4">Захиалга засварлах</h3>
            <div className="space-y-3">
              <div><label className="block text-xs text-gray-500 mb-1">Огноо</label>
                <input type="date" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" value={editDate} onChange={e=>setEditDate(e.target.value)} /></div>
              <div><label className="block text-xs text-gray-500 mb-1">Утас</label>
                <input className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" value={editPhone} onChange={e=>setEditPhone(e.target.value)} /></div>
              <div><label className="block text-xs text-gray-500 mb-1">Хаяг</label>
                <input className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" value={editAddr} onChange={e=>setEditAddr(e.target.value)} /></div>
              <div><label className="block text-xs text-gray-500 mb-1">Хүргэлт (₮)</label>
                <input type="number" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" value={editDelv} onChange={e=>setEditDelv(e.target.value)} /></div>
              <div><label className="block text-xs text-gray-500 mb-1">Статус</label>
                <select className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" value={editStatus} onChange={e=>setEditStatus(e.target.value)}>
                  <option value="pending">Хүлээгдэж байна</option>
                  <option value="delivered">Хүргэгдсэн</option>
                  <option value="cancelled">Цуцлагдсан</option>
                </select></div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={()=>setEditOrder(null)} className="flex-1 py-2 rounded-xl border border-gray-200 text-sm">Болих</button>
              <button onClick={saveEditOrder} className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold">Хадгалах</button>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[['Нийт үлдэгдэл',String(totalStock),'text-emerald-700'],['Хүлээгдэж байна',String(pending),'text-amber-600'],['Нийт захиалга',String(orders.length),'text-gray-700']].map(([l,v,c])=>(
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
          <div><label className="block text-xs text-gray-500 mb-1">Огноо</label>
            <input type="date" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" value={oDate} onChange={e=>setODate(e.target.value)} /></div>
          <div><label className="block text-xs text-gray-500 mb-1">Утасны дугаар</label>
            <input className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" placeholder="89639100" value={oPhone} onChange={e=>setOPhone(e.target.value)} /></div>
        </div>
        <label className="block text-xs text-gray-500 mb-1 mt-3">Хаяг</label>
        <input className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" placeholder="Дүүрэг, хороо, байр..." value={oAddr} onChange={e=>setOAddr(e.target.value)} />

        {/* Store & Warehouse selectors — зөвхөн байгаа үед */}
        {(stores.length>0||warehouses.length>0)&&(
          <div className="grid grid-cols-2 gap-3 mt-3">
            {stores.length>0&&(
              <div><label className="block text-xs text-gray-500 mb-1">Дэлгүүр</label>
                <select className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" value={oStore} onChange={e=>setOStore(e.target.value)}>
                  <option value="">— Сонгох —</option>
                  {stores.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                </select></div>
            )}
            {warehouses.length>0&&(
              <div><label className="block text-xs text-gray-500 mb-1">Агуулах</label>
                <select className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" value={oWarehouse} onChange={e=>setOWarehouse(e.target.value)}>
                  <option value="">— Сонгох —</option>
                  {warehouses.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}
                </select></div>
            )}
          </div>
        )}

        <label className="block text-xs text-gray-500 mb-1 mt-3">Захиалсан бараанууд</label>
        <div className="border border-gray-100 rounded-lg p-3 bg-gray-50 space-y-2 mb-2">
          {oItems.map((it,idx)=>(
            <div key={idx} className="grid grid-cols-[1fr_70px_100px_32px] gap-2 items-center">
              <select className="w-full px-2 py-2 rounded-lg border border-gray-200 text-sm" value={it.product_id} onChange={e=>setItem(idx,'product_id',e.target.value)}>
                {products.map(p=><option key={p.id} value={p.id}>{p.name} ({p.stock}ш)</option>)}
              </select>
              <input type="number" className="w-full px-2 py-2 rounded-lg border border-gray-200 text-sm text-center" min="1" value={it.qty} onChange={e=>setItem(idx,'qty',e.target.value)} />
              <input type="number" className="w-full px-2 py-2 rounded-lg border border-gray-200 text-sm" value={it.price} onChange={e=>setItem(idx,'price',e.target.value)} placeholder="Үнэ" />
              {oItems.length>1&&<button onClick={()=>removeItem(idx)} className="w-8 h-8 flex items-center justify-center bg-red-50 text-red-500 rounded-lg text-xs">✕</button>}
            </div>
          ))}
        </div>
        <button onClick={addItem} className="text-xs text-emerald-600 hover:underline mb-3">＋ Бараа нэмэх</button>
        <div className="max-w-xs">
          <label className="block text-xs text-gray-500 mb-1">Хүргэлтийн үнэ (₮){defaultDelivery>0&&<span className="text-gray-400 ml-1">— өгөгдмөл: {fmt(defaultDelivery)}₮</span>}</label>
          <input type="number" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" value={oDelv} onChange={e=>setODelv(e.target.value)} />
        </div>
        {gross>0&&<div className="mt-2 text-sm font-medium text-emerald-700">
          Нийт: {fmt(gross)}₮{Number(oDelv)>0?` − ${fmt(Number(oDelv))}₮ = ${fmt(net)}₮ цэвэр`:''}
        </div>}
        <div className="flex justify-end mt-4">
          <button onClick={submitOrder} className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700">✓ Захиалга бүртгэх</button>
        </div>
      </div>

      {/* Orders */}
      <div className="card">
        <h2 className="font-semibold text-gray-800 mb-3 text-base">📋 Захиалгын бүртгэл</h2>
        <div className="flex gap-2 mb-4 flex-wrap">
          <input className="px-3 py-2 rounded-lg border border-gray-200 text-sm flex-1" style={{minWidth:120,maxWidth:160}} placeholder="Утасны дугаар..." value={phoneFilter} onChange={e=>setPhoneFilter(e.target.value)} />
          <input type="date" className="px-3 py-2 rounded-lg border border-gray-200 text-sm" value={dateFilter} onChange={e=>setDateFilter(e.target.value)} />
          {dateFilter&&<button onClick={()=>setDateFilter('')} className="px-2 py-2 rounded-lg border border-gray-200 text-xs text-gray-500">✕</button>}
          <select className="px-3 py-2 rounded-lg border border-gray-200 text-sm" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
            <option value="all">Бүх статус</option>
            <option value="pending">Хүлээгдэж байна</option>
            <option value="delivered">Хүргэгдсэн</option>
          </select>
        </div>

        {Object.keys(groups).sort((a,b)=>b.localeCompare(a)).map(date=>{
          const grp=groups[date]
          const dayGross=grp.reduce((a,o)=>(o.order_items||[]).reduce((s:number,i:any)=>s+i.quantity*i.unit_price,a),0)
          const dayDelv=grp.reduce((a,o)=>a+(o.delivery_fee||0),0)
          const dayNet=dayGross-dayDelv
          return (
            <div key={date} className="mb-5">
              <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 mb-2 flex justify-between items-center flex-wrap gap-2">
                <span className="text-sm font-bold text-gray-700">{fmtD(date)}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400">{grp.length} захиалга</span>
                  <span className="text-sm font-semibold text-emerald-700">{fmt(dayNet)}₮</span>
                  {dayDelv>0&&<span className="text-xs text-gray-400">−{fmt(dayDelv)}₮ хүрг</span>}
                </div>
              </div>
              <div className="space-y-1.5">
                {grp.map(o=>{
                  const gross=(o.order_items||[]).reduce((a:number,i:any)=>a+i.quantity*i.unit_price,0)
                  const net=gross-(o.delivery_fee||0)
                  const itemsStr=(o.order_items||[]).map((i:any)=>`${i.product_name}×${i.quantity}`).join(', ')
                  const storeName=stores.find(s=>s.id===(o as any).store_id)?.name
                  return (
                    <div key={o.id} className={`rounded-xl border px-3.5 py-3 ${o.status==='delivered'?'border-emerald-100 bg-emerald-50/30':'border-gray-100 bg-white'}`}>
                      <div className="flex items-center gap-2 flex-wrap text-sm">
                        <button onClick={()=>copyText(o.phone,()=>showFlash('Утас хуулагдлаа ✓'))}
                          className="font-semibold text-gray-800 hover:text-emerald-600 whitespace-nowrap">{o.phone}</button>
                        {storeName&&<span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{storeName}</span>}
                        <span className="text-gray-300">·</span>
                        <button onClick={()=>copyText(o.address,()=>showFlash('Хаяг хуулагдлаа ✓'))}
                          className="text-xs text-gray-500 hover:text-emerald-600 max-w-[140px] truncate">{o.address}</button>
                        <span className="text-gray-300">·</span>
                        <span className="text-xs text-gray-500">{itemsStr}</span>
                        <span className="text-gray-300">·</span>
                        <span className="text-xs text-gray-500">
                          {fmt(gross)}₮{o.delivery_fee>0&&<span className="text-gray-400"> −{fmt(o.delivery_fee)}₮</span>}
                          {' = '}<span className="font-semibold text-emerald-700">{fmt(net)}₮</span>
                        </span>
                        <button onClick={()=>{setEditOrder(o);setEditPhone(o.phone);setEditAddr(o.address);setEditDate(o.date||TODAY);setEditStatus(o.status);setEditDelv(String(o.delivery_fee||''))}}
                          className="text-xs text-blue-400 hover:text-blue-600 px-1.5 py-0.5 rounded hover:bg-blue-50">Засах</button>
                        <button onClick={()=>deleteOrder(o)} className="text-xs text-red-300 hover:text-red-500 px-1 py-0.5 rounded hover:bg-red-50">🗑</button>
                        <button onClick={()=>toggleStatus(o.id,o.status)}
                          className={`text-xs px-2.5 py-1 rounded-full font-medium border transition-all whitespace-nowrap ${o.status==='delivered'?'bg-emerald-100 text-emerald-700 border-emerald-200':'bg-gray-100 text-gray-500 border-gray-200'}`}>
                          {o.status==='delivered'?'✓ Хүргэгдсэн':'○ Хүлээгдэж байна'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
        {filtered.length===0&&<p className="text-center text-gray-400 text-sm py-8">Захиалга олдсонгүй</p>}
      </div>
    </div>
  )
}
