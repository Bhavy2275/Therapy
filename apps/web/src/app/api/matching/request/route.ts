import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const rl = rateLimit(`matching-request:${ip}`, { limit: 15, windowMs: 60_000 });
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Too many session requests. Please wait a minute.' },
        { status: 429, headers: { 'Retry-After': '60' } }
      );
    }

    const serverClient = await createClient();
    const {
      data: { user },
      error: authError,
    } = await serverClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await req.json();
    const { type, languagePreference, topic, isSos } = body as {
      type: 'video' | 'voice' | 'chat';
      languagePreference?: string;
      topic?: string;
      isSos?: boolean;
    };

    const sessionType = type && ['video', 'voice', 'chat'].includes(type) ? type : 'video';

    const adminClient = createAdminClient();

    const finalTopic = isSos ? (topic || 'EMERGENCY_CRISIS_SOS') : (topic ? topic.trim() : null);

    // Create session record in pending status (free, 100% no billing)
    const { data: session, error: insertError } = await adminClient
      .from('sessions')
      .insert({
        client_id: user.id,
        type: sessionType,
        mode: 'instant',
        status: 'pending',
        billing_enabled: false,
        notes: finalTopic,
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

    // 90 seconds search window
    const expiresAt = new Date(Date.now() + 90000).toISOString();
    const clientName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Client';

    const offerPayload = {
      sessionId: session.id,
      clientId: user.id,
      clientName,
      type: sessionType,
      languagePreference: languagePreference || 'English',
      topic: finalTopic ?? undefined,
      isSos: Boolean(isSos),
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
