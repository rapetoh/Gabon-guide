import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '../../../../lib/supabase-server'
import PlaceForm from '../../../../components/PlaceForm'
import Topbar from '../../../../components/admin/Topbar'
import type { Database } from '../../../../lib/database.types'

type Place = Database['public']['Tables']['places']['Row']

export default async function EditPlacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data } = await supabase
    .from('places')
    .select('*')
    .eq('id', id)
    .eq('is_deleted', false)
    .single()

  const place = data as Place | null
  if (!place) notFound()

  return (
    <div>
      <Topbar
        title={place.name}
        breadcrumb={[
          { label: 'Admin', href: '/admin' },
          { label: 'Places', href: '/admin/places' },
          { label: 'Edit' },
        ]}
        actions={
          <>
            <Link
              href={`/admin/places/${id}/photos`}
              className="h-9 px-4 border border-gray-200 hover:border-gray-300 bg-white text-gray-700 text-sm font-semibold rounded-lg transition-colors flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Photos
            </Link>
            <Link
              href={`/admin/places/${id}/videos`}
              className="h-9 px-4 border border-gray-200 hover:border-gray-300 bg-white text-gray-700 text-sm font-semibold rounded-lg transition-colors flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Videos
            </Link>
          </>
        }
      />
      <div className="p-8">
        <PlaceForm place={place} />
      </div>
    </div>
  )
}
