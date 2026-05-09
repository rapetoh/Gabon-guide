import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '../../../../../lib/supabase-server'
import VideoManager from '../../../../../components/VideoManager'
import Topbar from '../../../../../components/admin/Topbar'
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
      <Topbar
        title={`Videos · ${place.name}`}
        breadcrumb={[
          { label: 'Admin', href: '/admin' },
          { label: 'Places', href: '/admin/places' },
          { label: place.name, href: `/admin/places/${place.id}` },
          { label: 'Videos' },
        ]}
        actions={
          <Link
            href={`/admin/places/${id}/photos`}
            className="h-9 px-4 border border-gray-200 hover:border-gray-300 bg-white text-gray-700 text-sm font-semibold rounded-lg transition-colors flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Photos
          </Link>
        }
      />
      <div className="p-8">
        <VideoManager placeId={id} initialVideos={(videos ?? []) as Video[]} />
      </div>
    </div>
  )
}
