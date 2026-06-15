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
  const [importExpanded, setImportExpanded] = useState(false)
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

  const [confirmModal, setConfirmModal] = useState<{msg:string,onOk:()=>void}|null>(null)
  const [editModal, setEditModal] = useState<Order|null>(null)
  const [editPhone, setEditPhone] = useState('')
  const [editAddr, setEditAddr] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editStatus, setEditStatus] = useState('')
  const [editDelv, setEditDelv] = useState('')

  async function saveEdit() {
    if(!editModal) return
    await supabase.from('orders').update({
      phone: editPhone, address: editAddr, date: editDate,
      status: editStatus, delivery_fee: Number(editDelv)||0
    }).eq('id', editModal.id)
    setEditModal(null)
    load()
  }
  const [openDropdown, setOpenDropdown] = useState<string|null>(null)
  const [dropdownPos, setDropdownPos] = useState<{top:number,right:number}>({top:0,right:0})
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(()=>{
    function handleClick(e:MouseEvent){
      if(dropdownRef.current&&!dropdownRef.current.contains(e.target as Node)){
        setOpenDropdown(null)
      }
    }
    document.addEventListener('mousedown',handleClick)
    return()=>document.removeEventListener('mousedown',handleClick)
  },[])

  async function setOrderStatus(id: string, s: string) {
    await supabase.from('orders').update({status:s}).eq('id',id)
    load()
  }

  async function deleteOrder(o: Order) {
    setConfirmModal({
      msg: 'Энэ захиалгыг бүр мөсөн устгах уу? Энэ үйлдлийг буцаах боломжгүй.',
      onOk: async () => {
        await supabase.from('order_items').delete().eq('order_id', o.id)
        await supabase.from('orders').delete().eq('id', o.id)
        load()
      }
    })
  }

  async function deleteAllCancelled(date: string, list: Order[]) {
    const cancelled = list.filter(o=>o.status==='cancelled')
    if (cancelled.length===0) return
    setConfirmModal({
      msg: `${fmtD(date)} өдрийн ${cancelled.length} цуцлагдсан захиалгыг бүр мөсөн устгах уу? Энэ үйлдлийг буцаах боломжгүй.`,
      onOk: async () => {
        for (const o of cancelled) {
          await supabase.from('order_items').delete().eq('order_id', o.id)
          await supabase.from('orders').delete().eq('id', o.id)
        }
        load()
      }
    })
  }

  async function markAllDelivered(date: string, list: Order[]) {
    const toMark = list.filter(o=>o.status!=='delivered'&&o.status!=='cancelled')
    if (toMark.length===0) return
    for (const o of toMark) {
      await supabase.from('orders').update({status:'delivered'}).eq('id', o.id)
    }
    load()
  }


  // Утасны хайлт — тухайн хүний бүх захиалга + хаягийн түүх
  const phoneOrders = selectedPhone
    ? orders.filter(o => o.phone === selectedPhone)
    : []
  const phoneAddresses = selectedPhone
    ? Array.from(new Set(phoneOrders.map(o => o.address).filter(Boolean)))
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
    const targetId = ownerId || user.id
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

      // Агуулахаас хасахын тулд бараануудыг урьдчилан ачаална
      const { data: products } = await supabase.from('products').select('*').eq('user_id', targetId)

      let cnt=0
      let stockMissCount=0
      for (const g of Object.values(grouped) as any[]) {
        const { data: ord } = await supabase.from('orders').insert({
          user_id:targetId, date:g.date, day_seq:1,
          phone:g.phone, address:g.addr||'-',
          delivery_fee:g.delv, status:g.status,
          store_id:activeStoreId||null
        }).select().single()
        if (ord&&g.items.length>0)
          await supabase.from('order_items').insert(g.items.map((it:any)=>({order_id:ord.id,...it})))

        // ── Агуулахаас хасах (барааны нэрээр тааруулна) ──
        for (const it of g.items as any[]) {
          const prod = (products||[]).find((p:any)=>p.name.trim().toLowerCase()===it.product_name.trim().toLowerCase())
          if (!prod) { stockMissCount++; continue }

          if (Array.isArray(prod.variants) && prod.variants.length>0 && it.variant_label) {
            const vIdx = prod.variants.findIndex((v:any)=>[v.size,v.color].filter(Boolean).join(' / ')===it.variant_label)
            if (vIdx>=0) {
              const newVariants = [...prod.variants]
              newVariants[vIdx] = { ...newVariants[vIdx], stock: Math.max(0,(newVariants[vIdx].stock||0)-it.quantity) }
              const newTotal = newVariants.reduce((a:number,v:any)=>a+(v.stock||0),0)
              await supabase.from('products').update({ variants:newVariants, stock:newTotal }).eq('id',prod.id)
              prod.variants = newVariants
              prod.stock = newTotal
            } else { stockMissCount++; continue }
          } else if (!Array.isArray(prod.variants) || prod.variants.length===0) {
            const newStock = Math.max(0,(prod.stock||0)-it.quantity)
            await supabase.from('products').update({ stock:newStock }).eq('id',prod.id)
            prod.stock = newStock
          } else { stockMissCount++; continue }

          await supabase.from('restock_log').insert({
            user_id:targetId, product_id:prod.id, product_name:prod.name,
            quantity: it.quantity, type:'out', note:`Импорт — ${g.phone}`,
            date: g.date, store_id: activeStoreId||null
          })
        }
        cnt++
      }
      setImportMsg(
        `${cnt} захиалга импортлогдлоо` +
        (stockMissCount>0 ? `, ${stockMissCount} бараа агуулахад олдсонгүй (тооноос хасагдсангүй)` : ', агуулахаас тоо ширхэг хасагдлаа')
      )
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

      {/* Import / Export — collapsible */}
      {!isViewer && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <button onClick={()=>setImportExpanded(v=>!v)}
            className="w-full flex items-center justify-between px-4 py-3">
            <h2 className="font-medium text-gray-800 text-sm">Импорт / Экспорт</h2>
            <span className="text-gray-400 text-xs">{importExpanded?'▲':'▼'}</span>
          </button>
          {importExpanded && (
            <div className="px-4 pb-4">
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
              </div>
              {importMsg&&<p className={`text-xs mt-2 font-medium ${importMsg.startsWith('Алдаа')?'text-red-500':'text-emerald-600'}`}>{importMsg}</p>}
              <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                ⚠️ Импорт хийхэд "Тоо ширхэг" нь захиалгын барааны нэртэй (variant бол variant нэртэй) <b>яг таарсан</b> барааны үлдэгдлээс автоматаар хасагдана. Нэр таараагүй бараа агуулахаас хасагдахгүй (захиалга үүснэ, мэдэгдэл харагдана).
              </p>
            </div>
          )}
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
          <div className="relative">
            <input type="date"
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
              value={dateFilter} onChange={e=>setDateFilter(e.target.value)}/>
            {!dateFilter && (
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none bg-white pr-1">
                Огноо сонгох
              </span>
            )}
          </div>
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

        {/* Нэг удаагийн header */}
        {filtered.length>0&&(
          <div className="grid text-xs font-medium text-gray-400 border-b border-gray-100 bg-white px-3 py-2 sticky top-0 z-10"
            style={{gridTemplateColumns:'110px 1fr 1fr 70px 70px 70px 160px'}}>
            <span>Утас</span><span>Хаяг</span><span>Бараа</span>
            <span>Дүн</span><span>Хүргэлт</span><span>Цэвэр</span><span>Үйлдэл</span>
          </div>
        )}

        {/* Grouped orders */}
        {Object.keys(groups).sort((a,b)=>b.localeCompare(a)).map(date=>{
          const grp=groups[date]
          const totNet=grp.reduce((a,o)=>{
            const g=(o.order_items||[]).reduce((s:number,i:any)=>s+i.quantity*i.unit_price,0)
            return a+g-(o.delivery_fee||0)
          },0)
          return (
            <div key={date}>
              {/* Огноогийн мөр + bulk actions */}
              <div className="px-4 py-2.5 flex flex-wrap justify-between items-center gap-2" style={{background:'#e6fbf6',borderTop:'1px solid #c2f5e8',borderBottom:'1px solid #c2f5e8'}}>
                <span className="text-xs font-semibold" style={{color:'#048a6a'}}>{dayLabel(date)}</span>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-gray-400">{grp.length} захиалга</span>
                  <span className="text-xs font-medium text-emerald-700">{fmt(totNet)}₮</span>
                  {!isViewer && grp.some(o=>o.status!=='delivered'&&o.status!=='cancelled') && (
                    <button onClick={()=>markAllDelivered(date, grp)}
                      className="text-xs px-2 py-1 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 font-medium whitespace-nowrap">
                      Бүгдийг хүргэсэн болгох
                    </button>
                  )}
                  {!isViewer && grp.some(o=>o.status==='cancelled') && (
                    <button onClick={()=>deleteAllCancelled(date, grp)}
                      className="text-xs px-2 py-1 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 font-medium whitespace-nowrap">
                      Цуцлагдсаныг устгах ({grp.filter(o=>o.status==='cancelled').length})
                    </button>
                  )}
                </div>
              </div>

              {/* Захиалгын мөрүүд */}
              {grp.map(o=>{
                const gross=(o.order_items||[]).reduce((a:number,i:any)=>a+i.quantity*i.unit_price,0)
                const net=gross-(o.delivery_fee||0)
                const isDelivered=o.status==='delivered'
                const isCancelled=o.status==='cancelled'
                return (
                  <div key={o.id} className="grid items-center border-b border-gray-100 hover:bg-gray-50 px-3 py-2 text-sm"
                    style={{gridTemplateColumns:'110px 1fr 1fr 70px 70px 70px 160px'}}>
                    <button onClick={()=>setSelectedPhone(selectedPhone===o.phone?null:o.phone)}
                      className="font-medium text-gray-800 hover:text-emerald-600 text-left text-xs whitespace-nowrap">
                      {o.phone}
                    </button>
                    <span className="text-gray-400 text-xs truncate pr-2">{o.address}</span>
                    <span className="text-gray-500 text-xs truncate pr-2">
                      {(o.order_items||[]).map((i:any)=>i.product_name+(i.variant_label?' · '+i.variant_label:'')+'×'+i.quantity).join(', ')}
                    </span>
                    <span className="text-gray-600 text-xs whitespace-nowrap">{fmt(gross)}₮</span>
                    <span className="text-gray-400 text-xs whitespace-nowrap">{o.delivery_fee>0?fmt(o.delivery_fee)+'₮':'—'}</span>
                    <span className="font-medium text-emerald-700 text-xs whitespace-nowrap">{fmt(net)}₮</span>
                    <div className="flex items-center gap-1">
                      {!isViewer?(
                        <>
                          <select
                            value={o.status}
                            onChange={e=>{
                              const v=e.target.value
                              if(v==='pending'||v==='delivered'||v==='cancelled') setOrderStatus(o.id,v)
                            }}
                            className={`text-xs px-1.5 py-0.5 rounded border cursor-pointer ${
                              isDelivered?'bg-emerald-50 text-emerald-700 border-emerald-200':
                              isCancelled?'bg-gray-100 text-gray-500 border-gray-200':
                              'bg-amber-50 text-amber-700 border-amber-200'
                            }`}>
                            <option value="pending">Хүлээгдэж байна</option>
                            <option value="delivered">✓ Хүргэгдсэн</option>
                            <option value="cancelled">✕ Цуцлагдсан</option>
                          </select>
                          <button onClick={()=>{setEditModal(o);setEditPhone(o.phone);setEditAddr(o.address);setEditDate(o.date||'');setEditStatus(o.status);setEditDelv(String(o.delivery_fee||''))}}
                            className="text-gray-400 hover:text-blue-500 px-1">✏️</button>
                          <button onClick={()=>setConfirmModal({msg:`${o.phone} захиалгыг устгах уу?`,onOk:()=>deleteOrder(o)})}
                            className="text-gray-300 hover:text-red-400 px-1">🗑</button>
                        </>
                      ):(
                        <span className={`text-xs px-2 py-0.5 rounded-full border whitespace-nowrap ${
                          isDelivered?'bg-emerald-50 text-emerald-600 border-emerald-100':
                          isCancelled?'bg-gray-100 text-gray-400 border-gray-200':
                          'bg-amber-50 text-amber-600 border-amber-100'
                        }`}>
                          {isDelivered?'Хүргэгдсэн':isCancelled?'Цуцлагдсан':'Хүлээгдэж байна'}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}
        {filtered.length===0&&<p className="text-center text-gray-400 text-sm py-10">Захиалга олдсонгүй</p>}
      </div>

      {/* Edit modal */}
      {editModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-3">
            <h3 className="font-medium text-gray-800 mb-2">Захиалга засварлах</h3>
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
            <div className="flex gap-2 pt-2">
              <button onClick={()=>setEditModal(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600">Болих</button>
              <button onClick={saveEdit} className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium">Хадгалах</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm modal */}
      {confirmModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm text-center">
            <p className="text-sm text-gray-800 mb-5 leading-relaxed">{confirmModal.msg}</p>
            <div className="flex gap-2">
              <button onClick={()=>setConfirmModal(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600">Болих</button>
              <button onClick={async()=>{ await confirmModal.onOk(); setConfirmModal(null) }}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600">Устгах</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
