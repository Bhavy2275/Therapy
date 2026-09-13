import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/platform-settings
 * Returns all platform settings as a flat key-value object.
 * Publicly readable (no auth required) so the donate page can load UPI info.
 */
export async function GET() {
  try {
    const adminClient = createAdminClient();
    const { data, error } = await adminClient
      .from('platform_settings')
      .select('key, value');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const settings: Record<string, string> = {};
    for (const row of data ?? []) {
      settings[row.key] = row.value ?? '';
    }

    return NextResponse.json(settings);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
