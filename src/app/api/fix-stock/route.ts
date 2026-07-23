import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 60

const FROM_DATE = '2024-09-10'

export async function POST() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: products } = await supabase.from('products').select('id,stock,variants,name')
  if (!products?.length) return NextResponse.json({ ok: true, fixed: 0 })

  const { data: logs } = await supabase.from('restock_log')
    .select('product_id,variant_label,quantity,type,note')
    .gte('date', FROM_DATE)

  const rstMap: any = {}
  for (const l of (logs||[])) {
    const k = l.product_id + '|||' + ((l.variant_label&&l.variant_label.trim())||'')
    if (l.type==='in') rstMap[k] = (rstMap[k]||0) + l.quantity
    else if (l.type==='out') rstMap[k] = (rstMap[k]||0) - l.quantity
  }

  let fixed = 0
  const details: any[] = []

  for (const p of products) {
    const pvs: any[] = p.variants || []
    if (pvs.length === 0) {
      const k = p.id + '|||'
      const correct = rstMap[k] || 0
      if (p.stock !== correct) {
        await supabase.from('products').update({ stock: correct }).eq('id', p.id)
        details.push({ name: p.name, old: p.stock, new: correct })
        fixed++
      }
    } else {
      const nv = pvs.map((v:any) => ({...v}))
      let changed = false
      for (let i = 0; i < nv.length; i++) {
        const lbl = [nv[i].size, nv[i].color].filter(Boolean).join(' / ')
        const k = p.id + '|||' + lbl
        const correct = rstMap[k] || 0
        if (nv[i].stock !== correct) {
          details.push({ name: p.name + ' · ' + lbl, old: nv[i].stock, new: correct })
          nv[i].stock = correct
          changed = true
        }
      }
      if (changed) {
        const total = nv.reduce((a:number,v:any) => a + v.stock, 0)
        await supabase.from('products').update({ variants: nv, stock: total }).eq('id', p.id)
        fixed++
      }
    }
  }
  return NextResponse.json({ ok: true, fixed, from: FROM_DATE, details })
}
