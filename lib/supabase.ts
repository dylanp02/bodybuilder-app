// lib/supabase.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const { supabaseUrl, supabaseAnonKey } = Constants.expoConfig?.extra ?? {};

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase config. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.');
}

export const supabase = createClient(supabaseUrl as string, supabaseAnonKey as string, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Helper: get the current logged-in user, or null if not logged in
export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

// Admin client — service role key bypasses RLS. Only used in debug.tsx.
// Never include this client in production navigation paths.
export const supabaseAdmin = process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(
      process.env.EXPO_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )
  : null;
