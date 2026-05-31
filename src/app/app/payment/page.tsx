'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/lib/types'

export default function PaymentPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [refCode, setRefCode] = useState('')
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    supabase.from('profiles').select('*').single().then(({ data }) => setProfile(data))
  }, [])

  async function submitPayment() {
    if (!refCode.trim()) return
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user) return
    const now = new Date()
    const end = new Date(now.getTime() + 30 * 86400000)
    await supabase.from('payments').insert({
      user_id: user.id, amount: 25000, method: 'bank_transfer',
      status: 'pending', reference_code: refCode.trim(),
      period_start: now.toISOString().slice(0,10),
      period_end: end.toISOString().slice(0,10),
    })
    setSubmitted(true)
  }

  return (
    <div className="space-y-5">
      <div className="card">
        <h2 className="font-semibold text-gray-800 mb-4 text-base">💳 Сарын төлбөр</h2>
        {submitted ? (
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-5 text-center">
            <div className="text-3xl mb-2">✅</div>
            <div className="font-semibold text-emerald-700 mb-1">Хүсэлт илгээгдлээ</div>
            <p className="text-sm text-gray-500">Баталгаажсаны дараа имэйлээр мэдэгдэл ирнэ</p>
          </div>
        ) : (
          <>
            <div className="bg-gray-50 rounded-xl p-4 mb-4 border border-gray-100">
              {[['Банк','Хаан банк'],['Дансны №','517307542'],['Хүлээн авагч','Алтаннар'],['Дүн','25,000₮/сар']].map(([k,v])=>(
                <div key={k} className="flex justify-between text-sm py-1">
                  <span className="text-gray-500">{k}:</span>
                  <span className="font-medium">{v}</span>
                </div>
              ))}
            </div>
            <label className="block text-xs text-gray-500 mb-1.5">Гүйлгээний дугаар</label>
            <div className="flex gap-2">
              <input className="flex-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm"
                placeholder="Гүйлгээний дугаар..." value={refCode} onChange={e=>setRefCode(e.target.value)} />
              <button onClick={submitPayment} className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold">
                Илгээх
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
