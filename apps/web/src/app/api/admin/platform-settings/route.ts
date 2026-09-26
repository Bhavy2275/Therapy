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
    let adminClient;
    try {
      adminClient = createAdminClient();
    } catch (envErr: unknown) {
      const msg = envErr instanceof Error ? envErr.message : String(envErr);
      console.error('[admin/platform-settings] Failed to create admin client:', msg);
      return NextResponse.json({ error: `Server configuration error: ${msg}` }, { status: 500 });
    }

    const { data, error } = await adminClient.from('platform_settings').select('key, value');

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
