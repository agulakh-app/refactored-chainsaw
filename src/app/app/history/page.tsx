'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { Order } from '@/lib/types'
import { consumeOrderItems, releaseOrderItems, insertOrderOutLogs, deleteOrderOutLogs } from '@/lib/stockMovement'
import * as XLSX from 'xlsx'
import { useGuestRole, useOwnerId, useActiveStore } from '../client-layout'

function fmt(n: number) { return n.toLocaleString() }
function fmtD(d: string) { if(!d) return ''; const [y,m,day]=d.split('-'); return `${y}/${m}/${day}` }
function dayLabel(d: string) {
  const today = new Date().toISOString().slice(0,10)
  const yest = new Date(Date.now()-86400000).toISOString().slice(0,10)
  if (d===today) return `Өнөөдөр — ${fmtD(d)}`
  if (d===yest) return `Өчигдөр — ${fmtD(d)}`
  return fmtD(d)
}

const StatusBadge = ({ s }: { s: string }) => {
  if (s==='delivered') return <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-full text-xs whitespace-nowrap">Хүргэгдсэн</span>
  if (s==='cancelled') return <span className="px-2 py-0.5 bg-gray-100 text-gray-400 border border-gray-200 rounded-full text-xs whitespace-nowrap">Цуцлагдсан</span>
  return <span className="px-2 py-0.5 bg-amber-50 text-amber-600 border border-amber-100 rounded-full text-xs whitespace-nowrap">Хүлээгдэж байна</span>
}

