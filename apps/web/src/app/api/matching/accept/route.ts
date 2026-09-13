import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: Request) {
  try {
    const serverClient = await createClient();
    const {
      data: { user },
      error: authError,
    } = await serverClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await req.json();
    const { sessionId } = body as { sessionId: string };

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // Verify user is a verified therapist
    const { data: userRow } = await adminClient
      .from('users')
      .select('role, full_name, email')
      .eq('id', user.id)
      .single();

    if (userRow?.role !== 'therapist') {
      return NextResponse.json({ error: 'Only therapists can accept sessions' }, { status: 403 });
    }

    // Atomic claim: only succeed if status is still 'pending'
    const livekitRoomName = `jarwis-live-${sessionId.slice(0, 8)}-${Date.now().toString(36)}`;
    const { data: updatedSession, error: updateError } = await adminClient
      .from('sessions')
      .update({
        therapist_id: user.id,
        status: 'accepted',
        started_at: new Date().toISOString(),
        livekit_room_name: livekitRoomName,
      })
      .eq('id', sessionId)
      .eq('status', 'pending')
      .select('id, client_id, therapist_id, type')
      .single();

    if (updateError || !updatedSession) {
      return NextResponse.json({
        won: false,
        message: 'This session has already been accepted by another therapist or expired.',
      });
    }

    // Fetch therapist profile for match reveal
    const { data: profile } = await adminClient
      .from('therapist_profiles')
      .select('bio, specializations')
      .eq('user_id', user.id)
      .single();

    const therapistName = userRow?.full_name || user.user_metadata?.full_name || 'Licensed Therapist';

    const sessionMatched = {
      sessionId,
      therapistId: user.id,
      therapistName,
      therapistBio: profile?.bio || '',
      specializations: profile?.specializations || [],
    };

    return NextResponse.json({
      won: true,
      sessionMatched,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[matching/accept] Unexpected error:', err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
