import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const maxDuration = 60

export async function POST() {
  const { data: products } = await supabase.from('products').select('id,stock,variants')
  if (!products?.length) return NextResponse.json({ ok: true, fixed: 0 })

  // Bulk татах
  const { data: logs } = await supabase.from('restock_log').select('product_id,variant_label,quantity,type').eq('type','in')
  const { data: deliveredOrders } = await supabase.from('orders').select('id').eq('status','delivered')
  const deliveredIds = (deliveredOrders||[]).map((o:any)=>o.id)
  const { data: orderItems } = deliveredIds.length > 0
    ? await supabase.from('order_items').select('product_id,variant_label,quantity').in('order_id', deliveredIds)
    : { data: [] }

  // Maps
  const soldMap: any = {}
  for (const it of (orderItems||[])) {
    const k = it.product_id + '|||' + ((it.variant_label&&it.variant_label.trim())||'__total__')
    soldMap[k] = (soldMap[k]||0) + it.quantity
  }
  const rstMap: any = {}
  for (const l of (logs||[])) {
    const k = l.product_id + '|||' + ((l.variant_label&&l.variant_label.trim())||'__total__')
    rstMap[k] = (rstMap[k]||0) + l.quantity
  }

  let fixed = 0
  for (const p of products) {
    const pvs: any[] = p.variants || []
    if (pvs.length === 0) {
      const k = p.id + '|||__total__'
      const correct = Math.max(0, (rstMap[k]||0) - (soldMap[k]||0))
      if (p.stock !== correct) {
        await supabase.from('products').update({ stock: correct }).eq('id', p.id)
        fixed++
      }
    } else {
      const nv = pvs.map((v:any) => ({...v}))
      let changed = false
      for (let i = 0; i < nv.length; i++) {
        const lbl = [nv[i].size, nv[i].color].filter(Boolean).join(' / ')
        const k = p.id + '|||' + (lbl.trim()||'__total__')
        const correct = Math.max(0, (rstMap[k]||0) - (soldMap[k]||0))
        if (nv[i].stock !== correct) { nv[i].stock = correct; changed = true }
      }
      if (changed) {
        const total = nv.reduce((a:number,v:any) => a + v.stock, 0)
        await supabase.from('products').update({ variants: nv, stock: total }).eq('id', p.id)
        fixed++
      }
    }
  }
  return NextResponse.json({ ok: true, fixed })
}
