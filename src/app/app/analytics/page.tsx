'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useOwnerId, useActiveStore, useGuestRole } from '../client-layout'

function fmt(n: number) { return n.toLocaleString() }

const PERIODS = [['week','7 хоног'],['month','Энэ сар'],['quarter','3 сар'],['all','Бүгд']] as const

const EXPENSE_CATS = [
  { value: 'ads', label: 'Зар сурталчилгаа (FB, IG...)' },
  { value: 'delivery', label: 'Карго зардал' },
  { value: 'packaging', label: 'Сав баглаа' },
  { value: 'salary', label: 'Цалин' },
  { value: 'rent', label: 'Түрээс' },
  { value: 'other', label: 'Бусад' },
]

const LEGACY_CAT_LABELS: Record<string,string> = {
  cogs: 'Бараа өртөг (хуучин)',
}

const WEEKDAY_LABELS = ['Ням','Даваа','Мягмар','Лхагва','Пүрэв','Баасан','Бямба']
const EXP_PAGE_SIZE = 5

export default function AnalyticsPage() {
  const ownerId = useOwnerId()
  const activeStoreId = useActiveStore()
  const guestRole = useGuestRole()
  const isViewer = guestRole === 'viewer'

  const [orders, setOrders] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [period, setPeriod] = useState('month')

  const [eDate, setEDate] = useState(new Date().toISOString().slice(0,10))
  const [eCat, setECat] = useState('ads')
  const [eNote, setENote] = useState('')
  const [eAmt, setEAmt] = useState('')
  const [flash, setFlash] = useState('')
  const [expPage, setExpPage] = useState(1)

  const showFlash = (m: string) => { setFlash(m); setTimeout(()=>setFlash(''),2500) }

  const [products, setProducts] = useState<any[]>([])

  const load = useCallback(async () => {
    const { data:{ user } } = await supabase.auth.getUser()
    const targetId = ownerId || user?.id
    if (!targetId) return
    const q = supabase.from('orders').select('*, order_items(*)')
      .eq('user_id', targetId).order('date',{ascending:false})
    const { data: ords } = activeStoreId ? await q.eq('store_id', activeStoreId) : await q

    const eq = supabase.from('expenses').select('*')
      .eq('user_id', targetId).order('date',{ascending:false})
    const { data: exps } = activeStoreId ? await eq.eq('store_id', activeStoreId) : await eq

    const pq = supabase.from('products').select('*').eq('user_id', targetId)
    const { data: prods } = activeStoreId ? await pq.eq('store_id', activeStoreId) : await pq

    setOrders(ords||[])
    setExpenses(exps||[])
    setProducts(prods||[])
  },[ownerId, activeStoreId])

  useEffect(()=>{ load() },[load])

  async function addExpense() {
    if (!eAmt || Number(eAmt) <= 0) { showFlash('Дүн оруулна уу'); return }
    const { data:{ user } } = await supabase.auth.getUser()
    const targetId = ownerId || user?.id
    if (!targetId) return
    await supabase.from('expenses').insert({
      user_id: targetId,
      store_id: activeStoreId || null,
      date: eDate,
      category: eCat,
      note: eNote || EXPENSE_CATS.find(c=>c.value===eCat)?.label || eCat,
      amount: Number(eAmt)
    })
    setEAmt(''); setENote(''); setExpPage(1)
    showFlash('Зардал бүртгэгдлээ ✓')
    load()
  }

  async function deleteExpense(id: string) {
    if (!confirm('Устгах уу?')) return
    await supabase.from('expenses').delete().eq('id', id)
    load()
  }

  const now = new Date()
  const inPeriod = (date: string) => {
    const d = new Date(date)
    if (period==='week') return (now.getTime()-d.getTime())<7*86400000
    if (period==='month') return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear()
    if (period==='quarter') return (now.getTime()-d.getTime())<90*86400000
    return true
  }

  const filtered = orders.filter(o=>inPeriod(o.date))
  const filteredExp = expenses.filter(e=>inPeriod(e.date))

  const totalGross = filtered.reduce((a,o)=>(o.order_items||[]).reduce((s:number,i:any)=>s+i.quantity*i.unit_price,a),0)
  const totalDelv = filtered.reduce((a,o)=>a+(o.delivery_fee||0),0)
  const totalNet = totalGross - totalDelv
  const totalExpenses = filteredExp.reduce((a,e)=>a+Number(e.amount),0)
  const delivered = filtered.filter(o=>o.status==='delivered').length
  const pending = filtered.filter(o=>o.status==='pending').length

  const expByCat: Record<string,number> = {}
  filteredExp.forEach(e=>{ expByCat[e.category]=(expByCat[e.category]||0)+Number(e.amount) })

  const getCost = (productName: string, variantLabel: string|null) => {
    for (const p of products) {
      if (p.name !== productName) continue
      const pvs: any[] = p.variants || []
      if (pvs.length > 0 && variantLabel) {
        const v = pvs.find((vv: any) => [vv.size, vv.color].filter(Boolean).join(' / ') === variantLabel)
        if (v?.cost) return Number(v.cost)
      }
      if (p.cost) return Number(p.cost)
      return 0
    }
    return 0
  }

  const productMap: Record<string,{qty:number,revenue:number,cost:number}> = {}
  filtered.forEach(o=>{
    (o.order_items||[]).forEach((i:any)=>{
      const key = i.product_name + (i.variant_label ? ' · '+i.variant_label : '')
      if (!productMap[key]) productMap[key]={qty:0,revenue:0,cost:0}
      productMap[key].qty+=i.quantity
      productMap[key].revenue+=i.quantity*i.unit_price
      productMap[key].cost+=i.quantity*getCost(i.product_name, i.variant_label||null)
    })
  })
  const totalCOGS = Object.values(productMap).reduce((a,v)=>a+v.cost,0)
  const totalProfit = totalNet - totalExpenses - totalCOGS
  const ranking = Object.entries(productMap).sort((a,b)=>b[1].qty-a[1].qty)
  const maxQty = ranking[0]?.[1]?.qty||1

  // Зардлын хуудасжуулалт
  const totalExpPages = Math.ceil(filteredExp.length / EXP_PAGE_SIZE)
  const pagedExp = filteredExp.slice(0, expPage * EXP_PAGE_SIZE)
  const hasMoreExp = expPage * EXP_PAGE_SIZE < filteredExp.length

  // Долоо хоногийн өдрөөр
  const weekdayTotals = [0,0,0,0,0,0,0]
  orders.forEach(o=>{
    if (!o.date) return
    const d = new Date(o.date)
    if (isNaN(d.getTime())) return
    const gross=(o.order_items||[]).reduce((a:number,i:any)=>a+i.quantity*i.unit_price,0)
    weekdayTotals[d.getDay()] += gross - (o.delivery_fee||0)
  })
  const weekdayOrder = [1,2,3,4,5,6,0]
  const weekdayChartData = weekdayOrder.map(i=>weekdayTotals[i])
  const weekdayChartLabels = weekdayOrder.map(i=>WEEKDAY_LABELS[i])

  // Сараар шилдэг бараанууд
  const monthlyProductMap: Record<string, number[]> = {}
  const productTotalsAll: Record<string, number> = {}
  orders.forEach(o=>{
    if (!o.date) return
    const d = new Date(o.date)
    if (isNaN(d.getTime())) return
    const m = d.getMonth()
    ;(o.order_items||[]).forEach((i:any)=>{
      const key = i.product_name + (i.variant_label ? ' · '+i.variant_label : '')
      const rev = i.quantity*i.unit_price
      if (!monthlyProductMap[key]) monthlyProductMap[key]=Array(12).fill(0)
      monthlyProductMap[key][m]+=rev
      productTotalsAll[key]=(productTotalsAll[key]||0)+rev
    })
  })
  const topProducts = Object.entries(productTotalsAll).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([k])=>k)
  const seasonalLabels = ['1 сар','2 сар','3 сар','4 сар','5 сар','6 сар','7 сар','8 сар','9 сар','10 сар','11 сар','12 сар']
  const seasonalColors = ['#1D9E75','#378ADD','#EF9F27','#D85A30']

  const weekdayCanvasRef = useRef<HTMLCanvasElement>(null)
  const seasonalCanvasRef = useRef<HTMLCanvasElement>(null)
  const weekdayChartRef = useRef<any>(null)
  const seasonalChartRef = useRef<any>(null)

  useEffect(() => {
    let cancelled = false
    const loadChartJS = (): Promise<any> => new Promise(resolve => {
      if ((window as any).Chart) { resolve((window as any).Chart); return }
      const s = document.createElement('script')
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js'
      s.onload = () => resolve((window as any).Chart)
      document.head.appendChild(s)
    })

    loadChartJS().then(Chart => {
      if (cancelled || !Chart) return

      if (weekdayChartRef.current) weekdayChartRef.current.destroy()
      if (weekdayCanvasRef.current) {
        const wMax = Math.max(...weekdayChartData, 1)
        weekdayChartRef.current = new Chart(weekdayCanvasRef.current, {
          type: 'bar',
          data: {
            labels: weekdayChartLabels,
            datasets: [{ data: weekdayChartData, backgroundColor: weekdayChartData.map(v=>v===wMax?'#1D9E75':'#9FE1CB'), borderRadius: 4 }]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display:false }, tooltip: { callbacks: { label:(c:any)=>fmt(Math.round(c.parsed.y))+'₮' } } },
            scales: { y: { ticks: { callback:(v:any)=>v>=1000?Math.round(v/1000)+'к':v }, beginAtZero:true } }
          }
        })
      }

      if (seasonalChartRef.current) seasonalChartRef.current.destroy()
      if (seasonalCanvasRef.current) {
        seasonalChartRef.current = new Chart(seasonalCanvasRef.current, {
          type: 'bar',
          data: {
            labels: seasonalLabels,
            datasets: topProducts.map((name,idx)=>({
              label: name,
              data: monthlyProductMap[name],
              backgroundColor: seasonalColors[idx % seasonalColors.length]
            }))
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display:false }, tooltip: { callbacks: { label:(c:any)=>c.dataset.label+': '+fmt(Math.round(c.parsed.y))+'₮' } } },
            scales: {
              x: { stacked:true, ticks: { autoSkip:false, maxRotation:60, font:{size:10} } },
              y: { stacked:true, ticks: { callback:(v:any)=>v>=1000?Math.round(v/1000)+'к':v }, beginAtZero:true }
            }
          }
        })
      }
    })

    return () => { cancelled = true }
  }, [JSON.stringify(weekdayChartData), JSON.stringify(topProducts)])

  return (
    <div className="space-y-4">
      {flash&&<div className="fixed top-4 right-4 bg-gray-900 text-white text-sm px-4 py-2 rounded-lg z-50">{flash}</div>}

      {/* Period tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
        {PERIODS.map(([v,l])=>(
          <button key={v} onClick={()=>setPeriod(v)}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${period===v?'bg-white text-gray-800 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>
            {l}
          </button>
        ))}
      </div>

      {isViewer && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {([
            ['Нийт захиалга', String(filtered.length), 'text-gray-800'],
            ['Хүргэгдсэн', String(delivered), 'text-gray-800'],
            ['Хүлээгдэж байна', String(pending), 'text-amber-600'],
          ] as const).map(([l,v,c])=>(
            <div key={l} className="bg-white rounded-xl border border-gray-100 p-4 overflow-hidden">
              <div className="text-xs text-gray-400 mb-1">{l}</div>
              <div className={`text-xl sm:text-2xl font-semibold ${c} truncate`}>{v}</div>
            </div>
          ))}
        </div>
      )}

      {/* Chart 1: Борлуулалт гаригаар */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <h2 className="font-medium text-gray-800 text-sm mb-3">Борлуулалт гаригаар (Нийт борлуулалтаас)</h2>
        <div className="relative w-full" style={{height:180}}>
          <canvas ref={weekdayCanvasRef}/>
        </div>
      </div>

      {/* Chart 2: Сараар шилдэг бараа */}
      {topProducts.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <h2 className="font-medium text-gray-800 text-sm mb-2">Сараар — шилдэг бараануудын борлуулалт</h2>
          <div className="flex flex-wrap gap-3 mb-2">
            {topProducts.map((name,idx)=>(
              <span key={name} className="text-xs flex items-center gap-1.5 text-gray-500">
                <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{background:seasonalColors[idx%seasonalColors.length]}}/>
                {name}
              </span>
            ))}
          </div>
          <div className="relative w-full" style={{height:220}}>
            <canvas ref={seasonalCanvasRef}/>
          </div>
        </div>
      )}

      {/* Зардал бүртгэх */}
      {!isViewer && (
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <h2 className="font-medium text-gray-800 text-sm mb-3">Зардал бүртгэх</h2>
          {/* Mobile: Ангилал → Дүн|Огноо → Тэмдэглэл */}
          <div className="sm:hidden space-y-3 mb-3">
            <div><label className="block text-xs text-gray-400 mb-1">Ангилал</label>
              <select className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
                value={eCat} onChange={e=>setECat(e.target.value)}>
                {EXPENSE_CATS.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}
              </select></div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="block text-xs text-gray-400 mb-1">Дүн (₮)</label>
                <input type="number" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                  placeholder="50000" value={eAmt} onChange={e=>setEAmt(e.target.value)}/></div>
              <div><label className="block text-xs text-gray-400 mb-1">Огноо</label>
                <input type="date" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
                  value={eDate} onChange={e=>setEDate(e.target.value)}/></div>
            </div>
            <div><label className="block text-xs text-gray-400 mb-1">Тэмдэглэл</label>
              <input className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                placeholder="Facebook post boost..." value={eNote} onChange={e=>setENote(e.target.value)}/></div>
          </div>
          {/* Desktop: анхны дараалал */}
          <div className="hidden sm:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
            <div><label className="block text-xs text-gray-400 mb-1">Огноо</label>
              <input type="date" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
                value={eDate} onChange={e=>setEDate(e.target.value)}/></div>
            <div><label className="block text-xs text-gray-400 mb-1">Ангилал</label>
              <select className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
                value={eCat} onChange={e=>setECat(e.target.value)}>
                {EXPENSE_CATS.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}
              </select></div>
            <div><label className="block text-xs text-gray-400 mb-1">Тэмдэглэл</label>
              <input className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                placeholder="Facebook post boost..." value={eNote} onChange={e=>setENote(e.target.value)}/></div>
            <div><label className="block text-xs text-gray-400 mb-1">Дүн (₮)</label>
              <input type="number" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                placeholder="50000" value={eAmt} onChange={e=>setEAmt(e.target.value)}/></div>
          </div>
          <div className="flex justify-end">
            <button onClick={addExpense}
              className="px-5 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-700">
              Зардал бүртгэх
            </button>
          </div>

          {/* Зардлын жагсаалт — хуудасжуулалттай */}
          {filteredExp.length > 0 && (
            <div className="mt-4 border-t border-gray-100 pt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400">Бүртгэгдсэн зардлууд ({filteredExp.length})</span>
              </div>
              <div className="space-y-1.5">
                {pagedExp.map(e=>(
                  <div key={e.id} className="flex justify-between items-center py-1.5 hover:bg-gray-50 px-2 rounded-lg group">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs text-gray-400 flex-shrink-0">{e.date.slice(5).replace('-','/')}</span>
                      <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full flex-shrink-0">
                        {EXPENSE_CATS.find(c=>c.value===e.category)?.label.split('(')[0].trim()
                          || LEGACY_CAT_LABELS[e.category] || e.category}
                      </span>
                      {e.note&&<span className="text-xs text-gray-500 truncate">{e.note}</span>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-sm font-medium text-red-500">−{fmt(Number(e.amount))}₮</span>
                      <button onClick={()=>deleteExpense(e.id)}
                        className="opacity-0 group-hover:opacity-100 text-xs text-gray-300 hover:text-red-500 transition-all">✕</button>
                    </div>
                  </div>
                ))}
              </div>
              {hasMoreExp && (
                <button onClick={()=>setExpPage(p=>p+1)}
                  className="mt-2 w-full text-xs text-gray-400 hover:text-gray-600 py-1.5 border border-gray-100 rounded-lg hover:bg-gray-50">
                  Дэлгэх ({filteredExp.length - expPage*EXP_PAGE_SIZE} үлдсэн)
                </button>
              )}
              {/* Ангиллаар нэгтгэл */}
              {Object.keys(expByCat).length > 1 && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="text-xs text-gray-400 mb-2">Ангиллаар:</div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(expByCat).map(([cat,amt])=>(
                      <div key={cat} className="flex items-center gap-1.5 px-2.5 py-1 bg-red-50 rounded-lg">
                        <span className="text-xs text-gray-500">
                          {EXPENSE_CATS.find(c=>c.value===cat)?.label.split('(')[0].trim()
                            || LEGACY_CAT_LABELS[cat] || cat}
                        </span>
                        <span className="text-xs font-medium text-red-500">{fmt(amt)}₮</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Барааны борлуулалт */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <h2 className="font-medium text-gray-800 text-sm mb-4">Барааны борлуулалт</h2>
        {ranking.length===0?(
          <p className="text-center text-gray-400 text-sm py-6">Мэдээлэл алга</p>
        ):(
          <div className="space-y-3">
            {ranking.map(([name,{qty,revenue,cost}],idx)=>{
              const profit = revenue - cost
              const margin = revenue > 0 ? Math.round((profit/revenue)*100) : 0
              return (
              <div key={name} className="flex items-center gap-3">
                <div className="text-xs text-gray-300 w-4 text-right">{idx+1}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap justify-between items-baseline mb-1 gap-x-3 gap-y-0.5">
                    <span className="text-sm text-gray-700 truncate">{name}</span>
                    <div className="flex items-baseline gap-3 flex-wrap">
                      <span className="text-xs text-gray-400">{qty} ш</span>
                      {cost>0&&<span className="text-xs text-orange-400">өртөг: {fmt(cost)}₮</span>}
                      <span className="text-xs font-medium text-emerald-600">{fmt(revenue)}₮</span>
                      {cost>0&&<span className={`text-xs font-medium px-1.5 py-0.5 rounded ${margin>=30?'bg-emerald-50 text-emerald-600':margin>=15?'bg-amber-50 text-amber-600':'bg-red-50 text-red-500'}`}>{margin}%</span>}
                    </div>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div className="bg-emerald-500 h-1.5 rounded-full"
                      style={{width:`${Math.round((qty/maxQty)*100)}%`}}/>
                  </div>
                </div>
              </div>
            )})}
          </div>
        )}
      </div>

      {/* Санхүүгийн дүгнэлт */}
      {!isViewer && <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="font-medium text-gray-800 text-sm">Санхүүгийн дүгнэлт</h2>
        </div>
        <div>
          {[
            ['Нийт борлуулалт', fmt(totalGross)+'₮', ''],
            ['Хүргэлтийн зардал', '−'+fmt(totalDelv)+'₮', 'text-red-400'],
            ['Цэвэр орлого', fmt(totalNet)+'₮', 'text-emerald-700'],
            ['Барааны өртөг (COGS)', '−'+fmt(totalCOGS)+'₮', 'text-orange-500'],
            ['Нийт зардал', '−'+fmt(totalExpenses)+'₮', 'text-red-500'],
            ['Цэвэр ашиг', fmt(totalProfit)+'₮', totalProfit>=0?'text-emerald-700 font-semibold':'text-red-600 font-semibold'],
            ['Захиалга тоо', String(filtered.length), ''],
            ['Хүргэгдсэн / Нийт', `${delivered} / ${filtered.length}`, ''],
          ].map(([k,v,c],i)=>(
            <div key={k} className={`flex justify-between px-4 py-2.5 gap-3 ${i>0?'border-t border-gray-100':''} ${k==='Цэвэр ашиг'?'bg-gray-50':''}`}>
              <span className="text-sm text-gray-500 flex-shrink-0">{k}</span>
              <span className={`text-sm text-right ${c||'text-gray-800'}`}>{v}</span>
            </div>
          ))}
        </div>
      </div>}

    </div>
  )
}
