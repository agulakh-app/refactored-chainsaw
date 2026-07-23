import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const name = searchParams.get('name')
  if (!name) return NextResponse.json({ error: 'name required' })

  const { data: products } = await supabase.from('products').select('id,name,stock,variants').ilike('name', `%${name}%`)
  if (!products?.length) return NextResponse.json({ error: 'product not found' })
  const p = products[0]

  const { data: rlogs } = await supabase.from('restock_log').select('id,date,type,quantity,note,variant_label').eq('product_id', p.id).order('date')
  const { data: slogs } = await supabase.from('supply_log').select('id,date,type,quantity,note,variant_label').eq('product_id', p.id).order('date')

  const { data: dOrds } = await supabase.from('orders').select('id,date').eq('status','delivered')
  const dIds = (dOrds||[]).map((o:any)=>o.id)
  const { data: oitems } = dIds.length>0
    ? await supabase.from('order_items').select('quantity,variant_label,order_id').eq('product_id',p.id).in('order_id',dIds)
    : { data: [] }

  const { data: pOrds } = await supabase.from('orders').select('id,date').eq('status','pending')
  const pIds = (pOrds||[]).map((o:any)=>o.id)
  const { data: poitems } = pIds.length>0
    ? await supabase.from('order_items').select('quantity,variant_label,order_id').eq('product_id',p.id).in('order_id',pIds)
    : { data: [] }

  const inLogs=(rlogs||[]).filter((l:any)=>l.type==='in')
  const outLogs=(rlogs||[]).filter((l:any)=>l.type==='out'&&l.note!=='Захиалга')
  const totalIn=inLogs.reduce((a:number,l:any)=>a+l.quantity,0)
  const totalOut=outLogs.reduce((a:number,l:any)=>a+l.quantity,0)
  const totalSold=(oitems||[]).reduce((a:number,it:any)=>a+it.quantity,0)
  const totalPending=(poitems||[]).reduce((a:number,it:any)=>a+it.quantity,0)

  return NextResponse.json({
    бараа: {нэр:p.name, db_stock:p.stock},
    дүн: {
      цэнэглэсэн:totalIn,
      гараар_хасалт:totalOut,
      зарагдсан_delivered:totalSold,
      pending:totalPending,
      тооцоолсон_үлдэгдэл:totalIn-totalOut-totalSold,
    },
    restock_log:rlogs,
    supply_log:slogs,
    delivered_items:oitems,
    pending_items:poitems,
  })
}
