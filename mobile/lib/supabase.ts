import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Persist session across app restarts using device storage
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // Required for React Native — no URL-based session detection
    detectSessionInUrl: false,
    // Required for OAuth in React Native — generates code_verifier so
    // exchangeCodeForSession() has something to exchange
    flowType: 'pkce',
  },
})
