import { createClient } from '../../lib/supabase-server'
import { redirect } from 'next/navigation'
import NavLinkClient from '../../components/NavLinkClient'
import LogoutButton from '../../components/LogoutButton'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Letter to fill the brand mark — keeps things personal but stable.
  const initial = (user.email ?? 'A').charAt(0).toUpperCase()

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-60 bg-white border-r border-gray-100 flex flex-col fixed h-full">
        {/* Brand */}
        <div className="px-5 pt-6 pb-5 flex items-center gap-3 border-b border-gray-100">
          <div className="w-9 h-9 rounded-lg bg-orange-500 text-white flex items-center justify-center font-bold text-lg">O</div>
          <div className="leading-tight">
            <div className="text-[15px] font-bold text-gray-900">O&apos;Kili</div>
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-[0.14em]">Admin</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-5 space-y-5 overflow-y-auto">
          <div>
            <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400">Général</div>
            <div className="space-y-0.5">
              <NavLinkClient href="/admin" exact>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <rect x="3" y="3" width="7" height="9" rx="1.5" />
                  <rect x="14" y="3" width="7" height="5" rx="1.5" />
                  <rect x="14" y="12" width="7" height="9" rx="1.5" />
                  <rect x="3" y="16" width="7" height="5" rx="1.5" />
                </svg>
                Overview
              </NavLinkClient>
              <NavLinkClient href="/admin/places">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Places
              </NavLinkClient>
            </div>
          </div>

          <div>
            <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400">Settings</div>
            <div className="space-y-0.5">
              <NavLinkClient href="/admin/tier-settings">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Tier settings
              </NavLinkClient>
            </div>
          </div>
        </nav>

        {/* User card */}
        <div className="px-3 py-3 border-t border-gray-100">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-9 h-9 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center font-semibold text-sm flex-shrink-0">
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold text-gray-900 truncate">{user.email}</div>
              <div className="text-[10px] text-gray-400">Administrateur</div>
            </div>
          </div>
          <LogoutButton />
        </div>
      </aside>

      <main className="flex-1 ml-60">
        {children}
      </main>
    </div>
  )
}
