import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

serve(async (req) => {
  const { type, to, data } = await req.json()

  let subject = ''
  let html = ''

  if (type === 'payment_confirmed') {
    subject = '✅ Төлбөр баталгаажлаа — Агуулахын систем'
    html = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:#0F6E56">✅ Төлбөр амжилттай баталгаажлаа</h2>
        <p>Сайн байна уу, <b>${data.name}</b>!</p>
        <p>Таны төлбөр амжилттай баталгаажлаа.</p>
        <div style="background:#f0fdf4;border-radius:12px;padding:16px;margin:16px 0">
          <div>📦 Тариф: <b>${data.plan}</b></div>
          <div>💰 Дүн: <b>${data.amount}</b></div>
          <div>📅 Хүчинтэй хугацаа: <b>${data.period_end}</b> хүртэл</div>
        </div>
        <a href="https://refactored-chainsaw-delta.vercel.app/app"
           style="display:inline-block;background:#0F6E56;color:white;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:600">
          Апп руу орох →
        </a>
        <p style="color:#888;font-size:12px;margin-top:24px">Агуулахын систем</p>
      </div>`
  }

  if (type === 'trial_warning') {
    subject = '⚠️ Туршилтын хугацаа дуусч байна — Агуулахын систем'
    html = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:#854F0B">⚠️ Туршилтын хугацаа ${data.days_left} өдөр үлдлээ</h2>
        <p>Сайн байна уу, <b>${data.name}</b>!</p>
        <p>Таны үнэгүй туршилтын хугацаа <b>${data.days_left} өдрийн дараа</b> дуусна.</p>
        <p>Үйлчилгээг тасралтгүй ашиглахын тулд доорх товч дарж төлбөр төлнө үү.</p>
        <a href="https://refactored-chainsaw-delta.vercel.app/pricing"
           style="display:inline-block;background:#0F6E56;color:white;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:600">
          Төлбөр төлөх →
        </a>
        <p style="color:#888;font-size:12px;margin-top:24px">Агуулахын систем</p>
      </div>`
  }

  if (type === 'low_stock') {
    subject = '🔴 Агуулахын бараа дуссан — Агуулахын систем'
    html = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:#A32D2D">🔴 Дараах бараанууд дуссан эсвэл дусч байна</h2>
        <p>Сайн байна уу, <b>${data.name}</b>!</p>
        <div style="background:#fef2f2;border-radius:12px;padding:16px;margin:16px 0">
          ${data.items.map((i:any) => `<div>• ${i.name}: <b>${i.stock} ш</b></div>`).join('')}
        </div>
        <a href="https://refactored-chainsaw-delta.vercel.app/app/stock"
           style="display:inline-block;background:#0F6E56;color:white;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:600">
          Агуулах харах →
        </a>
        <p style="color:#888;font-size:12px;margin-top:24px">Агуулахын систем</p>
      </div>`
  }

  if (!subject) return new Response('Unknown type', { status: 400 })

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'Агуулахын систем <onboarding@resend.dev>', to, subject, html })
  })

  const result = await res.json()
  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' }
  })
})
