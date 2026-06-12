'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import FacebookChat from '@/components/FacebookChat'

const BANK = { name: 'Хаан банк', account: '5173027542', owner: 'Алтаннар' }
const FB_URL = 'https://m.me/992480210614049'

// ── Үнийн дата ────────────────────────────────────────────────
const PERIODS = [
  { id: 'm', label: '1 сар', days: 30 },
  { id: 'q', label: '3 сар', days: 90 },
  { id: 'h', label: '6 сар', days: 180 },
  { id: 'y', label: '1 жил', days: 365 },
] as const

const PLANS = [
  { id: 'basic', label: 'Үндсэн', prices: { m: 19900, q: 55000, h: 109000, y: 218000 } },
  { id: 'standard', label: 'Стандарт', prices: { m: 29900, q: 85000, h: 169000, y: 318000 } },
  { id: 'full', label: 'Бүрэн эрх', prices: { m: 39900, q: 115000, h: 219000, y: 429000 } },
] as const

// ── Боломжууд (бүх багцад байгаа) ──────────────────────────────
const FEATURES_ALL = [
  'Бараа бүртгэл', 'Захиалга бүртгэл', 'Агуулахын үлдэгдэл', 'Цэнэглэлтийн түүх',
  'Утсаар шүүх', 'CSV татах', 'Хязгааргүй бараа', 'Гар утсанд ажиллана',
]

// Эрхээр ялгардаг боломжууд (мөр бүр = боломж, утга = аль эрхэд байгаа)
const FEATURE_MATRIX = [
  { label: 'Олон дэлгүүр', plans: { basic: false, standard: true, full: true } },
  { label: 'Зочин нэмэх', plans: { basic: false, standard: false, full: true } },
  { label: 'Тайлан харах', plans: { basic: false, standard: false, full: true } },
]

function fmt(n: number) {
  return n.toLocaleString() + '₮'
}

