import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/users/delete
 * Body: { userId: string }
 *
 * Permanently deletes a user from public tables and Supabase Auth.
 * Admin-only operation with strict rate limiting.
 */
export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const rl = rateLimit(`admin-delete:${ip}`, { limit: 10, windowMs: 60_000 });
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please slow down.' },
        { status: 429, headers: { 'Retry-After': '60' } }
      );
    }

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

    // 1. Delete associated sessions (both client and therapist roles)
    await adminClient.from('sessions').delete().eq('client_id', userId);
    await adminClient.from('sessions').delete().eq('therapist_id', userId);
    await adminClient
      .from('sessions')
      .delete()
      .or(`client_id.eq.${userId},therapist_id.eq.${userId}`);

    // Clean up therapist storage verification documents if any
    try {
      const { data: storageFiles } = await adminClient.storage
        .from('therapist-documents')
        .list(userId);
      if (storageFiles && storageFiles.length > 0) {
        await adminClient.storage
          .from('therapist-documents')
          .remove(storageFiles.map((f) => `${userId}/${f.name}`));
      }
    } catch {
      // Storage cleanup non-blocking
    }

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
      console.error('[admin/users/delete] Failed to delete from Supabase Auth:', authDeleteError);
      // Public profile is already deleted but the auth record remains — the user
      // could re-authenticate. Return a partial-failure response so the admin knows.
      return NextResponse.json(
        {
          success: false,
          partialDelete: true,
          message:
            'User profile data was deleted, but the authentication record could not be removed. ' +
            'The user cannot access their data but may still be able to sign in. ' +
            'Please delete them manually from the Supabase Auth dashboard.',
          deletedUserId: userId,
          authError: authDeleteError.message,
        },
        { status: 500 },
      );
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
