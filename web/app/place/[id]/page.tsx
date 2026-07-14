import type { Metadata } from 'next'
import { createClient } from '../../../lib/supabase-server'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: "O'Kili — Découvrez ce lieu",
  description: "Découvrez les meilleurs restaurants et lieux du Gabon sur O'Kili.",
}

// Public share-link fallback: when someone without the app opens a shared
// place link, this page shows the place and deep-links into the app.
// Route lives outside /admin — the proxy matcher only guards /admin/*.
export default async function PublicPlacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  // Anon-readable public data only: active, non-deleted places.
  const { data: place } = await supabase
    .from('places')
    .select('id, name, description_fr, address, phone')
    .eq('id', id)
    .eq('is_active', true)
    .eq('is_deleted', false)
    .maybeSingle()

  if (!place) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 max-w-md w-full text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-xl bg-orange-500 text-white flex items-center justify-center font-bold text-2xl">O</div>
          <h1 className="text-lg font-bold text-gray-900">Lieu introuvable</h1>
          <p className="text-sm text-gray-500">
            Ce lieu n&apos;existe pas ou n&apos;est plus disponible sur O&apos;Kili.
          </p>
          <p className="text-xs text-gray-400 pt-2">
            Téléchargez O&apos;Kili sur l&apos;App Store ou Google Play.
          </p>
        </div>
      </main>
    )
  }

  const { data: photo } = await supabase
    .from('photos')
    .select('storage_path')
    .eq('place_id', place.id)
    .eq('is_deleted', false)
    .eq('is_menu', false)
    .order('is_primary', { ascending: false })
    .order('position', { ascending: true })
    .limit(1)
    .maybeSingle()

  const photoUrl = photo
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/place-photos/${photo.storage_path}`
    : null

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4 sm:p-6">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden max-w-md w-full">
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt={place.name} className="w-full h-52 object-cover" />
        ) : (
          <div className="w-full h-32 bg-orange-50 flex items-center justify-center">
            <div className="w-12 h-12 rounded-xl bg-orange-500 text-white flex items-center justify-center font-bold text-2xl">O</div>
          </div>
        )}

        <div className="p-6 space-y-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-orange-500 mb-1">O&apos;Kili</div>
            <h1 className="text-xl font-bold text-gray-900">{place.name}</h1>
          </div>

          {place.description_fr && (
            <p className="text-sm text-gray-600 leading-relaxed">{place.description_fr}</p>
          )}

          <div className="space-y-2 text-sm text-gray-600">
            {place.address && (
              <div className="flex items-start gap-2">
                <svg className="w-4 h-4 mt-0.5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>{place.address}</span>
              </div>
            )}
            {place.phone && (
              <div className="flex items-start gap-2">
                <svg className="w-4 h-4 mt-0.5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <span>{place.phone}</span>
              </div>
            )}
          </div>

          <a
            href={`okili://place/${place.id}`}
            className="block w-full text-center bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold rounded-xl px-5 py-3.5 transition-colors"
          >
            Ouvrir dans l&apos;application O&apos;Kili
          </a>

          <p className="text-xs text-gray-400 text-center">
            Téléchargez O&apos;Kili sur l&apos;App Store ou Google Play.
          </p>
        </div>
      </div>
    </main>
  )
}
