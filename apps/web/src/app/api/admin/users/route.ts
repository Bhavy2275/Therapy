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

    const adminClient = createAdminClient();

    // Verify admin role
    const { data: adminRow, error: roleError } = await adminClient
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (roleError || adminRow?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admin access required.' }, { status: 403 });
    }

    // Fetch all users with therapist profile status
    const { data: users, error: usersError } = await adminClient
      .from('users')
      .select(`
        id,
        email,
        full_name,
        role,
        avatar_url,
        timezone,
        created_at,
        therapist_profiles(status, license_number, specializations)
      `)
      .order('created_at', { ascending: false });

    if (usersError) {
      console.error('[admin/users] Error fetching users:', usersError);
      return NextResponse.json({ error: usersError.message }, { status: 500 });
    }

    const formatted = (users || []).map((u: any) => {
      const therapistProfile = Array.isArray(u.therapist_profiles)
        ? u.therapist_profiles[0]
        : u.therapist_profiles;

      return {
        id: u.id,
        email: u.email,
        fullName: u.full_name || 'Anonymous User',
        role: u.role,
        avatarUrl: u.avatar_url,
        timezone: u.timezone || 'UTC',
        createdAt: u.created_at,
        therapistStatus: therapistProfile?.status ?? null,
        licenseNumber: therapistProfile?.license_number ?? null,
      };
    });

    return NextResponse.json({ success: true, users: formatted });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[admin/users] Unexpected error:', err);
    return NextResponse.json({ error: `Server error: ${msg}` }, { status: 500 });
  }
}
