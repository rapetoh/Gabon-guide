// Stable list of feature keys used in the tier_features matrix.
// Keep in sync with the seed in supabase/migrations/014_tiers_coupons_referrals.sql.

export const FEATURE_KEYS = [
  'whatsapp_cta',
  'call_cta',
  'website_cta',
  'social_links',
  'menu',
  'verified_badge',
  'views_stat',
  'coupons_create',
  'coupon_broadcast',
  'video',
  'trending_eligible',
  'competition_trends',
] as const

export type FeatureKey = (typeof FEATURE_KEYS)[number]

// Human-readable labels (FR/EN). Used by the admin matrix UI and in upsell copy.
export const FEATURE_LABELS: Record<FeatureKey, { fr: string; en: string }> = {
  whatsapp_cta:       { fr: 'Bouton WhatsApp',          en: 'WhatsApp button' },
  call_cta:           { fr: 'Bouton Appeler',           en: 'Call button' },
  website_cta:        { fr: 'Bouton Site web',          en: 'Website button' },
  social_links:       { fr: 'Réseaux sociaux',          en: 'Social links' },
  menu:               { fr: 'Menu (photos + PDF)',      en: 'Menu (photos + PDF)' },
  verified_badge:     { fr: 'Badge Vérifié',            en: 'Verified badge' },
  views_stat:         { fr: 'Statistique de vues',      en: 'Views statistic' },
  coupons_create:     { fr: 'Créer des coupons',        en: 'Create coupons' },
  coupon_broadcast:   { fr: 'Coupons notifiés à tous les utilisateurs', en: 'Coupons notify all users' },
  video:              { fr: 'Vidéo',                    en: 'Video' },
  trending_eligible:  { fr: 'Éligible à la mise en avant', en: 'Eligible for Trending' },
  competition_trends: { fr: 'Tendances du marché',      en: 'Market trends' },
}
