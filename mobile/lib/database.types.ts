// Generated from the live Supabase schema (project fvmzsxmlpwvtnszmuowc) — keep mobile + web in sync.
// Must satisfy @supabase/supabase-js GenericSchema: each table needs Relationships[],
// and the schema needs Views and Functions keys.
//
// Last regenerated 2026-07-13 via Supabase MCP generate_typescript_types (migrations through 034).
// NOTE: the app-specific helper types at the bottom of this file (SubscriptionTier,
// DayHours, PlaceHours) are hand-written — re-append them after any regeneration.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      categories: {
        Row: {
          created_at: string | null
          id: string
          name_en: string
          name_fr: string
          slug: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name_en: string
          name_fr: string
          slug: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name_en?: string
          name_fr?: string
          slug?: string
        }
        Relationships: []
      }
      coupon_places: {
        Row: {
          coupon_id: string
          created_at: string
          place_id: string
        }
        Insert: {
          coupon_id: string
          created_at?: string
          place_id: string
        }
        Update: {
          coupon_id?: string
          created_at?: string
          place_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_places_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_places_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_redemptions: {
        Row: {
          bill_amount: number | null
          coupon_id: string
          created_at: string
          discount_applied: number | null
          id: string
          place_id: string | null
          redeemed_at: string | null
          redemption_code: string
          user_id: string | null
        }
        Insert: {
          bill_amount?: number | null
          coupon_id: string
          created_at?: string
          discount_applied?: number | null
          id?: string
          place_id?: string | null
          redeemed_at?: string | null
          redemption_code: string
          user_id?: string | null
        }
        Update: {
          bill_amount?: number | null
          coupon_id?: string
          created_at?: string
          discount_applied?: number | null
          id?: string
          place_id?: string | null
          redeemed_at?: string | null
          redemption_code?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coupon_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_redemptions_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          created_at: string
          description_en: string | null
          description_fr: string | null
          discount_type: string | null
          discount_value: number | null
          expires_at: string
          id: string
          is_active: boolean
          is_system: boolean
          max_redemptions_per_user: number
          max_total_redemptions: number | null
          place_id: string | null
          starts_at: string
          title_en: string | null
          title_fr: string
        }
        Insert: {
          created_at?: string
          description_en?: string | null
          description_fr?: string | null
          discount_type?: string | null
          discount_value?: number | null
          expires_at: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          max_redemptions_per_user?: number
          max_total_redemptions?: number | null
          place_id?: string | null
          starts_at?: string
          title_en?: string | null
          title_fr: string
        }
        Update: {
          created_at?: string
          description_en?: string | null
          description_fr?: string | null
          discount_type?: string | null
          discount_value?: number | null
          expires_at?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          max_redemptions_per_user?: number
          max_total_redemptions?: number | null
          place_id?: string | null
          starts_at?: string
          title_en?: string | null
          title_fr?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupons_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_balances: {
        Row: {
          balance_fcfa: number
          lifetime_earned: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance_fcfa?: number
          lifetime_earned?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance_fcfa?: number
          lifetime_earned?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      credit_transactions: {
        Row: {
          created_at: string
          delta_fcfa: number
          id: string
          note: string | null
          place_id: string | null
          reason: string
          ref_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          delta_fcfa: number
          id?: string
          note?: string | null
          place_id?: string | null
          reason: string
          ref_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          delta_fcfa?: number
          id?: string
          note?: string | null
          place_id?: string | null
          reason?: string
          ref_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_transactions_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          created_at: string | null
          id: string
          place_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          place_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          place_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "favorites_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          payload: Json
          pushed_at: string | null
          read_at: string | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          payload?: Json
          pushed_at?: string | null
          read_at?: string | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          payload?: Json
          pushed_at?: string | null
          read_at?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      photos: {
        Row: {
          created_at: string | null
          id: string
          is_deleted: boolean
          is_menu: boolean
          is_primary: boolean | null
          place_id: string | null
          position: number
          storage_path: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_deleted?: boolean
          is_menu?: boolean
          is_primary?: boolean | null
          place_id?: string | null
          position?: number
          storage_path: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_deleted?: boolean
          is_menu?: boolean
          is_primary?: boolean | null
          place_id?: string | null
          position?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "photos_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      places: {
        Row: {
          address: string | null
          category_id: string | null
          created_at: string | null
          description_en: string | null
          description_fr: string | null
          hours: Json | null
          hours_verified_at: string | null
          id: string
          is_active: boolean | null
          is_deleted: boolean
          is_promoted: boolean | null
          latitude: number | null
          longitude: number | null
          menu_pdf_path: string | null
          name: string
          owner_id: string | null
          phone: string | null
          price_range: number | null
          promoted_label_en: string | null
          promoted_label_fr: string | null
          social_facebook: string | null
          social_instagram: string | null
          social_tiktok: string | null
          subcategory_id: string | null
          subscription_expires_at: string | null
          subscription_tier: string
          updated_at: string | null
          website: string | null
          whatsapp: string | null
          zone_id: string | null
        }
        Insert: {
          address?: string | null
          category_id?: string | null
          created_at?: string | null
          description_en?: string | null
          description_fr?: string | null
          hours?: Json | null
          hours_verified_at?: string | null
          id?: string
          is_active?: boolean | null
          is_deleted?: boolean
          is_promoted?: boolean | null
          latitude?: number | null
          longitude?: number | null
          menu_pdf_path?: string | null
          name: string
          owner_id?: string | null
          phone?: string | null
          price_range?: number | null
          promoted_label_en?: string | null
          promoted_label_fr?: string | null
          social_facebook?: string | null
          social_instagram?: string | null
          social_tiktok?: string | null
          subcategory_id?: string | null
          subscription_expires_at?: string | null
          subscription_tier?: string
          updated_at?: string | null
          website?: string | null
          whatsapp?: string | null
          zone_id?: string | null
        }
        Update: {
          address?: string | null
          category_id?: string | null
          created_at?: string | null
          description_en?: string | null
          description_fr?: string | null
          hours?: Json | null
          hours_verified_at?: string | null
          id?: string
          is_active?: boolean | null
          is_deleted?: boolean
          is_promoted?: boolean | null
          latitude?: number | null
          longitude?: number | null
          menu_pdf_path?: string | null
          name?: string
          owner_id?: string | null
          phone?: string | null
          price_range?: number | null
          promoted_label_en?: string | null
          promoted_label_fr?: string | null
          social_facebook?: string | null
          social_instagram?: string | null
          social_tiktok?: string | null
          subcategory_id?: string | null
          subscription_expires_at?: string | null
          subscription_tier?: string
          updated_at?: string | null
          website?: string | null
          whatsapp?: string | null
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "places_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "places_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "places_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "places_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "places_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          is_admin: boolean | null
          is_blocked: boolean
          preferred_language: string
          preferred_vibes: string[]
          preferred_zones: string[]
          referral_code: string | null
          referred_by: string | null
          role: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          is_admin?: boolean | null
          is_blocked?: boolean
          preferred_language?: string
          preferred_vibes?: string[]
          preferred_zones?: string[]
          referral_code?: string | null
          referred_by?: string | null
          role?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_admin?: boolean | null
          is_blocked?: boolean
          preferred_language?: string
          preferred_vibes?: string[]
          preferred_zones?: string[]
          referral_code?: string | null
          referred_by?: string | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      push_tokens: {
        Row: {
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          platform?: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_settings: {
        Row: {
          id: number
          is_active: boolean
          max_rewarded_invites: number
          referee_reward_value: number
          referrer_reward_value: number
          reward_coupon_id: string | null
          reward_credit_fcfa: number | null
          reward_type: string
          updated_at: string
        }
        Insert: {
          id?: number
          is_active?: boolean
          max_rewarded_invites?: number
          referee_reward_value?: number
          referrer_reward_value?: number
          reward_coupon_id?: string | null
          reward_credit_fcfa?: number | null
          reward_type?: string
          updated_at?: string
        }
        Update: {
          id?: number
          is_active?: boolean
          max_rewarded_invites?: number
          referee_reward_value?: number
          referrer_reward_value?: number
          reward_coupon_id?: string | null
          reward_credit_fcfa?: number | null
          reward_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_settings_reward_coupon_id_fkey"
            columns: ["reward_coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          author_display_name: string | null
          comment: string | null
          created_at: string | null
          id: string
          owner_reply: string | null
          owner_reply_at: string | null
          place_id: string
          rating: number
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          author_display_name?: string | null
          comment?: string | null
          created_at?: string | null
          id?: string
          owner_reply?: string | null
          owner_reply_at?: string | null
          place_id: string
          rating: number
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          author_display_name?: string | null
          comment?: string | null
          created_at?: string | null
          id?: string
          owner_reply?: string | null
          owner_reply_at?: string | null
          place_id?: string
          rating?: number
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      search_trends_weekly: {
        Row: {
          category_id: string
          search_count: number
          week_of: string
        }
        Insert: {
          category_id: string
          search_count?: number
          week_of: string
        }
        Update: {
          category_id?: string
          search_count?: number
          week_of?: string
        }
        Relationships: [
          {
            foreignKeyName: "search_trends_weekly_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      subcategories: {
        Row: {
          category_id: string
          created_at: string | null
          id: string
          name_en: string
          name_fr: string
          slug: string
        }
        Insert: {
          category_id: string
          created_at?: string | null
          id?: string
          name_en: string
          name_fr: string
          slug: string
        }
        Update: {
          category_id?: string
          created_at?: string | null
          id?: string
          name_en?: string
          name_fr?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "subcategories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          id: number
          moderation_enabled: boolean
          updated_at: string
        }
        Insert: {
          id?: number
          moderation_enabled?: boolean
          updated_at?: string
        }
        Update: {
          id?: number
          moderation_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      tier_features: {
        Row: {
          enabled: boolean
          feature_key: string
          tier: string
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          feature_key: string
          tier: string
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          feature_key?: string
          tier?: string
          updated_at?: string
        }
        Relationships: []
      }
      tier_limits: {
        Row: {
          max_photos: number
          tier: string
        }
        Insert: {
          max_photos?: number
          tier: string
        }
        Update: {
          max_photos?: number
          tier?: string
        }
        Relationships: []
      }
      videos: {
        Row: {
          caption: string | null
          created_at: string | null
          id: string
          place_id: string
          position: number
          storage_path: string
          thumbnail_url: string | null
        }
        Insert: {
          caption?: string | null
          created_at?: string | null
          id?: string
          place_id: string
          position?: number
          storage_path: string
          thumbnail_url?: string | null
        }
        Update: {
          caption?: string | null
          created_at?: string | null
          id?: string
          place_id?: string
          position?: number
          storage_path?: string
          thumbnail_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "videos_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_feed: {
        Row: {
          created_at: string | null
          id: string
          label_en: string | null
          label_fr: string | null
          place_id: string | null
          rank: number
          week_of: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          label_en?: string | null
          label_fr?: string | null
          place_id?: string | null
          rank: number
          week_of: string
        }
        Update: {
          created_at?: string | null
          id?: string
          label_en?: string | null
          label_fr?: string | null
          place_id?: string | null
          rank?: number
          week_of?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_feed_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      zones: {
        Row: {
          created_at: string | null
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
    }
    Views: {
      profiles_public: {
        Row: {
          avatar_url: string | null
          full_name: string | null
          id: string | null
        }
        Insert: {
          avatar_url?: string | null
          full_name?: string | null
          id?: string | null
        }
        Update: {
          avatar_url?: string | null
          full_name?: string | null
          id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_adjust_credit: {
        Args: { p_delta: number; p_note?: string; p_user_id: string }
        Returns: Json
      }
      apply_redemption_session: {
        Args: {
          p_bill_amount: number
          p_credit_to_use: number
          p_idempotency_key?: string
          p_place_id: string
          p_redemption_ids: string[]
          p_user_id: string
        }
        Returns: Json
      }
      claim_referral_code: { Args: { p_code: string }; Returns: Json }
      delete_my_account: { Args: never; Returns: undefined }
      generate_coupon_redemption_code: { Args: never; Returns: string }
      generate_referral_code: { Args: never; Returns: string }
      get_all_users_for_admin: {
        Args: never
        Returns: {
          avatar_url: string
          email: string
          full_name: string
          id: string
          is_admin: boolean
          is_blocked: boolean
          joined_at: string
          role: string
        }[]
      }
      get_credit_scan_details: {
        Args: { p_user_id: string }
        Returns: {
          balance_fcfa: number
          email: string
          full_name: string
        }[]
      }
      grant_referral_reward: { Args: { p_user_id: string }; Returns: undefined }
      is_admin: { Args: never; Returns: boolean }
      is_blocked: { Args: never; Returns: boolean }
      owner_place_in_coupon_scope: {
        Args: { p_coupon: string }
        Returns: boolean
      }
      owner_redeemed_customer: { Args: { p_profile: string }; Returns: boolean }
      referral_code_exists: { Args: { p_code: string }; Returns: boolean }
      set_review_owner_reply: {
        Args: { p_reply: string; p_review_id: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

// ---------------------------------------------------------------------------
// App-specific helper types (hand-written, not generated by Supabase).
// Imported across mobile + web — keep these when regenerating the file above.
// ---------------------------------------------------------------------------

export type SubscriptionTier = 'free' | 'standard' | 'premium'

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
