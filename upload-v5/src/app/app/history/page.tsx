'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { Order } from '@/lib/types'

declare const XLSX: any

function fmtYM(ym: string) { const [y,m] = ym.split('-'); return `${y}оны ${parseInt(m)}р сар` }
function fmt(n: number) { return n.toLocaleString() }

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
    const { data } = await supabase.from('orders').select('*, order_items(*)').eq('user_id', user.id)
      .order('date', { ascending: false }).order('day_seq', { ascending: false })
    setOrders(data || [])
  }, [])

  useEffect(() => { load() }, [load])

  async function setOrderStatus(id: string, s: string) {
    await supabase.from('orders').update({ status: s }).eq('id', id)
    load()
  }

  async function handleExcelImport(file: File) {
    setImporting(true)
    setImportMsg('Файл уншиж байна...')
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user) return

    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const script = document.createElement('script')
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
        script.onload = async () => {
          const data = new Uint8Array(e.target!.result as ArrayBuffer)
          const wb = (window as any).XLSX.read(data, { type: 'array' })

          // Read orders sheet
          const oSheet = wb.Sheets['Захиалга'] || wb.Sheets[wb.SheetNames[0]]
          const rows: any[] = oSheet ? (window as any).XLSX.utils.sheet_to_json(oSheet, { defval: '' }) : []

          // Read inventory sheet
          const iSheet = wb.Sheets['Агуулах'] || wb.Sheets[wb.SheetNames[1]]
          const invRows: any[] = iSheet ? (window as any).XLSX.utils.sheet_to_json(iSheet, { defval: '' }) : []

          let importedOrders = 0
          let importedProds = 0

          // Import inventory
          for (const r of invRows) {
            const name = (r['Барааны нэр'] || '').toString().trim()
            const qty = parseInt(r['Тоо ширхэг (үлдэгдэл)']) || 0
            const price = parseInt(r['Нэгж үнэ (₮)']) || 0
            if (!name) continue
            const { data: existing } = await supabase.from('products').select('id').eq('user_id', user.id).eq('name', name).single()
            if (existing) {
              await supabase.from('products').update({ stock: qty, unit_price: price }).eq('id', existing.id)
            } else {
              await supabase.from('products').insert({ user_id: user.id, name, stock: qty, unit_price: price })
            }
            importedProds++
          }

          // Group order rows by date + seq
          const grouped: Record<string, any> = {}
          for (const r of rows) {
            const date = (r['Огноо\n(YYYY-MM-DD)'] || r['Огноо'] || '').toString().trim()
            const seq = String(r['Захиалгын\nДугаар'] || r['Захиалгын Дугаар'] || '1')
            const phone = (r['Утасны\nДугаар'] || r['Утасны Дугаар'] || r['Утас'] || '').toString().trim()
            const addr = (r['Хаяг'] || '').toString().trim()
            const prod = (r['Барааны нэр'] || '').toString().trim()
            const qty = parseInt(r['Тоо ширхэг']) || 1
            const price = parseInt(r['Нэгж үнэ (₮)']) || 0
            const delv = parseInt(r['Хүргэлтийн үнэ (₮)\n(нэг удаа)'] || r['Хүргэлт'] || '0') || 0
            const rawStatus = (r['Хүргэлтийн\nСтатус'] || r['Статус'] || '').toString()
            const status = rawStatus.includes('Хүргэгдсэн') ? 'delivered' : 'pending'
            if (!date || !phone || !prod) continue
            const key = `${date}__${seq}__${phone}`
            if (!grouped[key]) grouped[key] = { date, seq: parseInt(seq) || 1, phone, addr, items: [], delv, status }
            grouped[key].items.push({ product_name: prod, quantity: qty, unit_price: price })
            if (addr) grouped[key].addr = addr
          }

          for (const g of Object.values(grouped)) {
            const { data: ord } = await supabase.from('orders').insert({
              user_id: user.id, date: g.date, day_seq: g.seq,
              phone: g.phone, address: g.addr || '-', delivery_fee: g.delv, status: g.status
            }).select().single()
            if (ord) {
              await supabase.from('order_items').insert(g.items.map((it: any) => ({ order_id: ord.id, ...it })))
            }
            importedOrders++
          }

          setImportMsg(`✓ ${importedOrders} захиалга, ${importedProds} бараа оруулагдлаа`)
          setImporting(false)
          load()
        }
        if (!document.querySelector('script[src*="xlsx"]')) document.head.appendChild(script)
        else script.onload!(new Event('load'))
      } catch (err) {
        setImportMsg('Алдаа гарлаа. Загвар файл ашиглана уу.')
        setImporting(false)
      }
    }
    reader.readAsArrayBuffer(file)
  }

  function exportCSV() {
    const rows = [['Дэс №','Огноо','Утас','Хаяг','Бараа','Барааны дүн','Хүргэлт','Цэвэр','Статус']]
    filtered.forEach(o => {
      const gross = (o.order_items||[]).reduce((a:number,i:any)=>a+i.quantity*i.unit_price,0)
      rows.push([String(o.day_seq),o.date,o.phone,o.address,(o.order_items||[]).map((i:any)=>i.product_name+'×'+i.quantity).join(';'),String(gross),String(o.delivery_fee),String(gross-o.delivery_fee),o.status])
    })
    const csv = rows.map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}))
    a.download = 'orders.csv'; a.click()
  }

  const filtered = orders.filter(o => {
    if (phone && !o.phone.includes(phone)) return false
    if (status !== 'all' && o.status !== status) return false
    return true
  })
  const groups: Record<string, Order[]> = {}
  filtered.forEach(o => { const ym=o.date.slice(0,7); if(!groups[ym])groups[ym]=[]; groups[ym].push(o) })

  const sbadge = (s: string) => s === 'delivered'
    ? <span className="badge badge-green">Хүргэгдсэн</span>
    : s === 'cancelled'
    ? <span className="badge badge-red">Цуцлагдсан</span>
    : <span className="badge badge-amber">Хүлээгдэж байна</span>

  return (
    <div className="space-y-5">
      {/* Excel Import Card */}
      <div className="card">
        <h2 className="font-semibold text-gray-800 mb-3 text-base flex items-center gap-2">
          📊 Хуучин бүртгэл оруулах (Эксел)
        </h2>
        <p className="text-xs text-gray-500 mb-3">Өмнө хөтлөж байсан Excel файлаа оруулахад захиалга болон барааны бүртгэл автоматаар нэмэгдэнэ.</p>
        <div className="flex items-center gap-3 flex-wrap">
          <input type="file" accept=".xlsx,.xls" ref={fileRef} className="hidden"
            onChange={e => e.target.files?.[0] && handleExcelImport(e.target.files[0])} />
          <button onClick={() => fileRef.current?.click()} disabled={importing}
            className="btn btn-primary disabled:opacity-60">
            {importing ? '⏳ Оруулж байна...' : '📂 Эксел файл сонгох'}
          </button>
          <a href="/agulakh_template.xlsx" className="btn btn-ghost text-xs">⬇ Загвар татах</a>
          {importMsg && <span className={`text-sm font-medium ${importMsg.startsWith('✓') ? 'text-emerald-600' : 'text-red-500'}`}>{importMsg}</span>}
        </div>
      </div>

      <div className="card">
        <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
          <h2 className="font-semibold text-gray-800 text-base">📜 Захиалгын түүх</h2>
          <button onClick={exportCSV} className="btn btn-ghost text-xs">⬇ CSV татах</button>
        </div>
        <div className="flex gap-2 mb-4 flex-wrap">
          <input className="input flex-1" style={{maxWidth:200}} placeholder="Утасны дугаараар шүүх..." value={phone} onChange={e => setPhone(e.target.value)} />
          <select className="input" style={{width:'auto'}} value={status} onChange={e => setStatus(e.target.value)}>
            <option value="all">Бүх статус</option>
            <option value="pending">Хүлээгдэж байна</option>
            <option value="delivered">Хүргэгдсэн</option>
            <option value="cancelled">Цуцлагдсан</option>
          </select>
        </div>
        {Object.keys(groups).sort((a,b)=>b.localeCompare(a)).map(ym => {
          const grp = groups[ym]
          const tot = grp.reduce((a,o)=>a+(o.order_items||[]).reduce((s:number,i:any)=>s+i.quantity*i.unit_price,0),0)
          return (
            <div key={ym} className="mb-6">
              <div className="flex justify-between py-1.5 border-b border-gray-100 mb-3">
                <span className="text-xs font-semibold text-gray-500">{fmtYM(ym)}</span>
                <span className="text-xs text-gray-400">{grp.length} захиалга · {fmt(tot)}₮</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      {['№','Огноо','Утас','Хаяг','Бараа','Барааны дүн','Хүргэлт','Цэвэр','Статус',''].map(h=>(
                        <th key={h} className="px-3 py-2 text-xs font-medium text-gray-500 text-left whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {grp.map(o => {
                      const gross = (o.order_items||[]).reduce((a:number,i:any)=>a+i.quantity*i.unit_price,0)
                      const net = gross - o.delivery_fee
                      return (
                        <tr key={o.id} className="border-t border-gray-100 hover:bg-gray-50">
                          <td className="px-3 py-2 font-bold text-gray-700">{o.day_seq}</td>
                          <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{o.date}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{o.phone}</td>
                          <td className="px-3 py-2 text-gray-500 max-w-[110px] truncate">{o.address}</td>
                          <td className="px-3 py-2 text-xs">{(o.order_items||[]).map((i:any)=>`${i.product_name}×${i.quantity}`).join(', ')}</td>
                          <td className="px-3 py-2 text-right whitespace-nowrap">{fmt(gross)}₮</td>
                          <td className="px-3 py-2 text-right text-gray-400 whitespace-nowrap">{o.delivery_fee>0?fmt(o.delivery_fee)+'₮':'—'}</td>
                          <td className="px-3 py-2 text-right font-semibold text-emerald-700 whitespace-nowrap">{fmt(net)}₮</td>
                          <td className="px-3 py-2">{sbadge(o.status)}</td>
                          <td className="px-3 py-2">
                            <div className="flex gap-1">
                              {o.status!=='cancelled' && (
                                <button onClick={()=>setOrderStatus(o.id,o.status==='delivered'?'pending':'delivered')}
                                  className={`btn bs text-xs ${o.status==='delivered'?'btn-ghost':'btn-primary'}`}>
                                  {o.status==='delivered'?'↩':'✓'}
                                </button>
                              )}
                              {o.status==='pending' && (
                                <button onClick={()=>setOrderStatus(o.id,'cancelled')} className="btn btn-danger text-xs px-2 py-1">✕</button>
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
        {filtered.length===0 && <p className="text-center text-gray-400 py-10">Захиалга олдсонгүй</p>}
      </div>
    </div>
  )
}
