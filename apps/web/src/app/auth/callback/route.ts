import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') ?? '/dashboard';
  const errorParam = requestUrl.searchParams.get('error_description') || requestUrl.searchParams.get('error');

  const forwardedHost = request.headers.get('x-forwarded-host');
  const origin = forwardedHost
    ? `${requestUrl.protocol}//${forwardedHost}`
    : requestUrl.origin;

  if (errorParam) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(errorParam)}`,
    );
  }

  const tokenHash = requestUrl.searchParams.get('token_hash');
  const type = requestUrl.searchParams.get('type');

  if (code || (tokenHash && type)) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options),
              );
            } catch {
              // Ignore if called in read-only environment
            }
          },
        },
      },
    );

    let authError = null;
    if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type as any,
      });
      authError = error;
    } else if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      authError = error;
    }

    if (!authError) {
      const response = NextResponse.redirect(`${origin}${next}`);
      response.headers.set(
        'Cache-Control',
        'no-store, no-cache, must-revalidate, proxy-revalidate',
      );
      return response;
    }

    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(authError.message)}`,
    );
  }

  // No code provided; redirect to login
  return NextResponse.redirect(`${origin}/login`);
}
