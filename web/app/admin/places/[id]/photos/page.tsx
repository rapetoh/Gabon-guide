import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '../../../../../lib/supabase-server'
import PhotoManager from '../../../../../components/PhotoManager'
import type { Database } from '../../../../../lib/database.types'

type Photo = Database['public']['Tables']['photos']['Row']

export default async function PhotosPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()

  const { data: place } = await supabase
    .from('places')
    .select('id, name')
    .eq('id', params.id)
    .eq('is_deleted', false)
    .single()

  if (!place) notFound()

  const { data: photos } = await supabase
    .from('photos')
    .select('*')
    .eq('place_id', params.id)
    .eq('is_deleted', false)
    .order('position', { ascending: true })

  return (
    <div>
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
      <PhotoManager placeId={params.id} initialPhotos={(photos ?? []) as Photo[]} />
    </div>
  )
}
