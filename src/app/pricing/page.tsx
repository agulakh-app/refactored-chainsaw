'use client'
export const dynamic = 'force-dynamic'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const PLANS = [
  { id:'demo',  label:'1 өдөр',  days:1,   price:0,      display:'Үнэгүй',    highlight:false, desc:'Бүх боломжийг туршиж үзэх' },
  { id:'month', label:'1 сар',   days:30,  price:25000,  display:'25,000₮',  highlight:false, desc:'Сар бүр сунгах' },
  { id:'quarter',label:'3 сар',  days:90,  price:69900,  display:'69,900₮',  highlight:true,  desc:'23,300₮/сар — 7% хямдрал', badge:'Алдартай' },
  { id:'year',  label:'1 жил',   days:365, price:255000, display:'255,000₮', highlight:false, desc:'21,250₮/сар — 15% хямдрал', badge:'Хамгийн хэмнэлттэй' },
]

export default function PricingPage() {
  const router = useRouter()
  const [selected, setSelected] = useState('quarter')
  const [step, setStep] = useState<'plans'|'payment'|'done'>('plans')
  const [refCode, setRefCode] = useState('')
  const [loading, setLoading] = useState(false)
  const plan = PLANS.find(p => p.id === selected)!

  async function choosePlan() {
    if (selected === 'demo') { router.push('/'); return }
    setStep('payment')
  }

  async function submitPayment() {
    if (!refCode.trim()) return
    setLoading(true)
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }
    const now = new Date()
    const end = new Date(now.getTime() + plan.days * 86400000)
    await supabase.from('payments').insert({
      user_id: user.id, amount: plan.price, method: 'bank_transfer', status: 'pending',
      reference_code: refCode.trim(),
      period_start: now.toISOString().slice(0,10),
      period_end: end.toISOString().slice(0,10),
    })
    setLoading(false); setStep('done')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-white px-4 py-10">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <div className="text-4xl mb-3">📦</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Агуулахын систем</h1>
          <p className="text-gray-500 text-sm">Захиалга, бараа, тооцоог нэг дор бүртгэнэ</p>
        </div>

        {step === 'plans' && (<>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {PLANS.map(p => (
              <div key={p.id} onClick={() => setSelected(p.id)}
                className={`relative rounded-2xl border-2 p-4 cursor-pointer transition-all ${selected===p.id?'border-emerald-500 bg-emerald-50 shadow-md':'border-gray-200 bg-white hover:border-emerald-300'}`}>
                {p.badge && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-xs font-semibold px-3 py-0.5 rounded-full whitespace-nowrap">{p.badge}</div>}
                <div className="text-xs font-semibold text-gray-500 mb-1 mt-1">{p.label}</div>
                <div className="text-xl font-bold text-gray-800 mb-1">{p.display}</div>
                <div className="text-xs text-gray-400 leading-relaxed">{p.desc}</div>
                {selected===p.id && <div className="mt-2 text-emerald-600 text-xs font-medium">✓ Сонгогдлоо</div>}
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-8">
            <h3 className="font-semibold text-gray-700 mb-3 text-sm">Бүх тарифт орсон боломжууд:</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {['Захиалга бүртгэл','Агуулахын үлдэгдэл','Цэнэглэлтийн түүх','Сараар тайлан','Утсаар шүүх','Олон бараа нэг захиалганд','CSV татах','Гар утсанд ажиллана','Хязгааргүй бараа','Эксел импорт'].map(f=>(
                <div key={f} className="flex items-center gap-1.5 text-sm text-gray-600"><span className="text-emerald-500 text-xs font-bold">✓</span>{f}</div>
              ))}
            </div>
          </div>

          <div className="flex justify-center">
            <button onClick={choosePlan} className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-10 py-3.5 rounded-xl text-base transition-all shadow-sm">
              {selected==='demo'?'Үнэгүй туршиж үзэх →':`${plan.display} — Үргэлжлүүлэх →`}
            </button>
          </div>
          <p className="text-center text-xs text-gray-400 mt-3">Аль ч тарифаар 1 өдрийн демо үнэгүй</p>
        </>)}

        {step === 'payment' && (
          <div className="max-w-md mx-auto bg-white rounded-2xl border border-gray-100 p-6">
            <div className="text-center mb-5">
              <div className="text-3xl font-bold text-emerald-700">{plan.display}</div>
              <div className="text-sm text-gray-500 mt-1">{plan.label} — {plan.desc}</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 mb-4 border border-gray-100">
              <div className="font-medium text-sm mb-2 text-gray-700">🏦 Банкны шилжүүлэг</div>
              {[['Банк','Хаан банк'],['Дансны №','5001234567'],['Хүлээн авагч','Агуулахын систем'],['Дүн',plan.display]].map(([k,v])=>(
                <div key={k} className="flex justify-between text-sm py-0.5"><span className="text-gray-500">{k}:</span><span className="font-medium">{v}</span></div>
              ))}
              <div className="mt-3 bg-amber-50 rounded-lg p-2 text-xs text-amber-700">⚠ Гүйлгээний утга хэсэгт <b>бүртгэлийн имэйлээ</b> бичнэ үү</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 mb-4">
              <div className="font-medium text-sm mb-2">📱 QPay QR код</div>
              <div className="bg-gray-200 rounded-lg h-24 flex items-center justify-center text-gray-400 text-xs">QPay идэвхжүүлсний дараа харагдана</div>
            </div>
            <label className="block text-xs text-gray-500 mb-1.5">Гүйлгээний дугаар</label>
            <input className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 mb-4"
              placeholder="Гүйлгээний дугаар..." value={refCode} onChange={e=>setRefCode(e.target.value)} />
            <div className="flex gap-2">
              <button onClick={()=>setStep('plans')} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">← Буцах</button>
              <button onClick={submitPayment} disabled={!refCode.trim()||loading}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50 hover:bg-emerald-700 transition-all">
                {loading?'Илгээж байна...':'Баталгаажуулах →'}
              </button>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="max-w-md mx-auto text-center bg-white rounded-2xl border border-emerald-100 p-8">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Хүсэлт илгээгдлээ!</h2>
            <p className="text-gray-500 text-sm mb-6">Төлбөр баталгаажсаны дараа таны эрх идэвхждэг.<br/>Ажлын өдрөөр 1–3 цагийн дотор шийдэгдэнэ.</p>
            <button onClick={()=>router.push('/app')} className="bg-emerald-600 text-white px-8 py-3 rounded-xl font-semibold hover:bg-emerald-700">Апп руу орох →</button>
          </div>
        )}
      </div>
    </div>
  )
}
