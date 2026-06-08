'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { Order } from '@/lib/types'
import { useGuestRole, useOwnerId, useActiveStore } from '../client-layout'

function fmt(n: number) { return n.toLocaleString() }
function fmtD(d: string) { if(!d) return ''; const [y,m,day]=d.split('-'); return `${y}/${m}/${day}` }
function dayLabel(d: string) {
  const today = new Date().toISOString().slice(0,10)
  const yest = new Date(Date.now()-86400000).toISOString().slice(0,10)
  if (d===today) return `Өнөөдөр — ${fmtD(d)}`
  if (d===yest) return `Өчигдөр — ${fmtD(d)}`
  return fmtD(d)
}

const StatusBadge = ({ s }: { s: string }) => {
  if (s==='delivered') return <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-full text-xs whitespace-nowrap">Хүргэгдсэн</span>
  if (s==='cancelled') return <span className="px-2 py-0.5 bg-gray-100 text-gray-400 border border-gray-200 rounded-full text-xs whitespace-nowrap">Цуцлагдсан</span>
  return <span className="px-2 py-0.5 bg-amber-50 text-amber-600 border border-amber-100 rounded-full text-xs whitespace-nowrap">Хүлээгдэж байна</span>
}

export default function HistoryPage() {
  const guestRole = useGuestRole()
  const ownerId = useOwnerId()
  const activeStoreId = useActiveStore()
  const isViewer = guestRole === 'viewer'

  const [orders, setOrders] = useState<Order[]>([])
  const [stores, setStores] = useState<any[]>([])
  const [phone, setPhone] = useState('')
  const [status, setStatus] = useState('all')
  const [dateFilter, setDateFilter] = useState('')
  const [storeFilter, setStoreFilter] = useState('all')
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // Утасны хайлтын дэлгэрэнгүй
  const [selectedPhone, setSelectedPhone] = useState<string|null>(null)

  const load = useCallback(async () => {
    const { data:{ user } } = await supabase.auth.getUser()
    const targetId = ownerId || user?.id
    if (!targetId) return
    const q = supabase.from('orders').select('*, order_items(*)')
      .eq('user_id', targetId).order('date',{ascending:false}).order('day_seq',{ascending:false})
    const { data } = activeStoreId ? await q.eq('store_id', activeStoreId) : await q
    setOrders(data||[])
    const { data: sts } = await supabase.from('stores').select('*').eq('user_id', targetId)
    setStores(sts||[])
  },[ownerId, activeStoreId])

  useEffect(()=>{ load() },[load])

  async function setOrderStatus(id: string, s: string) {
    await supabase.from('orders').update({status:s}).eq('id',id)
    load()
  }

  // Утасны хайлт — тухайн хүний бүх захиалга + хаягийн түүх
  const phoneOrders = selectedPhone
    ? orders.filter(o => o.phone === selectedPhone)
    : []
  const phoneAddresses = selectedPhone
    ? [...new Set(phoneOrders.map(o => o.address).filter(Boolean))]
    : []

  // CSV экспорт — дэлгүүрээр ялгасан
  function exportCSV(storeId?: string) {
    const storeName = storeId ? stores.find(s=>s.id===storeId)?.name || 'store' : 'all'
    const toExport = storeId
      ? filtered.filter(o=>(o as any).store_id===storeId)
      : filtered
    const rows=[['Огноо','Утас','Хаяг','Дэлгүүр','Бараа','Variant','Барааны дүн','Хүргэлт','Цэвэр','Статус']]
    toExport.forEach(o=>{
      const gross=(o.order_items||[]).reduce((a:number,i:any)=>a+i.quantity*i.unit_price,0)
      const net=gross-(o.delivery_fee||0)
      const oStore=stores.find(s=>s.id===(o as any).store_id)?.name||''
      ;(o.order_items||[]).forEach((i:any)=>{
        rows.push([
          o.date, o.phone, o.address, oStore,
          i.product_name, i.variant_label||'',
          String(i.quantity*i.unit_price),
          String(o.delivery_fee||0),
          String(net), o.status
        ])
      })
    })
    const csv=rows.map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\n')
    const a=document.createElement('a')
    a.href=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}))
    a.download=`orders_${storeName}_${new Date().toISOString().slice(0,10)}.csv`
    a.click()
  }

  // Excel template татах
  function downloadTemplate() {
    const rows=[
      ['Огноо (YYYY-MM-DD)','Утасны дугаар','Хаяг','Барааны нэр','Variant (өнгө/хэмжээ)','Тоо ширхэг','Нэгж үнэ (₮)','Хүргэлтийн үнэ (₮)','Статус'],
      ['2026-06-05','88118270','Гачуурт','Углаа','180x200 / Цагаан','1','89000','7000','delivered'],
      ['2026-06-05','99184322','ХУД 2-р хороо','Хөнжил','240x220','2','205000','7000','pending'],
    ]
    const csv=rows.map(r=>r.map(v=>'"'+String(v)+'"').join(',')).join('\n')
    const a=document.createElement('a')
    a.href=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}))
    a.download='olula_template.csv'; a.click()
  }

  // Excel import
  async function handleExcelImport(file: File) {
    setImporting(true); setImportMsg('Файл уншиж байна...')
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user) { setImporting(false); return }
    const loadXLSX = (): Promise<any> => new Promise(resolve => {
      if ((window as any).XLSX) { resolve((window as any).XLSX); return }
      const s = document.createElement('script')
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
      s.onload = () => resolve((window as any).XLSX)
      document.head.appendChild(s)
    })
    try {
      const buf = await file.arrayBuffer()
      const XLSX = await loadXLSX()
      const wb = XLSX.read(new Uint8Array(buf), {type:'array', cellDates:true, raw:false})
      const oSheet = wb.Sheets['Захиалга'] || wb.Sheets[wb.SheetNames[0]]
      const rows: any[] = oSheet ? XLSX.utils.sheet_to_json(oSheet,{defval:'',raw:false}) : []
      const grouped: Record<string,any> = {}
      for (const r of rows) {
        const date=(r['Огноо (YYYY-MM-DD)']||r['Огноо']||r[Object.keys(r)[0]]||'').toString().replace(/\./g,'-').trim().slice(0,10)
        const ph=(r['Утасны дугаар']||r['Утас']||'').toString().trim()
        const addr=(r['Хаяг']||'').toString().trim()
        const prod=(r['Барааны нэр']||r['Бараа']||'').toString().trim()
        const variant=(r['Variant (өнгө/хэмжээ)']||r['Variant']||'').toString().trim()
        const qty=parseInt(String(r['Тоо ширхэг']||'1').replace(/[^\d]/g,''))||1
        const price=parseInt(String(r['Нэгж үнэ (₮)']||'0').replace(/[^\d]/g,''))||0
        const delv=parseInt(String(r['Хүргэлтийн үнэ (₮)']||'0').replace(/[^\d]/g,''))||0
        const rawSt=(r['Статус']||'').toString()
        const st=rawSt.includes('delivered')||rawSt.includes('Хүргэгдсэн')?'delivered':'pending'
        if (!date||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!ph||!prod) continue
        const key=`${date}__${ph}__${addr}`
        if (!grouped[key]) grouped[key]={date,phone:ph,addr,items:[],delv,status:st}
        grouped[key].items.push({product_name:prod,variant_label:variant||null,quantity:qty,unit_price:price})
        if (delv) grouped[key].delv=delv
      }
      let cnt=0
      for (const g of Object.values(grouped)) {
        const { data: ord } = await supabase.from('orders').insert({
          user_id:user.id, date:g.date, day_seq:1,
          phone:g.phone, address:g.addr||'-',
          delivery_fee:g.delv, status:g.status,
          store_id:activeStoreId||null
        }).select().single()
        if (ord&&g.items.length>0)
          await supabase.from('order_items').insert(g.items.map((it:any)=>({order_id:ord.id,...it})))
        cnt++
      }
      setImportMsg(`${cnt} захиалга импортлогдлоо`)
      load()
    } catch(err:any) { setImportMsg('Алдаа: '+err.message) }
    setImporting(false)
  }

  const filtered = orders.filter(o=>{
    if(phone&&!o.phone.includes(phone)) return false
    if(status!=='all'&&o.status!==status) return false
    if(dateFilter&&o.date!==dateFilter) return false
    if(storeFilter!=='all'&&(o as any).store_id!==storeFilter) return false
    return true
  })

  const groups: Record<string,Order[]> = {}
  filtered.forEach(o=>{ if(!groups[o.date])groups[o.date]=[]; groups[o.date].push(o) })

  return (
    <div className="space-y-4">

      {/* Утасны хайлт — дэлгэрэнгүй харагдац */}
      {selectedPhone && (
        <div className="bg-white rounded-xl border border-emerald-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="font-medium text-gray-800 text-sm">{selectedPhone}</span>
              <span className="ml-2 text-xs text-gray-400">{phoneOrders.length} захиалга</span>
            </div>
            <button onClick={()=>setSelectedPhone(null)} className="text-xs text-gray-400 hover:text-gray-600">✕ Хаах</button>
          </div>
          {phoneAddresses.length>0&&(
            <div className="mb-3">
              <div className="text-xs text-gray-400 mb-1">Хаягийн түүх:</div>
              <div className="flex flex-wrap gap-1.5">
                {phoneAddresses.map((addr,i)=>(
                  <span key={i} className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-lg">{addr}</span>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-2">
            {phoneOrders.map(o=>{
              const gross=(o.order_items||[]).reduce((a:number,i:any)=>a+i.quantity*i.unit_price,0)
              const net=gross-(o.delivery_fee||0)
              return (
                <div key={o.id} className="flex justify-between items-start py-2 border-t border-gray-100">
                  <div>
                    <div className="text-xs text-gray-500">{fmtD(o.date)} — {o.address}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {(o.order_items||[]).map((i:any)=>i.product_name+(i.variant_label?' · '+i.variant_label:'')+'×'+i.quantity).join(', ')}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-emerald-700">{fmt(net)}₮</span>
                    <StatusBadge s={o.status}/>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between">
            <span className="text-xs text-gray-400">Нийт дүн</span>
            <span className="text-sm font-medium text-emerald-700">
              {fmt(phoneOrders.reduce((a,o)=>{
                const g=(o.order_items||[]).reduce((s:number,i:any)=>s+i.quantity*i.unit_price,0)
                return a+g-(o.delivery_fee||0)
              },0))}₮
            </span>
          </div>
        </div>
      )}

      {/* Import / Export */}
      {!isViewer && (
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <h2 className="font-medium text-gray-800 text-sm mb-3">Импорт / Экспорт</h2>
          <div className="flex flex-wrap gap-2">
            <input type="file" accept=".xlsx,.xls,.csv" ref={fileRef} className="hidden"
              onChange={e=>{ if(e.target.files?.[0]){ handleExcelImport(e.target.files[0]); e.target.value='' } }} />
            <button onClick={()=>fileRef.current?.click()} disabled={importing}
              className="px-3 py-2 bg-gray-900 text-white rounded-lg text-xs font-medium hover:bg-gray-700 disabled:opacity-50">
              {importing?'Оруулж байна...':'↑ Файл импортлох'}
            </button>
            <button onClick={downloadTemplate}
              className="px-3 py-2 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50">
              ↓ Template татах
            </button>
            <button onClick={()=>exportCSV()}
              className="px-3 py-2 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50">
              ↓ CSV (бүгд)
            </button>
            {stores.map(s=>(
              <button key={s.id} onClick={()=>exportCSV(s.id)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50">
                ↓ CSV ({s.name})
              </button>
            ))}
            {importMsg&&<span className={`text-xs self-center font-medium ${importMsg.startsWith('Алдаа')?'text-red-500':'text-emerald-600'}`}>{importMsg}</span>}
          </div>
        </div>
      )}

      {/* Захиалгын түүх */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="font-medium text-gray-800 text-sm">Захиалгын түүх</h2>
        </div>

        {/* Filters */}
        <div className="flex gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50 flex-wrap">
          <input
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
            style={{minWidth:120,maxWidth:160}}
            placeholder="Утас хайх..."
            value={phone}
            onChange={e=>{ setPhone(e.target.value); if(e.target.value) setSelectedPhone(e.target.value) }}
          />
          <input type="date"
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
            value={dateFilter} onChange={e=>setDateFilter(e.target.value)}/>
          {dateFilter&&<button onClick={()=>setDateFilter('')}
            className="px-2 py-2 rounded-lg border border-gray-200 text-xs text-gray-400 bg-white">✕</button>}
          <select className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
            value={status} onChange={e=>setStatus(e.target.value)}>
            <option value="all">Бүх статус</option>
            <option value="pending">Хүлээгдэж байна</option>
            <option value="delivered">Хүргэгдсэн</option>
            <option value="cancelled">Цуцлагдсан</option>
          </select>
          {!activeStoreId&&stores.length>1&&(
            <select className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
              value={storeFilter} onChange={e=>setStoreFilter(e.target.value)}>
              <option value="all">Бүх дэлгүүр</option>
              {stores.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
        </div>

        {/* Grouped orders */}
        {Object.keys(groups).sort((a,b)=>b.localeCompare(a)).map(date=>{
          const grp=groups[date]
          const totNet=grp.reduce((a,o)=>{
            const g=(o.order_items||[]).reduce((s:number,i:any)=>s+i.quantity*i.unit_price,0)
            return a+g-(o.delivery_fee||0)
          },0)
          return (
            <div key={date}>
              <div className="px-4 py-2.5 bg-gray-100 border-y border-gray-200 flex justify-between items-center">
                <span className="text-xs font-medium text-gray-600">{dayLabel(date)}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400">{grp.length} захиалга</span>
                  <span className="text-xs font-medium text-emerald-700">{fmt(totNet)}₮</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      {['Утас','Хаяг','Бараа','Дүн','Хүргэлт','Цэвэр','Статус',''].map(h=>(
                        <th key={h} className="px-3 py-2 text-xs font-medium text-gray-400 text-left whitespace-nowrap border-b border-gray-100">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {grp.map(o=>{
                      const gross=(o.order_items||[]).reduce((a:number,i:any)=>a+i.quantity*i.unit_price,0)
                      const net=gross-(o.delivery_fee||0)
                      return (
                        <tr key={o.id} className="border-t border-gray-100 hover:bg-gray-50">
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <button
                              onClick={()=>setSelectedPhone(selectedPhone===o.phone?null:o.phone)}
                              className="font-medium text-gray-800 hover:text-emerald-600 transition-colors">
                              {o.phone}
                            </button>
                          </td>
                          <td className="px-3 py-2.5 text-gray-400 text-xs max-w-[100px] truncate">{o.address}</td>
                          <td className="px-3 py-2.5 text-xs text-gray-500">
                            {(o.order_items||[]).map((i:any)=>
                              i.product_name+(i.variant_label?' · '+i.variant_label:'')+'×'+i.quantity
                            ).join(', ')}
                          </td>
                          <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{fmt(gross)}₮</td>
                          <td className="px-3 py-2.5 text-gray-400 whitespace-nowrap">{o.delivery_fee>0?fmt(o.delivery_fee)+'₮':'—'}</td>
                          <td className="px-3 py-2.5 font-medium text-emerald-700 whitespace-nowrap">{fmt(net)}₮</td>
                          <td className="px-3 py-2.5"><StatusBadge s={o.status}/></td>
                          <td className="px-3 py-2.5">
                            {!isViewer&&(
                              <div className="flex gap-1">
                                {o.status!=='cancelled'&&(
                                  <button onClick={()=>setOrderStatus(o.id,o.status==='delivered'?'pending':'delivered')}
                                    className={`px-2 py-1 rounded-lg text-xs font-medium ${o.status==='delivered'?'bg-amber-50 text-amber-600':'bg-emerald-50 text-emerald-600'}`}>
                                    {o.status==='delivered'?'↩':'✓'}
                                  </button>
                                )}
                                {o.status==='pending'&&(
                                  <button onClick={()=>setOrderStatus(o.id,'cancelled')}
                                    className="px-2 py-1 rounded-lg text-xs bg-gray-100 text-gray-400 hover:bg-red-50 hover:text-red-500">✕</button>
                                )}
                              </div>
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
