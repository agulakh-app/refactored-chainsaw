'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const PLANS = [
  { id:'month',   days:30,  price:25000,  label:'1 сар' },
  { id:'quarter', days:90,  price:69900,  label:'3 сар' },
  { id:'year',    days:365, price:255000, label:'1 жил' },
]

export default function PaymentPage() {
  const [profile, setProfile] = useState<any>(null)
  const [selectedPlan, setSelectedPlan] = useState('month')
  const [refCode, setRefCode] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.from('profiles').select('*').single().then(({ data }) => setProfile(data))
  }, [])

  const plan = PLANS.find(p=>p.id===selectedPlan)!

  async function submitPayment() {
    if (!refCode.trim()) return
    setLoading(true)
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user) return
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

    // Notify admin via email (best effort)
    try {
      await supabase.functions.invoke('send-notification', {
        body: {
          type: 'new_payment',
          to: 'hardworkingfmly@gmail.com',
          data: {
            user_email: profile?.contact_email || user.email,
            phone: user.email?.replace('@agulakh.app',''),
            amount: plan.price.toLocaleString()+'₮',
            plan: plan.label,
            ref_code: refCode.trim(),
          }
        }
      })
    } catch(e) { console.log('Notification failed:', e) }

    setLoading(false)
    setSubmitted(true)
  }

  return (
    <div className="space-y-5">
      <div className="card">
        <h2 className="font-semibold text-gray-800 mb-4 text-base">💳 Төлбөр төлөх</h2>

        {submitted ? (
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-6 text-center">
            <div className="text-4xl mb-3">✅</div>
            <div className="font-semibold text-emerald-700 mb-1">Хүсэлт амжилттай илгээгдлээ!</div>
            <p className="text-sm text-gray-500 mt-2">
              Төлбөр баталгаажсаны дараа таны эрх идэвхждэг.<br/>
              Ажлын цагаар <b>1–3 цагийн дотор</b> шийдэгдэнэ.
            </p>
            <a href="https://www.facebook.com/profile.php?id=61588363850286"
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-4 text-sm text-blue-600 hover:underline">
              Асуулт байвал Facebook-ээр холбогдоорой →
            </a>
          </div>
        ) : (
          <>
            {/* Plan selector */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {PLANS.map(p=>(
                <button key={p.id} onClick={()=>setSelectedPlan(p.id)}
                  className={`rounded-xl border-2 p-3 text-center transition-all ${selectedPlan===p.id?'border-emerald-500 bg-emerald-50':'border-gray-200 hover:border-emerald-300'}`}>
                  <div className="text-xs text-gray-500 mb-1">{p.label}</div>
                  <div className="text-sm font-bold text-gray-800">{p.price.toLocaleString()}₮</div>
                </button>
              ))}
            </div>

            {/* Bank info */}
            <div className="bg-gray-50 rounded-xl p-4 mb-4 border border-gray-100">
              <div className="font-medium text-sm mb-2 text-gray-700">🏦 Банкны шилжүүлэг</div>
              {[['Банк','Хаан банк'],['Дансны №','517307542'],['Хүлээн авагч','Алтаннар'],['Дүн',plan.price.toLocaleString()+'₮']].map(([k,v])=>(
                <div key={k} className="flex justify-between text-sm py-0.5">
                  <span className="text-gray-500">{k}:</span>
                  <span className="font-medium">{v}</span>
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
              <button onClick={submitPayment} disabled={!refCode.trim()||loading}
                className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50 hover:bg-emerald-700">
                {loading?'...':'Илгээх'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
