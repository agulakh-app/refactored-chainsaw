'use client'
export const dynamic = 'force-dynamic'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function AuthPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'login'|'register'>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [showPw2, setShowPw2] = useState(false)
  const [form, setForm] = useState({
    phone: '', email: '', password: '', password2: '',
    full_name: '', business_name: ''
  })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  function phoneToEmail(p: string) {
    return p.replace(/\D/g,'') + '@agulakh.app'
  }

  async function handleSubmit() {
    setLoading(true); setError('')

    if (mode === 'register') {
      if (!form.phone.trim() || !form.email.trim() || !form.password || !form.full_name || !form.business_name) {
        setError('Бүх талбарыг бөглөнө үү'); setLoading(false); return
      }
      if (form.password !== form.password2) {
        setError('Нууц үг таарахгүй байна'); setLoading(false); return
      }
      if (form.password.length < 6) {
        setError('Нууц үг хамгийн багадаа 6 тэмдэгт байх ёстой'); setLoading(false); return
      }
      // Check if phone already used
      const authEmail = phoneToEmail(form.phone.trim())
      const { error: signUpErr } = await supabase.auth.signUp({
        email: authEmail,
        password: form.password,
        options: {
          data: {
            full_name: form.full_name,
            business_name: form.business_name,
            contact_email: form.email.trim(),
            phone: form.phone.replace(/\D/g,''),
            trial_used: true
          }
        }
      })
      if (signUpErr) { setError(signUpErr.message); setLoading(false); return }
      // Send welcome email via edge function or just redirect
      router.push('/app')
    } else {
      // Login: phone number → convert to email
      const raw = form.phone.trim()
      const authEmail = raw.includes('@') ? raw : phoneToEmail(raw)
      const { error } = await supabase.auth.signInWithPassword({
        email: authEmail, password: form.password
      })
      if (error) setError('Утас/имэйл эсвэл нууц үг буруу байна')
      else router.push('/app')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">📦</div>
          <h1 className="text-2xl font-bold text-gray-800">Агуулахын систем</h1>
          <p className="text-gray-500 text-sm mt-1">Захиалга, бараа, тооцоог нэг дор</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-5">
            {(['login','register'] as const).map(m => (
              <button key={m} onClick={() => { setMode(m); setError('') }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${mode===m?'bg-white shadow-sm text-gray-800':'text-gray-500 hover:text-gray-700'}`}>
                {m==='login'?'Нэвтрэх':'Бүртгүүлэх'}
              </button>
            ))}
          </div>

          {mode==='register' && (
            <>
              <label className="block text-xs text-gray-500 mb-1">Овог нэр</label>
              <input className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                placeholder="Болд Батбаяр" value={form.full_name} onChange={e=>set('full_name',e.target.value)} />
              <label className="block text-xs text-gray-500 mb-1">Дэлгүүр / бизнесийн нэр</label>
              <input className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                placeholder="Sennka дэлгүүр" value={form.business_name} onChange={e=>set('business_name',e.target.value)} />
            </>
          )}

          {/* Утасны дугаар */}
          <label className="block text-xs text-gray-500 mb-1">
            Утасны дугаар
            {mode==='register' && <span className="text-gray-400 ml-1">— нэвтрэхэд ашиглана</span>}
          </label>
          <input className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            placeholder="99001234" value={form.phone} onChange={e=>set('phone',e.target.value)}
            inputMode="numeric" />

          {/* Имэйл — зөвхөн бүртгэлд */}
          {mode==='register' && (
            <>
              <label className="block text-xs text-gray-500 mb-1">
                Имэйл хаяг
                <span className="text-gray-400 ml-1">— мэдэгдэл, үйлчилгээний мэдээлэл хүлээн авна</span>
              </label>
              <input type="email" className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                placeholder="example@gmail.com" value={form.email} onChange={e=>set('email',e.target.value)} />
            </>
          )}

          {/* Нууц үг */}
          <label className="block text-xs text-gray-500 mb-1">Нууц үг</label>
          <div className="relative mb-3">
            <input type={showPw?'text':'password'}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              placeholder="••••••••" value={form.password} onChange={e=>set('password',e.target.value)}
              onKeyDown={e=>mode==='login'&&e.key==='Enter'&&handleSubmit()} />
            <button type="button" onClick={()=>setShowPw(v=>!v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs">
              {showPw?'Нуух':'Харах'}
            </button>
          </div>

          {/* Нууц үг баталгаажуулах — зөвхөн бүртгэлд */}
          {mode==='register' && (
            <>
              <label className="block text-xs text-gray-500 mb-1">Нууц үг давтах</label>
              <div className="relative mb-3">
                <input type={showPw2?'text':'password'}
                  className={`w-full px-3 py-2.5 rounded-lg border text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-emerald-400 ${form.password2&&form.password!==form.password2?'border-red-300 bg-red-50':'border-gray-200'}`}
                  placeholder="••••••••" value={form.password2} onChange={e=>set('password2',e.target.value)} />
                <button type="button" onClick={()=>setShowPw2(v=>!v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs">
                  {showPw2?'Нуух':'Харах'}
                </button>
              </div>
              {form.password2&&form.password!==form.password2&&(
                <p className="text-xs text-red-500 -mt-2 mb-2">Нууц үг таарахгүй байна</p>
              )}
            </>
          )}

          {error && <div className="mt-2 bg-red-50 border border-red-100 text-red-600 text-sm p-3 rounded-lg">{error}</div>}

          {mode==='register' && (
            <div className="mt-3 bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs p-3 rounded-lg space-y-1">
              <div>✓ <b>7 хоногийн үнэгүй туршилт</b> — бүртгүүлсний дараа автоматаар эхэлнэ</div>
              <div className="text-gray-500">Туршилтын хугацаанд зарим тохиргоо хязгаарлагдмал байна</div>
            </div>
          )}

          <button onClick={handleSubmit} disabled={loading}
            className="w-full mt-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition-all disabled:opacity-60">
            {loading?'Уншиж байна...':mode==='login'?'Нэвтрэх →':'Бүртгүүлэх →'}
          </button>
        </div>

        <div className="text-center mt-5 space-y-2">
          <a href="/pricing" className="block text-sm text-emerald-600 hover:underline font-medium">
            💳 Үнийн мэдээлэл харах →
          </a>
          <p className="text-xs text-gray-400">Аюулгүй · HTTPS шифрлэлт · Өгөгдөл тусгаарлагдсан</p>
        </div>
      </div>
    </div>
  )
}
