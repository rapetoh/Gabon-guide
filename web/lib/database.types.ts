export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

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
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['places']['Row'], 'id' | 'created_at' | 'updated_at'>
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
          is_admin: boolean
          created_at: string
        }
        Insert: Pick<Database['public']['Tables']['profiles']['Row'], 'id'>
        Update: Partial<Pick<Database['public']['Tables']['profiles']['Row'], 'full_name' | 'avatar_url' | 'is_admin'>>
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
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['reviews']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Pick<Database['public']['Tables']['reviews']['Row'], 'rating' | 'comment'>>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
  }
}

export interface DayHours {
  open: string       // "HH:MM"
  close: string      // "HH:MM"
  closed: boolean
  overnight: boolean
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
