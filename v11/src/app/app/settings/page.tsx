'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const ADMIN_PHONE_EMAIL = '88118270@agulakh.app'
const ADMIN_EMAIL = 'hardworkingfmly@gmail.com'

export default function SettingsPage() {
  const [deliveryFee, setDeliveryFee] = useState('')
  const [bizName, setBizName] = useState('')
  const [saved, setSaved] = useState(false)
  const [viewers, setViewers] = useState<any[]>([])
  const [newEmail, setNewEmail] = useState('')
  const [adding, setAdding] = useState(false)
  const [flash, setFlash] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)

  const showFlash = (m: string) => { setFlash(m); setTimeout(()=>setFlash(''),3000) }

  useEffect(()=>{
    supabase.auth.getUser().then(({data})=>{
      if (data.user) {
        setUserEmail(data.user.email||'')
        setIsAdmin(data.user.email===ADMIN_PHONE_EMAIL||data.user.email===ADMIN_EMAIL)
      }
    })
    supabase.from('profiles').select('business_name,default_delivery_fee').single().then(({data})=>{
      if (data) { setBizName(data.business_name||''); setDeliveryFee(String(data.default_delivery_fee||'')) }
    })
    loadViewers()
  },[])

  async function loadViewers() {
    const { data } = await supabase.from('shared_access').select('*').order('created_at',{ascending:false})
    setViewers(data||[])
  }

  async function saveSettings() {
    const { data:{ user } } = await supabase.auth.getUser()
    await supabase.from('profiles').update({
      business_name:bizName, default_delivery_fee:Number(deliveryFee)||0
    }).eq('id',user!.id)
    setSaved(true); setTimeout(()=>setSaved(false),2000)
  }

  async function addViewer() {
    if (!newEmail.trim()) return
    setAdding(true)
    const { data:{ user } } = await supabase.auth.getUser()
    const { data: ex } = await supabase.from('shared_access').select('id')
      .eq('owner_id',user!.id).eq('viewer_email',newEmail.trim()).maybeSingle()
    if (ex) { showFlash('Энэ хэрэглэгч аль хэдийн байна'); setAdding(false); return }
    await supabase.from('shared_access').insert({
      owner_id:user!.id, viewer_email:newEmail.trim(), role:'viewer'
    })
    try {
      await supabase.auth.signInWithOtp({
        email: newEmail.trim(),
        options: { emailRedirectTo: `${window.location.origin}/app` }
      })
      showFlash('✓ Урилга илгээгдлээ: '+newEmail)
    } catch(e) {
      showFlash('✓ Зочин нэмэгдлээ')
    }
    setNewEmail(''); loadViewers(); setAdding(false)
  }

  async function removeViewer(id: string) {
    await supabase.from('shared_access').delete().eq('id',id)
    setViewers(v=>v.filter(x=>x.id!==id))
    showFlash('Устгагдлаа')
  }

  return (
    <div className="space-y-5">
      {flash&&<div className="fixed top-4 right-4 bg-emerald-700 text-white text-sm px-4 py-2 rounded-lg shadow-lg z-50">{flash}</div>}

      {/* Admin link - зөвхөн эзэмшигчид харагдана */}
      {isAdmin && (
        <a href="/admin"
          className="flex items-center justify-between bg-gray-900 text-white rounded-2xl px-5 py-4 hover:bg-gray-800 transition-all">
          <div className="flex items-center gap-3">
            <span className="text-xl">🔐</span>
            <div>
              <div className="font-semibold text-sm">Admin самбар</div>
              <div className="text-xs text-gray-400">Хэрэглэгч, төлбөр, статистик удирдах</div>
            </div>
          </div>
          <span className="text-gray-400">→</span>
        </a>
      )}

      {/* General */}
      <div className="card">
        <h2 className="font-semibold text-gray-800 mb-4 text-base">⚙️ Ерөнхий тохиргоо</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Бизнесийн нэр</label>
            <input className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              value={bizName} onChange={e=>setBizName(e.target.value)} placeholder="Дэлгүүрийн нэр..." />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Өгөгдмөл хүргэлтийн үнэ (₮)
              <span className="text-gray-400 ml-1">— захиалга шивэхэд автоматаар орно</span>
            </label>
            <input type="number" className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              value={deliveryFee} onChange={e=>setDeliveryFee(e.target.value)} placeholder="7000" />
          </div>
        </div>
        <div className="flex justify-end mt-5">
          <button onClick={saveSettings}
            className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${saved?'bg-gray-100 text-gray-500':'bg-emerald-600 text-white hover:bg-emerald-700'}`}>
            {saved?'✓ Хадгалагдлаа':'Хадгалах'}
          </button>
        </div>
      </div>

      {/* Viewer */}
      <div className="card">
        <h2 className="font-semibold text-gray-800 mb-2 text-base">👁 Зочин хандалт</h2>
        <p className="text-xs text-gray-500 mb-4">Зочин хэрэглэгч зөвхөн харах боломжтой — захиалга нэмэх, засах боломжгүй.</p>
        <div className="flex gap-2 mb-4">
          <input type="email" className="flex-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            placeholder="Зочины имэйл хаяг..." value={newEmail} onChange={e=>setNewEmail(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&addViewer()} />
          <button onClick={addViewer} disabled={adding||!newEmail.trim()}
            className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 whitespace-nowrap">
            {adding?'...':'+ Урих'}
          </button>
        </div>
        {viewers.length>0 ? (
          <div className="space-y-2">
            {viewers.map(v=>(
              <div key={v.id} className="flex justify-between items-center bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-100">
                <div>
                  <div className="text-sm font-medium text-gray-700">{v.viewer_email}</div>
                  <div className="text-xs text-gray-400 mt-0.5">Зөвхөн харах эрх</div>
                </div>
                <button onClick={()=>removeViewer(v.id)} className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50">Устгах</button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-4 bg-gray-50 rounded-lg">Зочин хэрэглэгч нэмэгдээгүй байна</p>
        )}
      </div>

      {/* Account */}
      <div className="card">
        <h2 className="font-semibold text-gray-800 mb-3 text-base">👤 Бүртгэлийн мэдээлэл</h2>
        <div className="bg-gray-50 rounded-lg px-4 py-3">
          <div className="text-xs text-gray-500 mb-1">Бүртгэлийн имэйл / утас</div>
          <div className="text-sm font-medium text-gray-700">{userEmail}</div>
        </div>
      </div>
    </div>
  )
}
