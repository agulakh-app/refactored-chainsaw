'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useOwnerId } from '../client-layout'

function fmt(n: number) { return n.toLocaleString() }

const PERIODS = [['week','7 хоног'],['month','Энэ сар'],['quarter','3 сар'],['all','Бүгд']] as const

export default function AnalyticsPage() {
  const ownerId = useOwnerId()
  const [orders, setOrders] = useState<any[]>([])
  const [period, setPeriod] = useState('month')

  const load = useCallback(async () => {
    const { data:{ user } } = await supabase.auth.getUser()
    const targetId = ownerId || user?.id
    if (!targetId) return
    const { data } = await supabase.from('orders').select('*, order_items(*)')
      .eq('user_id', targetId).order('date',{ascending:false})
    setOrders(data||[])
  },[ownerId])

  useEffect(()=>{ load() },[load])

  const now = new Date()
  const filtered = orders.filter(o=>{
    const d = new Date(o.date)
    if (period==='week') return (now.getTime()-d.getTime())<7*86400000
    if (period==='month') return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear()
    if (period==='quarter') return (now.getTime()-d.getTime())<90*86400000
    return true
  })

  const totalGross = filtered.reduce((a,o)=>(o.order_items||[]).reduce((s:number,i:any)=>s+i.quantity*i.unit_price,a),0)
  const totalDelv = filtered.reduce((a,o)=>a+(o.delivery_fee||0),0)
  const totalNet = totalGross-totalDelv
  const delivered = filtered.filter(o=>o.status==='delivered').length
  const pending = filtered.filter(o=>o.status==='pending').length

  const productMap: Record<string,{qty:number,revenue:number}> = {}
  filtered.forEach(o=>{
    (o.order_items||[]).forEach((i:any)=>{
      const key = i.product_name + (i.variant_label ? ' · '+i.variant_label : '')
      if (!productMap[key]) productMap[key]={qty:0,revenue:0}
      productMap[key].qty+=i.quantity
      productMap[key].revenue+=i.quantity*i.unit_price
    })
  })
  const ranking = Object.entries(productMap).sort((a,b)=>b[1].qty-a[1].qty)
  const maxQty = ranking[0]?.[1]?.qty||1

  const dailyMap: Record<string,number> = {}
  filtered.forEach(o=>{
    const gross=(o.order_items||[]).reduce((a:number,i:any)=>a+i.quantity*i.unit_price,0)
    dailyMap[o.date]=(dailyMap[o.date]||0)+gross-(o.delivery_fee||0)
  })
  const dailyDays = Object.keys(dailyMap).sort().slice(-14)
  const maxDay = Math.max(...Object.values(dailyMap),1)

  return (
    <div className="space-y-4">

      {/* Period tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
        {PERIODS.map(([v,l])=>(
          <button key={v} onClick={()=>setPeriod(v)}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${period===v?'bg-white text-gray-800 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>
            {l}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {([
          ['Цэвэр орлого', fmt(totalNet)+'₮', 'text-emerald-700'],
          ['Нийт захиалга', String(filtered.length), 'text-gray-800'],
          ['Хүргэгдсэн', String(delivered), 'text-gray-800'],
          ['Хүлээгдэж байна', String(pending), 'text-amber-600'],
        ] as const).map(([l,v,c])=>(
          <div key={l} className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="text-xs text-gray-400 mb-1">{l}</div>
            <div className={`text-xl font-medium ${c}`}>{v}</div>
          </div>
        ))}
      </div>

      {/* Daily revenue bar chart */}
      {dailyDays.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <h2 className="font-medium text-gray-800 text-sm mb-4">Өдрийн цэвэр орлого</h2>
          <div className="flex items-end gap-1.5 h-28">
            {dailyDays.map(d=>{
              const val = dailyMap[d]||0
              const h = Math.max(4, Math.round((val/maxDay)*100))
              const [,m,day] = d.split('-')
              return (
                <div key={d} className="flex-1 flex flex-col items-center gap-1 group">
                  <div className="text-xs text-gray-300 font-medium group-hover:text-gray-500 transition-colors">
                    {val>=1000 ? Math.round(val/1000)+'к' : ''}
                  </div>
                  <div className="w-full bg-emerald-500 rounded-t hover:bg-emerald-600 transition-all cursor-default relative"
                    style={{height:`${h}%`}}>
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all z-10 pointer-events-none">
                      {fmt(val)}₮
                    </div>
                  </div>
                  <div className="text-xs text-gray-300">{parseInt(m)}/{parseInt(day)}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Product ranking */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <h2 className="font-medium text-gray-800 text-sm mb-4">Барааны борлуулалт</h2>
        {ranking.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-6">Мэдээлэл алга</p>
        ) : (
          <div className="space-y-3">
            {ranking.map(([name,{qty,revenue}],idx)=>(
              <div key={name} className="flex items-center gap-3">
                <div className="text-xs text-gray-300 w-4 text-right">{idx+1}</div>
                <div className="flex-1">
                  <div className="flex justify-between items-baseline mb-1.5">
                    <span className="text-sm text-gray-700">{name}</span>
                    <div className="flex items-baseline gap-4">
                      <span className="text-xs text-gray-400">{qty} ш</span>
                      <span className="text-xs font-medium text-emerald-600">{fmt(revenue)}₮</span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div className="bg-emerald-500 h-1.5 rounded-full transition-all"
                      style={{width:`${Math.round((qty/maxQty)*100)}%`}} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Summary table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="font-medium text-gray-800 text-sm">Орлогын дүгнэлт</h2>
        </div>
        <div>
          {[
            ['Нийт борлуулалт', fmt(totalGross)+'₮'],
            ['Хүргэлтийн зардал', fmt(totalDelv)+'₮'],
            ['Цэвэр орлого', fmt(totalNet)+'₮'],
            ['Захиалга тоо', String(filtered.length)],
            ['Дундаж захиалга', filtered.length ? fmt(Math.round(totalNet/filtered.length))+'₮' : '—'],
            ['Хүргэлтийн хувь', totalGross ? Math.round((totalDelv/totalGross)*100)+'%' : '—'],
          ].map(([k,v],i)=>(
            <div key={k} className={`flex justify-between px-4 py-2.5 ${i>0?'border-t border-gray-100':''}`}>
              <span className="text-sm text-gray-500">{k}</span>
              <span className={`text-sm font-medium ${k==='Цэвэр орлого'?'text-emerald-700':'text-gray-800'}`}>{v}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
