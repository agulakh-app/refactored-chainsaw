import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date')
  if (!date) return NextResponse.json({ error: 'date required' })

  const { data: orders } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('date', date)

  const result = (orders||[]).map((o:any) => ({
    id: o.id,
    date: o.date,
    phone: o.phone,
    status: o.status,
    delivery_fee: o.delivery_fee,
    items: (o.order_items||[]).map((it:any) => ({
      product_name: it.product_name,
      variant_label: it.variant_label,
      quantity: it.quantity,
      unit_price: it.unit_price,
      subtotal: it.quantity * it.unit_price,
    })),
    total: (o.order_items||[]).reduce((a:number,it:any)=>a+it.quantity*it.unit_price,0) - (o.delivery_fee||0),
  }))

  return NextResponse.json({ orders: result, count: result.length })
}
