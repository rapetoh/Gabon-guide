'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../lib/supabase-browser'

/**
 * Row actions for the coupons list: Activer/Désactiver toggle + Modifier link.
 * Admin RLS (coupons_owner_or_admin_write) lets admins update any coupon,
 * platform or place-owned.
 */
export default function CouponActions({ id, isActive }: { id: string; isActive: boolean }) {
  const supabase = createClient()
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function toggle() {
    setBusy(true)
    const { error } = await supabase
      .from('coupons')
      .update({ is_active: !isActive })
      .eq('id', id)
    setBusy(false)
    if (error) {
      alert(error.message)
      return
    }
    router.refresh()
  }

  return (
    <div className="flex items-center gap-3 justify-end whitespace-nowrap">
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        className={`text-xs font-semibold transition-colors disabled:opacity-40 ${
          isActive ? 'text-gray-400 hover:text-red-600' : 'text-green-600 hover:text-green-700'
        }`}
      >
        {busy ? '…' : isActive ? 'Désactiver' : 'Activer'}
      </button>
      <Link
        href={`/admin/coupons/${id}`}
        className="text-xs text-orange-500 hover:text-orange-600 font-semibold"
      >
        Modifier
      </Link>
    </div>
  )
}
