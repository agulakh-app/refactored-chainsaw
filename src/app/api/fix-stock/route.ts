import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST() {
  const { data: products } = await supabase.from('products').select('id,stock,variants')
  if (!products) return NextResponse.json({ error: 'no products' })

  let fixed = 0
  for (const p of products) {
    const pvs: any[] = p.variants || []
    if (pvs.length === 0) {
      const { data: rin } = await supabase.from('restock_log').select('quantity').eq('product_id', p.id).eq('type', 'in')
      const { data: oitems } = await supabase.from('order_items').select('quantity,order_id').eq('product_id', p.id)
      const { data: pendingOrders } = await supabase.from('orders').select('id').in('status',['pending','delivered'])
      const pendingIds = new Set((pendingOrders||[]).map((o:any)=>o.id))
      const rst = (rin||[]).reduce((a:number,r:any)=>a+r.quantity,0)
      const sold = (oitems||[]).filter((o:any)=>pendingIds.has(o.order_id)).reduce((a:number,o:any)=>a+o.quantity,0)
      const correct = Math.max(0, rst - sold)
      if (p.stock !== correct) { await supabase.from('products').update({stock:correct}).eq('id',p.id); fixed++ }
    } else {
      const nv = pvs.map((v:any)=>({...v}))
      let changed = false
      for (let i = 0; i < nv.length; i++) {
        const lbl = [nv[i].size, nv[i].color].filter(Boolean).join(' / ')
        const { data: rin } = await supabase.from('restock_log').select('quantity').eq('product_id',p.id).eq('type','in').eq('variant_label',lbl)
        const { data: oitems } = await supabase.from('order_items').select('quantity,order_id').eq('product_id',p.id).eq('variant_label',lbl)
        const { data: pendingOrders } = await supabase.from('orders').select('id').in('status',['pending','delivered'])
        const pendingIds = new Set((pendingOrders||[]).map((o:any)=>o.id))
        const rst = (rin||[]).reduce((a:number,r:any)=>a+r.quantity,0)
        const sold = (oitems||[]).filter((o:any)=>pendingIds.has(o.order_id)).reduce((a:number,o:any)=>a+o.quantity,0)
        const correct = Math.max(0, rst - sold)
        if (nv[i].stock !== correct) { nv[i].stock = correct; changed = true }
      }
      if (changed) {
        const total = nv.reduce((a:number,v:any)=>a+v.stock,0)
        await supabase.from('products').update({variants:nv,stock:total}).eq('id',p.id)
        fixed++
      }
    }
  }
  return NextResponse.json({ ok: true, fixed })
}
