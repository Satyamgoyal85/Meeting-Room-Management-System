import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/lib/types';

/**
 * Creates a privileged Supabase client using SUPABASE_SERVICE_ROLE_KEY (or falling back to ANON key).
 * Designed strictly for secure Node.js Server Actions (`src/actions/*.ts`) after verifying application-level session access (`getSession()`).
 * Bypasses Postgres RLS limitations when authenticating via custom ECN employee ID cookies (`dhanuka_session`).
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-supabase-url.supabase.co';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey || serviceRoleKey.includes('placeholder')) {
    console.warn('[Supabase Admin] WARNING: SUPABASE_SERVICE_ROLE_KEY is missing or set to a placeholder in .env.local. Admin server actions require the true Service Role Key from Supabase Dashboard → API → service_role to bypass Row Level Security.');
  }

  const effectiveKey = serviceRoleKey && !serviceRoleKey.includes('placeholder')
    ? serviceRoleKey
    : (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key');

  return createSupabaseClient<Database>(supabaseUrl, effectiveKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
