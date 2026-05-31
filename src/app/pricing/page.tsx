'use client'
export const dynamic = 'force-dynamic'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const BANK = { name:'Хаан банк', account:'5173027542', owner:'Алтаннар' }
const FB_URL = 'https://www.facebook.com/profile.php?id=61588363850286'

const PLANS = [
  { id:'trial', label:'7 хоног', days:7,   price:0,      display:'Үнэгүй',  desc:'Бүх боломжийг туршиж үзэх' },
  { id:'month', label:'1 сар',   days:30,  price:25000,  display:'25,000₮', desc:'Сар бүр сунгах' },
  { id:'quarter',label:'3 сар',  days:90,  price:69900,  display:'69,900₮', desc:'23,300₮/сар — 7% хямдрал' },
  { id:'year',  label:'1 жил',   days:365, price:255000, display:'255,000₮',desc:'21,250₮/сар — 15% хямдрал' },
]

const FEATURES = [
  'Захиалга бүртгэл','Агуулахын үлдэгдэл','Цэнэглэлтийн түүх',
  'Өдрийн тайлан','Утасаар шүүх','Олон бараа нэг захиалганд',
  'CSV татах','Гар утсанд ажиллана','Хязгааргүй бараа',
  'Борлуулалтын индекс','Дэлгүүр & агуулах','Зочин хэрэглэгч',
]

export default function PricingPage() {
  const router = useRouter()
  const [selected, setSelected] = useState('quarter')
  const [step, setStep] = useState<'select'|'pay'|'done'>('select')
  const [refCode, setRefCode] = useState('')
  const [loading, setLoading] = useState(false)

  const plan = PLANS.find(p=>p.id===selected)!

  async function handlePay() {
    if (!refCode.trim()) return
    setLoading(true)
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }
    const now = new Date()
    const end = new Date(now.getTime() + plan.days * 86400000)
    await supabase.from('payments').insert({
      user_id: user.id,
      amount: plan.price,
      method: 'bank_transfer',
      status: 'pending',
      reference_code: refCode.trim(),
      period_start: now.toISOString().slice(0,10),
      period_end: end.toISOString().slice(0,10),
    })
    try {
      await supabase.functions.invoke('send-notification', {
        body: {
          type: 'new_payment',
          to: 'hardworkingfmly@gmail.com',
          data: {
            user_email: user.email,
            amount: plan.display,
            plan: plan.label,
            ref_code: refCode.trim(),
          }
        }
      })
    } catch(e) {}
    setLoading(false)
    setStep('done')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-white py-10 px-4">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">📦</div>
          <h1 className="text-2xl font-bold text-gray-800">OLULA</h1>
          <p className="text-gray-500 text-sm mt-1">Агуулахаа гартаа атга</p>
        </div>

        {step === 'select' && (
          <>
            {/* Plans */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              {PLANS.map(p=>(
                <button key={p.id} onClick={()=>setSelected(p.id)}
                  className={`rounded-2xl border-2 p-4 text-center transition-all ${selected===p.id?'border-emerald-500 bg-emerald-50 shadow-sm':'border-gray-200 bg-white hover:border-emerald-300'}`}>
                  {p.id==='quarter'&&<div className="text-xs font-semibold text-emerald-600 mb-1">Алдартай</div>}
                  {p.id==='year'&&<div className="text-xs font-semibold text-amber-600 mb-1">Хэмнэлттэй</div>}
                  <div className="text-xs text-gray-500 mb-1">{p.label}</div>
                  <div className="text-base font-bold text-gray-800">{p.display}</div>
                  <div className="text-xs text-gray-400 mt-1">{p.desc}</div>
                </button>
              ))}
            </div>

            {/* Features */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-6">
              <h3 className="font-semibold text-gray-800 mb-3 text-sm">Бүх тарифт орсон боломжууд:</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {FEATURES.map(f=>(
                  <div key={f} className="flex items-center gap-1.5 text-xs text-gray-600">
                    <span className="text-emerald-500">✓</span>{f}
                  </div>
                ))}
              </div>
            </div>

            <div className="text-center">
              {plan.price > 0 ? (
                <button onClick={()=>setStep('pay')}
                  className="px-8 py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-all">
                  {plan.display} — Үргэлжлүүлэх →
                </button>
              ) : (
                <button onClick={()=>router.push('/')}
                  className="px-8 py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-all">
                  Үнэгүй эхлэх →
                </button>
              )}
              <p className="text-xs text-gray-400 mt-3">7 хоногийн үнэгүй туршилт — бүртгүүлсний дараа автоматаар эхэлнэ</p>
              <a href={FB_URL} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 mt-3 text-sm text-blue-600 hover:underline">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                Facebook-ээр холбогдох
              </a>
            </div>
          </>
        )}

        {step === 'pay' && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <button onClick={()=>setStep('select')} className="text-sm text-gray-400 hover:text-gray-600 mb-4 flex items-center gap-1">← Буцах</button>
            <h2 className="font-bold text-gray-800 mb-4">💳 Төлбөр төлөх — {plan.label} {plan.display}</h2>
            <div className="bg-gray-50 rounded-xl p-4 mb-4 border border-gray-100">
              <div className="font-medium text-sm mb-2">🏦 Банкны шилжүүлэг</div>
              {[['Банк',BANK.name],['Дансны №',BANK.account],['Хүлээн авагч',BANK.owner],['Дүн',plan.display]].map(([k,v])=>(
                <div key={k} className="flex justify-between text-sm py-1 border-b border-gray-100 last:border-0">
                  <span className="text-gray-500">{k}:</span>
                  <span className="font-semibold">{v}</span>
                </div>
              ))}
              <div className="mt-3 bg-amber-50 rounded-lg p-2 text-xs text-amber-700">
                ⚠ Гүйлгээний утга хэсэгт <b>утасны дугаараа</b> заавал бичнэ үү
              </div>
            </div>
            <label className="block text-xs text-gray-500 mb-1.5">Гүйлгээний дугаар</label>
            <div className="flex gap-2">
              <input className="flex-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Гүйлгээний дугаар..." value={refCode} onChange={e=>setRefCode(e.target.value)} />
              <button onClick={handlePay} disabled={!refCode.trim()||loading}
                className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50 hover:bg-emerald-700">
                {loading?'...':'Илгээх'}
              </button>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="max-w-md mx-auto text-center bg-white rounded-2xl border border-emerald-100 p-8">
            <div className="text-4xl mb-3">✅</div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Хүсэлт амжилттай!</h2>
            <p className="text-sm text-gray-500 mt-2">
              Төлбөр баталгаажсаны дараа таны эрх идэвхждэг.<br/>
              Ажлын цагаар <b>1–3 цагийн дотор</b> шийдэгдэнэ.
            </p>
            <a href={FB_URL} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-4 text-sm text-blue-600 hover:underline">
              Асуулт байвал Facebook-ээр холбогдоорой →
            </a>
            <div className="block mt-4">
              <button onClick={()=>router.push('/app')}
                className="bg-emerald-600 text-white px-8 py-3 rounded-xl font-semibold hover:bg-emerald-700">
                Апп руу орох →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
