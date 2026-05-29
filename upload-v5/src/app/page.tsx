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
  const [form, setForm] = useState({
    email: '', password: '', full_name: '', business_name: '', phone: ''
  })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  // Convert phone to email-like format for Supabase auth
  function phoneToEmail(phone: string) {
    const clean = phone.replace(/\D/g, '')
    return `${clean}@agulakh.app`
  }

  function isPhone(val: string) {
    return /^[0-9]{8,}$/.test(val.replace(/\D/g, ''))
  }

  function getAuthEmail() {
    const val = form.email.trim()
    if (isPhone(val)) return phoneToEmail(val)
    return val
  }

  async function handleSubmit() {
    setLoading(true); setError('')
    const authEmail = getAuthEmail()

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({
        email: authEmail, password: form.password
      })
      if (error) setError('Утас/имэйл эсвэл нууц үг буруу байна')
      else router.push('/app')
    } else {
      if (!form.full_name || !form.business_name) {
        setError('Бүх талбарыг бөглөнө үү'); setLoading(false); return
      }
      if (!form.email.trim()) {
        setError('Утасны дугаар эсвэл имэйл оруулна уу'); setLoading(false); return
      }
      const { error } = await supabase.auth.signUp({
        email: authEmail,
        password: form.password,
        options: {
          data: {
            full_name: form.full_name,
            business_name: form.business_name,
            phone: isPhone(form.email) ? form.email.replace(/\D/g,'') : form.phone
          }
        }
      })
      if (error) setError(error.message)
      else router.push('/app')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">📦</div>
          <h1 className="text-2xl font-bold text-gray-800">Агуулахын систем</h1>
          <p className="text-gray-500 text-sm mt-1">Захиалга, бараа, тооцоог нэг дор</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          {/* Mode toggle */}
          <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-6">
            {(['login','register'] as const).map(m => (
              <button key={m} onClick={() => { setMode(m); setError('') }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                  mode === m ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'
                }`}>
                {m === 'login' ? 'Нэвтрэх' : 'Бүртгүүлэх'}
              </button>
            ))}
          </div>

          {/* Register extra fields */}
          {mode === 'register' && (
            <>
              <label className="block text-xs text-gray-500 mb-1">Овог нэр</label>
              <input className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                placeholder="Болд Батбаяр" value={form.full_name} onChange={e => set('full_name', e.target.value)} />
              <label className="block text-xs text-gray-500 mb-1">Дэлгүүр / бизнесийн нэр</label>
              <input className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                placeholder="Sennka дэлгүүр" value={form.business_name} onChange={e => set('business_name', e.target.value)} />
            </>
          )}

          {/* Phone or Email */}
          <label className="block text-xs text-gray-500 mb-1">
            Утасны дугаар эсвэл имэйл
          </label>
          <input
            className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            placeholder="99001234 эсвэл name@gmail.com"
            value={form.email}
            onChange={e => set('email', e.target.value)}
          />

          <label className="block text-xs text-gray-500 mb-1">Нууц үг</label>
          <input
            className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            type="password" placeholder="••••••••"
            value={form.password} onChange={e => set('password', e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          />

          {/* Error */}
          {error && (
            <div className="mt-3 bg-red-50 border border-red-100 text-red-600 text-sm p-3 rounded-lg">{error}</div>
          )}

          {/* Trial note */}
          {mode === 'register' && (
            <div className="mt-3 bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs p-3 rounded-lg">
              ✓ Бүртгүүлсний дараа <b>14 хоногийн үнэгүй туршилт</b> эхэлнэ. Картын мэдээлэл шаардахгүй.
            </div>
          )}

          <button onClick={handleSubmit} disabled={loading}
            className="w-full mt-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition-all disabled:opacity-60">
            {loading ? 'Уншиж байна...' : mode === 'login' ? 'Нэвтрэх →' : 'Бүртгүүлэх →'}
          </button>
        </div>

        {/* Pricing link */}
        <div className="text-center mt-5 space-y-2">
          <a href="/pricing" className="block text-sm text-emerald-600 hover:underline font-medium">
            💳 Үнийн мэдээлэл харах →
          </a>
          <p className="text-xs text-gray-400">
            Аюулгүй · HTTPS шифрлэлт · Өгөгдөл тусгаарлагдсан
          </p>
        </div>
      </div>
    </div>
  )
}
