'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const BANK = { name:'Хаан банк', account:'5173027542', owner:'Алтаннар' }
const FB_URL = 'https://www.facebook.com/profile.php?id=61588363850286'

const PLANS = [
  { id:'basic',    label:'Үндсэн',    prices:{ m:19900, q:55000, h:109000, y:218000 } },
  { id:'standard', label:'Стандарт',  prices:{ m:29900, q:85000, h:169000, y:318000 } },
  { id:'full',     label:'Бүрэн эрх', prices:{ m:39900, q:115000, h:219000, y:429000 } },
]

const DURATIONS = [
  { id:'m', label:'1 сар',  days:30  },
  { id:'q', label:'3 сар',  days:90  },
  { id:'h', label:'6 сар',  days:180 },
  { id:'y', label:'1 жил',  days:365 },
]

const FEATURES_ALL = [
  'Захиалга бүртгэл','Агуулахын үлдэгдэл','Цэнэглэлтийн түүх',
  'Өдрийн тайлан','Утсаар шүүх','Олон бараа нэг захиалганд',
  'CSV татах','Гар утсанд ажиллана','Хязгааргүй бараа','Борлуулалтын индекс',
]

const FEATURES_EXTRA: Record<string,string[]> = {
  standard: ['Зочин нэмэх','Тайлан харах'],
  full:     ['Зочин нэмэх','Тайлан харах','Олон дэлгүүр'],
}

function fmt(n: number) { return n.toLocaleString() }

