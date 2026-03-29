import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '../../../../lib/supabase-server'
import PlaceForm from '../../../../components/PlaceForm'
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
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/places" className="text-sm text-gray-400 hover:text-gray-700">
          ← Places
        </Link>
        <span className="text-gray-200">/</span>
        <h1 className="text-xl font-bold text-gray-900">{place.name}</h1>
        <div className="ml-auto flex items-center gap-4">
          <Link
            href={`/admin/places/${id}/videos`}
            className="text-sm text-orange-500 hover:text-orange-700 font-medium"
          >
            Videos →
          </Link>
          <Link
            href={`/admin/places/${id}/photos`}
            className="text-sm text-orange-500 hover:text-orange-700 font-medium"
          >
            Photos →
          </Link>
        </div>
      </div>
      <PlaceForm place={place} />
    </div>
  )
}
