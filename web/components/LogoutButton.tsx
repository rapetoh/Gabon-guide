'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase-browser'

export default function LogoutButton() {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <button
      onClick={handleLogout}
      className="w-full text-left text-xs text-gray-500 hover:text-red-600 transition-colors"
    >
      Sign out
    </button>
  )
}
