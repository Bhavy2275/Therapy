import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/admin/therapist-status
 * Body: { userId: string; status: 'approved' | 'rejected' | 'suspended'; adminNote?: string }
 *
 * Uses the Supabase service-role key so the update bypasses RLS policies.
 * Only callable by users whose `role` in the `users` table is 'admin'.
 */
export async function POST(req: Request) {
  try {
    // Verify caller authentication via session cookie
    const serverClient = await createClient();
    const {
      data: { user },
      error: authError,
    } = await serverClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const adminClient = createAdminClient();

    // Verify role using adminClient to ensure RLS doesn't block the check
    const { data: userRow, error: roleError } = await adminClient
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (roleError || userRow?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required.' },
        { status: 403 },
      );
    }

    // Parse body
    const body = await req.json();
    const { userId, status, adminNote } = body as {
      userId: string;
      status: 'pending' | 'approved' | 'rejected' | 'suspended';
      adminNote?: string;
    };

    if (!userId || !status) {
      return NextResponse.json({ error: 'Missing userId or status' }, { status: 400 });
    }

    const validStatuses = ['pending', 'approved', 'rejected', 'suspended'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
    }

    // Update therapist profile with service role
    const { error: updateError } = await adminClient
      .from('therapist_profiles')
      .update({
        status,
        admin_note: adminNote ?? null,
        is_available_now: false,
      })
      .eq('user_id', userId);

    if (updateError) {
      console.error('[admin/therapist-status] DB error:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, userId, status });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[admin/therapist-status] Unexpected error:', err);
    return NextResponse.json({ error: `Server error: ${msg}` }, { status: 500 });
  }
}

