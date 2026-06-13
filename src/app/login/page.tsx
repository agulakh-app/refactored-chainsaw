'use client'
export const dynamic = 'force-dynamic'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'login'|'register'|'forgot'|'guest'>('login')
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

  function phoneToEmail(p: string) { return p.replace(/\D/g,'')+'@agulakh.app' }

  async function handleSubmit() {
    setLoading(true); setError(''); setSuccess('')
    if (mode==='register') {
      if (!phone.trim()) { setError('Утасны дугаар оруулна уу'); setLoading(false); return }
      if (!email.trim()) { setError('Имэйл хаяг оруулна уу'); setLoading(false); return }
      if (!password) { setError('Нууц үг оруулна уу'); setLoading(false); return }
      if (password.length<6) { setError('Нууц үг хамгийн багадаа 6 тэмдэгт байх ёстой'); setLoading(false); return }
      if (password!==password2) { setError('Нууц үг таарахгүй байна'); setLoading(false); return }
      const { error } = await supabase.auth.signUp({
        email: phoneToEmail(phone.trim()), password,
        options: { data: { phone: phone.replace(/\D/g,''), contact_email: email.trim() } }
      })
      if (error&&!error.message.includes('confirmation')&&!error.message.includes('email')) {
        setError(error.message); setLoading(false); return
      }
      router.push('/app')
    } else if (mode==='login') {
      if (!phone.trim()||!password) { setError('Утас болон нууц үгээ оруулна уу'); setLoading(false); return }
      const { error } = await supabase.auth.signInWithPassword({ email: phoneToEmail(phone.trim()), password })
      if (error) setError('Утасны дугаар эсвэл нууц үг буруу байна')
      else router.push('/app')
    } else if (mode==='forgot') {
      if (!email.trim()) { setError('Имэйл хаягаа оруулна уу'); setLoading(false); return }
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`
      })
      if (error) setError(error.message)
      else setSuccess('Нууц үг сэргээх холбоос таны имэйлд илгээгдлээ')
    } else if (mode==='guest') {
      if (!guestUsername.trim()||!guestPin.trim()) {
        setError('Нэвтрэх нэр болон PIN оруулна уу'); setLoading(false); return
      }
      const { data: access } = await supabase.from('shared_access')
        .select('id,owner_id,role,store_id').eq('username',guestUsername.trim()).eq('pin',guestPin.trim()).single()
      if (!access) { setError('Нэвтрэх нэр эсвэл PIN буруу байна'); setLoading(false); return }
      document.cookie = `guest_access=${encodeURIComponent(JSON.stringify({
        owner_id:access.owner_id, role:access.role, username:guestUsername.trim(), store_id:access.store_id||null
      }))}; path=/; max-age=86400`
      router.push('/app'); setLoading(false); return
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{background:'#ffffff'}}>
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <a href="/" className="relative inline-flex items-center justify-center">
            <span style={{
              fontSize: 20,
              fontWeight: 800,
              letterSpacing: '-0.5px',
              color: '#07e6ae',
              lineHeight: 1,
            }}>
              OLULA
            </span>
            <span style={{
              position: 'absolute',
              top: 1,
              right: -4,
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#07e6ae',
              boxShadow: '0 0 8px rgba(7,230,174,0.9)',
            }} />
          </a>
          <div className="text-xl font-medium text-gray-900 tracking-wide uppercase mt-2">Агуулахаа гартаа атга</div>
        </div>

        <div className="bg-white rounded-2xl p-6" style={{border:'1px solid #e5e7eb'}}>

          {mode!=='forgot'&&mode!=='guest'&&(
            <div className="flex gap-1 p-1 rounded-xl mb-5" style={{background:'#f3f4f6'}}>
              {(['login','register'] as const).map(m=>(
                <button key={m} onClick={()=>{setMode(m);setError('');setSuccess('')}}
                  className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
                  style={mode===m?{background:'#ffffff',color:'#111111'}:{color:'#6b7280'}}>
                  {m==='login'?'Нэвтрэх':'Бүртгүүлэх'}
                </button>
              ))}
            </div>
          )}

          {mode==='guest'&&(
            <div className="mb-5">
              <button onClick={()=>{setMode('login');setError('')}} className="text-xs text-gray-400 mb-3 block">← Буцах</button>
              <div className="text-sm font-medium text-gray-800 mb-1">Зочны нэвтрэлт</div>
              <p className="text-xs text-gray-400">Урисан хүний өгсөн нэвтрэх нэр, PIN кодоо оруулна уу</p>
            </div>
          )}

          {mode==='forgot'&&(
            <div className="mb-5">
              <button onClick={()=>{setMode('login');setError('')}} className="text-xs text-gray-400 mb-3 block">← Буцах</button>
              <div className="text-sm font-medium text-gray-800 mb-1">Нууц үг сэргээх</div>
              <p className="text-xs text-gray-400 mb-1">Бүртгэлийн имэйл хаягаа оруулна уу</p>
              <a href="https://www.facebook.com/profile.php?id=61588363850286" target="_blank" rel="noopener noreferrer"
                className="text-xs hover:underline" style={{color:'#07e6ae'}}>
                Facebook-ээр админтай холбогдох →
              </a>
            </div>
          )}

          {mode==='guest'&&(
            <>
              <label className="block text-xs text-gray-400 mb-1">Нэвтрэх нэр</label>
              <input className="w-full px-3 py-2.5 rounded-lg text-sm mb-3" style={{border:'1px solid #e5e7eb'}}
                placeholder="username" value={guestUsername} onChange={e=>setGuestUsername(e.target.value)}/>
              <label className="block text-xs text-gray-400 mb-1">PIN код</label>
              <input type="password" className="w-full px-3 py-2.5 rounded-lg text-sm mb-3" style={{border:'1px solid #e5e7eb'}}
                placeholder="••••" value={guestPin} onChange={e=>setGuestPin(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&handleSubmit()}/>
            </>
          )}

          {mode!=='forgot'&&mode!=='guest'&&(
            <>
              <label className="block text-xs text-gray-400 mb-1">Утасны дугаар</label>
              <input className="w-full px-3 py-2.5 rounded-lg text-sm mb-3" style={{border:'1px solid #e5e7eb'}}
                placeholder="99001234" value={phone} onChange={e=>setPhone(e.target.value)} inputMode="numeric"/>
            </>
          )}

          {(mode==='register'||mode==='forgot')&&(
            <>
              <label className="block text-xs text-gray-400 mb-1">Имэйл хаяг</label>
              <input type="email" className="w-full px-3 py-2.5 rounded-lg text-sm mb-3" style={{border:'1px solid #e5e7eb'}}
                placeholder="example@gmail.com" value={email} onChange={e=>setEmail(e.target.value)}/>
            </>
          )}

          {mode!=='forgot'&&mode!=='guest'&&(
            <>
              <label className="block text-xs text-gray-400 mb-1">Нууц үг</label>
              <div className="relative mb-3">
                <input type={showPw?'text':'password'}
                  className="w-full px-3 py-2.5 rounded-lg text-sm pr-14" style={{border:'1px solid #e5e7eb'}}
                  placeholder="••••••••" value={password} onChange={e=>setPassword(e.target.value)}
                  onKeyDown={e=>mode==='login'&&e.key==='Enter'&&handleSubmit()}/>
                <button type="button" onClick={()=>setShowPw(v=>!v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                  {showPw?'Нуух':'Харах'}
                </button>
              </div>
            </>
          )}

          {mode==='register'&&(
            <>
              <label className="block text-xs text-gray-400 mb-1">Нууц үг давтах</label>
              <div className="relative mb-3">
                <input type={showPw2?'text':'password'}
                  className="w-full px-3 py-2.5 rounded-lg text-sm pr-14"
                  style={{border:`1px solid ${password2&&password!==password2?'#fca5a5':'#e5e7eb'}`}}
                  placeholder="••••••••" value={password2} onChange={e=>setPassword2(e.target.value)}
                  onKeyDown={e=>e.key==='Enter'&&handleSubmit()}/>
                <button type="button" onClick={()=>setShowPw2(v=>!v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                  {showPw2?'Нуух':'Харах'}
                </button>
              </div>
              {password2&&password!==password2&&<p className="text-xs text-red-500 -mt-2 mb-3">Нууц үг таарахгүй байна</p>}
              <div className="text-xs p-3 rounded-lg mb-3" style={{background:'#f0fef9',color:'#04725a',border:'1px solid #b2f0e0'}}>
                7 хоногийн ТӨЛБӨРГҮЙ туршилт — бүртгүүлсний дараа автоматаар эхэлнэ
              </div>
            </>
          )}

          {mode==='login'&&(
            <div className="text-right mb-3 -mt-1">
              <button onClick={()=>{setMode('forgot');setError('')}}
                className="text-xs hover:underline" style={{color:'#07e6ae'}}>
                Нууц үг мартсан уу?
              </button>
            </div>
          )}

          {error&&<div className="text-xs p-3 rounded-lg mb-3" style={{background:'#fef2f2',color:'#dc2626',border:'1px solid #fecaca'}}>{error}</div>}
          {success&&<div className="text-xs p-3 rounded-lg mb-3" style={{background:'#f0fef9',color:'#04725a',border:'1px solid #b2f0e0'}}>{success}</div>}

          <button onClick={handleSubmit} disabled={loading}
            className="w-full py-3 rounded-xl text-sm font-medium transition-all disabled:opacity-60"
            style={{background:'#07e6ae',color:'#0a2e24'}}>
            {loading?'Уншиж байна...'
              :mode==='login'?'Нэвтрэх'
              :mode==='register'?'Бүртгүүлэх'
              :mode==='guest'?'Зочноор нэвтрэх'
              :'Холбоос илгээх'}
          </button>
        </div>

        <div className="text-center mt-4 space-y-2">
          {mode!=='guest'&&(
            <button onClick={()=>{setMode('guest');setError('')}}
              className="block w-full text-sm text-gray-500 py-2.5 px-4 rounded-xl"
              style={{border:'1px solid #e5e7eb'}}>
              Зочны эрхээр нэвтрэх
            </button>
          )}
          <p className="text-xs text-gray-300">Аюулгүй · HTTPS · Өгөгдөл тусгаарлагдсан</p>
        </div>
      </div>
    </div>
  )
}
