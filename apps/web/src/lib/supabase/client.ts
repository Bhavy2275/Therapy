import { createBrowserClient } from '@supabase/ssr';

/**
 * Supabase browser client — for use in Client Components.
 * Singleton pattern to avoid multiple GoTrue instances.
 */
let client: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return client;
}
