import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const sessionId = url.searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
    }

    const serverClient = await createClient();
    const {
      data: { user },
      error: authError,
    } = await serverClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const adminClient = createAdminClient();

    const { data: session, error: queryError } = await adminClient
      .from('sessions')
      .select('id, client_id, therapist_id, status, type')
      .eq('id', sessionId)
      .single();

    if (queryError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.status === 'accepted' && session.therapist_id) {
      // Fetch therapist profile for matched dossier
      const { data: therapistUser } = await adminClient
        .from('users')
        .select('full_name, email')
        .eq('id', session.therapist_id)
        .single();

      const { data: therapistProfile } = await adminClient
        .from('therapist_profiles')
        .select('bio, specializations')
        .eq('user_id', session.therapist_id)
        .single();

      return NextResponse.json({
        status: 'accepted',
        sessionMatched: {
          sessionId: session.id,
          therapistId: session.therapist_id,
          therapistName: therapistUser?.full_name || 'Licensed Therapist',
          therapistBio: therapistProfile?.bio || '',
          specializations: therapistProfile?.specializations || [],
        },
      });
    }

    return NextResponse.json({
      status: session.status,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
