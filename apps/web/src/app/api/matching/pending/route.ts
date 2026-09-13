import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const excludeParam = searchParams.get('exclude');
    const excludedIds = excludeParam
      ? excludeParam.split(',').map((s) => s.trim()).filter(Boolean)
      : [];

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

    // Only approved and ONLINE therapists receive offers
    const { data: therapistProfile } = await adminClient
      .from('therapist_profiles')
      .select('status, is_available_now')
      .eq('user_id', user.id)
      .single();

    if (therapistProfile?.status !== 'approved' || !therapistProfile?.is_available_now) {
      return NextResponse.json({ hasOffer: false }, { status: 200 });
    }

    // Query pending instant sessions created in the last 95 seconds
    const cutoff = new Date(Date.now() - 95000).toISOString();
    let query = adminClient
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
      .order('created_at', { ascending: false });

    if (excludedIds.length > 0) {
      query = query.not('id', 'in', `(${excludedIds.join(',')})`);
    }

    const { data: pendingSessions, error: queryError } = await query.limit(1);

    if (queryError) {
      console.error('[matching/pending] Query error:', queryError);
      return NextResponse.json({ hasOffer: false }, { status: 200 });
    }

    if (!pendingSessions || pendingSessions.length === 0) {
      return NextResponse.json({ hasOffer: false }, { status: 200 });
    }

    const session = pendingSessions[0];

    // Extra safeguard: in-memory check if excluded
    if (excludedIds.includes(session.id)) {
      return NextResponse.json({ hasOffer: false }, { status: 200 });
    }
    const userObj = Array.isArray(session.users) ? session.users[0] : session.users;
    const clientName = (userObj as { full_name?: string })?.full_name || 'Client';
    const createdAtMs = new Date(session.created_at).getTime();
    const expiresAt = new Date(createdAtMs + 90000).toISOString();

    // Check if 90s search window expired
    if (Date.now() > createdAtMs + 90000) {
      return NextResponse.json({ hasOffer: false }, { status: 200 });
    }

    const isSos = session.notes === 'EMERGENCY_CRISIS_SOS' || Boolean(session.notes?.includes('SOS'));

    return NextResponse.json({
      hasOffer: true,
      offer: {
        sessionId: session.id,
        clientId: session.client_id,
        clientName,
        type: session.type,
        topic: isSos ? 'Emergency Crisis SOS Request' : (session.notes ?? undefined),
        isSos,
        expiresAt,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[matching/pending] Unexpected error:', err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
