'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function AuthPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ email: '', password: '', full_name: '', business_name: '' })

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit() {
    setLoading(true); setError('')
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password })
      if (error) setError('Имэйл эсвэл нууц үг буруу байна')
      else router.push('/app')
    } else {
      if (!form.full_name || !form.business_name) { setError('Бүх талбарыг бөглөнө үү'); setLoading(false); return }
      const { error } = await supabase.auth.signUp({
        email: form.email, password: form.password,
        options: { data: { full_name: form.full_name, business_name: form.business_name } }
      })
      if (error) setError(error.message)
      else router.push('/app')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">📦</div>
          <h1 className="text-2xl font-semibold text-gray-800">Агуулахын систем</h1>
          <p className="text-gray-500 text-sm mt-1">Захиалга, бараа, тооцоог нэг дор</p>
        </div>

        <div className="card shadow-sm">
          <div className="flex gap-1 p-1 bg-gray-100 rounded-lg mb-6">
            {(['login','register'] as const).map(m => (
              <button key={m} onClick={() => setMode(m)}
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${mode===m ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500'}`}>
                {m === 'login' ? 'Нэвтрэх' : 'Бүртгүүлэх'}
              </button>
            ))}
          </div>

          {mode === 'register' && <>
            <label className="label">Нэр</label>
            <input className="input" placeholder="Овог нэр" value={form.full_name} onChange={e => set('full_name', e.target.value)} />
            <label className="label">Бизнесийн нэр</label>
            <input className="input" placeholder="Дэлгүүр / компанийн нэр" value={form.business_name} onChange={e => set('business_name', e.target.value)} />
          </>}

          <label className="label">Имэйл хаяг</label>
          <input className="input" type="email" placeholder="example@gmail.com" value={form.email} onChange={e => set('email', e.target.value)} />
          <label className="label">Нууц үг</label>
          <input className="input" type="password" placeholder="••••••••" value={form.password} onChange={e => set('password', e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()} />

          {error && <p className="text-red-600 text-sm mt-3 bg-red-50 p-3 rounded-lg">{error}</p>}

          {mode === 'register' && (
            <p className="text-xs text-gray-500 mt-3 bg-amber-50 p-3 rounded-lg">
              ✓ 14 хоногийн үнэгүй туршилт. Дараа нь сар бүр төлбөр.
            </p>
          )}

          <button onClick={handleSubmit} disabled={loading}
            className="btn btn-primary w-full mt-4 justify-center flex disabled:opacity-60">
            {loading ? 'Уншиж байна...' : mode === 'login' ? 'Нэвтрэх' : 'Бүртгүүлэх'}
          </button>
        </div>
      </div>
    </div>
  )
}
