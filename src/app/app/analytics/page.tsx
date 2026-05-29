'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

function fmt(n: number) { return n.toLocaleString() }

export default function AnalyticsPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [period, setPeriod] = useState('month')

  const load = useCallback(async () => {
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('orders').select('*, order_items(*)').eq('user_id',user.id).order('date',{ascending:false})
    setOrders(data||[])
  },[])

  useEffect(()=>{ load() },[load])

  // Filter by period
  const now = new Date()
  const filtered = orders.filter(o=>{
    const d = new Date(o.date)
    if (period==='week') return (now.getTime()-d.getTime())<7*86400000
    if (period==='month') return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear()
    if (period==='quarter') return (now.getTime()-d.getTime())<90*86400000
    return true
  })

  // Total stats
  const totalGross = filtered.reduce((a,o)=>(o.order_items||[]).reduce((s:number,i:any)=>s+i.quantity*i.unit_price,a),0)
  const totalDelv = filtered.reduce((a,o)=>a+(o.delivery_fee||0),0)
  const totalNet = totalGross-totalDelv
  const delivered = filtered.filter(o=>o.status==='delivered').length
  const pending = filtered.filter(o=>o.status==='pending').length

  // Product sales ranking
  const productMap: Record<string,{qty:number,revenue:number}> = {}
  filtered.forEach(o=>{
    (o.order_items||[]).forEach((i:any)=>{
      if (!productMap[i.product_name]) productMap[i.product_name]={qty:0,revenue:0}
      productMap[i.product_name].qty+=i.quantity
      productMap[i.product_name].revenue+=i.quantity*i.unit_price
    })
  })
  const ranking = Object.entries(productMap).sort((a,b)=>b[1].qty-a[1].qty)
  const maxQty = ranking[0]?.[1]?.qty||1

  // Daily revenue (last 14 days)
  const dailyMap: Record<string,number> = {}
  filtered.forEach(o=>{
    const gross=(o.order_items||[]).reduce((a:number,i:any)=>a+i.quantity*i.unit_price,0)
    dailyMap[o.date]=(dailyMap[o.date]||0)+gross-(o.delivery_fee||0)
  })
  const dailyDays = Object.keys(dailyMap).sort().slice(-14)
  const maxDay = Math.max(...Object.values(dailyMap),1)

  return (
    <div className="space-y-5">
      {/* Period filter */}
      <div className="flex gap-2 flex-wrap">
        {[['week','7 хоног'],['month','Энэ сар'],['quarter','3 сар'],['all','Бүгд']].map(([v,l])=>(
          <button key={v} onClick={()=>setPeriod(v)}
            className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${period===v?'bg-emerald-600 text-white border-emerald-600':'border-gray-200 text-gray-600 hover:border-emerald-300'}`}>
            {l}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          ['Нийт орлого',fmt(totalNet)+'₮','text-emerald-700','bg-emerald-50'],
          ['Захиалга',String(filtered.length),'text-gray-700','bg-gray-50'],
          ['Хүргэгдсэн',String(delivered),'text-blue-600','bg-blue-50'],
          ['Хүлээгдэж байна',String(pending),'text-amber-600','bg-amber-50'],
        ].map(([l,v,c,bg])=>(
          <div key={l} className={`rounded-2xl ${bg} p-4 border border-gray-100`}>
            <div className="text-xs text-gray-500 mb-1">{l}</div>
            <div className={`text-xl font-bold ${c}`}>{v}</div>
          </div>
        ))}
      </div>

      {/* Daily revenue chart */}
      {dailyDays.length>0 && (
        <div className="card">
          <h2 className="font-semibold text-gray-800 mb-4 text-base">📈 Өдрийн цэвэр орлого</h2>
          <div className="flex items-end gap-1.5 h-32">
            {dailyDays.map(d=>{
              const val = dailyMap[d]||0
              const h = Math.max(4, Math.round((val/maxDay)*100))
              const [,m,day] = d.split('-')
              return (
                <div key={d} className="flex-1 flex flex-col items-center gap-1">
                  <div className="text-xs text-gray-400 font-medium">{val>=1000?Math.round(val/1000)+'к':''}</div>
                  <div className="w-full bg-emerald-500 rounded-t-md hover:bg-emerald-600 transition-all cursor-default relative group"
                    style={{height:`${h}%`}}>
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all z-10">
                      {fmt(val)}₮
                    </div>
                  </div>
                  <div className="text-xs text-gray-400">{parseInt(m)}/{parseInt(day)}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Product ranking */}
      <div className="card">
        <h2 className="font-semibold text-gray-800 mb-4 text-base">🏆 Барааны борлуулалтын индекс</h2>
        {ranking.length===0 ? (
          <p className="text-center text-gray-400 py-6">Мэдээлэл алга</p>
        ) : (
          <div className="space-y-3">
            {ranking.map(([name,{qty,revenue}],idx)=>(
              <div key={name} className="flex items-center gap-3">
                <div className="text-sm font-bold text-gray-400 w-5 text-right">{idx+1}</div>
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-gray-800">{name}</span>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span className="font-semibold text-gray-700">{qty} ш</span>
                      <span className="text-emerald-600 font-medium">{fmt(revenue)}₮</span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className="bg-emerald-500 h-2 rounded-full transition-all"
                      style={{width:`${Math.round((qty/maxQty)*100)}%`}} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Monthly summary */}
      <div className="card">
        <h2 className="font-semibold text-gray-800 mb-3 text-base">📊 Орлогын дүгнэлт</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                {['Үзүүлэлт','Утга'].map(h=><th key={h} className="px-4 py-2.5 text-xs font-medium text-gray-500 text-left">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {[
                ['Нийт борлуулалт', fmt(totalGross)+'₮'],
                ['Хүргэлтийн зардал', fmt(totalDelv)+'₮'],
                ['Цэвэр орлого', fmt(totalNet)+'₮'],
                ['Захиалга тоо', String(filtered.length)],
                ['Дундаж захиалга', filtered.length?fmt(Math.round(totalNet/filtered.length))+'₮':'—'],
                ['Хүргэлтийн хувь', totalGross?Math.round((totalDelv/totalGross)*100)+'%':'—'],
              ].map(([k,v])=>(
                <tr key={k} className="border-t border-gray-100">
                  <td className="px-4 py-2.5 text-gray-600">{k}</td>
                  <td className="px-4 py-2.5 font-semibold text-gray-800">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
