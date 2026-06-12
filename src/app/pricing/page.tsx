'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import FacebookChat from '@/components/FacebookChat'

const BANK = { name: 'Хаан банк', account: '5173027542', owner: 'Алтаннар' }
const FB_URL = 'https://m.me/992480210614049'

// ── Үнийн сонголтууд (зэрэглэлгүй — бүгд адил боломжтой) ────────
const OPTIONS = [
  { id: 'trial', label: '7 хоног', price: 0, isTrial: true },
  { id: 'm1', label: '1 сар', price: 19900, days: 30 },
  { id: 'm3', label: '3 сар', price: 57000, days: 90 },
  { id: 'y1', label: '1 жил', price: 180000, days: 365 },
] as const

function fmt(n: number) {
  return n.toLocaleString() + '₮'
}

export default function PricingPage() {
  const router = useRouter()
  const [selected, setSelected] = useState<string | null>(null)
  const [refCode, setRefCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [copied, setCopied] = useState('')
  const [trialUsed, setTrialUsed] = useState(true)
  const [checkingTrial, setCheckingTrial] = useState(true)
  const [trialError, setTrialError] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { setCheckingTrial(false); return }
      const { data: p } = await supabase.from('profiles').select('trial_used').eq('id', data.user.id).single()
      setTrialUsed(p?.trial_used === true)
      setCheckingTrial(false)
    })
  }, [])

  const option = OPTIONS.find(o => o.id === selected)

  function selectOption(id: string) {
    setSelected(id)
    setDone(false)
    setRefCode('')
    setTrialError('')
    setTimeout(() => {
      document.getElementById('selection-panel')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 50)
  }

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text).then(() => { setCopied(label); setTimeout(() => setCopied(''), 2000) })
  }

  async function startTrial() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: prof } = await supabase.from('profiles').select('phone').eq('id', user.id).single()
    const phone = prof?.phone?.replace(/\D/g, '')

    if (phone) {
      const { data: existing } = await supabase
        .from('used_trial_phones')
        .select('phone')
        .eq('phone', phone)
        .maybeSingle()

      if (existing) {
        setTrialError('Энэ утасны дугаараар өмнө нь үнэгүй туршилт ашигласан байна. Доорх хугацааны аль нэгийг сонгож төлбөр төлнө үү.')
        return
      }
    }

    const end = new Date(Date.now() + 7 * 86400000)
    await supabase.from('profiles').update({
      subscription_status: 'trial', trial_ends_at: end.toISOString(), trial_used: true, plan: 'full',
    }).eq('id', user.id)

    if (phone) {
      await supabase.from('used_trial_phones').insert({ phone, user_id: user.id })
    }

    router.push('/app')
  }

  async function submitPayment() {
    if (!refCode.trim() || !option || option.isTrial) return
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const now = new Date()
    const end = new Date(now.getTime() + (option as any).days * 86400000)
    await supabase.from('payments').insert({
      user_id: user.id, amount: option.price, method: 'bank_transfer', status: 'pending',
      reference_code: refCode.trim(),
      period_start: now.toISOString().slice(0, 10),
      period_end: end.toISOString().slice(0, 10),
      plan: 'full',
    })
    setLoading(false); setDone(true)
  }

  return (
    <>
      <Navbar />
      <FacebookChat />

      <main style={{ paddingTop: 110, paddingBottom: 96, background: '#f8fffe', minHeight: '100vh' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 24px' }}>

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#07e6ae', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
              ҮНЭ ТАРИФ
            </p>
            <h1 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, color: '#0a2e24', letterSpacing: '-1px', margin: '0 0 12px' }}>
              Хугацаагаа сонгоод эхлээрэй
            </h1>
            <p style={{ fontSize: 15, color: '#6b7280', margin: 0 }}>
              Бүх боломж — нэг үнэ, зэрэглэлгүй. Доорх сонголтоо дарна уу.
            </p>
          </div>

          {/* 4 сонголт */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 24,
          }}>
            {OPTIONS.map(opt => {
              const isSelected = selected === opt.id
              return (
                <div
                  key={opt.id}
                  onClick={() => selectOption(opt.id)}
                  style={{
                    borderRadius: 16, padding: '20px 12px', textAlign: 'center', cursor: 'pointer',
                    transition: 'all 0.15s',
                    background: '#ffffff',
                    border: isSelected ? '2px solid #0a2e24' : (opt.isTrial ? '1px solid #07e6ae' : '1px solid #e8f5f1'),
                    boxShadow: isSelected ? '0 4px 24px rgba(10,46,36,0.12)' : 'none',
                  }}
                >
                  <div style={{ fontSize: 13, marginBottom: 8, color: '#9ca3af' }}>
                    {opt.label}
                  </div>
                  <div style={{
                    fontSize: opt.isTrial ? 17 : 19, fontWeight: 800,
                    color: opt.isTrial ? '#048a6a' : '#0a2e24',
                  }}>
                    {opt.isTrial ? 'Үнэгүй' : fmt(opt.price)}
                  </div>
                  {opt.isTrial && (
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                      туршилт
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Сонголтын панель */}
          {option && (
            <div id="selection-panel" style={{
              borderRadius: 16, border: '2px solid #07e6ae', background: '#fff',
              padding: '28px', marginBottom: 24,
              boxShadow: '0 4px 24px rgba(7,230,174,0.12)',
            }}>

              {/* Trial сонгосон */}
              {option.isTrial ? (
                <div>
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 4 }}>Сонгосон</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#0a2e24' }}>7 хоногийн төлбөргүй туршилт</div>
                  </div>

                  {trialError ? (
                    <div style={{
                      padding: '14px 16px', borderRadius: 10, marginBottom: 16,
                      background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)',
                      fontSize: 13, color: '#b91c1c', lineHeight: 1.5,
                    }}>
                      ⚠️ {trialError}
                    </div>
                  ) : !checkingTrial && trialUsed ? (
                    <div style={{
                      padding: '14px 16px', borderRadius: 10, marginBottom: 16,
                      background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)',
                      fontSize: 13, color: '#b91c1c', lineHeight: 1.5,
                    }}>
                      ⚠️ Та өмнө нь туршилт ашигласан байна. Доорх хугацааны аль нэгийг сонгож төлбөр төлнө үү.
                    </div>
                  ) : (
                    <button onClick={startTrial}
                      style={{ width: '100%', padding: '14px', borderRadius: 12, border: 'none', background: '#07e6ae', color: '#0a2e24', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                      Туршилтаа эхлүүлэх →
                    </button>
                  )}
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 4 }}>Сонгосон хугацаа</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: '#0a2e24' }}>{option.label}</div>
                    </div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: '#07e6ae' }}>{fmt(option.price)}</div>
                  </div>

                  {!done && (
                    <div>
                      <div style={{ borderRadius: 12, padding: '16px', border: '1px solid #e8f5f1', background: '#f8fffe', marginBottom: 16 }}>
                        {[
                          ['Дансны банк', BANK.name],
                          ['Дансны дугаар', BANK.account],
                          ['Хүлээн авагч', BANK.owner],
                          ['Гүйлгээний утга', 'Бүртгэлийн утасны дугаараа бичнэ үү'],
                          ['Дүн', fmt(option.price)],
                        ].map(([k, v]) => (
                          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14, padding: '6px 0' }}>
                            <span style={{ color: '#9ca3af' }}>{k}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontWeight: 600, color: '#0a2e24' }}>{v}</span>
                              {(k === 'Дансны дугаар' || k === 'Дүн') && (
                                <button onClick={() => copy(v, k)}
                                  style={{
                                    fontSize: 11, padding: '3px 8px', borderRadius: 6, border: 'none', cursor: 'pointer',
                                    background: copied === k ? 'rgba(7,230,174,0.15)' : '#f3f4f6',
                                    color: copied === k ? '#07e6ae' : '#6b7280',
                                  }}>
                                  {copied === k ? '✓' : 'copy'}
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      <label style={{ display: 'block', fontSize: 13, color: '#9ca3af', marginBottom: 6 }}>Гүйлгээний дугаар</label>
                      <input
                        value={refCode} onChange={e => setRefCode(e.target.value)}
                        placeholder="Гүйлгээний дугаараа оруулна уу..."
                        style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid #e0e0e0', fontSize: 14, marginBottom: 14, boxSizing: 'border-box' }}
                      />

                      <button onClick={submitPayment} disabled={!refCode.trim() || loading}
                        style={{
                          width: '100%', padding: '14px', borderRadius: 12, border: 'none',
                          background: '#07e6ae', color: '#0a2e24', fontSize: 15, fontWeight: 700,
                          cursor: 'pointer', opacity: (!refCode.trim() || loading) ? 0.5 : 1,
                        }}>
                        {loading ? 'Илгээж байна...' : 'Баталгаажуулах →'}
                      </button>
                    </div>
                  )}

                  {done && (
                    <div style={{ textAlign: 'center', padding: '20px 0' }}>
                      <div style={{
                        width: 48, height: 48, borderRadius: '50%', background: 'rgba(7,230,174,0.1)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
                      }}>
                        <span style={{ fontSize: 22, color: '#07e6ae' }}>✓</span>
                      </div>
                      <h3 style={{ fontSize: 17, fontWeight: 700, color: '#0a2e24', margin: '0 0 8px' }}>Хүсэлт илгээгдлээ</h3>
                      <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 20px', lineHeight: 1.6 }}>
                        Төлбөр баталгаажсаны дараа таны эрх идэвхждэг.<br />Ажлын өдрөөр 1–3 цагийн дотор шийдэгдэнэ.
                      </p>
                      <button onClick={() => router.push('/app')}
                        style={{ width: '100%', padding: '14px', borderRadius: 12, border: 'none', background: '#07e6ae', color: '#0a2e24', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                        Апп руу орох →
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* OLULA туслах */}
          <div style={{ textAlign: 'center' }}>
            <a href={FB_URL} target="_blank" rel="noopener noreferrer" style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 13, color: '#048a6a', textDecoration: 'none', fontWeight: 600,
            }}>
              <svg width="15" height="15" viewBox="0 0 28 28" fill="currentColor">
                <path d="M14 2C7.373 2 2 7.06 2 13.32c0 3.28 1.395 6.23 3.641 8.33V26l4.283-2.35c1.143.315 2.355.49 3.612.49 6.627 0 12-5.06 12-11.32C25.536 7.06 20.627 2 14 2z"/>
              </svg>
              Асуулт байвал OLULA туслах руу бичээрэй →
            </a>
          </div>

        </div>
      </main>
    </>
  )
}
