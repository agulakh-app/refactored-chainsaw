import { supabase } from './supabase'

type MovItem = {
  product_id: string
  product_name: string
  variant_label: string | null
  quantity: number
}

// Захиалга үүсгэх/сэргээхэд stock хасах
export async function consumeOrderItems(items: MovItem[]) {
  for (const it of items) {
    try {
      const { data: prod } = await supabase.from('products').select('stock,variants').eq('id', it.product_id).single()
      if (!prod) continue
      const pvs: any[] = prod.variants || []
      if (it.variant_label && pvs.length > 0) {
        const nv = pvs.map((v: any) => {
          const lbl = [v.size, v.color].filter(Boolean).join(' / ')
          return lbl === it.variant_label ? { ...v, stock: Math.max(0, v.stock - it.quantity) } : v
        })
        const nt = nv.reduce((a: number, v: any) => a + v.stock, 0)
        await supabase.from('products').update({ variants: nv, stock: nt }).eq('id', it.product_id)
      } else {
        await supabase.from('products').update({ stock: Math.max(0, prod.stock - it.quantity) }).eq('id', it.product_id)
      }
    } catch (e) {
      console.error('consumeOrderItems error:', e)
    }
  }
}

// Захиалга цуцлах/устгахад stock буцааx
export async function releaseOrderItems(items: MovItem[]) {
  for (const it of items) {
    try {
      const { data: prod } = await supabase.from('products').select('stock,variants').eq('id', it.product_id).single()
      if (!prod) continue
      const pvs: any[] = prod.variants || []
      if (it.variant_label && pvs.length > 0) {
        const nv = pvs.map((v: any) => {
          const lbl = [v.size, v.color].filter(Boolean).join(' / ')
          return lbl === it.variant_label ? { ...v, stock: v.stock + it.quantity } : v
        })
        const nt = nv.reduce((a: number, v: any) => a + v.stock, 0)
        await supabase.from('products').update({ variants: nv, stock: nt }).eq('id', it.product_id)
      } else {
        await supabase.from('products').update({ stock: prod.stock + it.quantity }).eq('id', it.product_id)
      }
    } catch (e) {
      console.error('releaseOrderItems error:', e)
    }
  }
}

// restock_log-д 'out' бүртгэл нэмэх
export async function insertOrderOutLogs(userId: string, storeId: string | null, date: string, items: MovItem[]) {
  for (const it of items) {
    try {
      await supabase.from('restock_log').insert({
        user_id: userId,
        store_id: storeId,
        product_id: it.product_id,
        product_name: it.product_name + (it.variant_label ? ' · ' + it.variant_label : ''),
        variant_label: it.variant_label,
        quantity: it.quantity,
        type: 'out',
        note: 'Захиалга',
        date,
      })
    } catch (e) {
      console.error('insertOrderOutLogs error:', e)
    }
  }
}

// restock_log-оос 'out' бүртгэл устгах (цуцлах үед)
export async function deleteOrderOutLogs(userId: string, date: string, items: MovItem[]) {
  for (const it of items) {
    try {
      let q = supabase.from('restock_log')
        .delete()
        .eq('user_id', userId)
        .eq('product_id', it.product_id)
        .eq('type', 'out')
        .eq('date', date)
        .eq('note', 'Захиалга')
      if (it.variant_label) {
        q = (q as any).eq('variant_label', it.variant_label)
      }
      await q
    } catch (e) {
      console.error('deleteOrderOutLogs error:', e)
    }
  }
}

// Огноо өөрчлөгдөхөд out-лог огноог шинэчлэх
export async function updateOrderOutLogsDate(userId: string, items: MovItem[], oldDate: string, newDate: string) {
  for (const it of items) {
    try {
      await supabase.from('restock_log')
        .update({ date: newDate })
        .eq('user_id', userId)
        .eq('product_id', it.product_id)
        .eq('type', 'out')
        .eq('date', oldDate)
        .eq('note', 'Захиалга')
    } catch (e) {
      console.error('updateOrderOutLogsDate error:', e)
    }
  }
}
