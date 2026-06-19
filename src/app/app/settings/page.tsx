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
  const [newRole, setNewRole] = useState('viewer')
  const [newUsername, setNewUsername] = useState('')
  const [newPin, setNewPin] = useState('')
  const [newStoreId, setNewStoreId] = useState('')

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
    const { error } = await supabase.from('stores').delete().eq('id',id)
    if (error) { showFlash('Алдаа: ' + error.message); return }
    showFlash('Устгагдлаа'); loadAll()
  }

  async function toggleStoreVariant(id: string, current: boolean) {
    await supabase.from('stores').update({ variant_enabled: !current }).eq('id', id)
    loadAll()
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
    const { error } = await supabase.from('warehouses').delete().eq('id',id)
    if (error) { showFlash('Алдаа: ' + error.message); return }
    showFlash('Устгагдлаа'); loadAll()
  }

  async function addViewer() {
    if (!newEmail.trim()) { showFlash('Имэйл оруулна уу'); return }
    if (!newUsername.trim()) { showFlash('Нэвтрэх нэр оруулна уу'); return }
    if (!newPin.trim()) { showFlash('PIN код оруулна уу'); return }
    if (newPin.length < 4) { showFlash('PIN хамгийн багадаа 4 оронтой байх ёстой'); return }
    const { data: existing } = await supabase.from('shared_access')
      .select('id').eq('username', newUsername.trim()).single()
    if (existing) { showFlash('Энэ нэвтрэх нэр аль хэдийн ашиглагдаж байна'); return }
    const { data:{ user } } = await supabase.auth.getUser()
    await supabase.from('shared_access').insert({
      owner_id:user!.id, viewer_email:newEmail.trim(),
      role:newRole, username:newUsername.trim(), pin:newPin.trim(),
      store_id: newStoreId || null
    })
    setNewEmail(''); setNewUsername(''); setNewPin(''); setNewStoreId('')
    showFlash('✓ Зочин нэмэгдлээ'); loadAll()
  }

  async function updateViewerStore(id: string, storeId: string) {
    await supabase.from('shared_access').update({ store_id: storeId || null }).eq('id', id)
    showFlash('✓ Дэлгүүр шинэчлэгдлээ')
    loadAll()
  }

  async function updateViewerRole(id: string, role: string) {
    await supabase.from('shared_access').update({ role }).eq('id', id)
    showFlash('✓ Эрх шинэчлэгдлээ')
    loadAll()
  }

  return (
    <div className="space-y-4">
      {flash&&<div className="fixed top-4 right-4 bg-gray-900 text-white text-sm px-4 py-2 rounded-lg z-50">{flash}</div>}

      {/* Туршилт / дууссан мэдэгдэл */}
      {subStatus === 'trial' && trialEndsAt && (
        <div className="bg-white rounded-xl border border-amber-100 px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-medium text-amber-700">Үнэгүй туршилт</div>
            <div className="text-xs text-gray-400 mt-0.5">
              {Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86400000))} өдөр үлдсэн
              · {new Date(trialEndsAt).toLocaleDateString('mn-MN')} дуусна
            </div>
          </div>
          <a href="/pricing" className="px-3 py-1.5 bg-emerald-600 text-white text-xs rounded-lg hover:bg-emerald-700 flex-shrink-0">Сунгах</a>
        </div>
      )}
      {subStatus === 'expired' && (
        <div className="bg-white rounded-xl border border-red-100 px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-medium text-red-600">Эрх дууссан</div>
            <div className="text-xs text-gray-400 mt-0.5">Үргэлжлүүлэн ашиглахын тулд төлбөр төлнө үү</div>
          </div>
          <a href="/pricing" className="px-3 py-1.5 bg-red-500 text-white text-xs rounded-lg hover:bg-red-600 flex-shrink-0">Сунгах</a>
        </div>
      )}

      {/* Дэлгүүрүүд */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <h2 className="font-medium text-gray-800 mb-1 text-sm">Дэлгүүрүүд</h2>
        <p className="text-xs text-gray-400 mb-4">Захиалга шивэхэд аль дэлгүүрээс ирсэнийг тэмдэглэнэ</p>
        {stores.length>0&&(
          <div className="space-y-2 mb-4">
            {stores.map(s=>(
              <div key={s.id} className="flex justify-between items-center bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-100">
                <span className="text-sm text-gray-700">{s.name}</span>
                <div className="flex items-center gap-3">
                  <button onClick={()=>toggleStoreVariant(s.id, s.variant_enabled)}
                    className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700">
                    <div className={`w-8 h-4 rounded-full relative transition-colors ${s.variant_enabled?'bg-emerald-500':'bg-gray-200'}`}>
                      <div className={`w-3 h-3 bg-white rounded-full absolute top-0.5 transition-all ${s.variant_enabled?'right-0.5':'left-0.5'}`}/>
                    </div>
                    <span className={s.variant_enabled?'text-emerald-600':'text-gray-400'}>Variant</span>
                  </button>
                  <button onClick={()=>deleteStore(s.id)} className="text-xs text-gray-400 hover:text-red-500 px-2 py-1 rounded hover:bg-red-50">устгах</button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm"
            placeholder="Дэлгүүрийн нэр" value={newStoreName} onChange={e=>setNewStoreName(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&addStore()} />
          <button onClick={addStore} disabled={!newStoreName.trim()}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 disabled:opacity-50">
            Нэмэх
          </button>
        </div>
      </div>

      {/* Агуулахууд */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <h2 className="font-medium text-gray-800 mb-1 text-sm">Агуулахууд</h2>
        <p className="text-xs text-gray-400 mb-4">Бараа хаана хадгалагдаж, хаанаас хүргэгдэхийг тэмдэглэнэ</p>
        {warehouses.length>0&&(
          <div className="space-y-2 mb-4">
            {warehouses.map(w=>(
              <div key={w.id} className="flex justify-between items-center bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-100">
                <div>
                  <div className="text-sm text-gray-700">{w.name}</div>
                  {w.address&&<div className="text-xs text-gray-400">{w.address}</div>}
                </div>
                <button onClick={()=>deleteWarehouse(w.id)} className="text-xs text-gray-400 hover:text-red-500 px-2 py-1 rounded hover:bg-red-50">устгах</button>
              </div>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 mb-2">
          <input className="px-3 py-2 rounded-lg border border-gray-200 text-sm"
            placeholder="Агуулахын нэр" value={newWhName} onChange={e=>setNewWhName(e.target.value)} />
          <input className="px-3 py-2 rounded-lg border border-gray-200 text-sm"
            placeholder="Хаяг (заавал биш)" value={newWhAddr} onChange={e=>setNewWhAddr(e.target.value)} />
        </div>
        <div className="flex justify-end">
          <button onClick={addWarehouse} disabled={!newWhName.trim()}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 disabled:opacity-50">
            Нэмэх
          </button>
        </div>
      </div>

      {/* Хүргэлтийн үнэ */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <h2 className="font-medium text-gray-800 mb-1 text-sm">Өгөгдмөл хүргэлтийн үнэ (₮)</h2>
        <p className="text-xs text-gray-400 mb-3">Захиалга шивэхэд автоматаар орно</p>
        <div className="flex gap-2">
          <input type="number" className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm"
            value={deliveryFee} onChange={e=>setDeliveryFee(e.target.value)} placeholder="7000" />
          <button onClick={saveDelivery}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all flex-shrink-0 ${deliverySaved?'bg-gray-100 text-gray-500':'bg-emerald-600 text-white hover:bg-emerald-700'}`}>
            {deliverySaved?'Хадгалагдлаа':'Хадгалах'}
          </button>
        </div>
      </div>

      {/* Зочин хандалт */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <h2 className="font-medium text-gray-800 mb-1 text-sm">Зочин хандалт</h2>
        <p className="text-xs text-gray-400 mb-4">Нэвтрэх нэр, PIN-ээр таны өгөгдлийг харна</p>
        <div className="space-y-3 mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Имэйл</label>
              <input type="email" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                placeholder="zochin@gmail.com" value={newEmail} onChange={e=>setNewEmail(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Эрх</label>
              <select className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white" value={newRole} onChange={e=>setNewRole(e.target.value)}>
                <option value="viewer">Харагч</option>
                <option value="editor">Засварлагч</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Нэвтрэх нэр</label>
              <input className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                placeholder="username" value={newUsername} onChange={e=>setNewUsername(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">PIN (4+ оронтой)</label>
              <input type="password" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                placeholder="••••" value={newPin} onChange={e=>setNewPin(e.target.value)} />
            </div>
          </div>
          {stores.length>0 && (
            <div>
              <label className="block text-xs text-gray-400 mb-1">Дэлгүүр</label>
              <select className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white" value={newStoreId} onChange={e=>setNewStoreId(e.target.value)}>
                <option value="">Бүх дэлгүүр (сонголтгүй)</option>
                {stores.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <p className="text-xs text-gray-400 mt-1">Зочин зөвхөн сонгосон дэлгүүрийн захиалга, бараа харна</p>
            </div>
          )}
          <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-400 space-y-1 border border-gray-100">
            <div><span className="text-gray-600">Харагч</span> — Самбар, агуулах, түүх зөвхөн харах эрхтэй</div>
            <div><span className="text-gray-600">Засварлагч</span> — Самбар, агуулах, түүх харах, засварлах эрхтэй</div>
          </div>
          <button onClick={addViewer}
            className="w-full py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700">
            Зочин нэмэх
          </button>
        </div>
        {viewers.length>0?(
          <div className="space-y-2">
            {viewers.map(v=>(
              <div key={v.id} className="bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-100">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-gray-700 break-all">{v.viewer_email}</div>
                    {v.username&&(
                      <div className="text-xs text-gray-400 mt-0.5">
                        {v.username} · PIN: {v.pin}
                      </div>
                    )}
                  </div>
                  <button onClick={async()=>{ await supabase.from('shared_access').delete().eq('id',v.id); loadAll() }}
                    className="text-xs text-gray-400 hover:text-red-500 px-2 py-1 rounded hover:bg-red-50 flex-shrink-0">устгах</button>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <select value={v.role} onChange={e=>updateViewerRole(v.id, e.target.value)}
                    className={`text-xs px-2 py-1 rounded-full border bg-white ${v.role==='editor'?'text-blue-600 border-blue-100':'text-gray-500 border-gray-200'}`}>
                    <option value="viewer">Харагч</option>
                    <option value="editor">Засварлагч</option>
                  </select>
                  {stores.length>0 && (
                    <select value={v.store_id||''} onChange={e=>updateViewerStore(v.id, e.target.value)}
                      className="text-xs px-2 py-1 rounded-full border bg-white text-gray-500 border-gray-200">
                      <option value="">Бүх дэлгүүр</option>
                      {stores.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  )}
                </div>
              </div>
            ))}
          </div>
        ):(
          <p className="text-sm text-gray-400 text-center py-4">Зочин нэмэгдээгүй</p>
        )}
      </div>
    </div>
  )
}
