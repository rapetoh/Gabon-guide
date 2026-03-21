import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '../../../../../lib/supabase-server'
import PhotoManager from '../../../../../components/PhotoManager'
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
      {created === '1' && (
        <div className="flex items-center gap-3 mb-6 px-4 py-3 bg-green-50 border border-green-100 rounded-xl text-sm text-green-800">
          <svg className="w-4 h-4 shrink-0 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          <span><strong>{place.name}</strong> was created successfully. Now upload at least one photo.</span>
        </div>
      )}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/places" className="text-sm text-gray-400 hover:text-gray-700">
          ← Places
        </Link>
        <span className="text-gray-200">/</span>
        <Link href={`/admin/places/${place.id}`} className="text-sm text-gray-400 hover:text-gray-700">
          {place.name}
        </Link>
        <span className="text-gray-200">/</span>
        <h1 className="text-xl font-bold text-gray-900">Photos</h1>
      </div>
      <PhotoManager placeId={id} initialPhotos={(photos ?? []) as Photo[]} />
    </div>
  )
}
