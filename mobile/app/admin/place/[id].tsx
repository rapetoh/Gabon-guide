import { useLocalSearchParams } from 'expo-router'
import { PlaceForm } from '../../../components/admin/PlaceForm'

export default function AdminEditPlaceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <PlaceForm mode="edit" placeId={id} />
}
