import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: products } = await supabase.from('products').select('id,stock,variants')
  if (!products) return NextResponse.json({ error: 'no products' })

  let fixed = 0
  for (const p of products) {
    const pvs: any[] = p.variants || []
    if (pvs.length === 0) {
      const { data: rin } = await supabase.from('restock_log').select('quantity').eq('product_id', p.id).eq('type', 'in')
      const { data: oitems } = await supabase.from('order_items').select('quantity, orders!inner(status)').eq('product_id', p.id)
      const restocked = (rin||[]).reduce((a:number,r:any)=>a+r.quantity,0)
      const sold = (oitems||[]).filter((o:any)=>['pending','delivered'].includes((o.orders as any)?.status)).reduce((a:number,o:any)=>a+o.quantity,0)
      const correct = Math.max(0, restocked - sold)
      if (p.stock !== correct) { await supabase.from('products').update({stock:correct}).eq('id',p.id); fixed++ }
    } else {
      const nv = pvs.map((v:any)=>({...v}))
      let changed = false
      for (let i = 0; i < nv.length; i++) {
        const lbl = [nv[i].size, nv[i].color].filter(Boolean).join(' / ')
        const { data: rin } = await supabase.from('restock_log').select('quantity').eq('product_id', p.id).eq('type','in').eq('variant_label',lbl)
        const { data: oitems } = await supabase.from('order_items').select('quantity, orders!inner(status)').eq('product_id', p.id).eq('variant_label',lbl)
        const rst = (rin||[]).reduce((a:number,r:any)=>a+r.quantity,0)
        const sold = (oitems||[]).filter((o:any)=>['pending','delivered'].includes((o.orders as any)?.status)).reduce((a:number,o:any)=>a+o.quantity,0)
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
