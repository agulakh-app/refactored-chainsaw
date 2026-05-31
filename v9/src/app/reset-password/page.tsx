'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function handleReset() {
    if (!password) { setError('Нууц үг оруулна уу'); return }
    if (password.length < 6) { setError('Хамгийн багадаа 6 тэмдэгт'); return }
    if (password !== password2) { setError('Нууц үг таарахгүй байна'); return }
    setLoading(true); setError('')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) setError(error.message)
    else setDone(true)
    setLoading(false)
  }

  if (done) return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-white flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center max-w-sm w-full">
        <div className="text-4xl mb-3">✅</div>
        <h2 className="font-bold text-gray-800 mb-2">Нууц үг шинэчлэгдлээ!</h2>
        <button onClick={() => router.push('/')}
          className="mt-4 w-full py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700">
          Нэвтрэх →
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-white flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 max-w-sm w-full">
        <h2 className="font-bold text-gray-800 mb-1">Шинэ нууц үг тохируулах</h2>
        <p className="text-xs text-gray-500 mb-5">Хамгийн багадаа 6 тэмдэгт байх ёстой</p>
        <label className="block text-xs text-gray-500 mb-1">Шинэ нууц үг</label>
        <div className="relative mb-3">
          <input type={showPw?'text':'password'}
            className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm pr-14 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            placeholder="••••••••" value={password} onChange={e=>setPassword(e.target.value)} />
          <button type="button" onClick={()=>setShowPw(v=>!v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
            {showPw?'Нуух':'Харах'}
          </button>
        </div>
        <label className="block text-xs text-gray-500 mb-1">Нууц үг давтах</label>
        <input type="password"
          className={`w-full px-3 py-2.5 rounded-lg border text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-emerald-400 ${
            password2&&password!==password2?'border-red-300':'border-gray-200'}`}
          placeholder="••••••••" value={password2} onChange={e=>setPassword2(e.target.value)} />
        {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-3">{error}</div>}
        <button onClick={handleReset} disabled={loading}
          className="w-full py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60">
          {loading?'Хадгалж байна...':'Нууц үг шинэчлэх →'}
        </button>
      </div>
    </div>
  )
}
