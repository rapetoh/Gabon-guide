import { usePostHog } from 'posthog-react-native'

/**
 * useAnalytics — thin wrapper around PostHog for clean event tracking.
 * All app events go through here so event names stay consistent.
 */
export function useAnalytics() {
  const posthog = usePostHog()

  return {
    // Place detail page opened
    placeViewed: (placeId: string, placeName: string, category?: string | null) =>
      posthog.capture('place_viewed', { place_id: placeId, place_name: placeName, ...(category ? { category } : {}) }),

    // CTA buttons on place detail
    ctaWhatsappTapped: (placeId: string, placeName: string) =>
      posthog.capture('cta_whatsapp_tapped', { place_id: placeId, place_name: placeName }),

    ctaCallTapped: (placeId: string, placeName: string) =>
      posthog.capture('cta_call_tapped', { place_id: placeId, place_name: placeName }),

    ctaSaveTapped: (placeId: string, placeName: string, saved: boolean) =>
      posthog.capture('cta_save_tapped', { place_id: placeId, place_name: placeName, saved }),

    ctaShareTapped: (placeId: string, placeName: string) =>
      posthog.capture('cta_share_tapped', { place_id: placeId, place_name: placeName }),

    // Explore screen filters
    filterUsed: (filters: { category?: string; zone?: string; price?: number; openNow?: boolean; nearMe?: boolean }) =>
      posthog.capture('filter_used', filters),

    // Search
    searchPerformed: (query: string, resultCount: number) =>
      posthog.capture('search_performed', { query, result_count: resultCount }),

    // Trending Now card tapped
    trendingCardTapped: (placeId: string, placeName: string, isPromoted: boolean) =>
      posthog.capture('trending_card_tapped', { place_id: placeId, place_name: placeName, is_promoted: isPromoted }),
  }
}
