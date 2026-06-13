import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
export async function GET() {
  try {
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const [{ data: profiles }, { data: payments }, { data: orders }] = await Promise.all([
      admin.from('profiles').select('*').order('created_at', { ascending: false }),
      admin.from('payments').select('*').order('created_at', { ascending: false }),
      admin.from('orders').select('user_id, date, delivery_fee, order_items(quantity, unit_price)'),
    ])
    return NextResponse.json({ profiles: profiles||[], payments: payments||[], orders: orders||[] })
  } catch(e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
export async function POST(req: Request) {
  try {
    const { action, id, data } = await req.json()
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    if (action==='confirm_payment') {
      await admin.from('payments').update({ status:'confirmed', confirmed_at:new Date().toISOString() }).eq('id',id)
      await admin.from('profiles').update({
        subscription_status:'active',
        subscription_ends_at:data.period_end,
        plan: data.plan || 'basic',
      }).eq('id',data.user_id)
    }
    if (action==='reject_payment') await admin.from('payments').update({ status:'failed' }).eq('id',id)
    if (action==='toggle_access') await admin.from('profiles').update({ subscription_status:data.new_status }).eq('id',id)
    if (action==='extend_trial') await admin.from('profiles').update({
      subscription_status:'trial', trial_ends_at:new Date(Date.now()+7*86400000).toISOString()
    }).eq('id',id)
    return NextResponse.json({ ok: true })
  } catch(e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
