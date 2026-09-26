import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/platform-settings
 * Returns all platform settings as a flat key-value object.
 * Publicly readable (no auth required) so the donate page can load UPI info.
 * Uses standard client utilizing public RLS SELECT policy.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from('platform_settings').select('key, value');

    if (error) {
      console.error('[admin/platform-settings] DB error:', error);
      return NextResponse.json(
        { error: `Failed to fetch platform settings: ${error.message}` },
        { status: 500 },
      );
    }

    const settings: Record<string, string> = {};
    for (const row of data ?? []) {
      settings[row.key] = row.value ?? '';
    }

    return NextResponse.json(settings);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[admin/platform-settings] Unexpected error:', err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
