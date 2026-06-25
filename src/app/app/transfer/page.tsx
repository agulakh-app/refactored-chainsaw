'use client'
export const dynamic = 'force-dynamic'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Өгөгдөл хуудас нь history/page.tsx-ийн import/export хэсгийг ашиглана
// Одоогоор history хуудас руу шилжүүлнэ
export default function TransferPage() {
  const router = useRouter()
  useEffect(()=>{ router.replace('/app/history') },[router])
  return <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Шилжүүлж байна...</div>
}
