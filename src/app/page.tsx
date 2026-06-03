'use client'
export const dynamic = 'force-dynamic'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function AuthPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'guest'>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [showPw2, setShowPw2] = useState(false)
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [guestUsername, setGuestUsername] = useState('')
  const [guestPin, setGuestPin] = useState('')

  function phoneToEmail(p: string) {
    return p.replace(/\D/g, '') + '@agulakh.app'
  }

  async function handleSubmit() {
    setLoading(true); setError(''); setSuccess('')

    if (mode === 'register') {
      if (!phone.trim()) { setError('Утасны дугаар оруулна уу'); setLoading(false); return }
      if (!email.trim()) { setError('Имэйл хаяг оруулна уу'); setLoading(false); return }
      if (!password) { setError('Нууц үг оруулна уу'); setLoading(false); return }
      if (password.length < 6) { setError('Нууц үг хамгийн багадаа 6 тэмдэгт байх ёстой'); setLoading(false); return }
      if (password !== password2) { setError('Нууц үг таарахгүй байна'); setLoading(false); return }
      const authEmail = phoneToEmail(phone.trim())
      const { error } = await supabase.auth.signUp({
        email: authEmail, password,
        options: { data: { phone: phone.replace(/\D/g, ''), contact_email: email.trim() } }
      })
      if (error && !error.message.includes('confirmation') && !error.message.includes('email')) {
        setError(error.message); setLoading(false); return
      }
      router.push('/app')

    } else if (mode === 'login') {
      if (!phone.trim() || !password) { setError('Утас болон нууц үгээ оруулна уу'); setLoading(false); return }
      const authEmail = phoneToEmail(phone.trim())
      const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password })
      if (error) setError('Утасны дугаар эсвэл нууц үг буруу байна')
      else router.push('/app')

    } else if (mode === 'forgot') {
      if (!email.trim()) { setError('Имэйл хаягаа оруулна уу'); setLoading(false); return }
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`
      })
      if (error) setError(error.message)
      else setSuccess('Нууц үг сэргээх холбоос таны имэйлд илгээгдлээ')

    } else if (mode === 'guest') {
      if (!guestUsername.trim() || !guestPin.trim()) {
        setError('Нэвтрэх нэр болон PIN оруулна уу'); setLoading(false); return
      }
      const { data: access } = await supabase.from('shared_access')
        .select('id, owner_id, role')
        .eq('username', guestUsername.trim())
        .eq('pin', guestPin.trim())
        .single()
      if (!access) {
        setError('Нэвтрэх нэр эсвэл PIN буруу байна'); setLoading(false); return
      }
      document.cookie = `guest_access=${encodeURIComponent(JSON.stringify({
        owner_id: access.owner_id,
        role: access.role,
        username: guestUsername.trim()
      }))}; path=/; max-age=86400`
      router.push('/app')
      setLoading(false); return
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-2xl font-medium text-gray-900 mb-1">OLULA</div>
          <p className="text-sm text-gray-400">Агуулахаа гартаа атга</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-6">

          {/* Mode tabs */}
          {mode !== 'forgot' && mode !== 'guest' && (
            <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-5">
              {(['login', 'register'] as const).map(m => (
                <button key={m} onClick={() => { setMode(m); setError(''); setSuccess('') }}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                    mode === m ? 'bg-white text-gray-800' : 'text-gray-400 hover:text-gray-600'
                  }`}>
                  {m === 'login' ? 'Нэвтрэх' : 'Бүртгүүлэх'}
                </button>
              ))}
            </div>
          )}

          {/* Guest header */}
          {mode === 'guest' && (
            <div className="mb-5">
              <button onClick={() => { setMode('login'); setError('') }}
                className="text-xs text-gray-400 hover:text-gray-600 mb-3 block">
                ← Буцах
              </button>
              <div className="text-sm font-medium text-gray-800 mb-1">Зочны нэвтрэлт</div>
              <p className="text-xs text-gray-400">Урисан хүний өгсөн нэвтрэх нэр, PIN кодоо оруулна уу</p>
            </div>
          )}

          {/* Forgot header */}
          {mode === 'forgot' && (
            <div className="mb-5">
              <button onClick={() => { setMode('login'); setError('') }}
                className="text-xs text-gray-400 hover:text-gray-600 mb-3 block">
                ← Буцах
              </button>
              <div className="text-sm font-medium text-gray-800 mb-1">Нууц үг сэргээх</div>
              <p className="text-xs text-gray-400">Бүртгэлийн имэйл хаягаа оруулна уу</p>
              <a href="https://www.facebook.com/profile.php?id=61588363850286"
                target="_blank" rel="noopener noreferrer"
                className="text-xs text-blue-500 hover:underline mt-1 block">
                Facebook-ээр админтай холбогдох →
              </a>
            </div>
          )}

          {/* Guest fields */}
          {mode === 'guest' && (
            <>
              <label className="block text-xs text-gray-400 mb-1">Нэвтрэх нэр</label>
              <input className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm mb-3"
                placeholder="username" value={guestUsername} onChange={e => setGuestUsername(e.target.value)} />
              <label className="block text-xs text-gray-400 mb-1">PIN код</label>
              <input type="password" className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm mb-3"
                placeholder="••••" value={guestPin} onChange={e => setGuestPin(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
            </>
          )}

          {/* Phone */}
          {mode !== 'forgot' && mode !== 'guest' && (
            <>
              <label className="block text-xs text-gray-400 mb-1">
                Утасны дугаар <span className="text-gray-300">— нэвтрэхэд ашиглана</span>
              </label>
              <input className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm mb-3"
                placeholder="99001234" value={phone} onChange={e => setPhone(e.target.value)} inputMode="numeric" />
            </>
          )}

          {/* Email */}
          {(mode === 'register' || mode === 'forgot') && (
            <>
              <label className="block text-xs text-gray-400 mb-1">
                Имэйл хаяг {mode === 'register' && <span className="text-gray-300">— нууц үг сэргээхэд</span>}
              </label>
              <input type="email" className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm mb-3"
                placeholder="example@gmail.com" value={email} onChange={e => setEmail(e.target.value)} />
            </>
          )}

          {/* Password */}
          {mode !== 'forgot' && mode !== 'guest' && (
            <>
              <label className="block text-xs text-gray-400 mb-1">Нууц үг</label>
              <div className="relative mb-3">
                <input type={showPw ? 'text' : 'password'}
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm pr-14"
                  placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => mode === 'login' && e.key === 'Enter' && handleSubmit()} />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600">
                  {showPw ? 'Нуух' : 'Харах'}
                </button>
              </div>
            </>
          )}

          {/* Confirm password */}
          {mode === 'register' && (
            <>
              <label className="block text-xs text-gray-400 mb-1">Нууц үг давтах</label>
              <div className="relative mb-3">
                <input type={showPw2 ? 'text' : 'password'}
                  className={`w-full px-3 py-2.5 rounded-lg border text-sm pr-14 ${
                    password2 && password !== password2 ? 'border-red-200 bg-red-50' : 'border-gray-200'
                  }`}
                  placeholder="••••••••" value={password2} onChange={e => setPassword2(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
                <button type="button" onClick={() => setShowPw2(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600">
                  {showPw2 ? 'Нуух' : 'Харах'}
                </button>
              </div>
              {password2 && password !== password2 && (
                <p className="text-xs text-red-500 -mt-2 mb-3">Нууц үг таарахгүй байна</p>
              )}
              <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs p-3 rounded-lg mb-3">
                7 хоногийн үнэгүй туршилт — бүртгүүлсний дараа автоматаар эхэлнэ
              </div>
            </>
          )}

          {/* Forgot password link */}
          {mode === 'login' && (
            <div className="text-right mb-3 -mt-1">
              <button onClick={() => { setMode('forgot'); setError('') }}
                className="text-xs text-emerald-600 hover:underline">
                Нууц үг мартсан уу?
              </button>
            </div>
          )}

          {error && <div className="bg-red-50 border border-red-100 text-red-600 text-xs p-3 rounded-lg mb-3">{error}</div>}
          {success && <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs p-3 rounded-lg mb-3">{success}</div>}

          <button onClick={handleSubmit} disabled={loading}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm transition-all disabled:opacity-60">
            {loading ? 'Уншиж байна...'
              : mode === 'login' ? 'Нэвтрэх'
              : mode === 'register' ? 'Бүртгүүлэх'
              : mode === 'guest' ? 'Зочноор нэвтрэх'
              : 'Холбоос илгээх'}
          </button>
        </div>

        <div className="text-center mt-5 space-y-2">
          {mode !== 'guest' && (
            <button onClick={() => { setMode('guest'); setError('') }}
              className="block w-full text-sm text-gray-500 hover:text-gray-700">
              Зочны эрхээр нэвтрэх →
            </button>
          )}
          <a href="/pricing" className="block text-sm text-emerald-600 hover:underline">
            Үнийн мэдээлэл →
          </a>
          <p className="text-xs text-gray-300">Аюулгүй · HTTPS · Өгөгдөл тусгаарлагдсан</p>
        </div>
      </div>
    </div>
  )
}
