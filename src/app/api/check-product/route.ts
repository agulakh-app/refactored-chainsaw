import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const name = searchParams.get('name')
  const from = searchParams.get('from') || '2024-09-10'
  if (!name) return NextResponse.json({ error: 'name required' })

  const { data: products } = await supabase.from('products').select('id,name,stock,variants').ilike('name', `%${name}%`)
  if (!products?.length) return NextResponse.json({ error: 'product not found' })
  const p = products[0]

  const { data: rlogs } = await supabase.from('restock_log')
    .select('id,date,type,quantity,note,variant_label')
    .eq('product_id', p.id)
    .gte('date', from)
    .order('date')

  const inTotal = (rlogs||[]).filter((l:any)=>l.type==='in').reduce((a:number,l:any)=>a+l.quantity,0)
  const outOrder = (rlogs||[]).filter((l:any)=>l.type==='out'&&l.note==='Захиалга').reduce((a:number,l:any)=>a+l.quantity,0)
  const outManual = (rlogs||[]).filter((l:any)=>l.type==='out'&&l.note!=='Захиалга').reduce((a:number,l:any)=>a+l.quantity,0)

  return NextResponse.json({
    бараа: {нэр:p.name, db_stock:p.stock},
    хугацаа: `${from}-өөс`,
    дүн: {
      цэнэглэсэн: inTotal,
      зарагдсан_захиалга: outOrder,
      гараар_хасалт: outManual,
      тооцоолсон_үлдэгдэл: inTotal - outOrder - outManual,
    },
    log_бүртгэл: rlogs,
  })
}
