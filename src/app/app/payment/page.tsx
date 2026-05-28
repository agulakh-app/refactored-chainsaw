'use client'
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
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('payments').insert({
      user_id: user!.id, amount: 15000, method: 'bank_transfer',
      status: 'pending', reference_code: refCode.trim()
    })
    setSubmitted(true)
  }

  return (
    <div className="space-y-5">
      <div className="card">
        <h2 className="font-semibold text-gray-800 mb-4 text-base">💳 Сарын төлбөр</h2>
        <div className="bg-emerald-50 rounded-lg p-4 mb-4 border border-emerald-100">
          <div className="text-2xl font-bold text-emerald-700 mb-1">15,000₮ <span className="text-sm font-normal text-gray-500">/ сар</span></div>
          <div className="text-xs text-gray-500">Нэвтрэх эрх, хязгааргүй захиалга, агуулахын бүртгэл</div>
        </div>

        {profile && (
          <div className="mb-4 text-sm">
            <span className="text-gray-500">Одоогийн статус: </span>
            <span className={`font-medium ${profile.subscription_status==='active'?'text-emerald-700':profile.subscription_status==='trial'?'text-amber-600':'text-red-600'}`}>
              {profile.subscription_status==='active'?'Идэвхтэй':profile.subscription_status==='trial'?'Туршилт (үнэгүй)':'Дууссан'}
            </span>
            {profile.trial_ends_at && profile.subscription_status==='trial' && (
              <span className="text-gray-400 text-xs ml-2">({new Date(profile.trial_ends_at).toLocaleDateString('mn-MN')} хүртэл)</span>
            )}
          </div>
        )}

        <div className="space-y-4">
          <div className="border border-gray-100 rounded-lg p-4">
            <div className="font-medium text-sm mb-3">🏦 Банкны шилжүүлэг</div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Банк:</span><span className="font-medium">Хаан банк</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Дансны дугаар:</span><span className="font-medium font-mono">5001234567</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Хүлээн авагч:</span><span className="font-medium">Агуулахын систем ХХК</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Дүн:</span><span className="font-bold text-emerald-700">15,000₮</span></div>
            </div>
            <div className="mt-3 bg-amber-50 rounded p-2 text-xs text-amber-700">
              ⚠ Гүйлгээний утга хэсэгт <b>имэйл хаягаа</b> бичнэ үү
            </div>
          </div>

          <div className="border border-gray-100 rounded-lg p-4">
            <div className="font-medium text-sm mb-3">📱 QPay QR код</div>
            <div className="bg-gray-100 rounded-lg h-32 flex items-center justify-center text-gray-400 text-sm">
              QPay API холбогдсоны дараа QR харагдана
            </div>
          </div>

          {!submitted ? (
            <div>
              <label className="label">Төлбөр төлсний дараа гүйлгээний дугаар оруулна уу</label>
              <div className="flex gap-2">
                <input className="input flex-1" placeholder="Гүйлгээний дугаар..." value={refCode} onChange={e => setRefCode(e.target.value)} />
                <button onClick={submitPayment} className="btn btn-primary">Илгээх</button>
              </div>
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-4 text-sm text-emerald-700">
              ✓ Хүсэлт илгээгдлээ. Баталгаажуулсны дараа нэвтрэх эрх шинэчлэгдэнэ (24 цагийн дотор).
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
