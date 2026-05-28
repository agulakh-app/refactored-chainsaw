'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Order } from '@/lib/types'

function fmtYM(ym: string) { const [y,m] = ym.split('-'); return `${y}оны ${parseInt(m)}р сар` }
function fmt(n: number) { return n.toLocaleString() }

export default function HistoryPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [phone, setPhone] = useState('')
  const [status, setStatus] = useState('all')

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('orders').select('*, order_items(*)').eq('user_id', user.id).order('date', { ascending: false }).order('day_seq', { ascending: false })
    setOrders(data || [])
  }, [])

  useEffect(() => { load() }, [load])

  async function setOrderStatus(id: string, s: string) {
    await supabase.from('orders').update({ status: s }).eq('id', id)
    load()
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
                      <th className="px-3 py-2 text-xs font-medium text-gray-500 text-left whitespace-nowrap">№</th>
                      <th className="px-3 py-2 text-xs font-medium text-gray-500 text-left">Огноо</th>
                      <th className="px-3 py-2 text-xs font-medium text-gray-500 text-left">Утас</th>
                      <th className="px-3 py-2 text-xs font-medium text-gray-500 text-left">Хаяг</th>
                      <th className="px-3 py-2 text-xs font-medium text-gray-500 text-left">Бараа</th>
                      <th className="px-3 py-2 text-xs font-medium text-gray-500 text-right">Барааны дүн</th>
                      <th className="px-3 py-2 text-xs font-medium text-gray-500 text-right">Хүргэлт</th>
                      <th className="px-3 py-2 text-xs font-medium text-gray-500 text-right">Цэвэр</th>
                      <th className="px-3 py-2 text-xs font-medium text-gray-500 text-left">Статус</th>
                      <th className="px-3 py-2"></th>
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
                          <td className="px-3 py-2 text-gray-500 max-w-[120px] truncate">{o.address}</td>
                          <td className="px-3 py-2 text-xs text-gray-600">{(o.order_items||[]).map((i:any)=>`${i.product_name}×${i.quantity}`).join(', ')}</td>
                          <td className="px-3 py-2 text-right whitespace-nowrap">{fmt(gross)}₮</td>
                          <td className="px-3 py-2 text-right text-gray-400 whitespace-nowrap">{o.delivery_fee>0?fmt(o.delivery_fee)+'₮':'—'}</td>
                          <td className="px-3 py-2 text-right font-semibold text-emerald-700 whitespace-nowrap">{fmt(net)}₮</td>
                          <td className="px-3 py-2">{sbadge(o.status)}</td>
                          <td className="px-3 py-2">
                            <div className="flex gap-1">
                              {o.status !== 'cancelled' && (
                                <button onClick={() => setOrderStatus(o.id, o.status==='delivered'?'pending':'delivered')}
                                  className={`btn bs text-xs ${o.status==='delivered'?'btn-ghost':'btn-primary'}`}>
                                  {o.status==='delivered'?'↩':'✓'}
                                </button>
                              )}
                              {o.status === 'pending' && (
                                <button onClick={() => setOrderStatus(o.id,'cancelled')} className="btn btn-danger text-xs px-2 py-1">✕</button>
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
