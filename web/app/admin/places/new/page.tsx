import Link from 'next/link'
import PlaceForm from '../../../../components/PlaceForm'

export default function NewPlacePage() {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/places" className="text-sm text-gray-400 hover:text-gray-700">
          ← Places
        </Link>
        <span className="text-gray-200">/</span>
        <h1 className="text-xl font-bold text-gray-900">Add place</h1>
      </div>
      <PlaceForm />
    </div>
  )
}
