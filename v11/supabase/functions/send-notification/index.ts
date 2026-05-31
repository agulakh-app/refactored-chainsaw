import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

serve(async (req) => {
  const { type, to, data } = await req.json()
  let subject = '', html = ''

  if (type === 'new_payment') {
    subject = '💳 Шинэ төлбөр хүлээгдэж байна — ' + data.plan
    html = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:#0F6E56">💳 Шинэ төлбөрийн хүсэлт</h2>
        <div style="background:#f0fdf4;border-radius:12px;padding:16px;margin:16px 0">
          <div>👤 Хэрэглэгч: <b>${data.phone||data.user_email}</b></div>
          <div>💰 Дүн: <b>${data.amount}</b></div>
          <div>📦 Тариф: <b>${data.plan}</b></div>
          <div>🔖 Гүйлгээний №: <b>${data.ref_code}</b></div>
        </div>
        <a href="https://refactored-chainsaw-delta.vercel.app/admin"
           style="display:inline-block;background:#0F6E56;color:white;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:600">
          Admin самбарт баталгаажуулах →
        </a>
      </div>`
  }

  if (type === 'payment_confirmed') {
    subject = '✅ Төлбөр баталгаажлаа — Агуулахын систем'
    html = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:#0F6E56">✅ Таны төлбөр баталгаажлаа</h2>
        <p>Сайн байна уу!</p>
        <div style="background:#f0fdf4;border-radius:12px;padding:16px;margin:16px 0">
          <div>📦 Тариф: <b>${data.plan}</b></div>
          <div>💰 Дүн: <b>${data.amount}</b></div>
          <div>📅 Хүчинтэй: <b>${data.period_end}</b> хүртэл</div>
        </div>
        <a href="https://refactored-chainsaw-delta.vercel.app/app"
           style="display:inline-block;background:#0F6E56;color:white;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:600">
          Апп руу орох →
        </a>
      </div>`
  }

  if (type === 'trial_warning') {
    subject = '⚠️ Туршилтын хугацаа ' + data.days_left + ' өдөр үлдлээ'
    html = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:#854F0B">⚠️ Туршилт дуусч байна</h2>
        <p>Таны үнэгүй туршилт <b>${data.days_left} өдрийн дараа</b> дуусна.</p>
        <a href="https://refactored-chainsaw-delta.vercel.app/pricing"
           style="display:inline-block;background:#0F6E56;color:white;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:600">
          Үргэлжлүүлэх →
        </a>
      </div>`
  }

  if (!subject) return new Response('Unknown type', { status: 400 })

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'Агуулахын систем <onboarding@resend.dev>', to, subject, html })
  })

  return new Response(JSON.stringify(await res.json()), { headers: { 'Content-Type': 'application/json' } })
})
