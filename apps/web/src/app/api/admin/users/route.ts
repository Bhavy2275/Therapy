import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/users
 * Returns all users in the system with their role, email, full name, and profiles.
 * Only accessible by admins.
 */
export async function GET() {
  try {
    const serverClient = await createClient();
    const {
      data: { user },
      error: authError,
    } = await serverClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    let adminClient;
    try {
      adminClient = createAdminClient();
    } catch (envErr: unknown) {
      const msg = envErr instanceof Error ? envErr.message : String(envErr);
      console.error('[admin/users] Failed to create admin client (missing env vars?):', msg);
      return NextResponse.json({ error: `Server configuration error: ${msg}` }, { status: 500 });
    }

    // Verify admin role
    const { data: adminRow, error: roleError } = await adminClient
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (roleError) {
      console.error('[admin/users] Role lookup error:', roleError);
      return NextResponse.json(
        { error: `Role check failed: ${roleError.message}` },
        { status: 500 },
      );
    }

    if (adminRow?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admin access required.' }, { status: 403 });
    }

    // Fetch all users
    const { data: users, error: usersError } = await adminClient
      .from('users')
      .select('id, email, full_name, role, avatar_url, timezone, created_at')
      .order('created_at', { ascending: false });

    if (usersError) {
      console.error('[admin/users] Error fetching users:', usersError);
      return NextResponse.json(
        { error: `Failed to fetch users: ${usersError.message}` },
        { status: 500 },
      );
    }

    if (!users || users.length === 0) {
      return NextResponse.json({ success: true, users: [] });
    }

    // Fetch therapist profiles separately to avoid join issues
    const therapistIds = users.filter((u) => u.role === 'therapist').map((u) => u.id);

    let therapistProfileMap: Record<string, { status: string; license_number: string }> = {};
    if (therapistIds.length > 0) {
      const { data: profiles, error: profilesError } = await adminClient
        .from('therapist_profiles')
        .select('user_id, status, license_number')
        .in('user_id', therapistIds);

      if (profilesError) {
        console.error('[admin/users] Error fetching therapist profiles:', profilesError);
        // Non-fatal — continue without profile data
      } else {
        therapistProfileMap = Object.fromEntries(
          (profiles ?? []).map((p) => [p.user_id, p]),
        );
      }
    }

    const formatted = users.map((u) => ({
      id: u.id,
      email: u.email,
      fullName: u.full_name || 'Anonymous User',
      role: u.role,
      avatarUrl: u.avatar_url,
      timezone: u.timezone || 'UTC',
      createdAt: u.created_at,
      therapistStatus: therapistProfileMap[u.id]?.status ?? null,
      licenseNumber: therapistProfileMap[u.id]?.license_number ?? null,
    }));

    return NextResponse.json({ success: true, users: formatted });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[admin/users] Unexpected error:', err);
    return NextResponse.json({ error: `Server error: ${msg}` }, { status: 500 });
  }
}
