'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useOwnerId, useActiveStore } from '../client-layout'

const TODAY = new Date().toISOString().slice(0,10)

export default function ProcurementPage() {
  const ownerId = useOwnerId()
  const activeStoreId = useActiveStore()
  const [products, setProducts] = useState([])
  const [supply, setSupply] = useState([])
  const [restockLogs, setRestockLogs] = useState([])
  const [flash, setFlash] = useState('')
  const [expanded, setExpanded] = useState(new Set())
  const [procDate, setProcDate] = useState(TODAY)
  const [procType, setProcType] = useState('ordered')
  const [procShipping, setProcShipping] = useState('')
  const [procNote, setProcNote] = useState('')
  const [procItems, setProcItems] = useState([{productId:'',variant:'',qty:'',cost:''}])
  const [saving, setSaving] = useState(false)
  const [orders, setOrders] = useState([])

  const showFlash = (m) => { setFlash(m); setTimeout(()=>setFlash(''),2500) }

  const load = useCallback(async () => {
    const { data:{ user } } = await supabase.auth.getUser()
    const uid = ownerId || user?.id
    if (!uid) return
    const [{ data: prods }, { data: sup }, { data: rlogs }, { data: ords }] = await Promise.all([
      supabase.from('products').select('*').eq('user_id', uid),
      supabase.from('supply_log').select('*').eq('user_id', uid).order('date', {ascending:false}),
      supabase.from('restock_log').select('*').eq('user_id', uid).eq('type','in').order('date',{ascending:false}),
      supabase.from('orders').select('*, order_items(*)').eq('user_id', uid).in('status',['pending','delivered']),
    ])
    setProducts(prods||[])
    setSupply(sup||[])
    setRestockLogs(rlogs||[])
    setOrders(ords||[])
  }, [ownerId, activeStoreId])

  useEffect(()=>{ load() },[load])

  async function save() {
    const valid = procItems.filter(it=>it.productId&&it.qty)
    if (!valid.length) return
    const { data:{ user } } = await supabase.auth.getUser()
    const uid = ownerId || user?.id
    if (!uid) return
    setSaving(true)
    const totalQty = valid.reduce((a,it)=>a+(parseInt(it.qty)||0),0)
    const ship = parseInt(procShipping)||0
    const { data: ord } = await supabase.from('procurement_orders').insert({
      user_id:uid, store_id:activeStoreId||null,
      date:procDate, type:procType, shipping_cost:ship, note:procNote||null
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
        await supabase.from('supply_log').insert({
          user_id:uid, store_id:activeStoreId||null,
          product_id:it.productId, product_name:prod?.name||'',
          variant_label:it.variant||null, type:procType,
          quantity:qty, date:procDate, note:procNote||null
        })
      }
    }
    setProcItems([{productId:'',variant:'',qty:'',cost:''}])
    setProcShipping(''); setProcNote('')
    setSaving(false); showFlash('Хадгалагдлаа ✓'); load()
  }

  function getSummary(pid, vl) {
    const ms = (s) => s.product_id===pid && (vl ? s.variant_label===vl : !s.variant_label||s.variant_label==='')
    const ml = (l) => l.product_id===pid && (vl ? l.variant_label===vl : !l.variant_label||l.variant_label==='')
    const ordered = supply.filter(s=>ms(s)&&s.type==='ordered').reduce((a,s)=>a+s.quantity,0)
    const received = supply.filter(s=>ms(s)&&s.type==='received').reduce((a,s)=>a+s.quantity,0)
    const fromSupply = supply.filter(s=>ms(s)&&s.type==='restocked').reduce((a,s)=>a+s.quantity,0)
    const fromRestock = restockLogs.filter(l=>{
      if (l.product_id !== pid) return false
      const lv = l.variant_label || ''
      return vl ? lv === vl : lv === ''
    }).reduce((a,l)=>a+l.quantity,0)
    const restocked = fromSupply + fromRestock
    const sold = orders.reduce((a,o)=>{
      return a+(o.order_items||[]).filter(it=>it.product_id===pid&&(vl?it.variant_label===vl:!it.variant_label||it.variant_label==='')).reduce((b,it)=>b+it.quantity,0)
    },0)
    const prod = products.find(p=>p.id===pid)
    const stock = vl ? (prod?.variants||[]).find(v=>[v.size,v.color].filter(Boolean).join(' / ')===vl)?.stock||0 : prod?.stock||0
    return {ordered, received, restocked, sold, stock}
  }

  const rows = []
  for (const p of products) {
    const pvs = p.variants||[]
    if (pvs.length) {
      for (const v of pvs) {
        const vl = [v.size,v.color].filter(Boolean).join(' / ')
        const s = getSummary(p.id, vl)
      if (s.ordered||s.received||s.restocked||s.stock) rows.push({id:p.id,label:p.name,variant:vl,...s})
      }
    } else {
      const s = getSummary(p.id, '')
      if (s.ordered||s.received||s.restocked||s.stock) rows.push({id:p.id,label:p.name,variant:'',...s})
    }
  }

  const fmtD = (d) => { if(!d)return''; const[,m,day]=d.split('-'); return m+'/'+day }
  const tLabel = {ordered:'Захиалсан',received:'Ирсэн',restocked:'Цэнэглэсэн'}
  const tColor = {ordered:'text-blue-600 bg-blue-50',received:'text-emerald-700 bg-emerald-50',restocked:'text-orange-600 bg-orange-50'}

  return (
    <div className="space-y-4">
      {flash&&<div className="fixed top-4 right-4 bg-gray-900 text-white text-sm px-4 py-2 rounded-lg z-50">{flash}</div>}

      <div className="grid gap-4 items-start" style={{gridTemplateColumns:'2fr 3fr'}}>
        {/* Зүүн: Бүртгэх форм */}
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <h2 className="font-medium text-gray-800 text-sm mb-3">Бараа татан авалт</h2>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Төрөл</label>
              <select value={procType} onChange={e=>setProcType(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white">
                <option value="ordered">Захиалсан</option>
                <option value="received">Ирсэн / Хүлээн авсан</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Огноо</label>
              <input type="date" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                value={procDate} onChange={e=>setProcDate(e.target.value)}/>
            </div>
          </div>

          <div className="space-y-2 mb-3">
            {procItems.map((it,idx)=>{
              const prod=products.find(p=>p.id===it.productId)
              const pvs=prod?.variants||[]
              return(
                <div key={idx} className="grid gap-1.5 items-start" style={{gridTemplateColumns:'2fr 1.2fr 55px 55px 20px'}}>
                  <div>
                    {idx===0&&<div className="text-xs text-gray-400 mb-1">Бараа</div>}
                    <select value={it.productId} onChange={e=>setProcItems(prev=>prev.map((x,i)=>i===idx?{...x,productId:e.target.value,variant:''}:x))}
                      className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs bg-white">
                      <option value="">— Сонгох —</option>
                      {products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    {pvs.length>0&&(
                      <select value={it.variant} onChange={e=>setProcItems(prev=>prev.map((x,i)=>i===idx?{...x,variant:e.target.value}:x))}
                        className="w-full mt-1 px-2 py-1.5 rounded-lg border border-gray-200 text-xs bg-white">
                        <option value="">— Variant —</option>
                        {pvs.map((v,vi)=><option key={vi} value={[v.size,v.color].filter(Boolean).join(' / ')}>{[v.size,v.color].filter(Boolean).join(' / ')}</option>)}
                      </select>
                    )}
                  </div>
                  <div>
                    {idx===0&&<div className="text-xs text-gray-400 mb-1">Өртөг/ш</div>}
                    <input type="number" placeholder="0" value={it.cost}
                      onChange={e=>setProcItems(prev=>prev.map((x,i)=>i===idx?{...x,cost:e.target.value}:x))}
                      className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs"/>
                  </div>
                  <div>
                    {idx===0&&<div className="text-xs text-gray-400 mb-1">Тоо</div>}
                    <input type="number" placeholder="0" value={it.qty}
                      onChange={e=>setProcItems(prev=>prev.map((x,i)=>i===idx?{...x,qty:e.target.value}:x))}
                      className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs"/>
                  </div>
                  <div>
                    {idx===0&&<div className="text-xs text-gray-400 mb-1">Нийт</div>}
                    <div className="text-xs text-gray-500 text-right py-1.5">
                      {it.qty&&it.cost?((parseInt(it.qty)||0)*(parseInt(it.cost)||0)).toLocaleString():'—'}
                    </div>
                  </div>
                  <div className="flex items-end pb-1">
                    <button onClick={()=>setProcItems(prev=>prev.filter((_,i)=>i!==idx))}
                      className="text-gray-300 hover:text-red-400 text-xs">✕</button>
                  </div>
                </div>
              )
            })}
            <button onClick={()=>setProcItems(prev=>[...prev,{productId:'',variant:'',qty:'',cost:''}])}
              className="text-xs text-emerald-600 hover:underline mt-1">＋ Бараа нэмэх</button>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-3">
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
          </div>

          <button onClick={save} disabled={saving||!procItems.some(it=>it.productId&&it.qty)}
            className="w-full py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium disabled:opacity-40">
            {saving?'Хадгалж байна...':'Хадгалах'}
          </button>
        </div>

        {/* Баруун: Нэгдсэн хяналт */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="font-medium text-gray-800 text-sm">Барааны нэгдсэн хяналт</h2>
            <p className="text-xs text-gray-400 mt-0.5">Захиалсан → Ирсэн → Цэнэглэсэн → Зарагдсан</p>
          </div>
          {rows.length===0?(
            <p className="text-center text-gray-400 text-sm py-10">Бүртгэл байхгүй</p>
          ):(
            <div>
              <div className="grid text-xs text-gray-400 font-medium px-4 py-2 bg-gray-50 border-b border-gray-100"
                style={{gridTemplateColumns:'1.6fr 65px 65px 80px 65px 65px 65px 20px'}}>
                <div>Барааны нэр</div>
                <div className="text-right">Захиалсан</div>
                <div className="text-right">Ирсэн</div>
                <div className="text-right">Цэнэглэсэн</div>
                <div className="text-right">Зарагдсан</div>
                <div className="text-right">Үлдэгдэл</div>
                <div className="text-right">Зөрүү</div>
                <div></div>
              </div>
              <div className="divide-y divide-gray-100">
                {rows.map((r,i)=>{
                  const ekey=r.id+r.variant
                  const isExp=expanded.has(ekey)
                  const expected=Math.max(0,r.restocked-r.sold)
                  const zoruu=r.stock-expected
                  const det=[
                    ...supply.filter(s=>s.product_id===r.id&&(r.variant?s.variant_label===r.variant:!s.variant_label||s.variant_label==='')),
                    ...restockLogs.filter(l=>{
                      if(l.product_id!==r.id) return false
                      const lv=l.variant_label||''
                      return r.variant ? lv===r.variant : lv===''
                    }).map(l=>({...l,type:'restocked',quantity:l.quantity}))
                  ].sort((a,b)=>b.date.localeCompare(a.date))
                  return(
                    <div key={i} className={zoruu!==0?'bg-red-50/20':''}>
                      <div className="grid items-center px-4 py-2.5 hover:bg-gray-50/50 cursor-pointer"
                        style={{gridTemplateColumns:'1.6fr 65px 65px 80px 65px 65px 65px 20px'}}
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
                          {zoruu===0?<span className="text-emerald-500">✓</span>:<span className={zoruu>0?'text-blue-500':'text-red-500'}>{zoruu>0?'+':''}{zoruu}ш</span>}
                        </div>
                        <div className="text-xs text-gray-300">{isExp?'▲':'▼'}</div>
                      </div>
                      {isExp&&(
                        <div className="border-t border-gray-100 bg-gray-50/30">
                          {det.map((d,j)=>(
                            <div key={j} className="flex items-center gap-3 px-6 py-2 border-b border-gray-100 last:border-0">
                              <span className="text-xs text-gray-400 w-10">{fmtD(d.date)}</span>
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${tColor[d.type]||'text-gray-500'}`}>{tLabel[d.type]||d.type}</span>
                              <span className="text-xs font-bold text-gray-700">+{d.quantity}ш</span>
                              <span className="text-xs text-gray-400 italic flex-1">{d.note||''}</span>
                              <button onClick={async e=>{e.stopPropagation();await supabase.from('supply_log').delete().eq('id',d.id);load()}}
                                className="text-gray-300 hover:text-red-400 text-xs">✕</button>
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
      </div>
    </div>
  )
}
