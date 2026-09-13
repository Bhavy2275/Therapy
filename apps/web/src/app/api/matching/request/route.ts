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
    const { type, languagePreference, topic } = body as {
      type: 'video' | 'voice' | 'chat';
      languagePreference?: string;
      topic?: string;
    };

    if (!type || !['video', 'voice', 'chat'].includes(type)) {
      return NextResponse.json({ error: 'Valid session type required' }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // Create session record in pending status
    const { data: session, error: insertError } = await adminClient
      .from('sessions')
      .insert({
        client_id: user.id,
        type,
        mode: 'instant',
        status: 'pending',
        notes: topic ? topic.trim() : null,
      })
      .select('id, client_id, type, mode, status, created_at')
      .single();

    if (insertError || !session) {
      console.error('[matching/request] Insert error:', insertError);
      return NextResponse.json(
        { error: insertError?.message || 'Failed to create session request' },
        { status: 500 },
      );
    }

    const expiresAt = new Date(Date.now() + 60000).toISOString();
    const clientName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Client';

    const offerPayload = {
      sessionId: session.id,
      clientId: user.id,
      clientName,
      type,
      languagePreference: languagePreference || 'English',
      topic: topic ? topic.trim() : undefined,
      expiresAt,
    };

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      expiresAt,
      offer: offerPayload,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[matching/request] Unexpected error:', err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
