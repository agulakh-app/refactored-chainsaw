'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useOwnerId, useActiveStore } from '../client-layout'

function fmtD(d: string) { if(!d) return ''; const [,m,day]=d.split('-'); return m+'/'+day }
const TODAY = new Date().toISOString().slice(0,10)

export default function SupplyPage() {
  const ownerId = useOwnerId()
  const activeStoreId = useActiveStore()
  const [products, setProducts] = useState<any[]>([])
  const [logs, setLogs] = useState<any[]>([])
  const [supply, setSupply] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [flash, setFlash] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [fProd, setFProd] = useState('')
  const [fVariant, setFVariant] = useState('')
  const [fType, setFType] = useState<'ordered'|'received'>('ordered')
  const [fQty, setFQty] = useState('')
  const [fDate, setFDate] = useState(TODAY)
  const [fNote, setFNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const showFlash = (m: string) => { setFlash(m); setTimeout(()=>setFlash(''),2500) }

  const load = useCallback(async () => {
    const { data:{ user } } = await supabase.auth.getUser()
    const targetId = ownerId || user?.id
    if(!targetId) return
    const [{ data: prods }, { data: rlogs }, { data: slogs }, { data: ords }] = await Promise.all([
      supabase.from('products').select('*').eq('user_id', targetId),
      supabase.from('restock_log').select('*').eq('user_id', targetId).eq('type','in').order('date',{ascending:false}),
      supabase.from('supply_log').select('*').eq('user_id', targetId).order('date',{ascending:false}),
      supabase.from('orders').select('*, order_items(*)').eq('user_id', targetId).in('status',['pending','delivered']),
    ])
    setProducts(prods||[])
    setLogs(rlogs||[])
    setSupply(slogs||[])
    setOrders(ords||[])
    if(prods&&prods.length>0&&!fProd) setFProd(prods[0].id)
  },[ownerId, activeStoreId, fProd])

  useEffect(()=>{ load() },[load])

  const selProd = products.find(p=>p.id===fProd)
  const variants: any[] = selProd?.variants||[]

  async function save() {
    if(!fProd||!fQty) return
    const { data:{ user } } = await supabase.auth.getUser()
    const targetId = ownerId || user?.id
    if(!targetId) return
    setSaving(true)
    const prod = products.find(p=>p.id===fProd)
    await supabase.from('supply_log').insert({
      user_id: targetId, store_id: activeStoreId||null,
      product_id: fProd, product_name: prod?.name||'',
      variant_label: fVariant||null, type: fType,
      quantity: parseInt(fQty)||0, date: fDate, note: fNote||null
    })
    setFQty(''); setFNote('')
    setSaving(false); showFlash('Хадгалагдлаа ✓'); load()
  }

  // Бараа бүрийн түлхүүр
  type PK = { id: string; label: string; variant: string }
  const prodKeys: PK[] = []
  for(const p of products) {
    const pvs: any[] = p.variants||[]
    if(pvs.length > 0) {
      for(const v of pvs) prodKeys.push({ id:p.id, label:p.name, variant:[v.size,v.color].filter(Boolean).join(' / ') })
    } else {
      prodKeys.push({ id:p.id, label:p.name, variant:'' })
    }
  }

  function getSummary(pk: PK) {
    const ms = (s:any) => s.product_id===pk.id && (pk.variant ? s.variant_label===pk.variant : !s.variant_label||s.variant_label==='')
    const ml = (l:any) => l.product_id===pk.id && (pk.variant ? l.variant_label===pk.variant : !l.variant_label||l.variant_label==='')
    const ordered = supply.filter(s=>ms(s)&&s.type==='ordered').reduce((a,s)=>a+s.quantity,0)
    const received = supply.filter(s=>ms(s)&&s.type==='received').reduce((a,s)=>a+s.quantity,0)
    const restocked = logs.filter(ml).reduce((a,l)=>a+l.quantity,0)
    const sold = orders.reduce((a,o)=>{
      return a+(o.order_items||[]).filter((it:any)=>it.product_id===pk.id&&(pk.variant?it.variant_label===pk.variant:!it.variant_label||it.variant_label==='')).reduce((b:number,it:any)=>b+it.quantity,0)
    },0)
    const stock = pk.variant
      ? (products.find(p=>p.id===pk.id)?.variants||[]).find((v:any)=>[v.size,v.color].filter(Boolean).join(' / ')===pk.variant)?.stock||0
      : products.find(p=>p.id===pk.id)?.stock||0
    return { ordered, received, restocked, sold, stock }
  }

  function getDetail(pk: PK) {
    const ms = (s:any) => s.product_id===pk.id && (pk.variant ? s.variant_label===pk.variant : !s.variant_label||s.variant_label==='')
    const ml = (l:any) => l.product_id===pk.id && (pk.variant ? l.variant_label===pk.variant : !l.variant_label||l.variant_label==='')
    const rows = [
      ...supply.filter(ms).map(s=>({ id:s.id, date:s.date, type:s.type, qty:s.quantity, note:s.note, deletable:true })),
      ...logs.filter(ml).map(l=>({ id:l.id, date:l.date, type:'restocked', qty:l.quantity, note:l.note, deletable:false })),
    ]
    return rows.sort((a,b)=>b.date.localeCompare(a.date))
  }

  const typeLabel: Record<string,string> = { ordered:'Захиалсан', received:'Ирсэн', restocked:'Цэнэглэсэн' }
  const typeColor: Record<string,string> = { ordered:'text-blue-600 bg-blue-50', received:'text-emerald-700 bg-emerald-50', restocked:'text-orange-600 bg-orange-50' }

  const visibleKeys = prodKeys.filter(pk=>{ const s=getSummary(pk); return s.ordered>0||s.received>0||s.restocked>0||s.sold>0 })

  return (
    <div className="space-y-4">
      {flash&&<div className="fixed top-4 right-4 bg-gray-900 text-white text-sm px-4 py-2 rounded-lg z-50">{flash}</div>}

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-800">Нийлүүлэлтийн бүртгэл</h2>
            <p className="text-xs text-gray-400 mt-0.5">Захиалсан → Ирсэн → Цэнэглэсэн → Зарагдсан</p>
          </div>
          <button onClick={()=>setShowForm(!showForm)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${showForm?'bg-gray-100 text-gray-600':'bg-[#0a2e24] text-white'}`}>
            {showForm?'Болих':'＋ Бүртгэх'}
          </button>
        </div>

        {showForm&&(
          <div className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-3">
            <div className="grid gap-3" style={{gridTemplateColumns:variants.length>0?'1fr 1fr':'1fr'}}>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Бараа</label>
                <select className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
                  value={fProd} onChange={e=>{setFProd(e.target.value);setFVariant('')}}>
                  {products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              {variants.length>0&&(
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Variant</label>
                  <select className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
                    value={fVariant} onChange={e=>setFVariant(e.target.value)}>
                    <option value="">— Сонгох —</option>
                    {variants.map((v:any,i:number)=>(
                      <option key={i} value={[v.size,v.color].filter(Boolean).join(' / ')}>
                        {[v.size,v.color].filter(Boolean).join(' / ')}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Төрөл</label>
                <select className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
                  value={fType} onChange={e=>setFType(e.target.value as any)}>
                  <option value="ordered">Захиалсан</option>
                  <option value="received">Ирсэн / Хүлээн авсан</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Тоо ширхэг</label>
                <input type="number" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                  value={fQty} onChange={e=>setFQty(e.target.value)} placeholder="0"/>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Огноо</label>
                <input type="date" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                  value={fDate} onChange={e=>setFDate(e.target.value)}/>
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Тэмдэглэл</label>
              <input className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                placeholder="1ш гэмтэлтэй ирсэн, дутуу г.м..." value={fNote} onChange={e=>setFNote(e.target.value)}/>
            </div>
            <button onClick={save} disabled={saving||!fProd||!fQty}
              className="w-full py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium disabled:opacity-40">
              {saving?'Хадгалж байна...':'Хадгалах'}
            </button>
          </div>
        )}
      </div>

      {/* Нэгтгэл */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="grid text-xs text-gray-400 font-medium px-4 py-2.5 bg-gray-50 border-b border-gray-100"
          style={{gridTemplateColumns:'1.8fr 75px 75px 85px 75px 65px 20px'}}>
          <div>Барааны нэр</div>
          <div className="text-right">Захиалсан</div>
          <div className="text-right">Ирсэн</div>
          <div className="text-right">Цэнэглэсэн</div>
          <div className="text-right">Зарагдсан</div>
          <div className="text-right">Үлдэгдэл</div>
          <div></div>
        </div>

        {visibleKeys.length===0?(
          <p className="text-center text-gray-400 text-sm py-10">Бүртгэл байхгүй — ＋ Бүртгэх дарж эхлэнэ</p>
        ):(
          <div className="divide-y divide-gray-100">
            {visibleKeys.map((pk,i)=>{
              const s = getSummary(pk)
              const det = getDetail(pk)
              const ekey = pk.id+pk.variant
              const isExp = expanded.has(ekey)
              return (
                <div key={i}>
                  <div className="grid items-center px-4 py-2.5 hover:bg-gray-50/50 cursor-pointer select-none"
                    style={{gridTemplateColumns:'1.8fr 75px 75px 85px 75px 65px 20px'}}
                    onClick={()=>{const n=new Set(expanded); n.has(ekey)?n.delete(ekey):n.add(ekey); setExpanded(n)}}>
                    <div>
                      <span className="text-sm font-medium text-gray-700">{pk.label}</span>
                      {pk.variant&&<span className="text-xs text-gray-400 ml-1.5">{pk.variant}</span>}
                    </div>
                    <div className="text-right text-xs font-medium text-blue-600">{s.ordered>0?s.ordered+'ш':'—'}</div>
                    <div className="text-right text-xs font-medium text-emerald-600">{s.received>0?s.received+'ш':'—'}</div>
                    <div className="text-right text-xs font-medium text-orange-500">{s.restocked>0?s.restocked+'ш':'—'}</div>
                    <div className="text-right text-xs text-gray-600">{s.sold>0?s.sold+'ш':'—'}</div>
                    <div className="text-right text-xs font-bold text-gray-800">{s.stock}ш</div>
                    <div className="text-xs text-gray-300 text-right">{isExp?'▲':'▼'}</div>
                  </div>

                  {isExp&&(
                    <div className="border-t border-gray-100 bg-gray-50/30">
                      {det.map((d,j)=>(
                        <div key={j} className="flex items-center gap-3 px-6 py-2 border-b border-gray-100 last:border-0">
                          <span className="text-xs text-gray-400 w-10 flex-shrink-0">{fmtD(d.date)}</span>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${typeColor[d.type]}`}>{typeLabel[d.type]}</span>
                          <span className="text-xs font-bold text-gray-700 w-12 flex-shrink-0 text-right">+{d.qty}ш</span>
                          <span className="text-xs text-gray-400 italic flex-1">{d.note||''}</span>
                          {d.deletable&&(
                            <button onClick={async e=>{ e.stopPropagation(); await supabase.from('supply_log').delete().eq('id',d.id); load() }}
                              className="text-gray-300 hover:text-red-400 text-xs ml-auto">✕</button>
                          )}
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
  )
}