export default function HistoryPage() {
  const guestRole = useGuestRole()
  const ownerId = useOwnerId()
  const activeStoreId = useActiveStore()
  const isViewer = guestRole === 'viewer'

  const [orders, setOrders] = useState<Order[]>([])
  const [stores, setStores] = useState<any[]>([])
  const [phone, setPhone] = useState('')
  const [status, setStatus] = useState('all')
  const [dateFilter, setDateFilter] = useState('')
  const [storeFilter, setStoreFilter] = useState('all')
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState('')
  const [importExpanded, setImportExpanded] = useState(false)
  const [importPreview, setImportPreview] = useState<any[]|null>(null)
  const [importProdList, setImportProdList] = useState<any[]>([])
  const [importGlobalDate, setImportGlobalDate] = useState(new Date().toISOString().slice(0,10))
  const [defaultDelivery, setDefaultDelivery] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)

  // Утасны хайлтын дэлгэрэнгүй
  const [selectedPhone, setSelectedPhone] = useState<string|null>(null)

  const load = useCallback(async () => {
    const { data:{ user } } = await supabase.auth.getUser()
    const targetId = ownerId || user?.id
    if (!targetId) return
    const q = supabase.from('orders').select('*, order_items(*)')
      .eq('user_id', targetId).order('date',{ascending:false}).order('day_seq',{ascending:false})
    const { data } = activeStoreId ? await q.eq('store_id', activeStoreId) : await q
    setOrders(data||[])
    const { data: sts } = await supabase.from('stores').select('*').eq('user_id', targetId)
    setStores(sts||[])
    const { data: prof } = await supabase.from('profiles').select('default_delivery_fee').eq('id', targetId).single()
    if(prof?.default_delivery_fee) setDefaultDelivery(prof.default_delivery_fee)
  },[ownerId, activeStoreId])

  useEffect(()=>{ load() },[load])


  const [confirmModal, setConfirmModal] = useState<{msg:string,onOk:()=>void}|null>(null)
  const [editModal, setEditModal] = useState<Order|null>(null)
  const [editPhone, setEditPhone] = useState('')
  const [editAddr, setEditAddr] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editStatus, setEditStatus] = useState('')
  const [editDelv, setEditDelv] = useState('')

  async function saveEdit() {
    if(!editModal) return
    await supabase.from('orders').update({
      phone: editPhone, address: editAddr, date: editDate,
      status: editStatus, delivery_fee: Number(editDelv)||0
    }).eq('id', editModal.id)
    setEditModal(null)
    load()
  }

  const [openDropdown, setOpenDropdown] = useState<string|null>(null)
  const [dropdownPos, setDropdownPos] = useState<{top:number,left:number}>({top:0,left:0})
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  function toggleSelect(id:string){
    setSelectedIds(prev=>{const s=new Set(prev); s.has(id)?s.delete(id):s.add(id); return s})
  }
  function toggleSelectGroup(grp:Order[]){
    const ids=grp.map(o=>o.id)
    const allSelected=ids.every(id=>selectedIds.has(id))
    setSelectedIds(prev=>{
      const s=new Set(prev)
      allSelected?ids.forEach(id=>s.delete(id)):ids.forEach(id=>s.add(id))
      return s
    })
  }
  async function bulkDeliver(){
    const{data:{user}}=await supabase.auth.getUser()
    const targetId=ownerId||user?.id
    for(const id of Array.from(selectedIds)){
      const o=orders.find(x=>x.id===id)
      if(!o||o.status==='delivered') continue
      // Цуцлагдсаныг хүргэгдсэн болгоход stock дахин хасагдаж, out-лог сэргэнэ
      if(o.status==='cancelled'){
        const items=(o.order_items||[]) as any[]
        await consumeOrderItems(items)
        if(targetId) await insertOrderOutLogs(targetId,(o as any).store_id||null,o.date,items)
      }
      await supabase.from('orders').update({status:'delivered'}).eq('id',id)
    }
    setSelectedIds(new Set()); load()
  }
  async function bulkDelete(){
    const{data:{user}}=await supabase.auth.getUser()
    const targetId=ownerId||user?.id
    for(const id of Array.from(selectedIds)){
      const o=orders.find(x=>x.id===id)
      if(!o){ await supabase.from('orders').delete().eq('id',id); continue }
      // pending/delivered захиалга устгахад stock буцааж, out-логийг цэвэрлэнэ
      if(o.status==='pending'||o.status==='delivered'){
        const items=(o.order_items||[]) as any[]
        await releaseOrderItems(items)
        if(targetId) await deleteOrderOutLogs(targetId,o.date,items)
      }
      await supabase.from('order_items').delete().eq('order_id',o.id)
      await supabase.from('orders').delete().eq('id',o.id)
    }
    setSelectedIds(new Set()); load()
  }

  useEffect(()=>{
    function handleClick(e:MouseEvent){
      if(dropdownRef.current&&!dropdownRef.current.contains(e.target as Node)){
        setOpenDropdown(null)
      }
    }
    document.addEventListener('mousedown',handleClick)
    return()=>document.removeEventListener('mousedown',handleClick)
  },[])

  async function setOrderStatus(id: string, s: string) {
    const o=orders.find(x=>x.id===id)
    if(o&&o.status!==s){
      // Захиалгын хуудастай ижил дүрэм: цуцлахад stock буцаж, сэргээхэд дахин хасагдана
      const wasHeld=o.status!=='cancelled'
      const nowHeld=s!=='cancelled'
      const{data:{user}}=await supabase.auth.getUser()
      const targetId=ownerId||user?.id
      const items=(o.order_items||[]) as any[]
      if(wasHeld&&!nowHeld){
        await releaseOrderItems(items)
        if(targetId) await deleteOrderOutLogs(targetId,o.date,items)
      } else if(!wasHeld&&nowHeld){
        await consumeOrderItems(items)
        if(targetId) await insertOrderOutLogs(targetId,(o as any).store_id||null,o.date,items)
      }
    }
    await supabase.from('orders').update({status:s}).eq('id',id)
    load()
  }

  async function deleteOrder(o: Order) {
    setConfirmModal({
      msg: 'Энэ захиалгыг бүр мөсөн устгах уу? Энэ үйлдлийг буцаах боломжгүй.',
      onOk: async () => {
        if(o.status==='pending'||o.status==='delivered'){
          const{data:{user}}=await supabase.auth.getUser()
          const targetId=ownerId||user?.id
          const items=(o.order_items||[]) as any[]
          await releaseOrderItems(items)
          if(targetId) await deleteOrderOutLogs(targetId,o.date,items)
        }
        await supabase.from('order_items').delete().eq('order_id', o.id)
        await supabase.from('orders').delete().eq('id', o.id)
        load()
      }
    })
  }

  async function deleteAllCancelled(date: string, list: Order[]) {
    const cancelled = list.filter(o=>o.status==='cancelled')
    if (cancelled.length===0) return
    setConfirmModal({
      msg: `${fmtD(date)} өдрийн ${cancelled.length} цуцлагдсан захиалгыг бүр мөсөн устгах уу? Энэ үйлдлийг буцаах боломжгүй.`,
      onOk: async () => {
        for (const o of cancelled) {
          await supabase.from('order_items').delete().eq('order_id', o.id)
          await supabase.from('orders').delete().eq('id', o.id)
        }
        load()
      }
    })
  }

  async function markAllDelivered(date: string, list: Order[]) {
    const toMark = list.filter(o=>o.status!=='delivered'&&o.status!=='cancelled')
    if (toMark.length===0) return
    for (const o of toMark) {
      await supabase.from('orders').update({status:'delivered'}).eq('id', o.id)
    }
    load()
  }


  // Утасны хайлт — тухайн хүний бүх захиалга + хаягийн түүх
  const phoneOrders = selectedPhone
    ? orders.filter(o => o.phone === selectedPhone)
    : []
  const phoneAddresses = selectedPhone
    ? Array.from(new Set(phoneOrders.map(o => o.address).filter(Boolean)))
    : []

  // CSV экспорт — дэлгүүрээр ялгасан
  function exportCSV(storeId?: string) {
    const storeName = storeId ? stores.find(s=>s.id===storeId)?.name || 'store' : 'all'
    const toExport = storeId
      ? filtered.filter(o=>(o as any).store_id===storeId)
      : filtered
    const rows=[['Огноо','Утас','Хаяг','Дэлгүүр','Бараа','Variant','Барааны дүн','Хүргэлт','Цэвэр','Статус']]
    toExport.forEach(o=>{
      const gross=(o.order_items||[]).reduce((a:number,i:any)=>a+i.quantity*i.unit_price,0)
      const net=gross-(o.delivery_fee||0)
      const oStore=stores.find(s=>s.id===(o as any).store_id)?.name||''
      ;(o.order_items||[]).forEach((i:any)=>{
        rows.push([
          o.date, o.phone, o.address, oStore,
          i.product_name, i.variant_label||'',
          String(i.quantity*i.unit_price),
          String(o.delivery_fee||0),
          String(net), o.status
        ])
      })
    })
    const csv=rows.map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\n')
    const a=document.createElement('a')
    a.href=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}))
    a.download=`orders_${storeName}_${new Date().toISOString().slice(0,10)}.csv`
    a.click()
  }

  // Template татах - xlsx формат, огноо текстээр
  function downloadTemplate() {
    const data=[
      ['Утасны дугаар','Хаяг','Бараа'],
      ['89639100','Дундговь аймаг','Экс ЭМ'],
      ['99629160','BZD 7 horoo 40 bair','ЭР багц, Суга ЭМ 4, Хөл багц 2'],
      ['88003313','Modern town 25-1-3','ЭР багц, Суга ЭМ'],
    ]
    const ws=XLSX.utils.aoa_to_sheet(data)
    ws['!cols']=[{wch:14},{wch:32},{wch:40}]
    const wb=XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb,ws,'Захиалга')
    XLSX.writeFile(wb,'olula_template.xlsx')
  }

  // Бараа текст задлах: "ЭР багц, Суга ЭМ 4, Хөл багц 2" → [{name,qty}]
  function parseItems(text: string): {name:string,qty:number}[] {
    if(!text.trim()) return []
    return text.split(',').map(part=>{
      part=part.trim()
      const m=part.match(/^(.*?)\s+(\d+)\s*ш?$/)
      if(m&&m[1].trim()) return {name:m[1].trim(),qty:parseInt(m[2])}
      return {name:part.replace(/\d+\s*ш?\s*$/,'').trim()||part,qty:1}
    }).filter(x=>x.name.length>0)
  }

  // Fuzzy match: том/жижиг үсэг, хоосон зай үл харгалзана
  function matchProduct(name:string, products:any[]): any|null {
    const norm=(s:string)=>s.toLowerCase().replace(/\s+/g,' ').trim()
    const n=norm(name)
    return products.find(p=>norm(p.name)===n)||null
  }

  // CSV → preview (баталгаажуулах дэлгэц)
  async function handleExcelImport(file: File) {
    setImporting(true); setImportMsg('Файл уншиж байна...')
    const { data:{ user } } = await supabase.auth.getUser()
    if(!user){ setImporting(false); return }
    const targetId=ownerId||user.id
    try {
      const buf=await file.arrayBuffer()
      const wb=XLSX.read(new Uint8Array(buf),{type:'array'})
      const sheet=wb.Sheets[wb.SheetNames[0]]
      const rows:any[]=sheet?XLSX.utils.sheet_to_json(sheet,{defval:'',raw:true}):[]
      if(rows.length===0){
        setImportMsg('Файлд өгөгдөл олдсонгүй. Template-ийн форматтай таарч байгааг шалгана уу.')
        setImporting(false); return
      }
      setImportMsg(`${rows.length} мөр уншиж байна...`)
      await processRows(rows, targetId)
    } catch(e:any){ setImportMsg('Файл уншихад алдаа: '+e.message); setImporting(false) }
  }

  async function processRows(rows: any[], targetId: string) {
      const { data: products } = await supabase.from('products').select('*').eq('user_id',targetId)
      const prodList=products||[]

      // Давхар import шалгалт: DB-д байгаа захиалгуудыг татна
      const { data: existingOrders } = await supabase.from('orders').select('phone,date').eq('user_id',targetId)
      const existingSet=new Set((existingOrders||[]).map((o:any)=>`${o.date}__${o.phone}`))

      const preview:any[]=[]
      for(const r of rows){
        const keys=Object.keys(r)
        // Утасны дугаар — number format, Excel shift-г тэсвэрлэх
        const phoneRaw=r['Утасны дугаар']??r['Утас']??r['Phone']??r[keys[0]]??''
        const phone=String(phoneRaw===null||phoneRaw===undefined?'':phoneRaw)
          .trim().replace(/\s/g,'').replace(/\.0$/,'').replace(/[^0-9+]/g,'')
        // 2-р багана: Хаяг
        const address=String(r['Хаяг']??r['Address']??r[keys[1]]??'').trim()
        // 3-р багана: Бараа
        const baraaText=String(r['Бараа']??r['Барааны нэр']??r['Product']??r[keys[2]]??'').trim()
        const rawDate=(r['Огноо (YYYY/MM/DD)']||r['Огноо']||r['Date']||'').toString().trim()
        const hasOwnDate=!!rawDate
        const date=rawDate ? rawDate.replace(/[./]/g,'-').slice(0,10) : importGlobalDate
        const dateValid=/^\d{4}-\d{2}-\d{2}$/.test(date)
        // Хүргэлт багана — тусдаа
        const delvRaw=String(r['Хүргэлт (₮)']||r['Хүргэлт']||r['Delivery']||'').trim()
        const delv=parseInt(delvRaw.replace(/[^\d]/g,''))||0
        // Төлбөр багана — Төлсөн/paid → delivered, тоо → нийт дүн (мэдээлэлд хадгалах)
        const rawTolbor=String(r['Төлбөр']||r['Статус']||'').trim()
        const isTolson=rawTolbor.toLowerCase().includes('төлсөн')||rawTolbor.toLowerCase().includes('paid')||rawTolbor.toLowerCase().includes('delivered')
        const status=isTolson?'delivered':'pending'
        const parsedItems=parseItems(baraaText)

        // Давхар import шалгах
        const isDuplicate=dateValid&&phone&&existingSet.has(`${date}__${phone}`)

        const matchedItems=parsedItems.map(it=>{
          const prod=matchProduct(it.name,prodList)
          // Variant шалгалт: олон variant байвал сонгуулах шаардлагатай
          let variantError:string|null=null
          let selectedVariantIdx:number=-1
          if(prod&&Array.isArray(prod.variants)&&prod.variants.length>1){
            variantError=`"${prod.name}" нь ${prod.variants.length} variant-тай — сонгоно уу`
          } else if(prod&&Array.isArray(prod.variants)&&prod.variants.length===1){
            selectedVariantIdx=0
          }
          return {
            ...it,
            product: prod,
            selectedVariantIdx,
            error: !prod ? `"${it.name}" агуулахад олдсонгүй` : variantError
          }
        })

        const errors:string[]=[]
        if(!dateValid) errors.push(`Огноо буруу формат: "${rawDate}"`)
        if(!phone) errors.push('Утасны дугаар хоосон')
        if(parsedItems.length===0) errors.push('Бараа байхгүй')
        if(isDuplicate) errors.push(`⚠️ Давхар import: ${phone} — ${date} өдрийн захиалга аль хэдийн бүртгэлтэй байна`)
        matchedItems.forEach(it=>{ if(it.error) errors.push(it.error) })

        // Нийт дүн = бараа бүрийн unit_price × qty
        const autoTotal=matchedItems.reduce((sum:number,it:any)=>sum+(it.product?.unit_price||0)*it.qty,0)
        preview.push({date,phone,address,items:matchedItems,delv:delv||defaultDelivery,
          status,errors,rawDate,isDuplicate,hasOwnDate,
          total:autoTotal,paid:isTolson})
      }
      if(preview.length===0){
        setImportMsg('Баталгаажуулах мөр олдсонгүй. Файлын форматыг шалгана уу.')
        setImporting(false); return
      }
      setImportProdList(prodList)
      setImportPreview(preview)
      setImporting(false); setImportMsg('')
  }


  // Баталгаажуулсны дараа бүртгэх
  async function confirmImport() {
    if(!importPreview) return
    const { data:{ user } } = await supabase.auth.getUser()
    if(!user) return
    const targetId=ownerId||user.id
    const { data: products } = await supabase.from('products').select('*').eq('user_id',targetId)
    const prodList=products||[]
    setImporting(true)
    let cnt=0
    for(const row of importPreview){
      if(row.errors.length>0) continue
      const { data: ord } = await supabase.from('orders').insert({
        user_id:targetId,date:row.date,day_seq:1,
        phone:row.phone,address:row.address||'-',
        delivery_fee:row.delv,status:row.status,
        store_id:activeStoreId||null
      }).select().single()
      if(!ord) continue
      const orderItems=row.items.map((it:any)=>{
        const unitPrice=row.paid?0:(it.product?.unit_price||Math.round((row.total||0)/Math.max(1,row.items.length))||0)
        return {
          order_id:ord.id,
          product_name:it.product?.name||it.name,
          product_id:it.product?.id||null,
          variant_label:it.selectedVariantIdx>=0&&it.product?.variants?
            [it.product.variants[it.selectedVariantIdx]?.size,it.product.variants[it.selectedVariantIdx]?.color].filter(Boolean).join(' / '):null,
          quantity:it.qty,
          unit_price:unitPrice
        }
      })
      if(orderItems.length>0) await supabase.from('order_items').insert(orderItems)
      // Stock хасах + 'out' хөдөлгөөний бүртгэл — цуцлагдсан мөрөнд хасалт хийхгүй
      if(row.status!=='cancelled'){
        const logItems:any[]=[]
        for(const it of row.items){
          const prod=it.product?prodList.find((p:any)=>p.id===it.product.id):null
          if(!prod) continue
          let vl:string|null=null
          if(Array.isArray(prod.variants)&&prod.variants.length>0){
            const vIdx=it.selectedVariantIdx>=0?it.selectedVariantIdx:-1
            if(vIdx>=0){
              vl=[prod.variants[vIdx]?.size,prod.variants[vIdx]?.color].filter(Boolean).join(' / ')||null
              const nv=[...prod.variants]
              nv[vIdx]={...nv[vIdx],stock:Math.max(0,(nv[vIdx].stock||0)-it.qty)}
              const nt=nv.reduce((a:number,v:any)=>a+(v.stock||0),0)
              await supabase.from('products').update({variants:nv,stock:nt}).eq('id',prod.id)
              prod.variants=nv; prod.stock=nt
            }
          } else {
            const ns=Math.max(0,(prod.stock||0)-it.qty)
            await supabase.from('products').update({stock:ns}).eq('id',prod.id)
            prod.stock=ns
          }
          logItems.push({product_id:prod.id,product_name:prod.name,variant_label:vl,quantity:it.qty})
        }
        // Хөдөлгөөний бүртгэл — устгах/цуцлах үйлдэлтэй уялдана
        if(logItems.length>0) await insertOrderOutLogs(targetId,activeStoreId||null,row.date,logItems)
      }
      cnt++
    }
    setImportPreview(null)
    setImportMsg(`${cnt} захиалга бүртгэгдлээ`)
    setImporting(false); load()
  }


  const filtered = orders.filter(o=>{
    if(phone&&!o.phone.includes(phone)) return false
    if(status!=='all'&&o.status!==status) return false
    if(dateFilter&&o.date!==dateFilter) return false
    if(storeFilter!=='all'&&(o as any).store_id!==storeFilter) return false
    return true
  })

  const groups: Record<string,Order[]> = {}
  filtered.forEach(o=>{ if(!groups[o.date])groups[o.date]=[]; groups[o.date].push(o) })

  const [pasteText, setPasteText] = useState('')

  async function handlePasteImport(text: string) {
    if(!text.trim()) return
    setImporting(true); setImportMsg('Боловсруулж байна...')
    const { data:{ user } } = await supabase.auth.getUser()
    if(!user){ setImporting(false); return }
    const targetId=ownerId||user.id
    // Tab-аар тусгаарлагдсан мөрүүдийг задлах
    const lines=text.trim().split('\n').filter(l=>l.trim())
    const rows=lines.map(line=>{
      const cells=line.split('\t')
      return {
        'Утасны дугаар': cells[0]?.trim()||'',
        'Хаяг': cells[1]?.trim()||'',
        'Бараа': cells[2]?.trim()||'',
        'Хүргэлт': cells[3]?.trim()||'',
        'Төлбөр': cells[4]?.trim()||'',
      }
    })
    await processRows(rows, targetId)
  }

  return (
    <div className="space-y-4">

      {/* Portal dropdown - самбарын стайлтай ижил */}
      {openDropdown && (()=>{
        const o = orders.find(x=>x.id===openDropdown)
        if(!o) return null
        return (
          <div ref={dropdownRef}
            style={{position:'fixed', top:dropdownPos.top, left:dropdownPos.left, zIndex:9999, minWidth:160, boxShadow:'0 4px 16px rgba(0,0,0,0.08)'}}
            className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {o.status!=='delivered'&&(
              <button onClick={()=>{setOrderStatus(o.id,'delivered');setOpenDropdown(null)}}
                className="w-full text-left px-4 py-2.5 text-xs text-emerald-700 hover:bg-emerald-50">✓ Хүргэгдсэн</button>
            )}
            {o.status==='delivered'&&(
              <button onClick={()=>{setOrderStatus(o.id,'pending');setOpenDropdown(null)}}
                className="w-full text-left px-4 py-2.5 text-xs text-amber-600 hover:bg-amber-50">Хүлээгдэж байна</button>
            )}
            {o.status==='cancelled'&&(
              <button onClick={()=>{setOrderStatus(o.id,'pending');setOpenDropdown(null)}}
                className="w-full text-left px-4 py-2.5 text-xs text-amber-600 hover:bg-amber-50">Буцаах</button>
            )}
            <button onClick={()=>{setEditModal(o);setEditPhone(o.phone);setEditAddr(o.address);setEditDate(o.date||'');setEditStatus(o.status);setEditDelv(String(o.delivery_fee||''));setOpenDropdown(null)}}
              className="w-full text-left px-4 py-2.5 text-xs text-gray-600 hover:bg-gray-50">Засах</button>
            {o.status!=='cancelled'&&(
              <button onClick={()=>{setOrderStatus(o.id,'cancelled');setOpenDropdown(null)}}
                className="w-full text-left px-4 py-2.5 text-xs text-gray-500 hover:bg-gray-50">Цуцлах</button>
            )}
            <button onClick={()=>{setConfirmModal({msg:`${o.phone} захиалгыг устгах уу?`,onOk:()=>deleteOrder(o)});setOpenDropdown(null)}}
              className="w-full text-left px-4 py-2.5 text-xs text-red-500 hover:bg-red-50 border-t border-gray-100">Устгах</button>
          </div>
        )
      })()}

      {/* Bulk action bar - самбарын стайлтай ижил */}
      {selectedIds.size>0&&(
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 bg-white border border-gray-200 rounded-xl overflow-hidden flex items-center" style={{boxShadow:'0 4px 16px rgba(0,0,0,0.08)'}}>
          <span className="text-xs text-gray-500 px-4 py-2.5 border-r border-gray-100">{selectedIds.size} сонгогдсон</span>
          <button onClick={bulkDeliver}
            className="text-xs px-4 py-2.5 text-emerald-700 hover:bg-emerald-50">✓ Бүгдийг хүргэсэн</button>
          <button onClick={()=>setConfirmModal({msg:`${selectedIds.size} захиалгыг устгах уу?`,onOk:bulkDelete})}
            className="text-xs px-4 py-2.5 text-red-500 hover:bg-red-50 border-l border-gray-100">Устгах</button>
          <button onClick={()=>setSelectedIds(new Set())}
            className="text-xs px-3 py-2.5 text-gray-400 hover:bg-gray-50 border-l border-gray-100">✕</button>
        </div>
      )}

      {selectedPhone && (
        <div className="bg-white rounded-xl border border-emerald-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="font-medium text-gray-800 text-sm">{selectedPhone}</span>
              <span className="ml-2 text-xs text-gray-400">{phoneOrders.length} захиалга</span>
            </div>
            <button onClick={()=>setSelectedPhone(null)} className="text-xs text-gray-400 hover:text-gray-600">✕ Хаах</button>
          </div>
          {phoneAddresses.length>0&&(
            <div className="mb-3">
              <div className="text-xs text-gray-400 mb-1">Хаягийн түүх:</div>
              <div className="flex flex-wrap gap-1.5">
                {phoneAddresses.map((addr,i)=>(
                  <span key={i} className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-lg">{addr}</span>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-2">
            {phoneOrders.map(o=>{
              const gross=(o.order_items||[]).reduce((a:number,i:any)=>a+i.quantity*i.unit_price,0)
              const net=gross-(o.delivery_fee||0)
              return (
                <div key={o.id} className="flex justify-between items-start py-2 border-t border-gray-100">
                  <div>
                    <div className="text-xs text-gray-500">{fmtD(o.date)} — {o.address}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {(o.order_items||[]).map((i:any)=>i.product_name+(i.variant_label?' · '+i.variant_label:'')+'×'+i.quantity).join(', ')}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-emerald-700">{fmt(net)}₮</span>
                    <StatusBadge s={o.status}/>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between">
            <span className="text-xs text-gray-400">Нийт дүн</span>
            <span className="text-sm font-medium text-emerald-700">
              {fmt(phoneOrders.reduce((a,o)=>{
                const g=(o.order_items||[]).reduce((s:number,i:any)=>s+i.quantity*i.unit_price,0)
                return a+g-(o.delivery_fee||0)
              },0))}₮
            </span>
          </div>
        </div>
      )}

      {/* Import / Export — collapsible */}
      {!isViewer && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <button onClick={()=>setImportExpanded(v=>!v)}
            className="w-full flex items-center justify-between px-4 py-3">
            <h2 className="font-medium text-gray-800 text-sm">Импорт / Экспорт</h2>
            <span className="text-gray-400 text-xs">{importExpanded?'▲':'▼'}</span>
          </button>
          {importExpanded && (
            <div className="px-4 pb-4">
              <div className="flex flex-wrap gap-2">
                <input type="file" accept=".xlsx,.xls,.csv" ref={fileRef} className="hidden"
                  onChange={e=>{ if(e.target.files?.[0]){ handleExcelImport(e.target.files[0]); e.target.value='' } }} />
                <button onClick={()=>fileRef.current?.click()} disabled={importing}
                  className="px-3 py-2 bg-gray-900 text-white rounded-lg text-xs font-medium hover:bg-gray-700 disabled:opacity-50">
                  {importing?'Оруулж байна...':'↑ Файл импортлох'}
                </button>
                <button onClick={downloadTemplate}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50">
                  ↓ Template татах
                </button>
                <button onClick={()=>exportCSV()}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50">
                  ↓ CSV (бүгд)
                </button>
                {stores.map(s=>(
                  <button key={s.id} onClick={()=>exportCSV(s.id)}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50">
                    ↓ CSV ({s.name})
                  </button>
                ))}
              </div>
              {importMsg&&<p className={`text-xs mt-2 font-medium ${importMsg.startsWith('Алдаа')?'text-red-500':'text-emerald-600'}`}>{importMsg}</p>}
              <div className="mt-3">
                <p className="text-xs text-gray-500 mb-1.5">Эсвэл Excel-ээс copy хийгээд доор paste хийнэ үү:</p>
                <textarea
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono resize-none focus:outline-none focus:border-emerald-400"
                  rows={4}
                  placeholder={"89639100\tДундговь аймаг\tЭкс ЭМ 2\n99629160\tБЗД хороо\tСуга ЭМ, Экс ЭМ"}
                  value={pasteText}
                  onChange={e=>setPasteText(e.target.value)}
                  onPaste={e=>{
                    e.preventDefault()
                    const text=e.clipboardData.getData('text')
                    setPasteText(text)
                    setTimeout(()=>handlePasteImport(text),100)
                  }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                ⚠️ Импорт хийхэд "Тоо ширхэг" нь захиалгын барааны нэртэй (variant бол variant нэртэй) <b>яг таарсан</b> барааны үлдэгдлээс автоматаар хасагдана. Нэр таараагүй бараа агуулахаас хасагдахгүй (захиалга үүснэ, мэдэгдэл харагдана).
              </p>
            </div>
          )}
        </div>
      )}

      {/* Import баталгаажуулах modal */}
      {importPreview && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-2xl my-4">
            <div className="p-5 border-b border-gray-100">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-gray-800">Импортын баталгаажуулалт</h3>
                  <p className="text-xs text-gray-400 mt-0.5">{importPreview.length} захиалга — шалгаад бүртгэнэ үү</p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <input type="date" value={importGlobalDate}
                  onChange={e=>{
                    setImportGlobalDate(e.target.value)
                    setImportPreview((prev:any)=>prev?.map((r:any)=>
                      !r.hasOwnDate ? {...r, date:e.target.value} : r
                    )||null)
                  }}
                  className="px-2 py-1 rounded-lg border border-gray-200 text-xs bg-white"/>
                <div className="text-xs font-medium text-emerald-600">
                  {(()=>{
                    const total = importPreview.reduce((sum:number,r:any)=>{
                      const gross=(r.items||[]).reduce((a:number,it:any)=>a+(Number(it.price)||0)*(Number(it.qty)||1),0)
                      return sum+gross-(Number(r.delivery)||0)
                    },0)
                    return total>0?`Нийт: ${total.toLocaleString()}₮`:''
                  })()}
                </div>
              </div>
            </div>
            <div className="max-h-[60vh] overflow-y-auto divide-y divide-gray-100">
              {importPreview.map((row:any, i:number)=>(
                <div key={i} className={`px-5 py-3 ${row.errors.length>0?'bg-red-50/40':''}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {row.phone?(
                        <span className="font-medium text-sm text-gray-800">{row.phone}</span>
                      ):(
                        <input
                          className="border border-red-200 rounded px-2 py-0.5 text-sm text-gray-700 bg-red-50 w-32"
                          placeholder="Утас..."
                          onChange={e=>{
                            const val=e.target.value.trim()
                            setImportPreview((prev:any)=>{
                              if(!prev) return prev
                              const next=[...prev]
                              next[i]={...next[i],phone:val,
                                errors:next[i].errors.filter((e2:string)=>e2!=='Утасны дугаар хоосон').concat(!val?['Утасны дугаар хоосон']:[])
                              }
                              return next
                            })
                          }}
                        />
                      )}
                      {row.address&&<span className="text-xs text-gray-400">{row.address}</span>}
                      <span className="text-xs text-gray-400">{row.date}</span>
                    </div>
                  </div>
                  <div className="mt-1.5 space-y-1">
                    {row.items.map((it:any, j:number)=>(
                      <div key={j} className="text-xs flex items-center gap-2">
                        {!it.product?(
                          <>
                            <span className="text-red-400">🔴</span>
                            <input
                              className="border border-red-200 rounded px-2 py-0.5 text-xs text-gray-700 bg-red-50 flex-1 min-w-0"
                              value={it.name}
                              placeholder="Барааны нэр засах..."
                              onChange={e=>{
                                const newName=e.target.value
                                setImportPreview((prev:any)=>{
                                  if(!prev) return prev
                                  const next=[...prev]
                                  const newItems=[...next[i].items]
                                  const prod=matchProduct(newName,importProdList)
                                  newItems[j]={...newItems[j],name:newName,product:prod,
                                    error:!prod?`"${newName}" агуулахад олдсонгүй`:null}
                                  next[i]={...next[i],items:newItems,
                                    errors:next[i].errors.filter((e2:string)=>!e2.includes('агуулахад олдсонгүй')&&!e2.includes('Бараа байхгүй'))
                                      .concat(!prod&&newName?[`"${newName}" агуулахад олдсонгүй`]:[])
                                  }
                                  return next
                                })
                              }}
                            />
                            <span className="text-red-400 text-[10px] whitespace-nowrap">× {it.qty}</span>
                          </>
                        ):(
                          <div className="flex items-center gap-1.5">
                            <span className="text-emerald-600">✅</span>
                            <span className="text-gray-600">{it.product.name}</span>
                            <span className="text-gray-400">×</span>
                            <input type="number" min="1"
                              className="w-12 border border-gray-200 rounded px-1.5 py-0.5 text-xs text-center"
                              value={it.qty}
                              onChange={e=>{
                                const qty=Math.max(1,parseInt(e.target.value)||1)
                                setImportPreview((prev:any)=>{
                                  if(!prev) return prev
                                  const next=[...prev]
                                  const newItems=[...next[i].items]
                                  newItems[j]={...newItems[j],qty}
                                  next[i]={...next[i],items:newItems}
                                  return next
                                })
                              }}
                            />
                            <span className="text-gray-400 text-[10px]">ш</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {row.errors.filter((e:string)=>!e.includes('агуулахад олдсонгүй')).map((e:string, j:number)=>(
                    <div key={j} className="mt-1 text-xs text-red-500">{e}</div>
                  ))}
                  {row.errors.length===0&&(
                    <div className="mt-2 flex items-center gap-3 flex-wrap">
                      <label className="text-xs text-gray-400">Нийт дүн:</label>
                      <input type="number"
                        className="w-24 border border-gray-200 rounded px-2 py-0.5 text-xs text-right"
                        value={row.total}
                        onChange={e=>{
                          const v=parseInt(e.target.value)||0
                          setImportPreview((prev:any)=>prev?.map((r:any,ri:number)=>ri===i?{...r,total:v}:r)||null)
                        }}/>
                      <span className="text-xs text-gray-400">₮</span>
                      <label className="text-xs text-gray-400 ml-2">Хүргэлт:</label>
                      <input type="number"
                        className="w-20 border border-gray-200 rounded px-2 py-0.5 text-xs text-right"
                        value={row.delv}
                        onChange={e=>{
                          const v=parseInt(e.target.value)||0
                          setImportPreview((prev:any)=>prev?.map((r:any,ri:number)=>ri===i?{...r,delv:v}:r)||null)
                        }}/>
                      <span className="text-xs text-gray-400">₮</span>
                      <label className="flex items-center gap-1 text-xs text-gray-500 ml-2 cursor-pointer">
                        <input type="checkbox" checked={row.paid}
                          onChange={e=>{
                            const v=e.target.checked
                            setImportPreview((prev:any)=>prev?.map((r:any,ri:number)=>ri===i?{...r,paid:v,status:v?'delivered':'pending'}:r)||null)
                          }}/>
                        Төлсөн
                      </label>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex items-center justify-between gap-3">
              <div className="text-xs text-gray-500">
                ✅ {importPreview.filter((r:any)=>r.errors.length===0).length} бүртгэгдэнэ
                {importPreview.filter((r:any)=>r.errors.length>0).length>0&&(
                  <span className="text-red-500 ml-2">🔴 {importPreview.filter((r:any)=>r.errors.length>0).length} алдаатай</span>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={()=>setImportPreview(null)}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600">Болих</button>
                <button onClick={confirmImport} disabled={importing||importPreview.filter((r:any)=>r.errors.length===0).length===0}
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium disabled:opacity-50">
                  {importing?'Бүртгэж байна...':'✓ Бүртгэх'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
