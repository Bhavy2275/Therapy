import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const serverClient = await createClient();
    const {
      data: { user },
      error: authError,
    } = await serverClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const adminClient = createAdminClient();

    // Check caller is a therapist
    const { data: userRow } = await adminClient
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userRow?.role !== 'therapist') {
      return NextResponse.json({ error: 'Only therapists can check pending offers' }, { status: 403 });
    }

    // Query pending instant sessions created in the last 65 seconds
    const cutoff = new Date(Date.now() - 65000).toISOString();
    const { data: pendingSessions, error: queryError } = await adminClient
      .from('sessions')
      .select(`
        id,
        client_id,
        type,
        mode,
        status,
        notes,
        created_at,
        users!sessions_client_id_fkey (
          full_name,
          email
        )
      `)
      .eq('status', 'pending')
      .eq('mode', 'instant')
      .gt('created_at', cutoff)
      .order('created_at', { ascending: false })
      .limit(1);

    if (queryError) {
      console.error('[matching/pending] Query error:', queryError);
      return NextResponse.json({ hasOffer: false }, { status: 200 });
    }

    if (!pendingSessions || pendingSessions.length === 0) {
      return NextResponse.json({ hasOffer: false }, { status: 200 });
    }

    const session = pendingSessions[0];
    const userObj = Array.isArray(session.users) ? session.users[0] : session.users;
    const clientName = (userObj as { full_name?: string })?.full_name || 'Client';
    const createdAtMs = new Date(session.created_at).getTime();
    const expiresAt = new Date(createdAtMs + 60000).toISOString();

    // Check if expired
    if (Date.now() > createdAtMs + 60000) {
      return NextResponse.json({ hasOffer: false }, { status: 200 });
    }

    return NextResponse.json({
      hasOffer: true,
      offer: {
        sessionId: session.id,
        clientId: session.client_id,
        clientName,
        type: session.type,
        topic: session.notes ?? undefined,
        expiresAt,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[matching/pending] Unexpected error:', err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
