import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(
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

    const authHeader = req.headers.get('Authorization') || '';
    const apiUrl =
      process.env.API_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      'https://jarwis-api-s8iz.onrender.com';

    // 1. Try proxying to the backend API service first
    try {
      const backendRes = await fetch(`${apiUrl}/api/v1/sessions/${sessionId}/livekit-token`, {
        headers: {
          Authorization: authHeader.startsWith('Bearer ')
            ? authHeader
            : `Bearer ${authHeader}`,
        },
        cache: 'no-store',
      });

      if (backendRes.ok) {
        const data = await backendRes.json();
        return NextResponse.json(data);
      }
    } catch (proxyErr) {
      console.warn('[sessions/livekit-token] Backend proxy warning, using fallback:', proxyErr);
    }

    // 2. Direct database fallback if backend service is unreachable or cold-starting
    const adminClient = createAdminClient();
    const { data: session, error: sessionErr } = await adminClient
      .from('sessions')
      .select(`
        id,
        client_id,
        therapist_id,
        type,
        mode,
        status,
        scheduled_at,
        started_at,
        ended_at,
        duration_minutes,
        livekit_room_name,
        notes,
        created_at,
        client:users!sessions_client_id_fkey(id, full_name, email, avatar_url),
        therapist:users!sessions_therapist_id_fkey(id, full_name, email, avatar_url)
      `)
      .eq('id', sessionId)
      .single();

    if (sessionErr || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Update to in_progress if accepted
    if (session.status === 'accepted') {
      await adminClient
        .from('sessions')
        .update({
          status: 'in_progress',
          started_at: session.started_at || new Date().toISOString(),
        })
        .eq('id', sessionId);
      session.status = 'in_progress';
    }

    const clientObj = Array.isArray(session.client) ? session.client[0] : session.client;
    const therapistObj = Array.isArray(session.therapist) ? session.therapist[0] : session.therapist;
    const isTherapist = session.therapist_id === user.id;

    return NextResponse.json({
      token: null,
      livekitUrl: process.env.LIVEKIT_URL || '',
      roomName: session.livekit_room_name || `session-${sessionId}`,
      isTherapist,
      session: {
        id: session.id,
        clientId: session.client_id,
        therapistId: session.therapist_id,
        type: session.type,
        mode: session.mode,
        status: session.status,
        livekitRoomName: session.livekit_room_name,
        notes: session.notes,
        startedAt: session.started_at,
        isTherapist,
        client: clientObj
          ? {
              id: clientObj.id,
              fullName: clientObj.full_name,
              email: clientObj.email,
            }
          : null,
        therapist: therapistObj
          ? {
              id: therapistObj.id,
              fullName: therapistObj.full_name,
              email: therapistObj.email,
            }
          : null,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[sessions/livekit-token] Unexpected error:', err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
