'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useOwnerId, useActiveStore } from '../client-layout'

const TODAY = new Date().toISOString().slice(0,10)
const fmtD = (d) => { if(!d) return ''; const [,m,day]=d.split('-'); return m+'/'+day }

export default function ProcurementPage() {
  const ownerId = useOwnerId()
  const activeStoreId = useActiveStore()
  const [products, setProducts] = useState([])
  const [supply, setSupply] = useState([])
  const [restockLogs, setRestockLogs] = useState([])
  const [orders, setOrders] = useState([])
  const [flash, setFlash] = useState('')
  const [expanded, setExpanded] = useState(new Set())

  // 1. Агуулах цэнэглэлт
  const [rProd, setRProd] = useState('')
  const [rVariantIdx, setRVariantIdx] = useState(-1)
  const [rQty, setRQty] = useState('1')
  const [rDate, setRDate] = useState(TODAY)
  const [rNote, setRNote] = useState('')
  const [rSaving, setRSaving] = useState(false)

  // 2. Татан авалт
  const [procDate, setProcDate] = useState(TODAY)
  const [procShipping, setProcShipping] = useState('')
  const [procNote, setProcNote] = useState('')
  const [procItems, setProcItems] = useState([{productId:'',variant:'',qty:'',cost:'',received:''}])
  const [procSaving, setProcSaving] = useState(false)

  // 3. Шинэ бараа
  const [nName, setNName] = useState('')

  const showFlash = (m) => { setFlash(m); setTimeout(()=>setFlash(''),2500) }

  const load = useCallback(async () => {
    const { data:{ user } } = await supabase.auth.getUser()
    const uid = ownerId || user?.id
    if (!uid) return
    const sq = activeStoreId
      ? supabase.from('products').select('*').eq('user_id', uid).eq('store_id', activeStoreId)
      : supabase.from('products').select('*').eq('user_id', uid)
    const [{ data: prods }, { data: sup }, { data: rlogs }, { data: ords }] = await Promise.all([
      sq,
      supabase.from('supply_log').select('*').eq('user_id', uid).order('date',{ascending:false}),
      supabase.from('restock_log').select('*').eq('user_id', uid).eq('type','in').order('date',{ascending:false}),
      supabase.from('orders').select('*, order_items(*)').eq('user_id', uid).in('status',['pending','delivered']),
    ])
    setProducts(prods||[])
    setSupply(sup||[])
    setRestockLogs(rlogs||[])
    setOrders(ords||[])
    if (!rProd && prods && prods.length) setRProd(prods[0].id)
  }, [ownerId, activeStoreId, rProd])

  useEffect(()=>{ load() },[load])

  // 1. Агуулах цэнэглэлт
  async function addRestock() {
    const qty = Number(rQty)
    if (!qty || !rProd) return
    const { data:{ user } } = await supabase.auth.getUser()
    const uid = ownerId || user?.id
    if (!uid) return
    setRSaving(true)
    const p = products.find(x=>x.id===rProd)
    if (!p) { setRSaving(false); return }
    const pvs = p.variants || []
    let variantLabel = ''
    if (pvs.length && rVariantIdx >= 0) {
      const v = pvs[rVariantIdx]
      variantLabel = [v.size,v.color].filter(Boolean).join(' / ')
      const nv = pvs.map((vv,i)=>i===rVariantIdx?{...vv,stock:vv.stock+qty}:vv)
      const nt = nv.reduce((a,vv)=>a+vv.stock,0)
      await supabase.from('products').update({variants:nv,stock:nt}).eq('id',rProd)
    } else {
      await supabase.from('products').update({stock:p.stock+qty}).eq('id',rProd)
    }
    await supabase.from('restock_log').insert({
      user_id:uid, product_id:rProd,
      product_name:p.name+(variantLabel?' | '+variantLabel:''),
      variant_label:variantLabel||null,
      quantity:qty, type:'in', note:rNote||'Цэнэглэлт',
      date:rDate, store_id:activeStoreId||null
    })
    setRQty('1'); setRNote(''); setRVariantIdx(-1)
    setRSaving(false); showFlash(p.name+' +'+qty+'ш ✓'); load()
  }

  // 2. Татан авалт хадгалах
  async function saveProcurement() {
    const valid = procItems.filter(it=>it.productId&&it.qty)
    if (!valid.length) return
    const { data:{ user } } = await supabase.auth.getUser()
    const uid = ownerId || user?.id
    if (!uid) return
    setProcSaving(true)
    const totalQty = valid.reduce((a,it)=>a+(parseInt(it.qty)||0),0)
    const ship = parseInt(procShipping)||0
    const { data: ord } = await supabase.from('procurement_orders').insert({
      user_id:uid, store_id:activeStoreId||null,
      date:procDate, type:'ordered', shipping_cost:ship, note:procNote||null
    }).select().single()
    if (ord) {
      for (const it of valid) {
        const qty = parseInt(it.qty)||0
        const recv = parseInt(it.received)||0
        const shipPer = totalQty > 0 ? Math.round(ship*qty/totalQty) : 0
        const prod = products.find(p=>p.id===it.productId)
        await supabase.from('procurement_items').insert({
          order_id:ord.id, product_id:it.productId,
          product_name:prod?.name||'', variant_label:it.variant||null,
          quantity:qty, unit_cost:(parseInt(it.cost)||0)+shipPer
        })
        // Захиалсан бүртгэл
        await supabase.from('supply_log').insert({
          user_id:uid, store_id:activeStoreId||null,
          product_id:it.productId, product_name:prod?.name||'',
          variant_label:it.variant||null, type:'ordered',
          quantity:qty, date:procDate, note:procNote||null
        })
        // Хүлээн авсан бол тусдаа бүртгэнэ
        if (recv > 0) {
          await supabase.from('supply_log').insert({
            user_id:uid, store_id:activeStoreId||null,
            product_id:it.productId, product_name:prod?.name||'',
            variant_label:it.variant||null, type:'received',
            quantity:recv, date:procDate, note:'Хүлээн авсан'
          })
        }
      }
    }
    setProcItems([{productId:'',variant:'',qty:'',cost:'',received:''}])
    setProcShipping(''); setProcNote('')
    setProcSaving(false); showFlash('Татан авалт бүртгэгдлээ ✓'); load()
  }

  // 3. Шинэ бараа
  async function addProduct() {
    if (!nName.trim()) return
    const { data:{ user } } = await supabase.auth.getUser()
    const uid = ownerId || user?.id
    if (!uid) return
    await supabase.from('products').insert({
      user_id:uid, store_id:activeStoreId||null, name:nName.trim(), stock:0
    })
    setNName(''); showFlash(nName+' нэмэгдлээ ✓'); load()
  }

  // Хяналт тооцоо
  const rows = []
  for (const p of products) {
    const pvs = p.variants || []
    const vlist = pvs.length ? pvs.map(v=>[v.size,v.color].filter(Boolean).join(' / ')) : ['']
    for (const vl of vlist) {
      const ms = (s) => s.product_id===p.id && (vl ? s.variant_label===vl : !s.variant_label||s.variant_label==='')
      const ordered = supply.filter(s=>ms(s)&&s.type==='ordered').reduce((a,s)=>a+s.quantity,0)
      const received = supply.filter(s=>ms(s)&&s.type==='received').reduce((a,s)=>a+s.quantity,0)
      const restocked = restockLogs.filter(l=>{
        if(l.product_id!==p.id) return false
        const lv=l.variant_label||''
        return vl?lv===vl:lv===''
      }).reduce((a,l)=>a+l.quantity,0)
      const sold = orders.reduce((a,o)=>{
        return a+(o.order_items||[]).filter(it=>it.product_id===p.id&&(vl?it.variant_label===vl:!it.variant_label||it.variant_label==='')).reduce((b,it)=>b+it.quantity,0)
      },0)
      const stock = vl?(pvs.find(v=>[v.size,v.color].filter(Boolean).join(' / ')===vl)?.stock||0):p.stock||0
      const expected = Math.max(0, restocked-sold)
      const zoruu = stock-expected
      if (ordered||received||restocked||stock) {
        rows.push({id:p.id,label:p.name,variant:vl,ordered,received,restocked,sold,stock,zoruu})
      }
    }
  }

  const rProdData = products.find(p=>p.id===rProd)
  const rVariants = rProdData ? rProdData.variants||[] : []
  const totalShip = parseInt(procShipping)||0
  const totalQtyAll = procItems.reduce((a,it)=>a+(parseInt(it.qty)||0),0)

  const tLabel = {ordered:'Захиалсан',received:'Хүлээн авсан',restocked:'Цэнэглэсэн'}
  const tColor = {ordered:'text-blue-600 bg-blue-50',received:'text-emerald-700 bg-emerald-50',restocked:'text-orange-600 bg-orange-50'}

  return (
    <div className="space-y-4">
      {flash&&<div className="fixed top-4 right-4 bg-gray-900 text-white text-sm px-4 py-2 rounded-lg z-50">{flash}</div>}

      <div className="grid gap-4 items-start" style={{gridTemplateColumns:'2fr 3fr'}}>

        {/* ЗҮҮН */}
        <div className="space-y-3">

          {/* 1. Агуулах цэнэглэлт */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <h2 className="font-medium text-gray-800 text-sm mb-3">Агуулах цэнэглэлт</h2>
            <div className="grid gap-2 mb-2" style={{gridTemplateColumns:'2fr 60px 140px'}}>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Бараа</label>
                <select className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
                  value={rProd} onChange={e=>{setRProd(e.target.value);setRVariantIdx(-1)}}>
                  {products.map(p=><option key={p.id} value={p.id}>{p.name} ({p.stock}ш)</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Тоо</label>
                <input type="number" value={rQty} onChange={e=>setRQty(e.target.value)}
                  className="w-full px-2 py-2 rounded-lg border border-gray-200 text-sm text-center"/>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Огноо</label>
                <input type="date" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
                  value={rDate} onChange={e=>setRDate(e.target.value)}/>
              </div>
            </div>
            {rVariants.length>0&&(
              <div className="mb-2">
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
            <div className="flex gap-2">
              <input className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm"
                placeholder="Тэмдэглэл..." value={rNote} onChange={e=>setRNote(e.target.value)}/>
              <button onClick={addRestock} disabled={rSaving||!rProd||!rQty}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium disabled:opacity-40">
                {rSaving?'...':'Нэмэх'}
              </button>
            </div>
          </div>

          {/* 2. Татан авалт */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <h2 className="font-medium text-gray-800 text-sm mb-3">Бараа татан авалт</h2>

            {/* Header мөр */}
            <div className="grid gap-1.5 mb-1 text-xs text-gray-400"
              style={{gridTemplateColumns:'2fr 75px 70px 75px 70px 20px'}}>
              <div>Барааны нэр</div>
              <div className="text-right">Захиалсан</div>
              <div className="text-right">Өртөг/ш</div>
              <div className="text-right">Хүлээн авсан</div>
              <div className="text-right">Огноо</div>
              <div></div>
            </div>

            {/* Мөрүүд */}
            <div className="space-y-2 mb-3">
              {procItems.map((it,idx)=>{
                const prod=products.find(p=>p.id===it.productId)
                const pvs=prod?.variants||[]
                const shipPer = totalQtyAll>0&&it.qty ? Math.round(totalShip*(parseInt(it.qty)||0)/totalQtyAll) : 0
                return(
                  <div key={idx} className="mb-1">
                    <div className="grid gap-1.5 items-start"
                      style={{gridTemplateColumns:'2fr 75px 70px 75px 70px 20px'}}>
                      <div>
                        <select value={it.productId}
                          onChange={e=>setProcItems(prev=>prev.map((x,i)=>i===idx?{...x,productId:e.target.value,variant:''}:x))}
                          className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs bg-white">
                          <option value="">— Сонгох —</option>
                          {products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        {pvs.length>0&&(
                          <select value={it.variant}
                            onChange={e=>setProcItems(prev=>prev.map((x,i)=>i===idx?{...x,variant:e.target.value}:x))}
                            className="w-full mt-1 px-2 py-1.5 rounded-lg border border-gray-200 text-xs bg-white">
                            <option value="">— Variant —</option>
                            {pvs.map((v,vi)=><option key={vi} value={[v.size,v.color].filter(Boolean).join(' / ')}>{[v.size,v.color].filter(Boolean).join(' / ')}</option>)}
                          </select>
                        )}
                      </div>
                      <input type="number" placeholder="0" value={it.qty}
                        onChange={e=>setProcItems(prev=>prev.map((x,i)=>i===idx?{...x,qty:e.target.value}:x))}
                        className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs text-right"/>
                      <div className="text-right">
                        <input type="number" placeholder="0" value={it.cost}
                          onChange={e=>setProcItems(prev=>prev.map((x,i)=>i===idx?{...x,cost:e.target.value}:x))}
                          className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs text-right"/>
                        {shipPer>0&&<div className="text-xs text-orange-400 mt-0.5">+{shipPer.toLocaleString()}₮</div>}
                      </div>
                      <input type="number" placeholder="0" value={it.received}
                        onChange={e=>setProcItems(prev=>prev.map((x,i)=>i===idx?{...x,received:e.target.value}:x))}
                        className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs text-right bg-emerald-50"/>
                      <input type="date" value={procDate} onChange={e=>setProcDate(e.target.value)}
                        className="w-full px-1 py-1.5 rounded-lg border border-gray-200 text-xs"/>
                      <button onClick={()=>setProcItems(prev=>prev.filter((_,i)=>i!==idx))}
                        className="text-gray-300 hover:text-red-400 text-xs">✕</button>
                    </div>
                  </div>
                )
              })}
              <button onClick={()=>setProcItems(prev=>[...prev,{productId:'',variant:'',qty:'',cost:'',received:''}])}
                className="text-xs text-emerald-600 hover:underline">＋ Бараа нэмэх</button>
            </div>

            {/* Тээвэр + Тэмдэглэл + Хадгалах */}
            <div className="grid gap-2 items-end" style={{gridTemplateColumns:'1fr 1fr auto'}}>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Тээвэр (₮)</label>
                <input type="number" placeholder="0" value={procShipping}
                  onChange={e=>setProcShipping(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"/>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Тэмдэглэл</label>
                <input placeholder="..." value={procNote} onChange={e=>setProcNote(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"/>
              </div>
              <button onClick={saveProcurement}
                disabled={procSaving||!procItems.some(it=>it.productId&&it.qty)}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium disabled:opacity-40 whitespace-nowrap">
                {procSaving?'...':'Хадгалах'}
              </button>
            </div>
          </div>

          {/* 3. Шинэ бараа */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <h2 className="font-medium text-gray-800 text-sm mb-3">Шинэ бараа</h2>
            <div className="flex gap-2">
              <input className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm"
                placeholder="Барааны нэр" value={nName} onChange={e=>setNName(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&addProduct()}/>
              <button onClick={addProduct} disabled={!nName.trim()}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium disabled:opacity-40">Нэмэх</button>
            </div>
          </div>

        </div>{/* end left */}

        {/* БАРУУН — Барааны хөдөлгөөн */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-medium text-gray-800 text-sm">Барааны хөдөлгөөн</h2>
            {rows.some(r=>r.zoruu!==0)&&<span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full">⚠️ Зөрүү илэрсэн</span>}
          </div>
          <div className="grid text-xs text-gray-400 font-medium px-4 py-2 bg-gray-50 border-b border-gray-100"
            style={{gridTemplateColumns:'1.6fr 65px 75px 80px 65px 65px 65px 20px'}}>
            <div></div>
            <div className="text-right">Захиалсан</div>
            <div className="text-right">Хүлээн авсан</div>
            <div className="text-right">Цэнэглэсэн</div>
            <div className="text-right">Зарагдсан</div>
            <div className="text-right">Үлдэгдэл</div>
            <div className="text-right">Зөрүү</div>
            <div></div>
          </div>
          {rows.length===0?(
            <p className="text-center text-gray-400 text-sm py-10">Бүртгэл байхгүй</p>
          ):(
            <div className="divide-y divide-gray-100">
              {rows.map((r,i)=>{
                const ekey=r.id+r.variant
                const isExp=expanded.has(ekey)
                const det=[
                  ...supply.filter(s=>s.product_id===r.id&&(r.variant?s.variant_label===r.variant:!s.variant_label||s.variant_label==='')),
                  ...restockLogs.filter(l=>{
                    if(l.product_id!==r.id) return false
                    const lv=l.variant_label||''
                    return r.variant?lv===r.variant:lv===''
                  }).map(l=>({...l,type:'restocked'}))
                ].sort((a,b)=>b.date.localeCompare(a.date))
                return(
                  <div key={i} className={r.zoruu!==0?'bg-red-50/20':''}>
                    <div className="grid items-center px-4 py-2.5 hover:bg-gray-50/50 cursor-pointer"
                      style={{gridTemplateColumns:'1.6fr 65px 75px 80px 65px 65px 65px 20px'}}
                      onClick={()=>{const n=new Set(expanded);n.has(ekey)?n.delete(ekey):n.add(ekey);setExpanded(n)}}>
                      <div>
                        <span className="text-sm font-medium text-gray-700">{r.label}</span>
                        {r.variant&&<span className="text-xs text-gray-400 ml-1.5">{r.variant}</span>}
                      </div>
                      <div className="text-right text-xs font-medium text-blue-600">{r.ordered>0?r.ordered+'ш':'—'}</div>
                      <div className="text-right text-xs font-medium text-emerald-600">{r.received>0?r.received+'ш':'—'}</div>
                      <div className="text-right text-xs font-medium text-orange-500">{r.restocked>0?r.restocked+'ш':'—'}</div>
                      <div className="text-right text-xs text-gray-600">{r.sold>0?r.sold+'ш':'—'}</div>
                      <div className="text-right text-xs font-bold text-gray-800">{r.stock}ш</div>
                      <div className="text-right text-xs font-bold">
                        {r.zoruu===0?<span className="text-emerald-500">✓</span>:<span className={r.zoruu>0?'text-blue-500':'text-red-500'}>{r.zoruu>0?'+':''}{r.zoruu}ш</span>}
                      </div>
                      <div className="text-xs text-gray-300">{isExp?'▲':'▼'}</div>
                    </div>
                    {isExp&&(
                      <div className="border-t border-gray-100 bg-gray-50/30">
                        {det.map((d,j)=>(
                          <div key={j} className="flex items-center gap-3 px-6 py-2 border-b border-gray-100 last:border-0">
                            <span className="text-xs text-gray-400 w-10">{fmtD(d.date)}</span>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${tColor[d.type]||'text-gray-500 bg-gray-100'}`}>{tLabel[d.type]||d.type}</span>
                            <span className="text-xs font-bold text-gray-700">+{d.quantity}ш</span>
                            <span className="text-xs text-gray-400 italic flex-1">{d.note||''}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
