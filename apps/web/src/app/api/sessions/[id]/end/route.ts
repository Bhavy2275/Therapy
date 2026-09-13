import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: sessionId } = await params;

    const serverClient = await createClient();
    const {
      data: { user },
      error: authError,
    } = await serverClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const adminClient = createAdminClient();

    // End session in database
    const now = new Date().toISOString();
    const { data: session } = await adminClient
      .from('sessions')
      .select('id, started_at')
      .eq('id', sessionId)
      .single();

    let durationMinutes = 45;
    if (session?.started_at) {
      const diffMs = Date.now() - new Date(session.started_at).getTime();
      durationMinutes = Math.max(1, Math.round(diffMs / 60000));
    }

    const { error: updateErr } = await adminClient
      .from('sessions')
      .update({
        status: 'completed',
        ended_at: now,
        duration_minutes: durationMinutes,
      })
      .eq('id', sessionId);

    if (updateErr) {
      console.error('[sessions/end] Error updating session:', updateErr);
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, sessionId, status: 'completed' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[sessions/end] Unexpected error:', err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
