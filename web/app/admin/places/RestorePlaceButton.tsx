'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../lib/supabase-browser'

/** Restores a soft-deleted place (is_deleted = false). */
export default function RestorePlaceButton({ id }: { id: string }) {
  const supabase = createClient()
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function restore() {
    setBusy(true)
    const { error } = await supabase
      .from('places')
      .update({ is_deleted: false })
      .eq('id', id)
    setBusy(false)
    if (error) {
      alert(error.message)
      return
    }
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={restore}
      disabled={busy}
      className="text-xs text-green-600 hover:text-green-700 font-semibold disabled:opacity-40"
    >
      {busy ? 'Restauration…' : 'Restaurer'}
    </button>
  )
}
