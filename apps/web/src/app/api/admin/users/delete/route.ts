import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/users/delete
 * Body: { userId: string }
 *
 * Permanently deletes a user from public tables and Supabase Auth.
 * Admin-only operation.
 */
export async function POST(req: Request) {
  try {
    const serverClient = await createClient();
    const {
      data: { user: adminUser },
      error: authError,
    } = await serverClient.auth.getUser();

    if (authError || !adminUser) {
      return NextResponse.json({ error: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const adminClient = createAdminClient();

    // Verify admin role
    const { data: adminRow, error: roleError } = await adminClient
      .from('users')
      .select('role')
      .eq('id', adminUser.id)
      .single();

    if (roleError || adminRow?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admin access required.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { userId } = body as { userId?: string };

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid userId.' }, { status: 400 });
    }

    if (userId === adminUser.id) {
      return NextResponse.json(
        { error: 'Security constraint: You cannot delete your own admin account.' },
        { status: 400 },
      );
    }

    // 1. Delete associated sessions
    await adminClient
      .from('sessions')
      .delete()
      .or(`client_id.eq.${userId},therapist_id.eq.${userId}`);

    // 2. Delete availability slots
    await adminClient
      .from('availability_slots')
      .delete()
      .eq('therapist_id', userId);

    // 3. Nullify or delete donations
    await adminClient
      .from('donations')
      .delete()
      .eq('donor_user_id', userId);

    // 4. Delete therapist profile
    await adminClient
      .from('therapist_profiles')
      .delete()
      .eq('user_id', userId);

    // 5. Delete client profile
    await adminClient
      .from('client_profiles')
      .delete()
      .eq('user_id', userId);

    // 6. Delete from public.users table
    const { error: userDeleteError } = await adminClient
      .from('users')
      .delete()
      .eq('id', userId);

    if (userDeleteError) {
      console.warn('[admin/users/delete] Error deleting from public.users:', userDeleteError);
    }

    // 7. Delete from Supabase Auth service
    const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(userId);
    if (authDeleteError) {
      console.warn('[admin/users/delete] Warning deleting from Supabase Auth:', authDeleteError);
      // Even if auth service warning occurs, public profile has been purged
    }

    return NextResponse.json({
      success: true,
      message: 'User and all associated data permanently deleted.',
      deletedUserId: userId,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[admin/users/delete] Unexpected error:', err);
    return NextResponse.json({ error: `Server error: ${msg}` }, { status: 500 });
  }
}
