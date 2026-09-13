import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/admin/platform-settings/update
 * Body: { settings: Record<string, string> }
 * Admin-only. Upserts one or more platform settings keys.
 */
export async function POST(req: Request) {
  try {
    const serverClient = await createClient();
    const { data: { user }, error: authError } = await serverClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminClient = createAdminClient();

    // Verify admin role
    const { data: userRow } = await adminClient
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userRow?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admin access required.' }, { status: 403 });
    }

    const body = await req.json() as { settings: Record<string, string> };
    if (!body.settings || typeof body.settings !== 'object') {
      return NextResponse.json({ error: 'Missing settings object' }, { status: 400 });
    }

    // Upsert each key
    const rows = Object.entries(body.settings).map(([key, value]) => ({ key, value }));
    const { error: upsertError } = await adminClient
      .from('platform_settings')
      .upsert(rows, { onConflict: 'key' });

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, updated: rows.length });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
