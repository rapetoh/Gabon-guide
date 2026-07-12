// Hand-written to keep mobile + web in sync.
// Must satisfy @supabase/supabase-js GenericSchema: each table needs Relationships[],
// and the schema needs Views and Functions keys.
//
// Last updated 2026-05-08 — Migration 014 (tiers + coupons + referrals + system settings).

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type SubscriptionTier = 'free' | 'standard' | 'premium'

export interface Database {
  public: {
    Tables: {
      categories: {
        Row: {
          id: string
          name_fr: string
          name_en: string
          slug: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['categories']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['categories']['Insert']>
        Relationships: []
      }
      zones: {
        Row: {
          id: string
          name: string
          slug: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['zones']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['zones']['Insert']>
        Relationships: []
      }
      places: {
        Row: {
          id: string
          name: string
          category_id: string | null
          zone_id: string | null
          price_range: 1 | 2 | 3 | null
          description_fr: string | null
          description_en: string | null
          address: string | null
          phone: string | null
          whatsapp: string | null
          hours: PlaceHours | null
          hours_verified_at: string | null
          latitude: number | null
          longitude: number | null
          website: string | null
          subcategory_id: string | null
          is_active: boolean
          is_deleted: boolean
          is_promoted: boolean
          promoted_label_fr: string | null
          promoted_label_en: string | null
          owner_id: string | null
          subscription_tier: SubscriptionTier
          subscription_expires_at: string | null
          social_instagram: string | null
          social_facebook: string | null
          social_tiktok: string | null
          menu_pdf_path: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<
          Database['public']['Tables']['places']['Row'],
          | 'id'
          | 'created_at'
          | 'updated_at'
          | 'owner_id'
          | 'subscription_tier'
          | 'subscription_expires_at'
          | 'social_instagram'
          | 'social_facebook'
          | 'social_tiktok'
          | 'menu_pdf_path'
        > & {
          owner_id?: string | null
          subscription_tier?: SubscriptionTier
          subscription_expires_at?: string | null
          social_instagram?: string | null
          social_facebook?: string | null
          social_tiktok?: string | null
          menu_pdf_path?: string | null
        }
        Update: Partial<Database['public']['Tables']['places']['Insert']>
        Relationships: []
      }
      photos: {
        Row: {
          id: string
          place_id: string
          storage_path: string
          is_primary: boolean
          is_deleted: boolean
          is_menu: boolean
          position: number
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['photos']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['photos']['Insert']>
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          full_name: string | null
          avatar_url: string | null
          email: string | null
          is_admin: boolean
          is_blocked: boolean
          role: 'user' | 'restaurant_owner' | 'admin'
          preferred_zones: string[]
          preferred_vibes: string[]
          referral_code: string | null
          referred_by: string | null
          created_at: string
        }
        Insert: Pick<Database['public']['Tables']['profiles']['Row'], 'id'> & Partial<Pick<Database['public']['Tables']['profiles']['Row'], 'email' | 'full_name' | 'referred_by'>>
        Update: Partial<Pick<Database['public']['Tables']['profiles']['Row'], 'full_name' | 'avatar_url' | 'email' | 'is_admin' | 'is_blocked' | 'role' | 'preferred_zones' | 'preferred_vibes' | 'referred_by'>>
        Relationships: []
      }
      favorites: {
        Row: {
          id: string
          user_id: string
          place_id: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['favorites']['Row'], 'id' | 'created_at'>
        Update: never
        Relationships: []
      }
      weekly_feed: {
        Row: {
          id: string
          week_of: string
          place_id: string
          rank: number
          label_fr: string | null
          label_en: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['weekly_feed']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['weekly_feed']['Insert']>
        Relationships: []
      }
      subcategories: {
        Row: {
          id: string
          category_id: string
          name_fr: string
          name_en: string
          slug: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['subcategories']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['subcategories']['Insert']>
        Relationships: []
      }
      reviews: {
        Row: {
          id: string
          place_id: string
          user_id: string
          rating: number
          comment: string | null
          owner_reply: string | null
          owner_reply_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['reviews']['Row'], 'id' | 'created_at' | 'updated_at' | 'owner_reply' | 'owner_reply_at'> & {
          owner_reply?: string | null
          owner_reply_at?: string | null
        }
        Update: Partial<Pick<Database['public']['Tables']['reviews']['Row'], 'rating' | 'comment'>>
        Relationships: []
      }
      videos: {
        Row: {
          id: string
          place_id: string
          storage_path: string
          thumbnail_url: string | null
          caption: string | null
          position: number
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['videos']['Row'], 'id' | 'created_at' | 'thumbnail_url' | 'caption'> & {
          thumbnail_url?: string | null
          caption?: string | null
        }
        Update: Partial<Database['public']['Tables']['videos']['Insert']>
        Relationships: []
      }
      tier_features: {
        Row: {
          feature_key: string
          tier: SubscriptionTier
          enabled: boolean
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['tier_features']['Row'], 'updated_at'> & { updated_at?: string }
        Update: Partial<Database['public']['Tables']['tier_features']['Row']>
        Relationships: []
      }
      tier_limits: {
        Row: {
          tier: SubscriptionTier
          max_photos: number
        }
        Insert: Database['public']['Tables']['tier_limits']['Row']
        Update: Partial<Database['public']['Tables']['tier_limits']['Row']>
        Relationships: []
      }
      coupons: {
        Row: {
          id: string
          place_id: string | null
          title_fr: string
          title_en: string | null
          description_fr: string | null
          description_en: string | null
          starts_at: string
          expires_at: string
          max_redemptions_per_user: number
          max_total_redemptions: number | null
          discount_type: 'percentage' | 'amount' | null
          discount_value: number | null
          is_active: boolean
          is_system: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['coupons']['Row'], 'id' | 'created_at' | 'starts_at' | 'max_redemptions_per_user' | 'max_total_redemptions' | 'discount_type' | 'discount_value' | 'is_active' | 'is_system'> & {
          starts_at?: string
          max_redemptions_per_user?: number
          max_total_redemptions?: number | null
          discount_type?: 'percentage' | 'amount' | null
          discount_value?: number | null
          is_active?: boolean
          is_system?: boolean
        }
        Update: Partial<Database['public']['Tables']['coupons']['Insert']>
        Relationships: []
      }
      coupon_places: {
        Row: {
          coupon_id: string
          place_id: string
          created_at: string
        }
        Insert: { coupon_id: string; place_id: string; created_at?: string }
        Update: never
        Relationships: []
      }
      coupon_redemptions: {
        Row: {
          id: string
          coupon_id: string
          user_id: string | null
          redemption_code: string
          redeemed_at: string | null
          bill_amount: number | null
          discount_applied: number | null
          place_id: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['coupon_redemptions']['Row'], 'id' | 'created_at' | 'redeemed_at' | 'bill_amount' | 'discount_applied' | 'place_id'> & {
          redeemed_at?: string | null
          bill_amount?: number | null
          discount_applied?: number | null
          place_id?: string | null
        }
        Update: Partial<Pick<Database['public']['Tables']['coupon_redemptions']['Row'], 'redeemed_at' | 'bill_amount' | 'discount_applied' | 'place_id'>>
        Relationships: []
      }
      referral_settings: {
        Row: {
          id: number
          reward_type: 'welcome_credit' | 'coupon' | 'points' | 'none'
          referrer_reward_value: number
          referee_reward_value: number
          reward_coupon_id: string | null
          reward_credit_fcfa: number | null
          is_active: boolean
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['referral_settings']['Row']> & { id?: number }
        Update: Partial<Database['public']['Tables']['referral_settings']['Row']>
        Relationships: []
      }
      credit_balances: {
        Row: {
          user_id: string
          balance_fcfa: number
          lifetime_earned: number
          updated_at: string
        }
        Insert: { user_id: string; balance_fcfa?: number; lifetime_earned?: number; updated_at?: string }
        Update: Partial<Database['public']['Tables']['credit_balances']['Row']>
        Relationships: []
      }
      credit_transactions: {
        Row: {
          id: string
          user_id: string
          delta_fcfa: number
          reason: 'referral_signup' | 'referral_invite' | 'redemption_session' | 'admin_adjust'
          ref_id: string | null
          place_id: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['credit_transactions']['Row'], 'id' | 'created_at'> & {
          id?: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['credit_transactions']['Row']>
        Relationships: []
      }
      system_settings: {
        Row: {
          id: number
          moderation_enabled: boolean
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['system_settings']['Row']> & { id?: number }
        Update: Partial<Database['public']['Tables']['system_settings']['Row']>
        Relationships: []
      }
      search_trends_weekly: {
        Row: {
          week_of: string
          category_id: string | null
          search_count: number
        }
        Insert: Database['public']['Tables']['search_trends_weekly']['Row']
        Update: Partial<Database['public']['Tables']['search_trends_weekly']['Row']>
        Relationships: []
      }
    }
    Views: {
      // Safe public projection of profiles (migration 025).
      profiles_public: {
        Row: {
          id: string
          full_name: string | null
          avatar_url: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      set_review_owner_reply: {
        Args: { p_review_id: string; p_reply: string }
        Returns: void
      }
      get_all_users_for_admin: {
        Args: Record<string, never>
        Returns: {
          id: string
          full_name: string | null
          role: string
          is_admin: boolean
          is_blocked: boolean
          email: string | null
          joined_at: string
        }[]
      }
      apply_redemption_session: {
        Args: {
          p_user_id: string
          p_redemption_ids: string[]
          p_credit_to_use: number
          p_bill_amount: number
          p_place_id: string
        }
        Returns: {
          bill_amount: number
          total_discount: number
          credit_used: number
          customer_pays: number
          lines: {
            redemption_id: string
            coupon_id: string
            bill_amount: number
            discount_applied: number
          }[]
        }
      }
    }
  }
}

export interface DayHours {
  open: string      // "HH:MM" format e.g. "08:00"
  close: string     // "HH:MM" format e.g. "22:00"
  closed: boolean   // true = closed all day
  overnight: boolean // true = closes after midnight (e.g. bar open until 02:00)
}

export interface PlaceHours {
  mon: DayHours
  tue: DayHours
  wed: DayHours
  thu: DayHours
  fri: DayHours
  sat: DayHours
  sun: DayHours
}
