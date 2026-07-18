import { useQuery } from '@tanstack/react-query'

import { supabase } from '../lib/supabase'

// Fire-and-forget engagement logging (migration 041). Never blocks or
// surfaces errors to the user — losing an event is fine, breaking a call
// button is not.
export function logPlaceEvent(placeId: string, eventType: 'view' | 'whatsapp' | 'call') {
  supabase
    .from('place_events')
    .insert({ place_id: placeId, event_type: eventType })
    .then(() => {})
}

export interface PlaceMetricsDay {
  day: string
  views: number
  whatsapp_taps: number
  calls: number
}

// Last-7-days engagement for the owner dashboard. The RPC authorizes against
// places.owner_id / is_admin() server-side and returns zero-filled days.
export function usePlaceMetrics(placeId: string | undefined) {
  return useQuery({
    queryKey: ['place-metrics', placeId],
    queryFn: async (): Promise<PlaceMetricsDay[]> => {
      if (!placeId) return []
      const { data, error } = await supabase.rpc('get_place_metrics', { p_place_id: placeId })
      if (error) throw error
      return (data ?? []) as PlaceMetricsDay[]
    },
    enabled: !!placeId,
    staleTime: 60_000,
  })
}
