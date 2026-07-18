import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '../lib/supabase'
import { useSession } from './useSession'

export type NotificationType =
  | 'coupon_redeemed'
  | 'credit_spent'
  | 'credit_received'
  | 'referral_reward'
  | 'review_reply'
  | 'new_review'      // owner: a customer reviewed your place
  | 'new_coupon'      // customer: coupon at a favorited place / platform-wide
  | 'place_activated' // owner: your listing went live
  | 'tier_expiry'     // ADMINS ONLY: a paid place's subscription is ending/lapsed

// Written by the DB triggers in migration 039 — text is rendered client-side
// from this payload so it always follows the user's current language.
export interface NotificationPayload {
  place_id?: string | null
  place_name?: string | null
  coupon_title_fr?: string | null
  coupon_title_en?: string | null
  discount_applied?: number | null
  delta_fcfa?: number
  reason?: string
  review_id?: string
  reply_excerpt?: string
  rating?: number
  author_name?: string | null
  excerpt?: string | null
  platform?: boolean
  tier?: string
  milestone?: 'soon' | 'expired'
  days_left?: number
}

export interface AppNotification {
  id: string
  type: NotificationType
  payload: NotificationPayload
  created_at: string
  read_at: string | null
}

export function useNotifications(limit = 50) {
  const { session } = useSession()
  return useQuery({
    queryKey: ['notifications', session?.user.id],
    queryFn: async (): Promise<AppNotification[]> => {
      if (!session) return []
      const { data, error } = await supabase
        .from('notifications')
        .select('id, type, payload, created_at, read_at')
        .order('created_at', { ascending: false })
        .limit(limit)
      if (error) throw error
      return (data ?? []) as unknown as AppNotification[]
    },
    enabled: !!session,
    staleTime: 15_000,
  })
}

// Drives the badge on the home-screen bell. Polls softly so a redemption at
// the counter shows up on the customer's phone within a minute even without
// a push (e.g. permission denied).
export function useUnreadNotificationCount() {
  const { session } = useSession()
  return useQuery({
    queryKey: ['notifications-unread', session?.user.id],
    queryFn: async (): Promise<number> => {
      if (!session) return 0
      const { count, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .is('read_at', null)
      if (error) throw error
      return count ?? 0
    },
    enabled: !!session,
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}

// RLS limits the UPDATE to the caller's own rows, and the column grant only
// allows read_at — so this can't touch anything else.
export function useMarkAllNotificationsRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .is('read_at', null)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
      qc.invalidateQueries({ queryKey: ['notifications-unread'] })
    },
  })
}
