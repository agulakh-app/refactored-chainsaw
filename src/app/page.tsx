'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function SettingsPage() {
  const [deliveryFee, setDeliveryFee] = useState('')
  const [bizName, setBizName] = useState('')
  const [saved, setSaved] = useState(false)
  const [viewers, setViewers] = useState<any[]>([])
  const [newEmail, setNewEmail] = useState('')
  const [adding, setAdding] = useState(false)
  const [flash, setFlash] = useState('')
  const [userEmail, setUserEmail] = useState('')

  const showFlash = (m: string) => { setFlash(m); setTimeout(()=>setFlash(''),3000) }

  useEffect(()=>{
    supabase.auth.getUser().then(({data})=>{
      if (data.user) setUserEmail(data.user.email||'')
    })
    supabase.from('profiles').select('business_name,default_delivery_fee').single().then(({data})=>{
      if (data) { setBizName(data.business_name||''); setDeliveryFee(String(data.default_delivery_fee||'')) }
    })
    loadViewers()
  },[])

  async function loadViewers() {
    const { data } = await supabase.from('shared_access').select('*').order('created_at',{ascending:false})
    setViewers(data||[])
  }

  async function saveSettings() {
    const { data:{ user } } = await supabase.auth.getUser()
    await supabase.from('profiles').update({
      business_name:bizName, default_delivery_fee:Number(deliveryFee)||0
    }).eq('id',user!.id)
    setSaved(true); setTimeout(()=>setSaved(false),2000)
  }

  async function addViewer() {
    if (!newEmail.trim()) return
    setAdding(true)
    const { data:{ user } } = await supabase.auth.getUser()

    // Check if already exists
    const { data: ex } = await supabase.from('shared_access').select('id')
      .eq('owner_id',user!.id).eq('viewer_email',newEmail.trim()).maybeSingle()
    if (ex) { showFlash('Энэ хэрэглэгч аль хэдийн нэмэгдсэн байна'); setAdding(false); return }

    const { error } = await supabase.from('shared_access').insert({
      owner_id:user!.id, viewer_email:newEmail.trim(), role:'viewer'
    })
    if (error) { showFlash('Алдаа: '+error.message); setAdding(false); return }

    // Send invite email via Supabase Auth (magic link)
    try {
      await supabase.auth.signInWithOtp({
        email: newEmail.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/app`,
          data: { invited_by: userEmail, role: 'viewer' }
        }
      })
      showFlash('✓ Урилга илгээгдлээ: '+newEmail)
    } catch(e) {
      showFlash('✓ Зочин нэмэгдлээ (имэйл илгээгдээгүй байж магадгүй)')
    }

    setNewEmail('')
    loadViewers()
    setAdding(false)
  }

  async function removeViewer(id: string) {
    await supabase.from('shared_access').delete().eq('id',id)
    setViewers(v=>v.filter(x=>x.id!==id))
    showFlash('Устгагдлаа')
  }

  return (
    <div className="space-y-5">
      {flash&&<div className="fixed top-4 right-4 bg-emerald-700 text-white text-sm px-4 py-2 rounded-lg shadow-lg z-50">{flash}</div>}

      {/* General */}
      <div className="card">
        <h2 className="font-semibold text-gray-800 mb-4 text-base">⚙️ Ерөнхий тохиргоо</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Бизнесийн нэр</label>
            <input className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              value={bizName} onChange={e=>setBizName(e.target.value)} placeholder="Дэлгүүрийн нэр..." />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Өгөгдмөл хүргэлтийн үнэ (₮)
              <span className="text-gray-400 ml-1">— захиалга шивэхэд автоматаар орно</span>
            </label>
            <input type="number" className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              value={deliveryFee} onChange={e=>setDeliveryFee(e.target.value)} placeholder="7000" />
          </div>
        </div>
        <div className="flex justify-end mt-5">
          <button onClick={saveSettings}
            className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${saved?'bg-gray-100 text-gray-500':'bg-emerald-600 text-white hover:bg-emerald-700'}`}>
            {saved?'✓ Хадгалагдлаа':'Хадгалах'}
          </button>
        </div>
      </div>

      {/* Viewer access */}
      <div className="card">
        <h2 className="font-semibold text-gray-800 mb-2 text-base">👁 Зочин хандалт</h2>
        <p className="text-xs text-gray-500 mb-4">
          Зочин хэрэглэгч зөвхөн харах боломжтой — захиалга нэмэх, засах боломжгүй.<br/>
          Имэйл оруулахад тухайн хаягаар нэвтрэх урилга автоматаар илгээгдэнэ.
        </p>
        <div className="flex gap-2 mb-4">
          <input className="flex-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            placeholder="Зочины имэйл хаяг..." value={newEmail} onChange={e=>setNewEmail(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&addViewer()} type="email" />
          <button onClick={addViewer} disabled={adding||!newEmail.trim()}
            className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 whitespace-nowrap">
            {adding?'...':'+ Урих'}
          </button>
        </div>
        {viewers.length>0 ? (
          <div className="space-y-2">
            {viewers.map(v=>(
              <div key={v.id} className="flex justify-between items-center bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-100">
                <div>
                  <div className="text-sm font-medium text-gray-700">{v.viewer_email}</div>
                  <div className="text-xs text-gray-400 mt-0.5">Зөвхөн харах эрх</div>
                </div>
                <button onClick={()=>removeViewer(v.id)}
                  className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50">
                  Устгах
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-4 bg-gray-50 rounded-lg">
            Зочин хэрэглэгч нэмэгдээгүй байна
          </p>
        )}
      </div>

      {/* Account info */}
      <div className="card">
        <h2 className="font-semibold text-gray-800 mb-3 text-base">👤 Бүртгэлийн мэдээлэл</h2>
        <div className="bg-gray-50 rounded-lg px-4 py-3">
          <div className="text-xs text-gray-500 mb-1">Бүртгэлийн имэйл / утас</div>
          <div className="text-sm font-medium text-gray-700">{userEmail}</div>
        </div>
      </div>
    </div>
  )
}

'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { Order } from '@/lib/types'

function fmt(n: number) { return n.toLocaleString() }
function fmtD(d: string) { if(!d) return ''; const [y,m,day]=d.split('-'); return `${y}/${m}/${day}` }
function dayLabel(d: string) {
  const today = new Date().toISOString().slice(0,10)
  const yest = new Date(Date.now()-86400000).toISOString().slice(0,10)
  const label = fmtD(d)
  if (d===today) return `Өнөөдөр  ${label}`
  if (d===yest) return `Өчигдөр  ${label}`
  return label
}

export default function HistoryPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [phone, setPhone] = useState('')
  const [status, setStatus] = useState('all')
  const [dateFilter, setDateFilter] = useState('')
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('orders').select('*, order_items(*)')
      .eq('user_id',user.id).order('date',{ascending:false}).order('day_seq',{ascending:false})
    setOrders(data||[])
  },[])

  useEffect(()=>{ load() },[load])

  async function setOrderStatus(id: string, s: string) {
    await supabase.from('orders').update({status:s}).eq('id',id)
    load()
  }

  async function handleExcelImport(file: File) {
    setImporting(true)
    setImportMsg('Файл уншиж байна...')
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

      // ── Inventory ──
      const iSheet = wb.Sheets['Агуулах'] || wb.Sheets[wb.SheetNames[1]] || wb.Sheets[wb.SheetNames[0]]
      const invRows: any[] = iSheet ? XLSX.utils.sheet_to_json(iSheet,{defval:''}) : []
      let importedProds = 0
      for (const r of invRows) {
        const keys = Object.keys(r)
        const name = (r['Барааны нэр']||r[keys[0]]||'').toString().trim()
        const qty = parseInt(String(r['Тоо ширхэг (үлдэгдэл)']||r['Тоо ширхэг']||r[keys[1]]||'0').replace(/[^\d]/g,''))||0
        const price = parseInt(String(r['Нэгж үнэ (₮)']||r[keys[2]]||'0').replace(/[^\d]/g,''))||0
        if (!name||name.length>60) continue
        const { data: ex } = await supabase.from('products').select('id').eq('user_id',user.id).eq('name',name).maybeSingle()
        if (ex) await supabase.from('products').update({stock:qty,unit_price:price}).eq('id',ex.id)
        else await supabase.from('products').insert({user_id:user.id,name,stock:qty,unit_price:price})
        importedProds++
      }

      // ── Orders ──
      const oSheet = wb.Sheets['Захиалга'] || wb.Sheets[wb.SheetNames[0]]
      const rows: any[] = oSheet ? XLSX.utils.sheet_to_json(oSheet,{defval:'',raw:false}) : []

      const grouped: Record<string,any> = {}
      for (const r of rows) {
        // Try every possible column name variant
        const date = (
          r['Огноо\n(YYYY-MM-DD)']||r['Огноо']||r['Date']||r['date']||
          r[Object.keys(r)[0]]||''
        ).toString().replace(/\./g,'-').trim().slice(0,10)

        const seq = String(r['Захиалгын\nДугаар']||r['Захиалгын Дугаар']||r['Дугаар']||r['№']||'1').replace(/[^\d]/g,'')||'1'
        const ph = (r['Утасны\nДугаар']||r['Утасны Дугаар']||r['Утас']||r['Phone number']||r['phone']||'').toString().trim()
        const addr = (r['Хаяг']||r['Address']||r['address']||'').toString().trim()
        const prod = (r['Барааны нэр']||r['order']||r['Бараа']||'').toString().trim()
        const qty = parseInt(String(r['Тоо ширхэг']||r['Qty']||r['qty']||'1').replace(/[^\d]/g,''))||1
        const price = parseInt(String(r['Нэгж үнэ (₮)']||r['order price']||r['Үнэ']||'0').replace(/[^\d,₮\s]/g,'').replace(/[,\s₮]/g,''))||0
        const delv = parseInt(String(r['Хүргэлтийн үнэ (₮)\n(нэг удаа)']||r['Delivery price']||r['Хүргэлт']||r['delivery']||'0').replace(/[^\d]/g,''))||0
        const rawSt = (r['Хүргэлтийн\nСтатус']||r['Статус']||r['status']||'').toString()
        const st = rawSt.includes('Хүргэгдсэн')||rawSt.toLowerCase().includes('delivered')?'delivered':'pending'

        // Validate date format
        if (!date||!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
        if (!ph||!prod) continue

        const key = `${date}__${seq}__${ph}`
        if (!grouped[key]) grouped[key]={date,seq:parseInt(seq)||1,phone:ph,addr,items:[],delv,status:st}
        grouped[key].items.push({product_name:prod,quantity:qty,unit_price:price})
        if (addr) grouped[key].addr=addr
        if (delv) grouped[key].delv=delv
      }

      let importedOrders=0
      for (const g of Object.values(grouped)) {
        const { data: ord } = await supabase.from('orders').insert({
          user_id:user.id, date:g.date, day_seq:g.seq,
          phone:g.phone, address:g.addr||'-', delivery_fee:g.delv, status:g.status
        }).select().single()
        if (ord&&g.items.length>0) {
          await supabase.from('order_items').insert(g.items.map((it:any)=>({order_id:ord.id,...it})))
        }
        importedOrders++
      }

      setImportMsg(`✓ ${importedOrders} захиалга, ${importedProds} бараа оруулагдлаа`)
      load()
    } catch(err:any) {
      console.error('Excel import error:', err)
      setImportMsg('Алдаа: '+err.message)
    }
    setImporting(false)
  }

  function exportCSV() {
    const rows=[['Огноо','Утас','Хаяг','Бараа','Барааны дүн','Хүргэлт','Цэвэр','Статус']]
    filtered.forEach(o=>{
      const g=(o.order_items||[]).reduce((a:number,i:any)=>a+i.quantity*i.unit_price,0)
      rows.push([o.date,o.phone,o.address,(o.order_items||[]).map((i:any)=>i.product_name+'×'+i.quantity).join(';'),String(g),String(o.delivery_fee),String(g-o.delivery_fee),o.status])
    })
    const csv=rows.map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\n')
    const a=document.createElement('a')
    a.href=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}))
    a.download='orders.csv'; a.click()
  }

  const filtered = orders.filter(o=>{
    if(phone&&!o.phone.includes(phone)) return false
    if(status!=='all'&&o.status!==status) return false
    if(dateFilter&&o.date!==dateFilter) return false
    return true
  })

  // Group by DATE
  const groups: Record<string,Order[]> = {}
  filtered.forEach(o=>{ if(!groups[o.date])groups[o.date]=[]; groups[o.date].push(o) })

  const sbadge = (s: string) => s==='delivered'
    ? <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium whitespace-nowrap">Хүргэгдсэн</span>
    : s==='cancelled'
    ? <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium whitespace-nowrap">Цуцлагдсан</span>
    : <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium whitespace-nowrap">Хүлээгдэж байна</span>

  return (
    <div className="space-y-5">
      {/* Excel Import */}
      <div className="card">
        <h2 className="font-semibold text-gray-800 mb-2 text-base">📊 Хуучин бүртгэл оруулах (Эксел)</h2>
        <p className="text-xs text-gray-500 mb-3">
          Өмнө хөтлөж байсан Excel файлаа оруулахад захиалга болон барааны бүртгэл автоматаар нэмэгдэнэ.
          Огноо нь <b>YYYY-MM-DD</b> эсвэл <b>YYYY.MM.DD</b> форматтай байх шаардлагатай.
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <input type="file" accept=".xlsx,.xls" ref={fileRef} className="hidden"
            onChange={e=>{ if(e.target.files?.[0]){ handleExcelImport(e.target.files[0]); e.target.value='' } }} />
          <button onClick={()=>fileRef.current?.click()} disabled={importing}
            className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 disabled:opacity-60 transition-all">
            {importing?'⏳ Оруулж байна...':'📂 Эксел файл сонгох'}
          </button>
          {importMsg&&(
            <span className={`text-sm font-medium ${importMsg.startsWith('✓')?'text-emerald-600':'text-red-500'}`}>
              {importMsg}
            </span>
          )}
        </div>
      </div>

      {/* History */}
      <div className="card">
        <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
          <h2 className="font-semibold text-gray-800 text-base">📜 Захиалгын түүх</h2>
          <button onClick={exportCSV} className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50">⬇ CSV</button>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-4 flex-wrap">
          <input className="px-3 py-2 rounded-lg border border-gray-200 text-sm flex-1" style={{minWidth:120,maxWidth:160}}
            placeholder="Утасны дугаар..." value={phone} onChange={e=>setPhone(e.target.value)} />
          <input type="date" className="px-3 py-2 rounded-lg border border-gray-200 text-sm"
            value={dateFilter} onChange={e=>setDateFilter(e.target.value)} />
          {dateFilter&&<button onClick={()=>setDateFilter('')} className="px-2 py-2 rounded-lg border border-gray-200 text-xs text-gray-500 hover:bg-gray-50">✕</button>}
          <select className="px-3 py-2 rounded-lg border border-gray-200 text-sm"
            value={status} onChange={e=>setStatus(e.target.value)}>
            <option value="all">Бүх статус</option>
            <option value="pending">Хүлээгдэж байна</option>
            <option value="delivered">Хүргэгдсэн</option>
            <option value="cancelled">Цуцлагдсан</option>
          </select>
        </div>

        {/* Grouped by date */}
        {Object.keys(groups).sort((a,b)=>b.localeCompare(a)).map(date=>{
          const grp=groups[date]
          const tot=grp.reduce((a,o)=>(o.order_items||[]).reduce((s:number,i:any)=>s+i.quantity*i.unit_price,a),0)
          const totNet=tot-grp.reduce((a,o)=>a+(o.delivery_fee||0),0)
          return (
            <div key={date} className="mb-5">
              <div className="flex justify-between py-2 px-3 bg-gray-50 border border-gray-200 rounded-xl mb-2">
                <span className="text-sm font-bold text-gray-700">{dayLabel(date)}</span>
                <span className="text-sm font-semibold text-emerald-700">{fmt(totNet)}₮</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      {['Утас','Хаяг','Бараа','Барааны дүн','Хүргэлт','Цэвэр','Статус',''].map(h=>(
                        <th key={h} className="px-3 py-2 text-xs font-medium text-gray-500 text-left whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {grp.map(o=>{
                      const gross=(o.order_items||[]).reduce((a:number,i:any)=>a+i.quantity*i.unit_price,0)
                      const net=gross-(o.delivery_fee||0)
                      return (
                        <tr key={o.id} className="border-t border-gray-100 hover:bg-gray-50">
                          <td className="px-3 py-2 font-medium whitespace-nowrap">{o.phone}</td>
                          <td className="px-3 py-2 text-gray-500 max-w-[110px] truncate">{o.address}</td>
                          <td className="px-3 py-2 text-xs">{(o.order_items||[]).map((i:any)=>`${i.product_name}×${i.quantity}`).join(', ')}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{fmt(gross)}₮</td>
                          <td className="px-3 py-2 text-gray-400 whitespace-nowrap">{o.delivery_fee>0?fmt(o.delivery_fee)+'₮':'—'}</td>
                          <td className="px-3 py-2 font-semibold text-emerald-700 whitespace-nowrap">{fmt(net)}₮</td>
                          <td className="px-3 py-2">{sbadge(o.status)}</td>
                          <td className="px-3 py-2">
                            <div className="flex gap-1">
                              {o.status!=='cancelled'&&(
                                <button onClick={()=>setOrderStatus(o.id,o.status==='delivered'?'pending':'delivered')}
                                  className={`px-2 py-1 rounded-lg text-xs font-medium transition-all ${o.status==='delivered'?'bg-amber-50 text-amber-600 hover:bg-amber-100':'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}>
                                  {o.status==='delivered'?'↩':'✓'}
                                </button>
                              )}
                              {o.status==='pending'&&(
                                <button onClick={()=>setOrderStatus(o.id,'cancelled')}
                                  className="px-2 py-1 rounded-lg text-xs bg-red-50 text-red-500 hover:bg-red-100">✕</button>
                              )}
                            </div>
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
        {filtered.length===0&&<p className="text-center text-gray-400 py-10">Захиалга олдсонгүй</p>}
      </div>
    </div>
  )
}

'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Product, RestockLog } from '@/lib/types'

const TODAY = new Date().toISOString().slice(0,10)
function fmtD(d: string) { if(!d) return ''; const [y,m,day]=d.split('-'); return `${y}/${m}/${day}` }

export default function StockPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [logs, setLogs] = useState<RestockLog[]>([])
  const [flash, setFlash] = useState('')
  const [logFilter, setLogFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('')
  const [rProd, setRProd] = useState('')
  const [rQty, setRQty] = useState('1')
  const [rDate, setRDate] = useState(TODAY)
  const [rNote, setRNote] = useState('')
  const [nName, setNName] = useState('')
  const [nPrice, setNPrice] = useState('')
  const [nQty, setNQty] = useState('0')
  const [nDate, setNDate] = useState(TODAY)
  const [editLog, setEditLog] = useState<RestockLog|null>(null)
  const [editQty, setEditQty] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editNote, setEditNote] = useState('')

  const showFlash = (m: string) => { setFlash(m); setTimeout(()=>setFlash(''),2500) }

  const load = useCallback(async () => {
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user) return
    const [{ data: prods },{ data: ls }] = await Promise.all([
      supabase.from('products').select('*').eq('user_id',user.id).order('name'),
      // Зөвхөн 'Захиалга' бус бүртгэлийг харуулна
      supabase.from('restock_log').select('*').eq('user_id',user.id)
        .neq('note','Захиалга')
        .order('date',{ascending:false}).order('created_at',{ascending:false})
    ])
    setProducts(prods||[])
    setLogs(ls||[])
    if (prods&&prods.length>0&&!rProd) setRProd(prods[0].id)
  },[rProd])

  useEffect(()=>{ load() },[load])

  async function addRestock() {
    const qty = Number(rQty)
    if (qty===0) { showFlash('Тоо оруулна уу'); return }
    const p = products.find(x=>x.id===rProd)
    if (!p) return
    const { data:{ user } } = await supabase.auth.getUser()
    const isNeg = qty < 0
    const absQty = Math.abs(qty)
    const newStock = isNeg ? Math.max(0, p.stock-absQty) : p.stock+absQty
    await Promise.all([
      supabase.from('products').update({stock:newStock}).eq('id',rProd),
      supabase.from('restock_log').insert({
        user_id:user!.id, product_id:rProd, product_name:p.name,
        quantity:absQty, type:isNeg?'out':'in',
        note:rNote||(isNeg?'Гараар хасалт':'Цэнэглэлт'), date:rDate
      })
    ])
    setRQty('1'); setRNote(''); setRDate(TODAY)
    showFlash(p.name+(isNeg?`: −${absQty}ш хасагдлаа`:`+${absQty}ш нэмэгдлээ`)+' ✓')
    load()
  }

  async function addNewProduct() {
    if (!nName.trim()) { showFlash('Нэр оруулна уу'); return }
    const { data:{ user } } = await supabase.auth.getUser()
    const { data: prod } = await supabase.from('products').insert({
      user_id:user!.id, name:nName.trim(), unit_price:Number(nPrice)||0,
      stock:Number(nQty)||0, added_date:nDate
    }).select().single()
    if (prod&&Number(nQty)>0) await supabase.from('restock_log').insert({
      user_id:user!.id, product_id:prod.id, product_name:nName.trim(),
      quantity:Number(nQty), type:'in', note:'Шинэ бараа', date:nDate
    })
    setNName(''); setNPrice(''); setNQty('0'); setNDate(TODAY)
    showFlash(nName+' нэмэгдлээ ✓'); load()
  }

  async function deleteLog(log: RestockLog) {
    if (!confirm('Энэ бүртгэлийг устгах уу?')) return
    const p = products.find(x=>x.id===log.product_id)
    if (p) await supabase.from('products').update({
      stock: Math.max(0, log.type==='in'?p.stock-log.quantity:p.stock+log.quantity)
    }).eq('id',p.id)
    await supabase.from('restock_log').delete().eq('id',log.id)
    showFlash('Устгагдлаа'); load()
  }

  async function saveEditLog() {
    if (!editLog) return
    const newQty = Number(editQty)
    const diff = newQty-editLog.quantity
    const p = products.find(x=>x.id===editLog.product_id)
    if (p&&diff!==0) await supabase.from('products').update({
      stock: Math.max(0, p.stock+(editLog.type==='in'?diff:-diff))
    }).eq('id',p.id)
    await supabase.from('restock_log').update({quantity:newQty,date:editDate,note:editNote}).eq('id',editLog.id)
    setEditLog(null); showFlash('Засварлагдлаа ✓'); load()
  }

  // Filter logs
  let filteredLogs = logs
  if (logFilter!=='all') filteredLogs = filteredLogs.filter(l=>l.product_name===logFilter)
  if (dateFilter) filteredLogs = filteredLogs.filter(l=>l.date===dateFilter)

  // Group by DATE
  const logGroups: Record<string,RestockLog[]> = {}
  filteredLogs.forEach(l=>{ if(!logGroups[l.date])logGroups[l.date]=[]; logGroups[l.date].push(l) })

  const zeros = products.filter(p=>p.stock===0)
  const warns = products.filter(p=>p.stock>0&&p.stock<=10)

  return (
    <div className="space-y-5">
      {flash&&<div className="fixed top-4 right-4 bg-emerald-700 text-white text-sm px-4 py-2 rounded-lg shadow-lg z-50">{flash}</div>}

      {/* Edit modal */}
      {editLog&&(
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="font-semibold text-gray-800 mb-4">Цэнэглэлт засварлах</h3>
            <div className="space-y-3">
              <div><label className="block text-xs text-gray-500 mb-1">Бараа</label>
                <div className="text-sm font-medium bg-gray-50 px-3 py-2 rounded-lg">{editLog.product_name}</div></div>
              <div><label className="block text-xs text-gray-500 mb-1">Тоо ширхэг</label>
                <input type="number" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  value={editQty} onChange={e=>setEditQty(e.target.value)} /></div>
              <div><label className="block text-xs text-gray-500 mb-1">Огноо</label>
                <input type="date" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  value={editDate} onChange={e=>setEditDate(e.target.value)} /></div>
              <div><label className="block text-xs text-gray-500 mb-1">Тэмдэглэл</label>
                <input className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  value={editNote} onChange={e=>setEditNote(e.target.value)} /></div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={()=>setEditLog(null)} className="flex-1 py-2 rounded-xl border border-gray-200 text-sm">Болих</button>
              <button onClick={saveEditLog} className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold">Хадгалах</button>
            </div>
          </div>
        </div>
      )}

      {/* 1. ЦЭНЭГЛЭЛТ */}
      <div className="card">
        <h2 className="font-semibold text-gray-800 mb-4 text-base">📅 Цэнэглэлтийн бүртгэл</h2>
        <div className="bg-gray-50 rounded-xl p-4 mb-5 border border-gray-100">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div><label className="block text-xs text-gray-500 mb-1">Бараа</label>
              <select className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" value={rProd} onChange={e=>setRProd(e.target.value)}>
                {products.map(p=><option key={p.id} value={p.id}>{p.name} ({p.stock}ш)</option>)}
              </select></div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Тоо ширхэг <span className="text-gray-400">(−тоо бичвэл хасна)</span>
              </label>
              <input type="number" value={rQty} onChange={e=>setRQty(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg border text-sm ${Number(rQty)<0?'border-red-300 bg-red-50 text-red-700 font-semibold':'border-gray-200'}`} />
            </div>
            <div><label className="block text-xs text-gray-500 mb-1">Огноо</label>
              <input type="date" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                value={rDate} onChange={e=>setRDate(e.target.value)} /></div>
          </div>
          <div className="mt-3"><label className="block text-xs text-gray-500 mb-1">Тэмдэглэл</label>
            <input className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
              placeholder="Нийлүүлэгч..." value={rNote} onChange={e=>setRNote(e.target.value)} /></div>
          {Number(rQty)<0&&(
            <div className="mt-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-xs text-red-600">
              ⚠ {Math.abs(Number(rQty))}ш агуулахаас хасагдана
            </div>
          )}
          <div className="flex justify-end mt-3">
            <button onClick={addRestock}
              className={`px-5 py-2 rounded-xl text-sm font-medium text-white transition-all ${Number(rQty)<0?'bg-red-500 hover:bg-red-600':'bg-emerald-600 hover:bg-emerald-700'}`}>
              {Number(rQty)<0?'− Хасах':'+ Цэнэглэлт бүртгэх'}
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-3 flex-wrap items-center">
          <select className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs" value={logFilter} onChange={e=>setLogFilter(e.target.value)}>
            <option value="all">Бүх бараа</option>
            {products.map(p=><option key={p.id} value={p.name}>{p.name}</option>)}
          </select>
          <input type="date" className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs"
            value={dateFilter} onChange={e=>setDateFilter(e.target.value)} title="Өдрөөр шүүх" />
          {dateFilter&&<button onClick={()=>setDateFilter('')} className="px-2 py-1 rounded-lg border border-gray-200 text-xs text-gray-500 hover:bg-gray-50">✕</button>}
        </div>

        {/* Grouped by DATE */}
        {Object.keys(logGroups).sort((a,b)=>b.localeCompare(a)).map(date=>{
          const grp = logGroups[date]
          const totalIn = grp.filter(r=>r.type==='in').reduce((a,r)=>a+r.quantity,0)
          const totalOut = grp.filter(r=>r.type==='out').reduce((a,r)=>a+r.quantity,0)
          return (
            <div key={date} className="mb-4">
              <div className="flex justify-between items-center bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 mb-1.5">
                <span className="text-sm font-bold text-emerald-800">{fmtD(date)}</span>
                <div className="flex gap-2">
                  {totalIn>0&&<span className="text-xs font-medium text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">+{totalIn}ш</span>}
                  {totalOut>0&&<span className="text-xs font-medium text-red-500 bg-red-50 px-2 py-0.5 rounded-full">−{totalOut}ш</span>}
                </div>
              </div>
              {grp.map(r=>(
                <div key={r.id} className="flex justify-between items-center py-2.5 px-2 border-b border-gray-50 last:border-0 hover:bg-gray-50 rounded-lg group">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-800">{r.product_name}</div>
                    {r.note&&<div className="text-xs text-gray-400 mt-0.5">{r.note}</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`text-lg font-semibold ${r.type==='in'?'text-emerald-700':'text-red-500'}`}>
                      {r.type==='in'?'+':'-'}{r.quantity}ш
                    </div>
                    <button onClick={()=>{setEditLog(r);setEditQty(String(r.quantity));setEditDate(r.date);setEditNote(r.note||'')}}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-blue-50 text-blue-500 transition-all text-xs">✏️</button>
                    <button onClick={()=>deleteLog(r)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition-all text-xs">🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          )
        })}
        {filteredLogs.length===0&&<p className="text-center text-gray-400 text-sm py-6">Бүртгэл алга</p>}
      </div>

      {/* 2. ШИНЭ БАРАА */}
      <div className="card">
        <h2 className="font-semibold text-gray-800 mb-4 text-base">🆕 Шинэ бараа оруулах</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div><label className="block text-xs text-gray-500 mb-1">Барааны нэр</label>
            <input className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" placeholder="Нэр..."
              value={nName} onChange={e=>setNName(e.target.value)} /></div>
          <div><label className="block text-xs text-gray-500 mb-1">Нэгж үнэ (₮)</label>
            <input type="number" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
              placeholder="0" value={nPrice} onChange={e=>setNPrice(e.target.value)} /></div>
          <div><label className="block text-xs text-gray-500 mb-1">Анхны тоо</label>
            <input type="number" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
              min="0" value={nQty} onChange={e=>setNQty(e.target.value)} /></div>
          <div><label className="block text-xs text-gray-500 mb-1">Огноо</label>
            <input type="date" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
              value={nDate} onChange={e=>setNDate(e.target.value)} /></div>
        </div>
        <div className="flex justify-end mt-4">
          <button onClick={addNewProduct} className="px-5 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700">+ Нэмэх</button>
        </div>
      </div>

      {/* 3. АНХААРУУЛГА */}
      {(zeros.length>0||warns.length>0)&&(
        <div className="card border-amber-200 bg-amber-50/30">
          <h2 className="font-semibold text-amber-700 mb-3 text-base">⚠️ Цэнэглэх шаардлагатай</h2>
          {zeros.length>0&&<div className="mb-3">
            <p className="text-xs font-semibold text-red-600 mb-2">🔴 Дууссан</p>
            <div className="flex flex-wrap gap-2">{zeros.map(p=><span key={p.id} className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">{p.name}</span>)}</div>
          </div>}
          {warns.length>0&&<div>
            <p className="text-xs font-semibold text-amber-600 mb-2">🟡 Дусах дөхсөн</p>
            <div className="flex flex-wrap gap-2">{warns.map(p=><span key={p.id} className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">{p.name} — {p.stock}ш</span>)}</div>
          </div>}
        </div>
      )}
    </div>
  )
}

'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Product, Order } from '@/lib/types'

const TODAY = new Date().toISOString().slice(0,10)
function fmt(n: number) { return n.toLocaleString() }
function fmtD(d: string) {
  if (!d) return ''
  const [y,m,day] = d.split('-')
  return `${y}/${m}/${day}`
}
function dayLabel(d: string) {
  const today = new Date().toISOString().slice(0,10)
  const yest = new Date(Date.now()-86400000).toISOString().slice(0,10)
  const label = fmtD(d)
  if (d===today) return `Өнөөдөр  ${label}`
  if (d===yest) return `Өчигдөр  ${label}`
  return label
}
function copyText(t: string, cb: ()=>void) {
  navigator.clipboard.writeText(t).then(cb).catch(()=>{})
}

export default function DashPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [flash, setFlash] = useState('')
  const [phoneFilter, setPhoneFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('')
  const [defaultDelivery, setDefaultDelivery] = useState(0)

  // Edit modal
  const [editOrder, setEditOrder] = useState<Order|null>(null)
  const [editPhone, setEditPhone] = useState('')
  const [editAddr, setEditAddr] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editStatus, setEditStatus] = useState('')
  const [editDelv, setEditDelv] = useState('')

  // New order form
  const [oDate, setODate] = useState(TODAY)
  const [oPhone, setOPhone] = useState('')
  const [oAddr, setOAddr] = useState('')
  const [oDelv, setODelv] = useState('')
  const [oItems, setOItems] = useState([{product_id:'',product_name:'',qty:'1',price:''}])

  const showFlash = (m: string) => { setFlash(m); setTimeout(()=>setFlash(''),2500) }

  const load = useCallback(async () => {
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: prof } = await supabase.from('profiles').select('default_delivery_fee').eq('id',user.id).single()
    if (prof?.default_delivery_fee) {
      setDefaultDelivery(prof.default_delivery_fee)
      setODelv(v => (!v||v==='0') ? String(prof.default_delivery_fee) : v)
    }
    const [{ data: prods },{ data: ords }] = await Promise.all([
      supabase.from('products').select('*').eq('user_id',user.id).order('name'),
      supabase.from('orders').select('*, order_items(*)').eq('user_id',user.id)
        .order('date',{ascending:false}).order('day_seq',{ascending:false})
    ])
    setProducts(prods||[])
    setOrders(ords||[])
    if (prods&&prods.length>0) {
      setOItems(i=>i.map((it,idx)=>idx===0&&!it.product_id
        ?{...it,product_id:prods[0].id,product_name:prods[0].name,price:String(prods[0].unit_price)}:it))
    }
  },[])

  useEffect(()=>{ load() },[load])

  function addItem() {
    setOItems(i=>[...i,{product_id:products[0]?.id||'',product_name:products[0]?.name||'',qty:'1',price:String(products[0]?.unit_price||'')}])
  }
  function removeItem(idx: number) { setOItems(i=>i.filter((_,j)=>j!==idx)) }
  function setItem(idx: number, key: string, val: string) {
    setOItems(items=>items.map((it,i)=>{
      if(i!==idx) return it
      if(key==='product_id'){const p=products.find(x=>x.id===val);return{...it,product_id:val,product_name:p?.name||'',price:String(p?.unit_price||'')}}
      return{...it,[key]:val}
    }))
  }

  const gross = oItems.reduce((a,i)=>a+(Number(i.qty)||0)*(Number(i.price)||0),0)
  const net = gross-(Number(oDelv)||0)

  async function submitOrder() {
    if (!oPhone||!oAddr){showFlash('Утас, хаяг оруулна уу');return}
    const { data:{ user } } = await supabase.auth.getUser()
    for (const it of oItems){
      const p=products.find(x=>x.id===it.product_id)
      if(!p||p.stock<Number(it.qty)){showFlash((p?.name||'Бараа')+' хүрэлцэхгүй! '+( p?.stock||0));return}
    }
    const { data: seqData } = await supabase.rpc('get_day_seq',{p_user_id:user!.id,p_date:oDate||TODAY})
    const { data: order } = await supabase.from('orders').insert({
      user_id:user!.id,date:oDate||TODAY,day_seq:seqData||1,
      phone:oPhone,address:oAddr,delivery_fee:Number(oDelv)||0,status:'pending'
    }).select().single()
    if (order){
      await supabase.from('order_items').insert(oItems.map(it=>({
        order_id:order.id,product_id:it.product_id,product_name:it.product_name,
        quantity:Number(it.qty),unit_price:Number(it.price)
      })))
      for(const it of oItems){
        const p=products.find(x=>x.id===it.product_id)!
        await supabase.from('products').update({stock:p.stock-Number(it.qty)}).eq('id',it.product_id)
        await supabase.from('restock_log').insert({
          user_id:user!.id,product_id:it.product_id,product_name:it.product_name,
          quantity:Number(it.qty),type:'out',note:'Захиалга',date:oDate||TODAY
        })
      }
    }
    setOPhone('');setOAddr('');setODelv(String(defaultDelivery))
    setOItems([{product_id:products[0]?.id||'',product_name:products[0]?.name||'',qty:'1',price:String(products[0]?.unit_price||'')}])
    showFlash('Захиалга бүртгэгдлээ ✓');load()
  }

  async function toggleStatus(id: string, cur: string) {
    const next=cur==='pending'?'delivered':'pending'
    await supabase.from('orders').update({status:next}).eq('id',id)
    showFlash(next==='delivered'?'Хүргэгдсэн ✓':'Хүлээгдэж байна болгов');load()
  }

  async function saveEditOrder() {
    if(!editOrder) return
    await supabase.from('orders').update({
      phone:editPhone,address:editAddr,status:editStatus,
      delivery_fee:Number(editDelv)||0,date:editDate
    }).eq('id',editOrder.id)
    setEditOrder(null);showFlash('Засварлагдлаа ✓');load()
  }

  async function deleteOrder(o: Order) {
    if(!confirm('Захиалга устгах уу?')) return
    if(o.status==='pending'){
      for(const it of (o.order_items||[])){
        const p=products.find(x=>x.id===(it as any).product_id)
        if(p) await supabase.from('products').update({stock:p.stock+(it as any).quantity}).eq('id',p.id)
      }
    }
    await supabase.from('order_items').delete().eq('order_id',o.id)
    await supabase.from('orders').delete().eq('id',o.id)
    showFlash('Устгагдлаа');load()
  }

  // Filter
  const filtered = orders.filter(o=>{
    if(phoneFilter&&!o.phone.includes(phoneFilter)) return false
    if(statusFilter!=='all'&&o.status!==statusFilter) return false
    if(dateFilter&&o.date!==dateFilter) return false
    return true
  })

  // Group by DATE
  const groups: Record<string,Order[]> = {}
  filtered.forEach(o=>{ if(!groups[o.date])groups[o.date]=[]; groups[o.date].push(o) })

  const totalStock=products.reduce((a,p)=>a+p.stock,0)
  const pending=orders.filter(o=>o.status==='pending').length

  return (
    <div className="space-y-5">
      {flash&&<div className="fixed top-4 right-4 bg-emerald-700 text-white text-sm px-4 py-2 rounded-lg shadow-lg z-50">{flash}</div>}

      {/* Edit modal */}
      {editOrder&&(
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="font-semibold text-gray-800 mb-4">Захиалга засварлах</h3>
            <div className="space-y-3">
              <div><label className="block text-xs text-gray-500 mb-1">Огноо</label>
                <input type="date" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  value={editDate} onChange={e=>setEditDate(e.target.value)} /></div>
              <div><label className="block text-xs text-gray-500 mb-1">Утасны дугаар</label>
                <input className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  value={editPhone} onChange={e=>setEditPhone(e.target.value)} /></div>
              <div><label className="block text-xs text-gray-500 mb-1">Хаяг</label>
                <input className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  value={editAddr} onChange={e=>setEditAddr(e.target.value)} /></div>
              <div><label className="block text-xs text-gray-500 mb-1">Хүргэлтийн үнэ (₮)</label>
                <input type="number" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  value={editDelv} onChange={e=>setEditDelv(e.target.value)} /></div>
              <div><label className="block text-xs text-gray-500 mb-1">Статус</label>
                <select className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                  value={editStatus} onChange={e=>setEditStatus(e.target.value)}>
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
        {[
          ['Нийт үлдэгдэл',String(totalStock),'text-emerald-700'],
          ['Хүлээгдэж байна',String(pending),'text-amber-600'],
          ['Нийт захиалга',String(orders.length),'text-gray-700']
        ].map(([l,v,c])=>(
          <div key={l} className="card text-center py-3">
            <div className="text-xs text-gray-400 mb-1">{l}</div>
            <div className={`text-2xl font-bold ${c}`}>{v}</div>
          </div>
        ))}
      </div>

      {/* New order form */}
      <div className="card">
        <h2 className="font-semibold text-gray-800 mb-4 text-base">➕ Шинэ захиалга</h2>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-xs text-gray-500 mb-1">Огноо</label>
            <input type="date" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
              value={oDate} onChange={e=>setODate(e.target.value)} /></div>
          <div><label className="block text-xs text-gray-500 mb-1">Утасны дугаар</label>
            <input className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
              placeholder="89639100" value={oPhone} onChange={e=>setOPhone(e.target.value)} /></div>
        </div>
        <label className="block text-xs text-gray-500 mb-1 mt-3">Хаяг</label>
        <input className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
          placeholder="Дүүрэг, хороо, байр..." value={oAddr} onChange={e=>setOAddr(e.target.value)} />
        <label className="block text-xs text-gray-500 mb-1 mt-3">Захиалсан бараанууд</label>
        <div className="border border-gray-100 rounded-lg p-3 bg-gray-50 space-y-2 mb-2">
          {oItems.map((it,idx)=>(
            <div key={idx} className="grid grid-cols-[1fr_70px_100px_32px] gap-2 items-center">
              <select className="w-full px-2 py-2 rounded-lg border border-gray-200 text-sm"
                value={it.product_id} onChange={e=>setItem(idx,'product_id',e.target.value)}>
                {products.map(p=><option key={p.id} value={p.id}>{p.name} ({p.stock}ш)</option>)}
              </select>
              <input type="number" className="w-full px-2 py-2 rounded-lg border border-gray-200 text-sm text-center"
                min="1" value={it.qty} onChange={e=>setItem(idx,'qty',e.target.value)} />
              <input type="number" className="w-full px-2 py-2 rounded-lg border border-gray-200 text-sm"
                value={it.price} onChange={e=>setItem(idx,'price',e.target.value)} placeholder="Үнэ" />
              {oItems.length>1&&<button onClick={()=>removeItem(idx)}
                className="w-8 h-8 flex items-center justify-center bg-red-50 text-red-500 rounded-lg text-xs">✕</button>}
            </div>
          ))}
        </div>
        <button onClick={addItem} className="text-xs text-emerald-600 hover:underline mb-3">＋ Бараа нэмэх</button>
        <div className="max-w-xs">
          <label className="block text-xs text-gray-500 mb-1">
            Хүргэлтийн үнэ (₮){defaultDelivery>0&&<span className="text-gray-400 ml-1">— өгөгдмөл: {fmt(defaultDelivery)}₮</span>}
          </label>
          <input type="number" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
            value={oDelv} onChange={e=>setODelv(e.target.value)} />
        </div>
        {gross>0&&<div className="mt-2 text-sm font-medium text-emerald-700">
          Нийт: {fmt(gross)}₮{Number(oDelv)>0?` − ${fmt(Number(oDelv))}₮ = ${fmt(net)}₮ цэвэр`:''}
        </div>}
        <div className="flex justify-end mt-4">
          <button onClick={submitOrder} className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700">
            ✓ Захиалга бүртгэх
          </button>
        </div>
      </div>

      {/* Orders list */}
      <div className="card">
        <h2 className="font-semibold text-gray-800 mb-3 text-base">📋 Захиалгын бүртгэл</h2>

        {/* Filters — Засвар 3: утас + огноогоор хайх */}
        <div className="flex gap-2 mb-4 flex-wrap">
          <input className="px-3 py-2 rounded-lg border border-gray-200 text-sm flex-1" style={{minWidth:120,maxWidth:160}}
            placeholder="Утасны дугаар..." value={phoneFilter} onChange={e=>setPhoneFilter(e.target.value)} />
          <input type="date" className="px-3 py-2 rounded-lg border border-gray-200 text-sm"
            value={dateFilter} onChange={e=>setDateFilter(e.target.value)}
            title="Өдрөөр шүүх" />
          {dateFilter&&<button onClick={()=>setDateFilter('')} className="px-2 py-2 rounded-lg border border-gray-200 text-xs text-gray-500 hover:bg-gray-50">✕</button>}
          <select className="px-3 py-2 rounded-lg border border-gray-200 text-sm"
            value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
            <option value="all">Бүх статус</option>
            <option value="pending">Хүлээгдэж байна</option>
            <option value="delivered">Хүргэгдсэн</option>
          </select>
        </div>

        {/* Grouped by date */}
        {Object.keys(groups).sort((a,b)=>b.localeCompare(a)).map(date=>{
          const grp=groups[date]
          const dayGross=grp.reduce((a,o)=>(o.order_items||[]).reduce((s:number,i:any)=>s+i.quantity*i.unit_price,a),0)
          const dayDelv=grp.reduce((a,o)=>a+(o.delivery_fee||0),0)
          const dayNet=dayGross-dayDelv
          return (
            <div key={date} className="mb-5">
              {/* Day header */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 mb-2 flex justify-between items-center flex-wrap gap-2">
                <span className="text-sm font-bold text-gray-700">{dayLabel(date)}</span>
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
                  return (
                    <div key={o.id} className={`rounded-xl border px-3.5 py-3 ${o.status==='delivered'?'border-emerald-100 bg-emerald-50/30':'border-gray-100 bg-white'}`}>
                      {/* Single row layout: утас · хаяг · бараа · үнэ · хүргэлт = орлого · Засах · Төлөв */}
                      <div className="flex items-center gap-2 flex-wrap text-sm">
                        {/* Утас */}
                        <button onClick={()=>copyText(o.phone,()=>showFlash('Утас хуулагдлаа ✓'))}
                          className="font-semibold text-gray-800 hover:text-emerald-600 whitespace-nowrap" title="Copy">
                          {o.phone}
                        </button>
                        <span className="text-gray-300">·</span>
                        {/* Хаяг */}
                        <button onClick={()=>copyText(o.address,()=>showFlash('Хаяг хуулагдлаа ✓'))}
                          className="text-xs text-gray-500 hover:text-emerald-600 max-w-[140px] truncate" title="Copy">
                          {o.address}
                        </button>
                        <span className="text-gray-300">·</span>
                        {/* Бараа */}
                        <span className="text-xs text-gray-500">{itemsStr}</span>
                        <span className="text-gray-300">·</span>
                        {/* Үнэ тооцоо */}
                        <span className="text-xs text-gray-500">
                          {fmt(gross)}₮
                          {o.delivery_fee>0&&<span className="text-gray-400"> −{fmt(o.delivery_fee)}₮</span>}
                          {' = '}
                          <span className="font-semibold text-emerald-700">{fmt(net)}₮</span>
                        </span>
                        {/* Засах */}
                        <button onClick={()=>{
                          setEditOrder(o);setEditPhone(o.phone);setEditAddr(o.address);
                          setEditDate(o.date||TODAY);setEditStatus(o.status);setEditDelv(String(o.delivery_fee||''))
                        }} className="text-xs text-blue-400 hover:text-blue-600 px-1.5 py-0.5 rounded hover:bg-blue-50">
                          Засах
                        </button>
                        <button onClick={()=>deleteOrder(o)}
                          className="text-xs text-red-300 hover:text-red-500 px-1 py-0.5 rounded hover:bg-red-50">🗑</button>
                        {/* Төлөв */}
                        <button onClick={()=>toggleStatus(o.id,o.status)}
                          className={`text-xs px-2.5 py-1 rounded-full font-medium border transition-all whitespace-nowrap ${
                            o.status==='delivered'?'bg-emerald-100 text-emerald-700 border-emerald-200':'bg-gray-100 text-gray-500 border-gray-200'
                          }`}>
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
