'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const ADMIN_PHONE_EMAIL = '88118270@agulakh.app'
const ADMIN_EMAIL = 'hardworkingfmly@gmail.com'

export default function SettingsPage() {
  const [deliveryFee, setDeliveryFee] = useState('')
  const [deliverySaved, setDeliverySaved] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [flash, setFlash] = useState('')
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null)
  const [subStatus, setSubStatus] = useState('')

  const [stores, setStores] = useState<any[]>([])
  const [newStoreName, setNewStoreName] = useState('')

  const [warehouses, setWarehouses] = useState<any[]>([])
  const [newWhName, setNewWhName] = useState('')
  const [newWhAddr, setNewWhAddr] = useState('')

  const [viewers, setViewers] = useState<any[]>([])
  const [newEmail, setNewEmail] = useState('')

  const showFlash = (m: string) => { setFlash(m); setTimeout(()=>setFlash(''),2500) }

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user) return
    setIsAdmin(user.email===ADMIN_PHONE_EMAIL||user.email===ADMIN_EMAIL)
    const [{ data: prof },{ data: sts },{ data: whs },{ data: vws }] = await Promise.all([
      supabase.from('profiles').select('default_delivery_fee,trial_ends_at,subscription_status').single(),
      supabase.from('stores').select('*').eq('user_id',user.id).order('created_at'),
      supabase.from('warehouses').select('*').eq('user_id',user.id).order('created_at'),
      supabase.from('shared_access').select('*').order('created_at',{ascending:false}),
    ])
    if (prof) {
      setDeliveryFee(String(prof.default_delivery_fee||''))
      setTrialEndsAt(prof.trial_ends_at || null)
      setSubStatus(prof.subscription_status || '')
    }
    setStores(sts||[])
    setWarehouses(whs||[])
    setViewers(vws||[])
  }

  async function saveDelivery() {
    const { data:{ user } } = await supabase.auth.getUser()
    await supabase.from('profiles').update({ default_delivery_fee:Number(deliveryFee)||0 }).eq('id',user!.id)
    setDeliverySaved(true); setTimeout(()=>setDeliverySaved(false),2000)
  }

  async function addStore() {
    if (!newStoreName.trim()) { showFlash('Дэлгүүрийн нэр оруулна уу'); return }
    const { data:{ user } } = await supabase.auth.getUser()
    await supabase.from('stores').insert({ user_id:user!.id, name:newStoreName.trim() })
    setNewStoreName('')
    showFlash('Дэлгүүр нэмэгдлээ ✓'); loadAll()
  }

  async function deleteStore(id: string) {
    if (!confirm('Дэлгүүр устгах уу?')) return
    await supabase.from('stores').delete().eq('id',id)
    showFlash('Устгагдлаа'); loadAll()
  }

  async function addWarehouse() {
    if (!newWhName.trim()) { showFlash('Агуулахын нэр оруулна уу'); return }
    const { data:{ user } } = await supabase.auth.getUser()
    await supabase.from('warehouses').insert({ user_id:user!.id, name:newWhName.trim(), address:newWhAddr.trim()||null })
    setNewWhName(''); setNewWhAddr('')
    showFlash('Агуулах нэмэгдлээ ✓'); loadAll()
  }

  async function deleteWarehouse(id: string) {
    if (!confirm('Агуулах устгах уу?')) return
    await supabase.from('warehouses').delete().eq('id',id)
    showFlash('Устгагдлаа'); loadAll()
  }

  async function addViewer() {
    if (!newEmail.trim()) return
    const { data:{ user } } = await supabase.auth.getUser()
    await supabase.from('shared_access').insert({ owner_id:user!.id, viewer_email:newEmail.trim(), role:'viewer' })
    setNewEmail(''); showFlash('✓ Зочин нэмэгдлээ'); loadAll()
  }

  return (
    <div className="space-y-5">
      {flash&&<div className="fixed top-4 right-4 bg-emerald-700 text-white text-sm px-4 py-2 rounded-lg shadow-lg z-50">{flash}</div>}

      {/* Туршилтын мэдээлэл */}
      {subStatus === 'trial' && trialEndsAt && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xl">⏳</span>
              <div>
                <div className="font-semibold text-sm text-amber-800">Үнэгүй туршилт</div>
                <div className="text-xs text-amber-600">
                  {Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86400000))} өдөр үлдсэн
                  · {new Date(trialEndsAt).toLocaleDateString('mn-MN')} дуусна
                </div>
              </div>
            </div>
            <a href="/app/payment" className="px-4 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-xl hover:bg-emerald-700">
              Сунгах →
            </a>
          </div>
        </div>
      )}
      {subStatus === 'expired' && (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xl">⚠️</span>
              <div>
                <div className="font-semibold text-sm text-red-800">Эрх дууссан</div>
                <div className="text-xs text-red-600">Үргэлжлүүлэн ашиглахын тулд төлбөр төлнө үү</div>
              </div>
            </div>
            <a href="/app/payment" className="px-4 py-2 bg-red-600 text-white text-xs font-semibold rounded-xl hover:bg-red-700">
              Сунгах →
            </a>
          </div>
        </div>
      )}

      {/* Admin link */}
      {isAdmin&&(
        <a href="/admin" className="flex items-center justify-between bg-gray-900 text-white rounded-2xl px-5 py-4 hover:bg-gray-800 transition-all">
          <div className="flex items-center gap-3">
            <span className="text-xl">🔐</span>
            <div>
              <div className="font-semibold text-sm">Admin самбар</div>
              <div className="text-xs text-gray-400">Хэрэглэгч, төлбөр, статистик</div>
            </div>
          </div>
          <span className="text-gray-400">→</span>
        </a>
      )}

      {/* 1. Дэлгүүрүүд */}
      <div className="card">
        <h2 className="font-semibold text-gray-800 mb-2 text-base">🏪 Дэлгүүрүүд</h2>
        <p className="text-xs text-gray-500 mb-4">Захиалга шивэхэд аль дэлгүүрээс ирсэнийг тэмдэглэнэ</p>
        {stores.length>0&&(
          <div className="space-y-2 mb-4">
            {stores.map(s=>(
              <div key={s.id} className="flex justify-between items-center bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                <span className="text-sm font-medium text-gray-800">🏪 {s.name}</span>
                <button onClick={()=>deleteStore(s.id)} className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50">Устгах</button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input className="flex-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            placeholder="Дэлгүүрийн нэр..." value={newStoreName} onChange={e=>setNewStoreName(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&addStore()} />
          <button onClick={addStore} disabled={!newStoreName.trim()}
            className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
            + Нэмэх
          </button>
        </div>
      </div>

      {/* 2. Агуулахууд */}
      <div className="card">
        <h2 className="font-semibold text-gray-800 mb-2 text-base">🏭 Агуулахууд</h2>
        <p className="text-xs text-gray-500 mb-4">Бараа хаана хадгалагдаж, хаанаас хүргэгдэхийг тэмдэглэнэ</p>
        {warehouses.length>0&&(
          <div className="space-y-2 mb-4">
            {warehouses.map(w=>(
              <div key={w.id} className="flex justify-between items-center bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                <div>
                  <div className="text-sm font-medium text-gray-800">🏭 {w.name}</div>
                  {w.address&&<div className="text-xs text-gray-400">{w.address}</div>}
                </div>
                <button onClick={()=>deleteWarehouse(w.id)} className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50">Устгах</button>
              </div>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 mb-2">
          <input className="px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            placeholder="Агуулахын нэр..." value={newWhName} onChange={e=>setNewWhName(e.target.value)} />
          <input className="px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            placeholder="Хаяг (заавал биш)..." value={newWhAddr} onChange={e=>setNewWhAddr(e.target.value)} />
        </div>
        <div className="flex justify-end">
          <button onClick={addWarehouse} disabled={!newWhName.trim()}
            className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
            + Нэмэх
          </button>
        </div>
      </div>

      {/* 3. Хүргэлтийн үнэ */}
      <div className="card">
        <h2 className="font-semibold text-gray-800 mb-4 text-base">🚚 Өгөгдмөл хүргэлтийн үнэ (₮)</h2>
        <p className="text-xs text-gray-500 mb-3">Захиалга шивэхэд автоматаар орно</p>
        <div className="flex gap-2">
          <input type="number" className="flex-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            value={deliveryFee} onChange={e=>setDeliveryFee(e.target.value)} placeholder="7000" />
          <button onClick={saveDelivery}
            className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${deliverySaved?'bg-gray-100 text-gray-500':'bg-emerald-600 text-white hover:bg-emerald-700'}`}>
            {deliverySaved?'✓ Хадгалагдлаа':'Хадгалах'}
          </button>
        </div>
      </div>

      {/* 4. Зочин */}
      <div className="card">
        <h2 className="font-semibold text-gray-800 mb-2 text-base">👁 Зочин хандалт</h2>
        <p className="text-xs text-gray-500 mb-4">Зочин хэрэглэгч зөвхөн харах боломжтой</p>
        <div className="flex gap-2 mb-4">
          <input type="email" className="flex-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            placeholder="Зочины имэйл..." value={newEmail} onChange={e=>setNewEmail(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&addViewer()} />
          <button onClick={addViewer} disabled={!newEmail.trim()}
            className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
            + Урих
          </button>
        </div>
        {viewers.length>0?(
          <div className="space-y-2">
            {viewers.map(v=>(
              <div key={v.id} className="flex justify-between items-center bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-100">
                <div className="text-sm text-gray-700">{v.viewer_email}</div>
                <button onClick={async()=>{ await supabase.from('shared_access').delete().eq('id',v.id); loadAll() }}
                  className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50">Устгах</button>
              </div>
            ))}
          </div>
        ):(
          <p className="text-sm text-gray-400 text-center py-4 bg-gray-50 rounded-lg">Зочин нэмэгдээгүй</p>
        )}
      </div>
    </div>
  )
}
