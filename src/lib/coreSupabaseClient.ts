import { createClient } from '@supabase/supabase-js';

const envSource =
  (typeof import.meta !== 'undefined' && (import.meta as any)?.env) ||
  (typeof process !== 'undefined' ? process.env : undefined);

const coreSupabaseUrl =
  envSource?.VITE_CORE_SUPABASE_URL ?? envSource?.CORE_SUPABASE_URL;
const coreSupabaseAnonKey =
  envSource?.VITE_CORE_SUPABASE_ANON_KEY ?? envSource?.CORE_SUPABASE_ANON_KEY;

if (!coreSupabaseUrl || !coreSupabaseAnonKey) {
  throw new Error('Missing core Supabase environment variables');
}

export const coreSupabase = createClient(coreSupabaseUrl, coreSupabaseAnonKey);
