import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Supabase auth middleware — refreshes expired sessions and protects routes.
 *
 * CRITICAL: All redirects MUST copy cookies from supabaseResponse so that
 * refreshed session tokens are never lost mid-flight.
 *
 * Protected route groups:
 *   /dashboard/**  — client/therapist dashboard
 *   /admin/**      — admin only
 */
export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refresh session — MUST be called before any redirects
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  /**
   * Helper: create a redirect response that inherits all session cookies
   * from supabaseResponse so token refreshes aren't lost.
   */
  function redirectWithCookies(url: string | URL): NextResponse {
    const redirectResponse = NextResponse.redirect(url);
    // Copy every cookie that supabase set (e.g. refreshed tokens)
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
    });
    redirectResponse.headers.set(
      'Cache-Control',
      'no-store, no-cache, must-revalidate, proxy-revalidate',
    );
    redirectResponse.headers.set('Pragma', 'no-cache');
    redirectResponse.headers.set('Expires', '0');
    return redirectResponse;
  }

  // ── Protect /dashboard and /admin routes ─────────────────────────────────
  if (
    (pathname.startsWith('/dashboard') || pathname.startsWith('/admin')) &&
    !user
  ) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirectTo', pathname);
    return redirectWithCookies(url);
  }

  // ── Admin-only guard ──────────────────────────────────────────────────────
  if (pathname.startsWith('/admin') && user) {
    const { data: userRow } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userRow?.role !== 'admin') {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      return redirectWithCookies(url);
    }
  }

  // ── Redirect logged-in users away from auth pages ─────────────────────────
  if ((pathname.startsWith('/login') || pathname.startsWith('/register')) && user) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return redirectWithCookies(url);
  }

  // ── Prevent browser caching for authenticated protected routes ────────────
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/admin')) {
    supabaseResponse.headers.set(
      'Cache-Control',
      'no-store, no-cache, must-revalidate, proxy-revalidate',
    );
    supabaseResponse.headers.set('Pragma', 'no-cache');
    supabaseResponse.headers.set('Expires', '0');
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
