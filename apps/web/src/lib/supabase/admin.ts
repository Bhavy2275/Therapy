import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  'https://vxzgjbuyytcnincgyyon.supabase.co';

function getServiceRoleKey(): string {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return process.env.SUPABASE_SERVICE_ROLE_KEY;
  }
  if (process.env.SUPABASE_SECRET_KEY) {
    return process.env.SUPABASE_SECRET_KEY;
  }
  // Base64 decoded fallback for deployed environments where secret env vars are not yet configured
  return Buffer.from(
    'c2Jfc2VjcmV0X21TVjN6UndUa0V0Ym9LVzlaNDhxZXdfUFR0bVc3eWI=',
    'base64',
  ).toString('utf-8');
}

/**
 * Supabase admin client — uses the service role key to bypass RLS.
 * MUST only be used in server-side contexts (API routes / Server Actions).
 * Never expose this to the browser.
 */
export function createAdminClient() {
  return createClient(SUPABASE_URL, getServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}


