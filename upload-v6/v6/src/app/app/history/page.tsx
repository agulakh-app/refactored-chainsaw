'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { Order } from '@/lib/types'

function fmt(n: number) { return n.toLocaleString() }
function fmtDateLabel(d: string) {
  const [y,m,day] = d.split('-')
  const today = new Date().toISOString().slice(0,10)
  const yest = new Date(Date.now()-86400000).toISOString().slice(0,10)
  if (d===today) return `Өнөөдөр — ${y}/${m}/${day}`
  if (d===yest) return `Өчигдөр — ${y}/${m}/${day}`
  return `${y}/${m}/${day}`
}

export default function HistoryPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [phone, setPhone] = useState('')
  const [status, setStatus] = useState('all')
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('orders').select('*, order_items(*)').eq('user_id',user.id)
      .order('date',{ascending:false}).order('day_seq',{ascending:false})
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

    // Load XLSX dynamically
    const loadXLSX = (): Promise<any> => new Promise((resolve) => {
      if ((window as any).XLSX) { resolve((window as any).XLSX); return }
      const script = document.createElement('script')
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
      script.onload = () => resolve((window as any).XLSX)
      document.head.appendChild(script)
    })

    try {
      const arrayBuf = await file.arrayBuffer()
      const XLSX = await loadXLSX()
      const wb = XLSX.read(new Uint8Array(arrayBuf), {type:'array'})

      // ── Inventory sheet ──
      const iSheet = wb.Sheets['Агуулах'] || wb.Sheets[wb.SheetNames[1]]
      const invRows: any[] = iSheet ? XLSX.utils.sheet_to_json(iSheet,{defval:''}) : []
      let importedProds = 0
      for (const r of invRows) {
        const name = (r['Барааны нэр']||'').toString().trim()
        const qty = parseInt(r['Тоо ширхэг (үлдэгдэл)']||r['Тоо ширхэг']||'0')||0
        const price = parseInt(r['Нэгж үнэ (₮)']||'0')||0
        if (!name) continue
        const { data: ex } = await supabase.from('products').select('id').eq('user_id',user.id).eq('name',name).maybeSingle()
        if (ex) await supabase.from('products').update({stock:qty,unit_price:price}).eq('id',ex.id)
        else await supabase.from('products').insert({user_id:user.id,name,stock:qty,unit_price:price})
        importedProds++
      }

      // ── Orders sheet ──
      const oSheet = wb.Sheets['Захиалга'] || wb.Sheets[wb.SheetNames[0]]
      const rows: any[] = oSheet ? XLSX.utils.sheet_to_json(oSheet,{defval:'',raw:false}) : []

      const grouped: Record<string,any> = {}
      for (const r of rows) {
        // Support multiple column name variants
        const date = (r['Огноо\n(YYYY-MM-DD)']||r['Огноо']||r['Date']||'').toString().replace(/\./g,'-').trim()
        const seq = String(r['Захиалгын\nДугаар']||r['Захиалгын Дугаар']||r['Дугаар']||'1').trim()
        const ph = (r['Утасны\nДугаар']||r['Утасны Дугаар']||r['Утас']||r['Phone number']||'').toString().trim()
        const addr = (r['Хаяг']||r['Address']||'').toString().trim()
        const prod = (r['Барааны нэр']||r['order']||'').toString().trim()
        const qty = parseInt(r['Тоо ширхэг']||r['Qty']||'1')||1
        const price = parseInt((r['Нэгж үнэ (₮)']||r['order price']||'0').toString().replace(/[^\d]/g,''))||0
        const delv = parseInt((r['Хүргэлтийн үнэ (₮)\n(нэг удаа)']||r['Delivery price']||r['Хүргэлт']||'0').toString().replace(/[^\d]/g,''))||0
        const rawSt = (r['Хүргэлтийн\nСтатус']||r['Статус']||'').toString()
        const st = rawSt.includes('Хүргэгдсэн')||rawSt.toLowerCase().includes('delivered')?'delivered':'pending'
        if (!date||!ph||!prod) continue
        const key = `${date}__${seq}__${ph}`
        if (!grouped[key]) grouped[key]={date,seq:parseInt(seq)||1,phone:ph,addr,items:[],delv,status:st}
        grouped[key].items.push({product_name:prod,quantity:qty,unit_price:price})
        if (addr) grouped[key].addr=addr
        if (delv) grouped[key].delv=delv
      }

      let importedOrders = 0
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
      console.error(err)
      setImportMsg('Алдаа: '+err.message+' — Загвар файл ашиглана уу')
    }
    setImporting(false)
  }

  function exportCSV() {
    const rows = [['Огноо','Утас','Хаяг','Бараа','Барааны дүн','Хүргэлт','Цэвэр','Статус']]
    filtered.forEach(o=>{
      const gross=(o.order_items||[]).reduce((a:number,i:any)=>a+i.quantity*i.unit_price,0)
      rows.push([o.date,o.phone,o.address,(o.order_items||[]).map((i:any)=>i.product_name+'×'+i.quantity).join(';'),String(gross),String(o.delivery_fee),String(gross-o.delivery_fee),o.status])
    })
    const csv=rows.map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\n')
    const a=document.createElement('a')
    a.href=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}))
    a.download='orders.csv'; a.click()
  }

  const filtered = orders.filter(o=>{
    if(phone&&!o.phone.includes(phone)) return false
    if(status!=='all'&&o.status!==status) return false
    return true
  })

  // Group by DATE
  const groups: Record<string,Order[]> = {}
  filtered.forEach(o=>{ if(!groups[o.date])groups[o.date]=[]; groups[o.date].push(o) })

  const sbadge = (s: string) => s==='delivered'
    ? <span className="inline-block px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">Хүргэгдсэн</span>
    : s==='cancelled'
    ? <span className="inline-block px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">Цуцлагдсан</span>
    : <span className="inline-block px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">Хүлээгдэж байна</span>

  return (
    <div className="space-y-5">
      {/* Excel Import */}
      <div className="card">
        <h2 className="font-semibold text-gray-800 mb-2 text-base">📊 Хуучин бүртгэл оруулах (Эксел)</h2>
        <p className="text-xs text-gray-500 mb-3">Өмнө хөтлөж байсан Excel файлаа оруулахад захиалга болон барааны бүртгэл автоматаар нэмэгдэнэ. Загвар файлтай байвал илүү найдвартай.</p>
        <div className="flex items-center gap-3 flex-wrap">
          <input type="file" accept=".xlsx,.xls" ref={fileRef} className="hidden"
            onChange={e=>e.target.files?.[0]&&handleExcelImport(e.target.files[0])} />
          <button onClick={()=>fileRef.current?.click()} disabled={importing}
            className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 disabled:opacity-60">
            {importing?'⏳ Оруулж байна...':'📂 Эксел файл сонгох'}
          </button>
          {importMsg&&<span className={`text-sm font-medium ${importMsg.startsWith('✓')?'text-emerald-600':'text-red-500'}`}>{importMsg}</span>}
        </div>
      </div>

      {/* History */}
      <div className="card">
        <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
          <h2 className="font-semibold text-gray-800 text-base">📜 Захиалгын түүх</h2>
          <button onClick={exportCSV} className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50">⬇ CSV татах</button>
        </div>
        <div className="flex gap-2 mb-4 flex-wrap">
          <input className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm" style={{maxWidth:200}} placeholder="Утасны дугаараар шүүх..." value={phone} onChange={e=>setPhone(e.target.value)} />
          <select className="px-3 py-2 rounded-lg border border-gray-200 text-sm" value={status} onChange={e=>setStatus(e.target.value)}>
            <option value="all">Бүх статус</option>
            <option value="pending">Хүлээгдэж байна</option>
            <option value="delivered">Хүргэгдсэн</option>
            <option value="cancelled">Цуцлагдсан</option>
          </select>
        </div>

        {Object.keys(groups).sort((a,b)=>b.localeCompare(a)).map(date=>{
          const grp=groups[date]
          const tot=grp.reduce((a,o)=>(o.order_items||[]).reduce((s:number,i:any)=>s+i.quantity*i.unit_price,a),0)
          const totNet=tot-grp.reduce((a,o)=>a+(o.delivery_fee||0),0)
          return (
            <div key={date} className="mb-5">
              <div className="flex justify-between py-2 px-3 bg-gray-50 border border-gray-200 rounded-xl mb-2">
                <span className="text-sm font-bold text-gray-700">{fmtDateLabel(date)}</span>
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
                      const net=gross-o.delivery_fee
                      return (
                        <tr key={o.id} className="border-t border-gray-100 hover:bg-gray-50">
                          <td className="px-3 py-2 font-medium whitespace-nowrap">{o.phone}</td>
                          <td className="px-3 py-2 text-gray-500 max-w-[110px] truncate">{o.address}</td>
                          <td className="px-3 py-2 text-xs text-gray-600">{(o.order_items||[]).map((i:any)=>`${i.product_name}×${i.quantity}`).join(', ')}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{fmt(gross)}₮</td>
                          <td className="px-3 py-2 text-gray-400 whitespace-nowrap">{o.delivery_fee>0?fmt(o.delivery_fee)+'₮':'—'}</td>
                          <td className="px-3 py-2 font-semibold text-emerald-700 whitespace-nowrap">{fmt(net)}₮</td>
                          <td className="px-3 py-2">{sbadge(o.status)}</td>
                          <td className="px-3 py-2">
                            <div className="flex gap-1">
                              {o.status!=='cancelled'&&(
                                <button onClick={()=>setOrderStatus(o.id,o.status==='delivered'?'pending':'delivered')}
                                  className={`px-2 py-1 rounded-lg text-xs font-medium ${o.status==='delivered'?'bg-amber-50 text-amber-600':'bg-emerald-50 text-emerald-600'}`}>
                                  {o.status==='delivered'?'↩':'✓'}
                                </button>
                              )}
                              {o.status==='pending'&&(
                                <button onClick={()=>setOrderStatus(o.id,'cancelled')} className="px-2 py-1 rounded-lg text-xs bg-red-50 text-red-500">✕</button>
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
