import Link from 'next/link'
import { createClient } from '../../../lib/supabase-server'
import Topbar from '../../../components/admin/Topbar'
import DeleteReviewButton from './DeleteReviewButton'

export const dynamic = 'force-dynamic'

interface ReviewRow {
  id: string
  place_id: string
  user_id: string
  rating: number
  comment: string | null
  created_at: string
  author_display_name: string | null
  places: { id: string; name: string } | null
}

export default async function AdminReviewsPage() {
  const supabase = await createClient()

  // Latest 100 reviews with place name. author_display_name is the snapshot
  // kept when an account is deleted (migration 027) — not yet in the
  // generated types, hence the cast.
  const { data } = await supabase
    .from('reviews')
    .select('id, place_id, user_id, rating, comment, created_at, author_display_name, places(id, name)')
    .order('created_at', { ascending: false })
    .limit(100)
  const reviews = (data ?? []) as unknown as ReviewRow[]

  // Author names via the safe public projection of profiles (migration 025).
  const userIds = Array.from(new Set(reviews.map(r => r.user_id).filter(Boolean)))
  const { data: authors } = userIds.length
    ? await supabase.from('profiles_public').select('id, full_name').in('id', userIds)
    : { data: [] }
  const nameMap = new Map(
    ((authors ?? []) as { id: string; full_name: string | null }[]).map(a => [a.id, a.full_name]),
  )

  function authorName(r: ReviewRow): string {
    return nameMap.get(r.user_id)?.trim() || r.author_display_name?.trim() || 'Utilisateur supprimé'
  }

  return (
    <div>
      <Topbar
        title="Avis"
        breadcrumb={[{ label: 'Admin', href: '/admin' }, { label: 'Avis' }]}
        rightHint={`${reviews.length} avis récents`}
      />
      <div className="p-8 space-y-4">
        <div className="text-xs text-gray-500">
          Les 100 derniers avis publiés. La suppression est définitive et recalcule la note du lieu.
        </div>

        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          {reviews.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
              <p className="text-sm text-gray-500">Aucun avis pour le moment.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-[0.08em]">Auteur</th>
                  <th className="text-left px-5 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-[0.08em]">Lieu</th>
                  <th className="text-left px-5 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-[0.08em]">Note</th>
                  <th className="text-left px-5 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-[0.08em]">Commentaire</th>
                  <th className="text-left px-5 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-[0.08em]">Date</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {reviews.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <Link href={`/admin/users/${r.user_id}`} className="font-semibold text-gray-900 hover:text-orange-600">
                        {authorName(r)}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      {r.places ? (
                        <Link href={`/admin/places/${r.places.id}`} className="text-orange-500 hover:text-orange-600 font-medium">
                          {r.places.name}
                        </Link>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      <span className="font-semibold text-gray-900">{r.rating}</span>
                      <span className="text-orange-400"> ★</span>
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      <div className="max-w-md truncate" title={r.comment ?? undefined}>
                        {r.comment?.trim() || <span className="text-gray-300">—</span>}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-500 whitespace-nowrap">
                      {new Date(r.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <DeleteReviewButton id={r.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
