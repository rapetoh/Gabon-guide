import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '../../../../../lib/supabase-server'
import VideoManager from '../../../../../components/VideoManager'
import type { Database } from '../../../../../lib/database.types'

type Video = Database['public']['Tables']['videos']['Row']

export default async function VideosPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: place } = await supabase
    .from('places')
    .select('id, name')
    .eq('id', id)
    .eq('is_deleted', false)
    .single()

  if (!place) notFound()

  const { data: videos } = await supabase
    .from('videos')
    .select('*')
    .eq('place_id', id)
    .order('position', { ascending: true })

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/admin/places/${id}`} className="text-sm text-gray-400 hover:text-gray-700">
          ← {place.name}
        </Link>
        <span className="text-gray-200">/</span>
        <h1 className="text-xl font-bold text-gray-900">Videos</h1>
        <Link
          href={`/admin/places/${id}/photos`}
          className="ml-auto text-sm text-orange-500 hover:text-orange-700 font-medium"
        >
          Photos →
        </Link>
      </div>
      <VideoManager placeId={id} initialVideos={(videos ?? []) as Video[]} />
    </div>
  )
}
