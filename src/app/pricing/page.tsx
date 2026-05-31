'use client'
export const dynamic = 'force-dynamic'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'


const BANK = { name:'Хаан банк', account:'5173027542', owner:'Алтаннар' }
const FB_URL = 'https://www.facebook.com/profile.php?id=61588363850286'

const PLANS = [
  { id:'demo',    label:'1 өдөр',  days:1,   price:0,      display:'Үнэгүй',    desc:'Бүх боломжийг туршиж үзэх' },
  { id:'month',   label:'1 сар',   days:30,  price:25000,  display:'25,000₮',   desc:'Сар бүр сунгах' },
  { id:'quarter', label:'3 сар',   days:90,  price:69900,  display:'69,900₮',   desc:'23,300₮/сар — 7% хямдрал', badge:'Алдартай' },
  { id:'year',    label:'1 жил',   days:365, price:255000, display:'255,000₮',  desc:'21,250₮/сар — 15% хямдрал', badge:'Хэмнэлттэй' },
]

export default function PricingPage() {
  const router = useRouter()
  const [selected, setSelected] = useState('quarter')
  const [step, setStep] = useState<'plans'|'payment'|'done'>('plans')
  const [refCode, setRefCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState('')
  const plan = PLANS.find(p=>p.id===selected)!

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text).then(()=>{ setCopied(label); setTimeout(()=>setCopied(''),2000) })
  }

  async function choosePlan() {
    if (selected==='demo') { router.push('/'); return }
    setStep('payment')
  }

  async function submitPayment() {
    if (!refCode.trim()) return
    setLoading(true)
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }
    const now = new Date()
    const end = new Date(now.getTime()+plan.days*86400000)
    await supabase.from('payments').insert({
      user_id:user.id, amount:plan.price, method:'bank_transfer', status:'pending',
      reference_code:refCode.trim(),
      period_start:now.toISOString().slice(0,10),
      period_end:end.toISOString().slice(0,10),
    })
    setLoading(false); setStep('done')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-white px-4 py-10">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <div className="text-4xl mb-3">📦</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">OLULA</h1>
          <p className="text-gray-500 text-sm">Агуулахаа гартаа атга</p>
        </div>

        {step==='plans' && (<>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {PLANS.map(p=>(
              <div key={p.id} onClick={()=>setSelected(p.id)}
                className={"relative rounded-2xl border-2 p-4 cursor-pointer transition-all "+(selected===p.id?'border-emerald-500 bg-emerald-50 shadow-md':'border-gray-200 bg-white hover:border-emerald-300')}>
                {p.badge&&<div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-xs font-semibold px-3 py-0.5 rounded-full whitespace-nowrap">{p.badge}</div>}
                <div className="text-xs font-semibold text-gray-500 mb-1 mt-1">{p.label}</div>
                <div className="text-xl font-bold text-gray-800 mb-1">{p.display}</div>
                <div className="text-xs text-gray-400 leading-relaxed">{p.desc}</div>
                {selected===p.id&&<div className="mt-2 text-emerald-600 text-xs font-medium">✓ Сонгогдлоо</div>}
              </div>
            ))}
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-8">
            <h3 className="font-semibold text-gray-700 mb-3 text-sm">Бүх тарифт орсон боломжууд:</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {['Захиалга бүртгэл','Агуулахын үлдэгдэл','Цэнэглэлтийн түүх','Өдрийн тайлан','Утсаар шүүх','Олон бараа нэг захиалганд','CSV татах','Гар утсанд ажиллана','Хязгааргүй бараа','Борлуулалтын индекс'].map(f=>(
                <div key={f} className="flex items-center gap-1.5 text-sm text-gray-600"><span className="text-emerald-500 text-xs font-bold">✓</span>{f}</div>
              ))}
            </div>
          </div>
          <div className="flex justify-center">
            <button onClick={choosePlan} className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-10 py-3.5 rounded-xl text-base transition-all shadow-sm">
              {selected==='demo'?'Үнэгүй туршиж үзэх →':plan.display+' — Үргэлжлүүлэх →'}
            </button>
          </div>
          <p className="text-center text-xs text-gray-400 mt-3">7 хоногийн үнэгүй туршилт — бүртгүүлсний дараа автоматаар эхэлнэ</p>

          {/* FB contact */}
          <div className="text-center mt-6">
            <a href={FB_URL} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline font-medium">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              Facebook хуудсаар лавлах
            </a>
          </div>
        </>)}

        {step==='payment' && (
          <div className="max-w-md mx-auto">
            <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-4">
              <div className="text-center mb-5">
                <div className="text-3xl font-bold text-emerald-700">{plan.display}</div>
                <div className="text-sm text-gray-500 mt-1">{plan.label} — {plan.desc}</div>
              </div>

              {/* Bank info */}
              <div className="bg-gray-50 rounded-xl p-4 mb-4 border border-gray-100">
                <div className="font-medium text-sm mb-3 text-gray-700">🏦 Банкны шилжүүлэг</div>
                <div className="space-y-2">
                  {[['Банк',BANK.name],['Дансны №',BANK.account],['Хүлээн авагч',BANK.owner],['Дүн',plan.display]].map(([k,v])=>(
                    <div key={k} className="flex justify-between items-center text-sm">
                      <span className="text-gray-500">{k}:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{v}</span>
                        {(k==='Дансны №'||k==='Дүн')&&(
                          <button onClick={()=>copy(v,k)} className={"text-xs px-2 py-0.5 rounded-lg transition-all "+(copied===k?'bg-emerald-100 text-emerald-600':'bg-gray-200 text-gray-500 hover:bg-gray-300')}>
                            {copied===k?'✓':'Copy'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 bg-amber-50 rounded-lg p-2.5 text-xs text-amber-700 border border-amber-100">
                  ⚠ Гүйлгээний утга хэсэгт <b>бүртгэлийн имэйл эсвэл утасны дугаараа</b> заавал бичнэ үү
                </div>
              </div>

              {/* QR */}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 mb-4">
                <div className="font-medium text-sm mb-3 text-gray-700">📱 QPay QR код</div>
                <div className="flex justify-center">
                  <img src={QR_IMAGE} alt="QPay QR код" className="w-48 h-48 rounded-xl object-cover border border-gray-200" />
                </div>
                <p className="text-xs text-center text-gray-400 mt-2">Утасны банкны аппаар уншуулна</p>
              </div>

              <label className="block text-xs text-gray-500 mb-1.5">Гүйлгээний дугаар / баталгаажуулах код</label>
              <input className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 mb-4"
                placeholder="Гүйлгээний дугаар..." value={refCode} onChange={e=>setRefCode(e.target.value)} />

              <div className="flex gap-2">
                <button onClick={()=>setStep('plans')} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">← Буцах</button>
                <button onClick={submitPayment} disabled={!refCode.trim()||loading}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50 hover:bg-emerald-700">
                  {loading?'Илгээж байна...':'Баталгаажуулах →'}
                </button>
              </div>

              {/* FB contact */}
              <div className="text-center mt-4">
                <a href={FB_URL} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-blue-500 hover:underline">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                  Асуулт байвал Facebook-ээр холбогдоорой
                </a>
              </div>
            </div>
          </div>
        )}

        {step==='done' && (
          <div className="max-w-md mx-auto text-center bg-white rounded-2xl border border-emerald-100 p-8">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Хүсэлт илгээгдлээ!</h2>
            <p className="text-gray-500 text-sm mb-5">Төлбөр баталгаажсаны дараа таны эрх идэвхждэг.<br/>Ажлын өдрөөр 1–3 цагийн дотор шийдэгдэнэ.</p>
            <a href={FB_URL} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline mb-5 font-medium">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              Facebook-ээр лавлах
            </a>
            <div className="block">
              <button onClick={()=>router.push('/app')} className="bg-emerald-600 text-white px-8 py-3 rounded-xl font-semibold hover:bg-emerald-700">Апп руу орох →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
