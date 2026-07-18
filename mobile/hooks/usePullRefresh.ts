import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { rotateFeedSeed } from '../lib/feedRanking'

// Standard pull-to-refresh wiring: re-fetches every query the screen is
// showing. Pair with <RefreshControl refreshing={refreshing} onRefresh={onRefresh}/>.
export function usePullRefresh() {
  const qc = useQueryClient()
  const [refreshing, setRefreshing] = useState(false)

  async function onRefresh() {
    setRefreshing(true)
    try {
      // A manual refresh deals a fresh feed order (seeded shuffle).
      // Invalidation-driven refetches keep the current seed, so the feed
      // never reshuffles under the user's thumb.
      rotateFeedSeed()
      await qc.refetchQueries({ type: 'active' })
    } finally {
      setRefreshing(false)
    }
  }

  return { refreshing, onRefresh }
}
