import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

async function performLogout(request: Request) {
  const cookieStore = await cookies();
  const supabase = await createClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.access_token) {
          const adminClient = createAdminClient();
          await adminClient.auth.admin.signOut(session.access_token, 'global');
        }
      } catch (adminErr) {
        console.warn('[logout] Admin global signOut warning:', adminErr);
      }
    }
  } catch {
    // Continue with client signOut even if getUser/admin signOut fails
  }

  try {
    await supabase.auth.signOut();
  } catch {
    // Continue with clearing cookies even if signOut fails
  }

  const url = new URL('/login', request.url);
  const response = NextResponse.redirect(url, { status: 303 });

  // Explicitly clear all supabase auth cookies on the outgoing response
  const allCookies = cookieStore.getAll();
  for (const cookie of allCookies) {
    if (
      cookie.name.startsWith('sb-') ||
      cookie.name.includes('supabase') ||
      cookie.name.includes('auth')
    ) {
      response.cookies.set(cookie.name, '', {
        path: '/',
        maxAge: 0,
        expires: new Date(0),
      });
      try {
        cookieStore.delete(cookie.name);
      } catch {
        // ignore
      }
    }
  }

  // Prevent browser caching the logout response or back-navigation
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');

  return response;
}

export async function POST(request: Request) {
  return performLogout(request);
}
