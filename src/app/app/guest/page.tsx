'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function GuestPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [ownerName, setOwnerName] = useState('')
  const [role, setRole] = useState('')
  const [ownerId, setOwnerId] = useState('')

  useEffect(() => {
    const raw = localStorage.getItem('guest_access')
    if (!raw) { router.push('/'); return }
    try {
      const access = JSON.parse(raw)
      setOwnerId(access.owner_id)
      setRole(access.role)
      supabase.from('profiles').select('business_name').eq('id', access.owner_id).single()
        .then(({ data }) => {
          setOwnerName(data?.business_name || 'OLULA')
          setLoading(false)
        })
    } catch { router.push('/') }
  }, [router])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-gray-400 text-sm">Ачааллаж байна...</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-gray-100 p-8 max-w-sm w-full text-center">
        <div className="text-4xl mb-4">📦</div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">{ownerName}</h2>
        <p className="text-sm text-gray-500 mb-6">
          {role === 'editor' ? '✏️ Засварлагч' : '👁 Харагч'} эрхээр нэвтэрсэн
        </p>
        <div className="space-y-3">
          <button onClick={() => router.push('/app/guest/dashboard')}
            className="w-full py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700">
            Самбар харах →
          </button>
          <button onClick={() => { localStorage.removeItem('guest_access'); router.push('/') }}
            className="w-full py-2.5 border border-gray-200 text-gray-500 rounded-xl text-sm hover:bg-gray-50">
            Гарах
          </button>
        </div>
      </div>
    </div>
  )
}
