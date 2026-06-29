  import 'react-native-url-polyfill/auto';
  import { createClient } from '@supabase/supabase-js';
  import AsyncStorage from '@react-native-async-storage/async-storage';
  import { Platform } from 'react-native';

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  //  ADD THESE TWO LINES
  console.log("Supabase URL:", supabaseUrl);
  console.log("Supabase Key:", supabaseKey?.substring(0, 20));

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables');
  }

  export const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      storage: Platform.OS === 'web' ? undefined : AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: Platform.OS === 'web',
    },
  });