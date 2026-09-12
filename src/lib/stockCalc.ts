// Барааны үлдэгдлийн НЭГ ЛГАН ЖИНХЭНЭ эх сурвалж.
// Аль ч хуудас (Шинэ захиалга, Барааны хөдөлгөөн, гэх мэт) барааны үлдэгдэл тооцох шаардлагатай бол
// ЗААВАЛ энэ файлын функцийг ашиглана — хуудас бүрт тусад нь дахин бичихгүй.
// Ингэснээр 2 хуудасны тоо хэзээ ч зөрөхгүй.
//
// Томьёо: Үлдэгдэл = Цэнэглэсэн(restock_log,type=in) − Зарагдсан(delivered order_items) − Хасалт(restock_log,type=out)

import { supabase } from './supabase'

export type StockMaps = {
  rstMap: Record<string, number>       // Цэнэглэсэн
  manualOutMap: Record<string, number> // Хасалт (гараар)
  soldMap: Record<string, number>      // Зарагдсан (delivered)
  pendingMap: Record<string, number>   // Хүлээгдэж буй (pending)
}

export function stockKey(productId: string, variantLabel?: string | null): string {
  const vl = (variantLabel && variantLabel.trim()) || ''
  return productId + '|||' + vl
}

async function fetchOrderIdsByStatus(targetId: string, activeStoreId: string | null, status: string): Promise<string[]> {
  const ids: string[] = []
  let page = 0
  while (true) {
    const q = activeStoreId
      ? supabase.from('orders').select('id').eq('user_id', targetId).eq('store_id', activeStoreId).eq('status', status).range(page*1000, (page+1)*1000-1)
      : supabase.from('orders').select('id').eq('user_id', targetId).eq('status', status).range(page*1000, (page+1)*1000-1)
    const { data } = await q
    if (!data || data.length === 0) break
    ids.push(...data.map((o: any) => o.id))
    if (data.length < 1000) break
    page++
  }
  return ids
}

async function fetchItemsForOrders(orderIds: string[], productIds: string[], targetMap: Record<string, number>) {
  if (orderIds.length === 0 || productIds.length === 0) return
  for (let i = 0; i < productIds.length; i += 200) {
    const pidBatch = productIds.slice(i, i + 200)
    for (let j = 0; j < orderIds.length; j += 500) {
      const oidBatch = orderIds.slice(j, j + 500)
      const { data } = await supabase.from('order_items').select('product_id,variant_label,quantity')
        .in('product_id', pidBatch).in('order_id', oidBatch).limit(5000)
      for (const it of (data || [])) {
        const k = stockKey(it.product_id, it.variant_label)
        targetMap[k] = (targetMap[k] || 0) + it.quantity
      }
    }
  }
}

// Бүх барааны Цэнэглэсэн/Хасалт/Зарагдсан/Хүлээгдэж-г нэг дор татаж, key (product_id|||variant_label)-аар нэгтгэнэ.
export async function fetchStockMaps(targetId: string, activeStoreId: string | null, productIds: string[]): Promise<StockMaps> {
  const rstMap: Record<string, number> = {}
  const manualOutMap: Record<string, number> = {}
  const soldMap: Record<string, number> = {}
  const pendingMap: Record<string, number> = {}

  // 1. restock_log (in=Цэнэглэсэн, out=Хасалт). 'Захиалга' тэмдэглэлтэй out-г хасна —
  //    тэдгээр нь захиалгаас автоматаар үүссэн бөгөөд Зарагдсан тооцоонд аль хэдийн орсон байдаг.
  const rlogQ = activeStoreId
    ? supabase.from('restock_log').select('product_id,variant_label,quantity,type').eq('user_id', targetId).eq('store_id', activeStoreId).neq('note', 'Захиалга')
    : supabase.from('restock_log').select('product_id,variant_label,quantity,type').eq('user_id', targetId).neq('note', 'Захиалга')
  const { data: rlogs } = await rlogQ
  for (const l of (rlogs || [])) {
    const k = stockKey(l.product_id, l.variant_label)
    if (l.type === 'in') rstMap[k] = (rstMap[k] || 0) + l.quantity
    else if (l.type === 'out') manualOutMap[k] = (manualOutMap[k] || 0) + l.quantity
  }

  // 2. Зарагдсан = delivered захиалгын order_items
  const deliveredIds = await fetchOrderIdsByStatus(targetId, activeStoreId, 'delivered')
  await fetchItemsForOrders(deliveredIds, productIds, soldMap)

  // 3. Хүлээгдэж буй = pending захиалгын order_items
  const pendingIds = await fetchOrderIdsByStatus(targetId, activeStoreId, 'pending')
  await fetchItemsForOrders(pendingIds, productIds, pendingMap)

  return { rstMap, manualOutMap, soldMap, pendingMap }
}

// Тухайн бараа/variant-ийн одоогийн үлдэгдэл — ЦОРЫН ГАНЦ томьёо, хаа сайгүй үүнийг л дуудна.
export function calcExpectedStock(maps: StockMaps, productId: string, variantLabel?: string | null): number {
  const k = stockKey(productId, variantLabel)
  return (maps.rstMap[k] || 0) - (maps.soldMap[k] || 0) - (maps.manualOutMap[k] || 0)
}

export function getPending(maps: StockMaps, productId: string, variantLabel?: string | null): number {
  const k = stockKey(productId, variantLabel)
  return maps.pendingMap[k] || 0
}
