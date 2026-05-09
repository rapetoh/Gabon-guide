import PlaceForm from '../../../../components/PlaceForm'
import Topbar from '../../../../components/admin/Topbar'

export default function NewPlacePage() {
  return (
    <div>
      <Topbar
        title="New place"
        breadcrumb={[
          { label: 'Admin', href: '/admin' },
          { label: 'Places', href: '/admin/places' },
          { label: 'New' },
        ]}
      />
      <div className="p-8">
        <PlaceForm />
      </div>
    </div>
  )
}
