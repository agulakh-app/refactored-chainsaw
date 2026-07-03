'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { deleteRestockLogWithStock } from '@/lib/stockMovement'
import { useOwnerId, useActiveStore, useGuestRole } from '../client-layout'

const TODAY = new Date().toISOString().slice(0,10)
const fmtD = (d) => { if(!d) return ''; const [,m,day]=d.split('-'); return m+'/'+day }

export default function ProcurementSection() {
  const ownerId = useOwnerId()
  const activeStoreId = useActiveStore()
  const guestRole = useGuestRole()
  const isViewer = guestRole === 'viewer'
  const [products, setProducts] = useState([])
  const [supply, setSupply] = useState([])
  const [restockLogs, setRestockLogs] = useState([])
  const [orders, setOrders] = useState([])
  const [flash, setFlash] = useState('')
  const [expanded, setExpanded] = useState(new Set())
  const [confirmModal, setConfirmModal] = useState(null)

  // Татан авалт форм
  const [procDate, setProcDate] = useState(TODAY)
  const [procShipping, setProcShipping] = useState('')
  const [procNote, setProcNote] = useState('')
  const [procItems, setProcItems] = useState([{productId:'',variant:'',qty:'',cost:'',received:''}])
  const [procSaving, setProcSaving] = useState(false)

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
  }, [ownerId, activeStoreId])

  useEffect(()=>{ load() },[load])

  // Татан авалт хадгалах
  async function saveProcurement() {
    const valid = procItems.filter(it=>it.productId&&it.qty)
    if (!valid.length) return
    // Variant-тай бараанд variant заавал сонгуулна — үгүй бол хяналтын
    // хүснэгтэд харагдахгүй "ghost" бүртгэл үүсдэг
    for (const it of valid) {
      const prod = products.find(p=>p.id===it.productId)
      if ((prod?.variants||[]).length > 0 && !it.variant) {
        showFlash((prod?.name||'Бараа')+' — variant сонгоно уу!'); return
      }
    }
    const { data:{ user } } = await supabase.auth.getUser()
    const uid = ownerId || user?.id
    if (!uid) return
    setProcSaving(true)
    const totalQty = valid.reduce((a,it)=>a+(parseInt(it.qty)||0),0)
    const ship = parseInt(procShipping)||0
    // Хяналтын хүснэгтийн үндсэн эх сурвалж — supply_log-д заавал бичнэ
    let ok = true
    for (const it of valid) {
      const qty = parseInt(it.qty)||0
      const recv = parseInt(it.received)||0
      const prod = products.find(p=>p.id===it.productId)
      const { error: e1 } = await supabase.from('supply_log').insert({
        user_id:uid, store_id:activeStoreId||null,
        product_id:it.productId, product_name:prod?.name||'',
        variant_label:it.variant||null, type:'ordered',
        quantity:qty, date:procDate, note:procNote||null
      })
      if (e1) ok = false
      if (recv > 0) {
        const { error: e2 } = await supabase.from('supply_log').insert({
          user_id:uid, store_id:activeStoreId||null,
          product_id:it.productId, product_name:prod?.name||'',
          variant_label:it.variant||null, type:'received',
          quantity:recv, date:procDate, note:'Хүлээн авсан'
        })
        if (e2) ok = false
      }
    }
    // Татан авалтын захиалгын толгой/мөр — нэмэлт бүртгэл (боломжтой бол)
    const { data: ord } = await supabase.from('procurement_orders').insert({
      user_id:uid, store_id:activeStoreId||null,
      date:procDate, type:'ordered', shipping_cost:ship, note:procNote||null
    }).select().single()
    if (ord) {
      for (const it of valid) {
        const qty = parseInt(it.qty)||0
        const shipPer = totalQty > 0 ? Math.round(ship*qty/totalQty) : 0
        const prod = products.find(p=>p.id===it.productId)
        await supabase.from('procurement_items').insert({
          order_id:ord.id, product_id:it.productId,
          product_name:prod?.name||'', variant_label:it.variant||null,
          quantity:qty, unit_cost:(parseInt(it.cost)||0)+shipPer
        })
      }
    }
    setProcItems([{productId:'',variant:'',qty:'',cost:'',received:''}])
    setProcShipping(''); setProcNote('')
    setProcSaving(false)
    showFlash(ok?'Татан авалт бүртгэгдлээ ✓':'Зарим бүртгэл хадгалагдсангүй — дахин шалгана уу')
    load()
  }

  // Хөдөлгөөний нэг бүртгэл устгах — stock-той уялдаатай
  function askDeleteDetail(d) {
    setConfirmModal({
      msg: d.src==='restock'
        ? 'Энэ цэнэглэлтийн бүртгэлийг устгах уу? Барааны үлдэгдэл мөн тохирч буурна.'
        : 'Энэ бүртгэлийг устгах уу?',
      onOk: async()=>{
        if (d.src==='supply') await supabase.from('supply_log').delete().eq('id', d.id)
        else await deleteRestockLogWithStock(d.raw)
        showFlash('Устгагдлаа ✓'); load()
      }
    })
  }

  // Хяналт тооцоо
  const rows = []
  for (const p of products) {
    const pvs = p.variants || []
    const vlist = pvs.length ? pvs.map(v=>[v.size,v.color].filter(Boolean).join(' / ')) : ['']
    // Variant-тай бараанд хуучин variant-гүй бүртгэл байвал тусад нь харуулж
    // устгах боломж олгоно (өмнө нь хаана ч харагддаггүй байсан)
    if (pvs.length) {
      const hasLegacy =
        supply.some(s=>s.product_id===p.id&&(!s.variant_label||s.variant_label==='')) ||
        restockLogs.some(l=>l.product_id===p.id&&!(l.variant_label||''))
      if (hasLegacy) vlist.push('')
    }
    for (const vl of vlist) {
      const isLegacy = pvs.length>0 && vl===''
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
      const stock = isLegacy ? 0 : (vl?(pvs.find(v=>[v.size,v.color].filter(Boolean).join(' / ')===vl)?.stock||0):p.stock||0)
      const expected = Math.max(0, restocked-sold)
      const zoruu = isLegacy ? 0 : stock-expected
      // Зөвхөн бодит хөдөлгөөнтэй мөрийг харуулна — бүртгэл бүрэн устгагдвал
      // мөр мөн арилна (өмнө нь stock>0 бол хоосон мөр үлддэг байсан)
      if (ordered||received||restocked||sold) {
        rows.push({id:p.id,label:p.name,variant:vl,isLegacy,ordered,received,restocked,sold,stock,zoruu})
      }
    }
  }

  const totalShip = parseInt(procShipping)||0
  const totalQtyAll = procItems.reduce((a,it)=>a+(parseInt(it.qty)||0),0)

  const tLabel = {ordered:'Захиалсан',received:'Хүлээн авсан',restocked:'Цэнэглэсэн'}
  const tColor = {ordered:'text-blue-600 bg-blue-50',received:'text-emerald-700 bg-emerald-50',restocked:'text-orange-600 bg-orange-50'}

  return (
    <div className="space-y-4">
      {flash&&<div className="fixed top-4 right-4 bg-gray-900 text-white text-sm px-4 py-2 rounded-lg z-50">{flash}</div>}

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

      <div className="grid gap-4 items-start" style={{gridTemplateColumns:'2fr 3fr'}}>

        {/* ЗҮҮН — Бараа татан авалт */}
        <div className="space-y-3">
          {!isViewer&&(
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

            {/* Мөрүүд — variant байвал Барааны нэр богиносож variant нэг мөрөнд сууна */}
            <div className="space-y-2 mb-3">
              {procItems.map((it,idx)=>{
                const prod=products.find(p=>p.id===it.productId)
                const pvs=prod?.variants||[]
                const shipPer = totalQtyAll>0&&it.qty ? Math.round(totalShip*(parseInt(it.qty)||0)/totalQtyAll) : 0
                return(
                  <div key={idx} className="grid gap-1.5 items-center"
                    style={{gridTemplateColumns:'2fr 75px 70px 75px 70px 20px'}}>
                    {pvs.length>0 ? (
                      <div className="grid grid-cols-2 gap-1.5">
                        <select value={it.productId}
                          onChange={e=>setProcItems(prev=>prev.map((x,i)=>i===idx?{...x,productId:e.target.value,variant:''}:x))}
                          className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs bg-white">
                          <option value="">— Сонгох —</option>
                          {products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        <select value={it.variant}
                          onChange={e=>setProcItems(prev=>prev.map((x,i)=>i===idx?{...x,variant:e.target.value}:x))}
                          className="w-full px-2 py-1.5 rounded-lg border border-gray-200 bg-white text-xs">
                          <option value="">— Variant —</option>
                          {pvs.map((v,vi)=><option key={vi} value={[v.size,v.color].filter(Boolean).join(' / ')}>{[v.size,v.color].filter(Boolean).join(' / ')}</option>)}
                        </select>
                      </div>
                    ) : (
                      <select value={it.productId}
                        onChange={e=>setProcItems(prev=>prev.map((x,i)=>i===idx?{...x,productId:e.target.value,variant:''}:x))}
                        className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs bg-white">
                        <option value="">— Сонгох —</option>
                        {products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    )}
                    <input type="number" placeholder="0" value={it.qty}
                      onChange={e=>setProcItems(prev=>prev.map((x,i)=>i===idx?{...x,qty:e.target.value}:x))}
                      className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs text-right"/>
                    <div>
                      <input type="number" placeholder="0" value={it.cost}
                        onChange={e=>setProcItems(prev=>prev.map((x,i)=>i===idx?{...x,cost:e.target.value}:x))}
                        className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs text-right"/>
                      {shipPer>0&&<div className="text-xs text-orange-400 mt-0.5 text-right">+{shipPer.toLocaleString()}₮</div>}
                    </div>
                    <input type="number" placeholder="0" value={it.received}
                      onChange={e=>setProcItems(prev=>prev.map((x,i)=>i===idx?{...x,received:e.target.value}:x))}
                      className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs text-right bg-emerald-50"/>
                    <input type="date" value={procDate} onChange={e=>setProcDate(e.target.value)}
                      className="w-full px-1 py-1.5 rounded-lg border border-gray-200 text-xs"/>
                    <button onClick={()=>setProcItems(prev=>prev.filter((_,i)=>i!==idx))}
                      className="text-gray-300 hover:text-red-400 text-xs">✕</button>
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
          )}
        </div>

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
                  ...supply.filter(s=>s.product_id===r.id&&(r.variant?s.variant_label===r.variant:!s.variant_label||s.variant_label==='')).map(s=>({id:s.id,date:s.date,type:s.type,quantity:s.quantity,note:s.note,src:'supply',raw:s})),
                  ...restockLogs.filter(l=>{
                    if(l.product_id!==r.id) return false
                    const lv=l.variant_label||''
                    return r.variant?lv===r.variant:lv===''
                  }).map(l=>({id:l.id,date:l.date,type:'restocked',quantity:l.quantity,note:l.note,src:'restock',raw:l}))
                ].sort((a,b)=>b.date.localeCompare(a.date))
                return(
                  <div key={i} className={r.zoruu!==0?'bg-red-50/20':''}>
                    <div className="grid items-center px-4 py-2.5 hover:bg-gray-50/50 cursor-pointer"
                      style={{gridTemplateColumns:'1.6fr 65px 75px 80px 65px 65px 65px 20px'}}
                      onClick={()=>{const n=new Set(expanded);n.has(ekey)?n.delete(ekey):n.add(ekey);setExpanded(n)}}>
                      <div>
                        <span className="text-sm font-medium text-gray-700">{r.label}</span>
                        {r.variant&&<span className="text-xs text-gray-400 ml-1.5">{r.variant}</span>}
                        {r.isLegacy&&<span className="text-xs text-amber-500 ml-1.5">(variant-гүй бүртгэл)</span>}
                      </div>
                      <div className="text-right text-xs font-medium text-blue-600">{r.ordered>0?r.ordered+'ш':'—'}</div>
                      <div className="text-right text-xs font-medium text-emerald-600">{r.received>0?r.received+'ш':'—'}</div>
                      <div className="text-right text-xs font-medium text-orange-500">{r.restocked>0?r.restocked+'ш':'—'}</div>
                      <div className="text-right text-xs text-gray-600">{r.sold>0?r.sold+'ш':'—'}</div>
                      <div className="text-right text-xs font-bold text-gray-800">{r.isLegacy?'—':r.stock+'ш'}</div>
                      <div className="text-right text-xs font-bold">
                        {r.isLegacy?<span className="text-gray-300">—</span>:r.zoruu===0?<span className="text-emerald-500">✓</span>:<span className={r.zoruu>0?'text-blue-500':'text-red-500'}>{r.zoruu>0?'+':''}{r.zoruu}ш</span>}
                      </div>
                      <div className="text-xs text-gray-300">{isExp?'▲':'▼'}</div>
                    </div>
                    {isExp&&(
                      <div className="border-t border-gray-100 bg-gray-50/30">
                        {det.map((d,j)=>(
                          <div key={j} className="flex items-center gap-3 px-6 py-2 border-b border-gray-100 last:border-0">
                            <span className="text-xs text-gray-400 w-10 flex-shrink-0">{fmtD(d.date)}</span>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${tColor[d.type]||'text-gray-500 bg-gray-100'}`}>{tLabel[d.type]||d.type}</span>
                            <span className="text-xs font-bold text-gray-700 flex-shrink-0">+{d.quantity}ш</span>
                            <span className="text-xs text-gray-400 italic flex-1">{d.note||''}</span>
                            {!isViewer&&(
                              <button onClick={(e)=>{e.stopPropagation();askDeleteDetail(d)}}
                                className="text-gray-300 hover:text-red-400 text-xs flex-shrink-0">✕</button>
                            )}
                          </div>
                        ))}
                        {det.length===0&&<p className="text-xs text-gray-400 px-6 py-2">Дэлгэрэнгүй бүртгэл алга</p>}
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