export default function PricingPage() {
  const router = useRouter()
  const [selPlan, setSelPlan] = useState('standard')
  const [selDur, setSelDur] = useState('m')
  const [step, setStep] = useState<'plans'|'payment'|'done'>('plans')
  const [refCode, setRefCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState('')
  const [trialUsed, setTrialUsed] = useState(true)
  const [checkingTrial, setCheckingTrial] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { setCheckingTrial(false); return }
      const { data: p } = await supabase.from('profiles').select('trial_used').eq('id', data.user.id).single()
      setTrialUsed(p?.trial_used === true)
      setCheckingTrial(false)
    })
  }, [])

  const plan = PLANS.find(p=>p.id===selPlan)!
  const dur = DURATIONS.find(d=>d.id===selDur)!
  const price = plan.prices[selDur as keyof typeof plan.prices]

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text).then(()=>{ setCopied(label); setTimeout(()=>setCopied(''),2000) })
  }

  async function startTrial() {
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }
    const end = new Date(Date.now()+7*86400000)
    await supabase.from('profiles').update({
      subscription_status:'trial', trial_ends_at:end.toISOString(), trial_used:true,
    }).eq('id', user.id)
    router.push('/app')
  }

  async function submitPayment() {
    if (!refCode.trim()) return
    setLoading(true)
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }
    const now = new Date()
    const end = new Date(now.getTime()+dur.days*86400000)
    await supabase.from('payments').insert({
      user_id:user.id, amount:price, method:'bank_transfer', status:'pending',
      reference_code:refCode.trim(),
      period_start:now.toISOString().slice(0,10),
      period_end:end.toISOString().slice(0,10),
    })
    setLoading(false); setStep('done')
  }

  if (checkingTrial) return (
    <div className="min-h-screen flex items-center justify-center" style={{background:'#f8fffe'}}>
      <div className="text-gray-400 text-sm">Ачааллаж байна...</div>
    </div>
  )

  return (
    <div className="min-h-screen px-4 py-10" style={{background:'#f8fffe'}}>
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="text-center mb-10">
          <div className="text-xs font-semibold tracking-widest mb-1" style={{color:'#07e6ae'}}>OLULA</div>
          <h1 className="text-xl font-medium text-gray-900 tracking-wide uppercase mb-1">Агуулахаа гартаа атга</h1>
          <p className="text-xs text-gray-400">Бараа бүртгэл · Захиалга бүртгэл · Орлого, ашгийн тооцоо</p>
        </div>

        {step==='plans' && (
          <div className="space-y-4">

            {/* Бүгдэд байна */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <div className="text-xs font-medium tracking-widest uppercase mb-3" style={{color:'#07e6ae'}}>Бүгдэд байна</div>
              <div className="grid grid-cols-2 gap-2">
                {FEATURES_ALL.map(f=>(
                  <div key={f} className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="text-xs font-medium" style={{color:'#07e6ae'}}>✓</span>{f}
                  </div>
                ))}
              </div>
            </div>

            {/* Эрх сонгох */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <div className="text-xs font-medium tracking-widest uppercase mb-3" style={{color:'#07e6ae'}}>Эрх сонгох</div>
              <div className="grid grid-cols-3 gap-3 mb-4">
                {PLANS.map(p=>(
                  <button key={p.id} onClick={()=>setSelPlan(p.id)}
                    className="py-2.5 px-3 rounded-xl border text-sm font-medium transition-all"
                    style={selPlan===p.id
                      ? {borderColor:'#07e6ae',background:'#f0fef9',color:'#04725a'}
                      : {borderColor:'#e5e7eb',color:'#6b7280'}}>
                    {p.label}
                  </button>
                ))}
              </div>
              {(FEATURES_EXTRA[selPlan]||[]).length>0 && (
                <div className="rounded-lg px-4 py-3 border border-gray-100" style={{background:'#f8fffe'}}>
                  <p className="text-xs text-gray-400 mb-2">Нэмэлт эрх:</p>
                  <div className="flex flex-wrap gap-2">
                    {(FEATURES_EXTRA[selPlan]||[]).map(f=>(
                      <span key={f} className="text-xs px-2.5 py-1 rounded-lg border"
                        style={{background:'#f0fef9',color:'#04725a',borderColor:'#b2f0e0'}}>{f}</span>
                    ))}
                  </div>
                </div>
              )}
              {selPlan==='basic' && (
                <div className="rounded-lg px-4 py-3 border border-gray-100 bg-gray-50">
                  <p className="text-xs text-gray-400">Зочин нэмэх, тайлан, олон дэлгүүр боломжгүй</p>
                </div>
              )}
            </div>

            {/* Хугацаа + үнэ */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <div className="text-xs font-medium tracking-widest uppercase mb-3" style={{color:'#07e6ae'}}>Хугацаа сонгох</div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                {DURATIONS.map(d=>(
                  <button key={d.id} onClick={()=>setSelDur(d.id)}
                    className="py-2.5 rounded-xl border text-sm font-medium transition-all"
                    style={selDur===d.id
                      ? {borderColor:'#07e6ae',background:'#f0fef9',color:'#04725a'}
                      : {borderColor:'#e5e7eb',color:'#6b7280'}}>
                    {d.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between px-1">
                <span className="text-sm text-gray-500">{plan.label} · {dur.label}</span>
                <span className="text-2xl font-medium text-gray-900">{fmt(price)}₮</span>
              </div>
            </div>

            {/* Товчнууд */}
            <button onClick={()=>setStep('payment')}
              className="w-full py-3.5 rounded-xl text-sm font-medium transition-all"
              style={{background:'#07e6ae',color:'#0a2e24'}}>
              {fmt(price)}₮ — Үргэлжлүүлэх →
            </button>

            {!trialUsed && (
              <button onClick={startTrial}
                className="w-full py-3 border border-gray-200 text-gray-500 hover:bg-gray-50 rounded-xl text-sm transition-all">
                7 хоногийн ТӨЛБӨРГҮЙ туршилт эхлүүлэх
              </button>
            )}

            <div className="text-center">
              <a href={FB_URL} target="_blank" rel="noopener noreferrer"
                className="text-xs text-blue-500 hover:underline">
                Асуулт байвал Facebook-ээр холбогдоорой →
              </a>
            </div>
          </div>
        )}

        {step==='payment' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <div className="flex justify-between items-center mb-5 pb-4 border-b border-gray-100">
                <div>
                  <div className="text-sm font-medium text-gray-800">{plan.label} · {dur.label}</div>
                  <div className="text-xs text-gray-400 mt-0.5">Банкны шилжүүлэг</div>
                </div>
                <div className="text-2xl font-medium text-gray-900">{fmt(price)}₮</div>
              </div>
              <div className="rounded-lg p-4 border border-gray-100 space-y-2.5 mb-4" style={{background:'#f8fffe'}}>
                {[['Банк',BANK.name],['Дансны №',BANK.account],['Хүлээн авагч',BANK.owner],['Дүн',fmt(price)+'₮']].map(([k,v])=>(
                  <div key={k} className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">{k}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-800">{v}</span>
                      {(k==='Дансны №'||k==='Дүн')&&(
                        <button onClick={()=>copy(v,k)}
                          className="text-xs px-2 py-0.5 rounded-lg transition-all"
                          style={copied===k
                            ? {background:'#f0fef9',color:'#04725a'}
                            : {background:'#f3f4f6',color:'#6b7280'}}>
                          {copied===k?'✓':'copy'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-4">
                Гүйлгээний утга хэсэгт бүртгэлийн имэйл эсвэл утасны дугаараа бичнэ үү
              </p>
              <label className="block text-xs text-gray-400 mb-1.5">Гүйлгээний дугаар</label>
              <input className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm mb-4"
                placeholder="Гүйлгээний дугаар..." value={refCode} onChange={e=>setRefCode(e.target.value)}/>
              <div className="flex gap-2">
                <button onClick={()=>setStep('plans')}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500">
                  ← Буцах
                </button>
                <button onClick={submitPayment} disabled={!refCode.trim()||loading}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 transition-all"
                  style={{background:'#07e6ae',color:'#0a2e24'}}>
                  {loading?'Илгээж байна...':'Баталгаажуулах →'}
                </button>
              </div>
            </div>
            <div className="text-center">
              <a href={FB_URL} target="_blank" rel="noopener noreferrer"
                className="text-xs text-blue-500 hover:underline">
                Асуулт байвал Facebook-ээр холбогдоорой →
              </a>
            </div>
          </div>
        )}

        {step==='done' && (
          <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
            <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{background:'#f0fef9'}}>
              <span className="text-xl" style={{color:'#07e6ae'}}>✓</span>
            </div>
            <h2 className="text-lg font-medium text-gray-800 mb-2">Хүсэлт илгээгдлээ</h2>
            <p className="text-sm text-gray-400 mb-6">
              Төлбөр баталгаажсаны дараа таны эрх идэвхждэг.<br/>
              Ажлын өдрөөр 1–3 цагийн дотор шийдэгдэнэ.
            </p>
            <div className="space-y-3">
              <button onClick={()=>router.push('/app')}
                className="w-full py-3 rounded-xl text-sm font-medium"
                style={{background:'#07e6ae',color:'#0a2e24'}}>
                Апп руу орох →
              </button>
              <a href={FB_URL} target="_blank" rel="noopener noreferrer"
                className="block text-xs text-blue-500 hover:underline">
                Facebook-ээр лавлах →
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