export default function PricingPage() {
  const router = useRouter()
  const [selPlan, setSelPlan] = useState<string | null>(null)
  const [selPeriod, setSelPeriod] = useState<string | null>(null)
  const [trialChoice, setTrialChoice] = useState<'yes' | 'no' | null>(null)
  const [trialError, setTrialError] = useState('')
  const [refCode, setRefCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [copied, setCopied] = useState('')
  const [trialUsed, setTrialUsed] = useState(true)
  const [checkingTrial, setCheckingTrial] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { setCheckingTrial(false); return }
      const { data: p } = await supabase.from('profiles').select('trial_used').eq('id', data.user.id).single()
      setTrialUsed(p?.trial_used === true)
      setCheckingTrial(false)
    })
  }, [])

  const plan = PLANS.find(p => p.id === selPlan)
  const period = PERIODS.find(p => p.id === selPeriod)
  const price = plan && period ? plan.prices[period.id as keyof typeof plan.prices] : null

  function selectCell(planId: string, periodId: string) {
    setSelPlan(planId)
    setSelPeriod(periodId)
    setTrialChoice(null)
    setTrialError('')
    setDone(false)
    setRefCode('')
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

    // Хэрэглэгчийн утасны дугаарыг авна
    const { data: prof } = await supabase.from('profiles').select('phone').eq('id', user.id).single()
    const phone = prof?.phone?.replace(/\D/g, '')

    if (phone) {
      // Энэ дугаараар өмнө нь туршилт авсан эсэхийг шалгана
      const { data: existing } = await supabase
        .from('used_trial_phones')
        .select('phone')
        .eq('phone', phone)
        .maybeSingle()

      if (existing) {
        setTrialError('Энэ утасны дугаараар өмнө нь үнэгүй туршилт ашигласан байна. Та эрх худалдан авах хэрэгтэй.')
        setTrialChoice('no')
        return
      }
    }

    const end = new Date(Date.now() + 7 * 86400000)
    await supabase.from('profiles').update({
      subscription_status: 'trial', trial_ends_at: end.toISOString(), trial_used: true,
    }).eq('id', user.id)

    // Утасны дугаарыг "ашигласан" жагсаалтад нэмнэ
    if (phone) {
      await supabase.from('used_trial_phones').insert({ phone, user_id: user.id })
    }

    router.push('/app')
  }

  async function submitPayment() {
    if (!refCode.trim() || !plan || !period || price === null) return
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const now = new Date()
    const end = new Date(now.getTime() + period.days * 86400000)
    await supabase.from('payments').insert({
      user_id: user.id, amount: price, method: 'bank_transfer', status: 'pending',
      reference_code: refCode.trim(),
      period_start: now.toISOString().slice(0, 10),
      period_end: end.toISOString().slice(0, 10),
      plan: plan.id,
    })
    setLoading(false); setDone(true)
  }

  return (
    <>
      <Navbar />
      <FacebookChat />

      <main style={{ paddingTop: 110, paddingBottom: 96, background: '#f8fffe', minHeight: '100vh' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', padding: '0 24px' }}>

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#07e6ae', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
              ҮНЭ ТАРИФ
            </p>
            <h1 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, color: '#0a2e24', letterSpacing: '-1px', margin: '0 0 12px' }}>
              Боломжийн · Хэмнэлттэй
            </h1>
            <p style={{ fontSize: 15, color: '#6b7280', margin: 0 }}>
              Хүснэгт дээрх үнэ дээр дараад, эрхээ сонгоно уу
            </p>
          </div>

          {/* Бүгдэд байна */}
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e8f5f1', padding: '24px 28px', marginBottom: 24 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#07e6ae', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 16px' }}>
              Бүх багцад байна
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
              {FEATURES_ALL.map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#374151' }}>
                  <span style={{ color: '#07e6ae', fontWeight: 700 }}>✓</span>{f}
                </div>
              ))}
            </div>
          </div>

          {/* Үнийн хүснэгт */}
          <div style={{
            borderRadius: 16, border: '1px solid #e8f5f1', overflow: 'hidden',
            background: '#ffffff', boxShadow: '0 2px 24px rgba(7,230,174,0.06)', marginBottom: 24,
          }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
                <thead>
                  <tr>
                    <th style={{ padding: '16px 20px', textAlign: 'left', borderBottom: '1px solid #e8f5f1' }} />
                    {PERIODS.map((p, i) => (
                      <th key={p.id} style={{
                        padding: '16px 20px', textAlign: 'center', fontSize: 14, fontWeight: 700,
                        color: '#0a2e24', borderBottom: '1px solid #e8f5f1',
                        background: i === 2 ? 'rgba(7,230,174,0.06)' : 'transparent',
                      }}>
                        {p.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PLANS.map((p) => (
                    <tr key={p.id}>
                      <td style={{ padding: '18px 20px', fontSize: 15, fontWeight: 700, color: '#0a2e24', borderBottom: '1px solid #f0fdf9', whiteSpace: 'nowrap' }}>
                        {p.label}
                      </td>
                      {PERIODS.map((per, colIdx) => {
                        const isSelected = selPlan === p.id && selPeriod === per.id
                        return (
                          <td
                            key={per.id}
                            onClick={() => selectCell(p.id, per.id)}
                            style={{
                              padding: '14px 20px', textAlign: 'center', fontSize: 15, fontWeight: 700,
                              color: isSelected ? '#0a2e24' : (p.id === 'standard' ? '#07e6ae' : '#374151'),
                              borderBottom: '1px solid #f0fdf9',
                              background: isSelected ? 'rgba(7,230,174,0.9)' : (colIdx === 2 ? 'rgba(7,230,174,0.04)' : 'transparent'),
                              cursor: 'pointer',
                              transition: 'all 0.15s',
                              borderRadius: isSelected ? 8 : 0,
                            }}
                          >
                            {fmt(p.prices[per.id as keyof typeof p.prices])}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Боломжийн харьцуулалт (эрхээр) */}
          <div style={{
            borderRadius: 16, border: '1px solid #e8f5f1', overflow: 'hidden',
            background: '#ffffff', marginBottom: 24,
          }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
                <thead>
                  <tr>
                    <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e8f5f1' }}>
                      Эрхийн ялгаа
                    </th>
                    {PLANS.map(p => (
                      <th key={p.id} style={{ padding: '14px 20px', textAlign: 'center', fontSize: 14, fontWeight: 700, color: '#0a2e24', borderBottom: '1px solid #e8f5f1' }}>
                        {p.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {FEATURE_MATRIX.map(row => (
                    <tr key={row.label}>
                      <td style={{ padding: '14px 20px', fontSize: 14, color: '#374151', borderBottom: '1px solid #f0fdf9' }}>
                        {row.label}
                      </td>
                      {PLANS.map(p => {
                        const inc = row.plans[p.id as keyof typeof row.plans]
                        return (
                          <td key={p.id} style={{ padding: '14px 20px', textAlign: 'center', borderBottom: '1px solid #f0fdf9' }}>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              width: 22, height: 22, borderRadius: '50%', fontSize: 12, fontWeight: 700,
                              background: inc ? 'rgba(7,230,174,0.12)' : 'rgba(248,113,113,0.08)',
                              color: inc ? '#07e6ae' : '#f87171',
                            }}>
                              {inc ? '✓' : '✕'}
                            </span>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Сонголтын панель */}
          {plan && period && price !== null && (
            <div id="selection-panel" style={{
              borderRadius: 16, border: '2px solid #07e6ae', background: '#fff',
              padding: '28px', marginBottom: 24,
              boxShadow: '0 4px 24px rgba(7,230,174,0.12)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 4 }}>Сонгосон багц</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#0a2e24' }}>{plan.label} · {period.label}</div>
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#07e6ae' }}>{fmt(price)}</div>
              </div>

              {/* Энэ эрхийн боломжууд */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
                {FEATURE_MATRIX.filter(f => f.plans[plan.id as keyof typeof f.plans]).map(f => (
                  <span key={f.label} style={{
                    fontSize: 13, padding: '5px 12px', borderRadius: 100,
                    background: 'rgba(7,230,174,0.1)', color: '#07e6ae', fontWeight: 600,
                  }}>
                    ✓ {f.label}
                  </span>
                ))}
              </div>

              {/* Туршилт асуулт */}
              {!checkingTrial && !trialUsed && trialChoice === null && (
                <div style={{ padding: '20px', borderRadius: 12, background: '#f8fffe', border: '1px solid #e8f5f1', marginBottom: 20 }}>
                  <p style={{ fontSize: 15, fontWeight: 600, color: '#0a2e24', margin: '0 0 14px' }}>
                    🎉 7 хоногийн ТӨЛБӨРГҮЙ туршилтаа идэвхжүүлэх үү?
                  </p>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => setTrialChoice('yes')}
                      style={{ flex: 1, padding: '12px', borderRadius: 10, border: 'none', background: '#07e6ae', color: '#0a2e24', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                      Тийм, туршина
                    </button>
                    <button onClick={() => setTrialChoice('no')}
                      style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1.5px solid #e0e0e0', background: 'transparent', color: '#374151', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                      Үгүй, төлбөр төлнө
                    </button>
                  </div>
                </div>
              )}

              {/* Trial алдааны мессеж */}
              {trialError && (
                <div style={{
                  padding: '14px 16px', borderRadius: 10, marginBottom: 16,
                  background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)',
                  fontSize: 13, color: '#b91c1c', lineHeight: 1.5,
                }}>
                  ⚠️ {trialError}
                </div>
              )}

              {/* Туршилт сонгосон */}
              {trialChoice === 'yes' && (
                <button onClick={startTrial}
                  style={{ width: '100%', padding: '14px', borderRadius: 12, border: 'none', background: '#07e6ae', color: '#0a2e24', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                  Туршилтаа эхлүүлэх →
                </button>
              )}

              {/* Төлбөрийн мэдээлэл — trialUsed эсвэл "Үгүй" сонгосон бол */}
              {(trialUsed || trialChoice === 'no') && !done && (
                <div>
                  <div style={{ borderRadius: 12, padding: '16px', border: '1px solid #e8f5f1', background: '#f8fffe', marginBottom: 16 }}>
                    {[
                      ['Дансны банк', BANK.name],
                      ['Дансны дугаар', BANK.account],
                      ['Хүлээн авагч', BANK.owner],
                      ['Гүйлгээний утга', 'Бүртгэлийн утасны дугаараа бичнэ үү'],
                      ['Дүн', fmt(price)],
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

                  <div style={{ textAlign: 'center', marginTop: 12 }}>
                    <a href={FB_URL} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: '#0084FF', textDecoration: 'none' }}>
                      Асуулт байвал Facebook-ээр холбогдоорой →
                    </a>
                  </div>
                </div>
              )}

              {/* Амжилттай */}
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

          {/* Trial banner — анхны байдал */}
          {!plan && (
            <div style={{
              padding: '18px 24px', borderRadius: 12, background: 'rgba(7,230,174,0.06)',
              border: '1px solid rgba(7,230,174,0.2)', textAlign: 'center', fontSize: 14, color: '#374151',
            }}>
              🎉 7 хоногийн <strong style={{ color: '#0a2e24' }}>ТӨЛБӨРГҮЙ туршилт</strong> — дээрх хүснэгцээс эрхээ сонгоод бүртгүүлнэ үү.
            </div>
          )}

        </div>
      </main>
    </>
  )
}
