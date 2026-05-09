import { notFound } from 'next/navigation'
import { createClient } from '../../../../../lib/supabase-server'
import PhotoManager from '../../../../../components/PhotoManager'
import Topbar from '../../../../../components/admin/Topbar'
import type { Database } from '../../../../../lib/database.types'

type Photo = Database['public']['Tables']['photos']['Row']

export default async function PhotosPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ created?: string }>
}) {
  const { id } = await params
  const { created } = await searchParams
  const supabase = await createClient()

  const { data: place } = await supabase
    .from('places')
    .select('id, name')
    .eq('id', id)
    .eq('is_deleted', false)
    .single()

  if (!place) notFound()

  const { data: photos } = await supabase
    .from('photos')
    .select('*')
    .eq('place_id', id)
    .eq('is_deleted', false)
    .order('position', { ascending: true })

  return (
    <div>
      <Topbar
        title={`Photos · ${place.name}`}
        breadcrumb={[
          { label: 'Admin', href: '/admin' },
          { label: 'Places', href: '/admin/places' },
          { label: place.name, href: `/admin/places/${place.id}` },
          { label: 'Photos' },
        ]}
      />
      <div className="p-8 space-y-4">
        {created === '1' && (
          <div className="flex items-center gap-3 px-4 py-3 bg-green-50 border border-green-100 rounded-xl text-sm text-green-800">
            <svg className="w-4 h-4 shrink-0 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            <span><strong>{place.name}</strong> was created successfully. Now upload at least one photo.</span>
          </div>
        )}
        <PhotoManager placeId={id} initialPhotos={(photos ?? []) as Photo[]} />
      </div>
    </div>
  )
}
