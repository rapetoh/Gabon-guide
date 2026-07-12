import { createClient } from '../../../lib/supabase-server'
import Topbar from '../../../components/admin/Topbar'
import UsersClient, { type AdminUserRow } from './UsersClient'

export const dynamic = 'force-dynamic'

export default async function UsersPage() {
  const supabase = await createClient()

  // Same SECURITY DEFINER RPC the mobile admin uses — returns every profile
  // with email + role + blocked flag, admin-only.
  const { data, error } = await supabase.rpc('get_all_users_for_admin')

  const users: AdminUserRow[] = (data ?? []) as AdminUserRow[]

  return (
    <div className="min-h-screen">
      <Topbar
        title="Users"
        breadcrumb={[{ label: 'Admin', href: '/admin' }, { label: 'Users' }]}
        rightHint={`${users.length} registered`}
      />
      <div className="p-8">
        {error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            Could not load users: {error.message}
          </div>
        ) : (
          <UsersClient users={users} />
        )}
      </div>
    </div>
  )
}
