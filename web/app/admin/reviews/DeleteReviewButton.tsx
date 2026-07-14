'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../lib/supabase-browser'

/** Deletes a review after confirmation. Admin RLS (reviews_admin_delete) permits it. */
export default function DeleteReviewButton({ id }: { id: string }) {
  const supabase = createClient()
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function handleDelete() {
    if (!confirm('Supprimer définitivement cet avis ? Cette action est irréversible.')) return
    setBusy(true)
    const { error } = await supabase.from('reviews').delete().eq('id', id)
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
      onClick={handleDelete}
      disabled={busy}
      className="text-xs text-red-500 hover:text-red-700 font-semibold disabled:opacity-40"
    >
      {busy ? 'Suppression…' : 'Supprimer'}
    </button>
  )
}
