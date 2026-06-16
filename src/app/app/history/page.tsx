'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { Order } from '@/lib/types'
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
  const [importPreview, setImportPreview] = useState<any[]|null>(null) // баталгаажуулах дэлгэц
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
    const ids=Array.from(selectedIds)
    await Promise.all(ids.map(id=>supabase.from('orders').update({status:'delivered'}).eq('id',id)))
    setSelectedIds(new Set()); load()
  }
  async function bulkDelete(){
    const ids=Array.from(selectedIds)
    await Promise.all(ids.map(id=>supabase.from('orders').delete().eq('id',id)))
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
    await supabase.from('orders').update({status:s}).eq('id',id)
    load()
  }

  async function deleteOrder(o: Order) {
    setConfirmModal({
      msg: 'Энэ захиалгыг бүр мөсөн устгах уу? Энэ үйлдлийг буцаах боломжгүй.',
      onOk: async () => {
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

  // Template татах - шинэ формат
  function downloadTemplate() {
    const rows=[
      ['Огноо (YYYY/MM/DD)','Утасны дугаар','Хаяг','Бараа','Барааны үнэ (₮)','Хүргэлт (₮)','Статус'],
      ['2026/06/16','89639100','Дундговь аймаг','Экс ЭМ','59000','7000','Төлсөн'],
      ['2026/06/16','99629160','BZD 7 horoo 40 bair','ЭР багц, Суга ЭМ 4, Хөл багц 2','59000','7000','Төлсөн'],
      ['2026/06/17','88003313','Modern town 25-1-3','ЭР багц, Суга ЭМ','','',''],
    ]
    const csv=rows.map(r=>r.map(v=>`"${v}"`).join(',')).join('\n')
    const a=document.createElement('a')
    a.href=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}))
    a.download='olula_template.csv'; a.click()
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
    const loadXLSX=():Promise<any>=>new Promise(resolve=>{
      if((window as any).XLSX){ resolve((window as any).XLSX); return }
      const s=document.createElement('script')
      s.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
      s.onload=()=>resolve((window as any).XLSX)
      document.head.appendChild(s)
    })
    try {
      const buf=await file.arrayBuffer()
      const XLSX=await loadXLSX()
      const wb=XLSX.read(new Uint8Array(buf),{type:'array',cellDates:true,raw:false})
      const sheet=wb.Sheets[wb.SheetNames[0]]
      const rows:any[]=sheet?XLSX.utils.sheet_to_json(sheet,{defval:'',raw:false}):[]
      const { data: products } = await supabase.from('products').select('*').eq('user_id',targetId)
      const prodList=products||[]

      // Давхар import шалгалт: DB-д байгаа захиалгуудыг татна
      const { data: existingOrders } = await supabase.from('orders').select('phone,date').eq('user_id',targetId)
      const existingSet=new Set((existingOrders||[]).map((o:any)=>`${o.date}__${o.phone}`))

      const preview:any[]=[]
      for(const r of rows){
        const rawDate=(r['Огноо (YYYY/MM/DD)']||r['Огноо']||r[Object.keys(r)[0]]||'').toString().trim()
        const date=rawDate.replace(/[./]/g,'-').slice(0,10)
        const dateValid=/^\d{4}-\d{2}-\d{2}$/.test(date)
        const phone=(r['Утасны дугаар']||r['Утас']||'').toString().trim()
        const address=(r['Хаяг']||'').toString().trim()
        const baraaText=(r['Бараа']||r['Барааны нэр']||'').toString().trim()
        const parsedItems=parseItems(baraaText)
        const price=parseInt(String(r['Барааны үнэ (₮)']||r['Үнэ']||'0').replace(/[^\d]/g,''))||0
        const delv=parseInt(String(r['Хүргэлт (₮)']||'0').replace(/[^\d]/g,''))||0
        const rawStatus=(r['Статус']||'').toString().trim()
        const status=rawStatus.includes('Төлсөн')||rawStatus.toLowerCase().includes('delivered')?'delivered':'pending'

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

        preview.push({date,phone,address,items:matchedItems,price,delv,status,errors,rawDate,isDuplicate})
      }
      setImportPreview(preview)
      setImporting(false); setImportMsg('')
    } catch(e:any){ setImportMsg('Файл уншихад алдаа: '+e.message); setImporting(false) }
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
      const totalQty=row.items.reduce((a:number,x:any)=>a+x.qty,0)||1
      const unitPrice=Math.round(row.price/totalQty)
      const orderItems=row.items.map((it:any)=>({
        order_id:ord.id,product_name:it.product?.name||it.name,
        variant_label:null,quantity:it.qty,unit_price:unitPrice
      }))
      if(orderItems.length>0) await supabase.from('order_items').insert(orderItems)
      for(const it of row.items){
        const prod=it.product?prodList.find((p:any)=>p.id===it.product.id):null
        if(!prod) continue
        if(Array.isArray(prod.variants)&&prod.variants.length>0){
          const vIdx=it.selectedVariantIdx>=0?it.selectedVariantIdx:-1
          if(vIdx>=0){
            const nv=[...prod.variants]
            nv[vIdx]={...nv[vIdx],stock:Math.max(0,(nv[vIdx].stock||0)-it.qty)}
            const nt=nv.reduce((a:number,v:any)=>a+(v.stock||0),0)
            await supabase.from('products').update({variants:nv,stock:nt}).eq('id',prod.id)
            prod.variants=nv; prod.stock=nt
          }
          // vIdx<0 бол хасахгүй — variant сонгоогүй
        } else {
          const ns=Math.max(0,(prod.stock||0)-it.qty)
          await supabase.from('products').update({stock:ns}).eq('id',prod.id)
          prod.stock=ns
        }
        await supabase.from('restock_log').insert({
          user_id:targetId,product_id:prod.id,product_name:prod.name,
          quantity:it.qty,type:'out',note:`Импорт — ${row.phone}`,
          date:row.date,store_id:activeStoreId||null
        })
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
              <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                ⚠️ Импорт хийхэд "Тоо ширхэг" нь захиалгын барааны нэртэй (variant бол variant нэртэй) <b>яг таарсан</b> барааны үлдэгдлээс автоматаар хасагдана. Нэр таараагүй бараа агуулахаас хасагдахгүй (захиалга үүснэ, мэдэгдэл харагдана).
              </p>
            </div>
          )}
        </div>
      )}

      {/* Захиалгын түүх */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="font-medium text-gray-800 text-sm">Захиалгын түүх</h2>
        </div>

        {/* Filters */}
        <div className="flex gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50 flex-wrap">
          <input
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
            style={{minWidth:120,maxWidth:160}}
            placeholder="Утас хайх..."
            value={phone}
            onChange={e=>{ setPhone(e.target.value); if(e.target.value) setSelectedPhone(e.target.value) }}
          />
          <div className="relative">
            <input type="date"
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
              value={dateFilter} onChange={e=>setDateFilter(e.target.value)}/>
            {!dateFilter && (
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none bg-white pr-1">
                Огноо сонгох
              </span>
            )}
          </div>
          {dateFilter&&<button onClick={()=>setDateFilter('')}
            className="px-2 py-2 rounded-lg border border-gray-200 text-xs text-gray-400 bg-white">✕</button>}
          <select className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
            value={status} onChange={e=>setStatus(e.target.value)}>
            <option value="all">Бүх статус</option>
            <option value="pending">Хүлээгдэж байна</option>
            <option value="delivered">Хүргэгдсэн</option>
            <option value="cancelled">Цуцлагдсан</option>
          </select>
          {!activeStoreId&&stores.length>1&&(
            <select className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
              value={storeFilter} onChange={e=>setStoreFilter(e.target.value)}>
              <option value="all">Бүх дэлгүүр</option>
              {stores.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
        </div>

        {/* Grouped orders - card style */}
        {Object.keys(groups).sort((a,b)=>b.localeCompare(a)).map(date=>{
          const grp=groups[date]
          const totNet=grp.reduce((a,o)=>{
            const g=(o.order_items||[]).reduce((s:number,i:any)=>s+i.quantity*i.unit_price,0)
            return a+g-(o.delivery_fee||0)
          },0)
          return (
            <div key={date}>
              {/* Огноогийн мөр */}
              <div className="px-4 py-2 flex items-center gap-2 flex-wrap" style={{background:'#e6fbf6',borderTop:'1px solid #c2f5e8',borderBottom:'1px solid #c2f5e8'}}>
                {!isViewer&&(
                  <input type="checkbox"
                    checked={grp.every(o=>selectedIds.has(o.id))}
                    onChange={()=>toggleSelectGroup(grp)}
                    className="w-3.5 h-3.5 accent-emerald-500 flex-shrink-0"/>
                )}
                <span className="text-xs font-semibold" style={{color:'#048a6a'}}>{dayLabel(date)}</span>
                <span className="text-xs text-gray-400">{grp.length} захиалга</span>
                <span className="text-xs font-medium text-emerald-700 ml-1">{fmt(totNet)}₮</span>
                {!isViewer && grp.some(o=>o.status!=='delivered'&&o.status!=='cancelled') && (
                  <button onClick={()=>markAllDelivered(date, grp)}
                    className="text-xs px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-700 font-medium ml-auto whitespace-nowrap">
                    Бүгдийг хүргэсэн болгох
                  </button>
                )}
              </div>

              {/* Захиалгын card мөрүүд */}
              {grp.map(o=>{
                const gross=(o.order_items||[]).reduce((a:number,i:any)=>a+i.quantity*i.unit_price,0)
                const net=gross-(o.delivery_fee||0)
                const isDelivered=o.status==='delivered'
                const isCancelled=o.status==='cancelled'
                return (
                  <div key={o.id} className={`px-4 py-3 border-b border-gray-100 ${selectedIds.has(o.id)?'bg-emerald-50/50':'hover:bg-gray-50/60'}`}>
                    {/* Мөр 1: checkbox + утас + dropdown */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {!isViewer&&(
                          <input type="checkbox" checked={selectedIds.has(o.id)} onChange={()=>toggleSelect(o.id)}
                            className="w-3.5 h-3.5 accent-emerald-500 flex-shrink-0"/>
                        )}
                        <button onClick={()=>setSelectedPhone(selectedPhone===o.phone?null:o.phone)}
                          className="font-semibold text-sm text-gray-800 hover:text-emerald-600">
                          {o.phone}
                        </button>
                        {o.address&&<span className="text-xs text-gray-400 truncate hidden sm:block">{o.address}</span>}
                      </div>
                      {!isViewer?(
                        <button
                          onClick={(e)=>{
                            const rect=(e.currentTarget as HTMLElement).getBoundingClientRect()
                            setDropdownPos({top:rect.bottom+4, left:Math.min(rect.left, window.innerWidth-170)})
                            setOpenDropdown(openDropdown===o.id?null:o.id)
                          }}
                          className={`text-xs px-2.5 py-1 rounded-lg border flex items-center gap-1 whitespace-nowrap flex-shrink-0 ${
                            isDelivered?'bg-emerald-50 text-emerald-600 border-emerald-200':
                            isCancelled?'bg-gray-100 text-gray-400 border-gray-200':
                            'bg-amber-50 text-amber-600 border-amber-200'
                          }`}>
                          {isDelivered?'Хүргэгдсэн':isCancelled?'Цуцлагдсан':'Хүлээгдэж байна'} ▾
                        </button>
                      ):(
                        <span className={`text-xs px-3 py-1 rounded-full border whitespace-nowrap ${
                          isDelivered?'bg-emerald-50 text-emerald-600 border-emerald-100':
                          isCancelled?'bg-gray-100 text-gray-400 border-gray-200':
                          'bg-amber-50 text-amber-600 border-amber-100'
                        }`}>
                          {isDelivered?'Хүргэгдсэн':isCancelled?'Цуцлагдсан':'Хүлээгдэж байна'}
                        </span>
                      )}
                    </div>
                    {/* Мөр 2: хаяг (mobile) */}
                    {o.address&&<div className="text-xs text-gray-400 mt-1 sm:hidden pl-5">{o.address}</div>}
                    {/* Мөр 3: бараа + дүн */}
                    <div className="flex items-center justify-between mt-1.5 pl-5">
                      <span className="text-xs text-gray-500 truncate flex-1 pr-4">
                        {(o.order_items||[]).map((i:any)=>i.product_name+(i.variant_label?' · '+i.variant_label:'')+'×'+i.quantity).join(', ')}
                      </span>
                      <div className="flex items-center gap-3 flex-shrink-0 text-xs">
                        {o.delivery_fee>0&&<span className="text-gray-400">-{fmt(o.delivery_fee)}₮</span>}
                        <span className={`font-semibold ${net<0?'text-red-500':'text-emerald-700'}`}>{fmt(net)}₮</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}
        {filtered.length===0&&<p className="text-center text-gray-400 text-sm py-10">Захиалга олдсонгүй</p>}
      </div>

      {/* Edit modal */}
      {editModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-3">
            <h3 className="font-medium text-gray-800 mb-2">Захиалга засварлах</h3>
            <div><label className="block text-xs text-gray-500 mb-1">Огноо</label>
              <div className="overflow-hidden rounded-lg border border-gray-200 bg-white h-[38px] flex items-center">
                <input type="date" className="w-full px-3 text-sm bg-white appearance-none" style={{WebkitAppearance:'none'}} value={editDate} onChange={e=>setEditDate(e.target.value)}/>
              </div></div>
            <div><label className="block text-xs text-gray-500 mb-1">Утас</label>
              <input className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" value={editPhone} onChange={e=>setEditPhone(e.target.value)}/></div>
            <div><label className="block text-xs text-gray-500 mb-1">Хаяг</label>
              <input className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" value={editAddr} onChange={e=>setEditAddr(e.target.value)}/></div>
            <div><label className="block text-xs text-gray-500 mb-1">Хүргэлт (₮)</label>
              <input type="number" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" value={editDelv} onChange={e=>setEditDelv(e.target.value)}/></div>
            <div><label className="block text-xs text-gray-500 mb-1">Статус</label>
              <select className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white" value={editStatus} onChange={e=>setEditStatus(e.target.value)}>
                <option value="pending">Хүлээгдэж байна</option>
                <option value="delivered">Хүргэгдсэн</option>
                <option value="cancelled">Цуцлагдсан</option>
              </select></div>
            <div className="flex gap-2 pt-2">
              <button onClick={()=>setEditModal(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600">Болих</button>
              <button onClick={saveEdit} className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium">Хадгалах</button>
            </div>
          </div>
        </div>
      )}

      {/* Import баталгаажуулах modal */}
      {importPreview && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-2xl my-4">
            <div className="p-5 border-b border-gray-100">
              <h3 className="font-semibold text-gray-800">Импортын баталгаажуулалт</h3>
              <p className="text-xs text-gray-400 mt-0.5">{importPreview.length} захиалга — шалгаад баталгаажуулна уу</p>
            </div>
            <div className="divide-y divide-gray-100 max-h-[60vh] overflow-y-auto">
              {Object.entries(
                importPreview.reduce((acc:any,row:any)=>{
                  if(!acc[row.date]) acc[row.date]=[]
                  acc[row.date].push(row); return acc
                },{})
              ).sort(([a],[b])=>a.localeCompare(b)).map(([date,rows]:any)=>(
                <div key={date}>
                  <div className="px-5 py-2 bg-emerald-50/60 text-xs font-semibold text-emerald-700">{date}</div>
                  {rows.map((row:any,i:number)=>(
                    <div key={i} className={`px-5 py-3 ${row.errors.length>0?'bg-red-50/40':''}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="font-medium text-sm text-gray-800">{row.phone}</span>
                          {row.address&&<span className="text-xs text-gray-400 ml-2">{row.address}</span>}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 text-xs">
                          {row.price>0&&<span className="text-gray-600">{row.price.toLocaleString()}₮</span>}
                          {row.delv>0&&<span className="text-gray-400">+{row.delv.toLocaleString()}₮</span>}
                          <span className={`px-2 py-0.5 rounded-full border text-xs ${row.status==='delivered'?'bg-emerald-50 text-emerald-700 border-emerald-200':'bg-amber-50 text-amber-700 border-amber-200'}`}>
                            {row.status==='delivered'?'Хүргэгдсэн':'Хүлээгдэж байна'}
                          </span>
                        </div>
                      </div>
                      {/* Барааны жагсаалт */}
                      <div className="mt-1.5 space-y-1.5">
                        {row.items.map((it:any,j:number)=>(
                          <div key={j} className="text-xs">
                            {!it.product?(
                              <span className="text-red-500">🔴 {it.name} × {it.qty} — агуулахад олдсонгүй</span>
                            ):it.product.variants&&it.product.variants.length>1?(
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-amber-600">⚠️ {it.product.name} × {it.qty}</span>
                                <select
                                  className="text-xs px-2 py-0.5 rounded border border-amber-300 bg-amber-50 text-amber-700"
                                  value={it.selectedVariantIdx}
                                  onChange={e=>{
                                    const idx=parseInt(e.target.value)
                                    setImportPreview(prev=>{
                                      if(!prev) return prev
                                      const next=[...prev]
                                      const newItems=[...next[importPreview!.indexOf(row)].items]
                                      newItems[j]={...newItems[j],selectedVariantIdx:idx,error:idx>=0?null:it.error}
                                      next[importPreview!.indexOf(row)]={...next[importPreview!.indexOf(row)],items:newItems}
                                      // errors шинэчлэх
                                      const errs=next[importPreview!.indexOf(row)].errors.filter((e:string)=>!e.includes(`"${it.product.name}"`))
                                      if(idx<0) errs.push(`"${it.product.name}" variant сонгоогүй`)
                                      next[importPreview!.indexOf(row)].errors=errs
                                      return next
                                    })
                                  }}>
                                  <option value={-1}>— Variant сонгох —</option>
                                  {it.product.variants.map((v:any,vi:number)=>(
                                    <option key={vi} value={vi}>{[v.size,v.color].filter(Boolean).join(' / ')} ({v.stock||0}ш)</option>
                                  ))}
                                </select>
                              </div>
                            ):(
                              <span className="text-gray-500">
                                ✅ {it.product.name}{it.product.variants?.length===1?` · ${[it.product.variants[0].size,it.product.variants[0].color].filter(Boolean).join('/')}`:''} × {it.qty}
                                <span className="text-gray-400 ml-1">(үлдэгдэл: {it.product.variants?.length===1?(it.product.variants[0].stock||0):it.product.stock||0}ш)</span>
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                      {/* Алдааны мэдэгдэл */}
                      {row.errors.filter((e:string)=>!e.includes('агуулахад олдсонгүй')&&!e.includes('variant')).map((e:string,j:number)=>(
                        <div key={j} className={`mt-1 text-xs font-medium ${e.includes('Давхар')?'text-amber-600':'text-red-500'}`}>🔴 {e}</div>
                      ))}
                      {row.errors.length>0&&(
                        <div className="mt-1.5 text-xs font-medium text-red-500 bg-red-50 px-2 py-1 rounded-lg">
                          ⛔ Энэ захиалга бүртгэгдэхгүй — дээрх алдааг засна уу
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
            {/* Summary */}
            <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-gray-500">
                  ✅ {importPreview.filter(r=>r.errors.length===0).length} бүртгэгдэнэ
                  {importPreview.filter(r=>r.errors.length>0).length>0&&(
                    <span className="text-red-500 ml-2">🔴 {importPreview.filter(r=>r.errors.length>0).length} алдаатай (бүртгэгдэхгүй)</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={()=>setImportPreview(null)}
                    className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600">Цуцлах</button>
                  <button onClick={confirmImport} disabled={importing||importPreview.filter(r=>r.errors.length===0).length===0}
                    className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium disabled:opacity-50">
                    {importing?'Бүртгэж байна...':'✓ Бүртгэх'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm modal */}
      {confirmModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm text-center">
            <p className="text-sm text-gray-800 mb-5 leading-relaxed">{confirmModal.msg}</p>
            <div className="flex gap-2">
              <button onClick={()=>setConfirmModal(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600">Болих</button>
              <button onClick={async()=>{ await confirmModal.onOk(); setConfirmModal(null) }}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600">Устгах</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
