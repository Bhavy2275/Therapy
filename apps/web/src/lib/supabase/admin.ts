import { createClient } from '@supabase/supabase-js';

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
      `Ensure it is set in your .env.local (development) or deployment secrets (production).`,
    );
  }
  return value;
}

/**
 * Supabase admin client — uses the service role key to bypass RLS.
 * MUST only be used in server-side contexts (API routes / Server Actions).
 * Never expose this to the browser.
 */
export function createAdminClient() {
  const supabaseUrl = getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL');
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    getRequiredEnv('SUPABASE_SECRET_KEY');

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}


