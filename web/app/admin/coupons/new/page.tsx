import { createClient } from '../../../../lib/supabase-server'
import Topbar from '../../../../components/admin/Topbar'
import NewCouponClient from './NewCouponClient'

export const dynamic = 'force-dynamic'

export default async function NewPlatformCouponPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('places')
    .select('id, name')
    .eq('is_deleted', false)
    .order('name', { ascending: true })

  const places = ((data ?? []) as Array<{ id: string; name: string }>)

  return (
    <div>
      <Topbar
        title="New platform coupon"
        breadcrumb={[
          { label: 'Admin',   href: '/admin' },
          { label: 'Coupons', href: '/admin/coupons' },
          { label: 'New' },
        ]}
      />
      <div className="p-8 max-w-3xl">
        <p className="text-sm text-gray-500 mb-6">
          Admin-issued coupon. Pick a scope: valid at every restaurant on O&apos;Kili, or only the ones you select.
          Restaurant owners cannot edit or delete it.
        </p>
        <NewCouponClient places={places} />
      </div>
    </div>
  )
}
