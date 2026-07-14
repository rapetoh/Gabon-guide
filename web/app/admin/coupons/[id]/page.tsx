import { notFound } from 'next/navigation'
import { createClient } from '../../../../lib/supabase-server'
import Topbar from '../../../../components/admin/Topbar'
import EditCouponClient, { type CouponDetail } from './EditCouponClient'

export const dynamic = 'force-dynamic'

export default async function EditCouponPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: coupon }, { data: placesData }, { data: scopeRows }] = await Promise.all([
    supabase
      .from('coupons')
      .select(
        'id, place_id, title_fr, title_en, description_fr, starts_at, expires_at, max_redemptions_per_user, max_total_redemptions, discount_type, discount_value, is_active, is_system, places!coupons_place_id_fkey(id, name)',
      )
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('places')
      .select('id, name')
      .eq('is_deleted', false)
      .order('name', { ascending: true }),
    supabase.from('coupon_places').select('place_id').eq('coupon_id', id),
  ])

  if (!coupon) notFound()

  const detail = coupon as unknown as CouponDetail
  const places = (placesData ?? []) as Array<{ id: string; name: string }>
  const initialScope = ((scopeRows ?? []) as Array<{ place_id: string }>).map(r => r.place_id)

  return (
    <div>
      <Topbar
        title="Modifier le coupon"
        breadcrumb={[
          { label: 'Admin',   href: '/admin' },
          { label: 'Coupons', href: '/admin/coupons' },
          { label: detail.title_fr },
        ]}
      />
      <div className="p-8 max-w-3xl">
        <p className="text-sm text-gray-500 mb-6">
          {detail.place_id === null
            ? 'Coupon plateforme — émis par l’administration. Modifiez les textes, la validité, la remise et les restaurants concernés.'
            : <>Coupon du restaurant <span className="font-semibold text-gray-700">{detail.places?.name ?? '—'}</span>. Les modifications sont visibles immédiatement dans l’application.</>}
        </p>
        <EditCouponClient coupon={detail} places={places} initialScope={initialScope} />
      </div>
    </div>
  )
}
