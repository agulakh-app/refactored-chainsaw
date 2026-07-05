import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const maxDuration = 60

export async function POST() {
  // 1. Бүх бараа татах
  const { data: products } = await supabase.from('products').select('id,stock,variants')
  if (!products?.length) return NextResponse.json({ ok: true, fixed: 0 })

  // 2. Нэг query-д restock_log бүгдийг татах
  const { data: logs } = await supabase.from('restock_log').select('product_id,variant_label,quantity,type').eq('type','in')

  // 3. Нэг query-д delivered order_items татах
  const { data: deliveredOrders } = await supabase.from('orders').select('id').eq('status','delivered')
  const deliveredIds = (deliveredOrders||[]).map((o:any)=>o.id)
  
  const { data: orderItems } = deliveredIds.length > 0
    ? await supabase.from('order_items').select('product_id,variant_label,quantity,order_id').in('order_id', deliveredIds)
    : { data: [] }

  // 4. soldMap тооцоол
  const soldMap: any = {}
  for (const it of (orderItems||[])) {
    const k = it.product_id + '|' + (it.variant_label||'')
    soldMap[k] = (soldMap[k]||0) + it.quantity
  }

  // 5. restock Map тооцоол
  const rstMap: any = {}
  for (const l of (logs||[])) {
    const k = l.product_id + '|' + (l.variant_label||'')
    rstMap[k] = (rstMap[k]||0) + l.quantity
  }

  // 6. Бараа бүрийн stock засах
  let fixed = 0
  for (const p of products) {
    const pvs: any[] = p.variants || []
    if (pvs.length === 0) {
      const k = p.id + '|'
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
        const k = p.id + '|' + lbl
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
