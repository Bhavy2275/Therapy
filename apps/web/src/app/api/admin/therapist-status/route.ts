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
    // Verify the caller is an authenticated admin
    const serverClient = await createClient();
    const { data: { user } } = await serverClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userRow } = await serverClient
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userRow?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: admin only' }, { status: 403 });
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

    // Use the admin client (service role) to bypass RLS
    const adminClient = createAdminClient();
    const { error } = await adminClient
      .from('therapist_profiles')
      .update({
        status,
        admin_note: adminNote ?? null,
        is_available_now: false,
      })
      .eq('user_id', userId);

    if (error) {
      console.error('[admin/therapist-status] DB error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, userId, status });
  } catch (err) {
    console.error('[admin/therapist-status] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
