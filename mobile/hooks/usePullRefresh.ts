import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

// Standard pull-to-refresh wiring: re-fetches every query the screen is
// showing. Pair with <RefreshControl refreshing={refreshing} onRefresh={onRefresh}/>.
export function usePullRefresh() {
  const qc = useQueryClient()
  const [refreshing, setRefreshing] = useState(false)

  async function onRefresh() {
    setRefreshing(true)
    try {
      await qc.refetchQueries({ type: 'active' })
    } finally {
      setRefreshing(false)
    }
  }

  return { refreshing, onRefresh }
}
