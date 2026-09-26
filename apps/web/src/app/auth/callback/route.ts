import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { EmailOtpType } from '@supabase/supabase-js';

const VALID_OTP_TYPES: readonly EmailOtpType[] = [
  'signup',
  'recovery',
  'invite',
  'magiclink',
  'email',
];

function sanitizeRedirect(nextParam: string | null): string {
  if (!nextParam) return '/dashboard';
  // Enforce relative path and prevent protocol-relative (//evil.com) or backslash evasion
  if (nextParam.startsWith('/') && !nextParam.startsWith('//') && !nextParam.startsWith('/\\')) {
    return nextParam;
  }
  return '/dashboard';
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = sanitizeRedirect(requestUrl.searchParams.get('next'));
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
  const rawType = requestUrl.searchParams.get('type');

  if (code || (tokenHash && rawType)) {
    // Validate OTP type if token_hash is present
    if (tokenHash && rawType && !VALID_OTP_TYPES.includes(rawType as EmailOtpType)) {
      return NextResponse.redirect(`${origin}/login?error=invalid_token_type`);
    }

    const cookieStore = await cookies();
    const redirectResponse = NextResponse.redirect(`${origin}${next}`);
    redirectResponse.headers.set(
      'Cache-Control',
      'no-store, no-cache, must-revalidate, proxy-revalidate',
    );

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              try {
                cookieStore.set(name, value, options);
              } catch {
                // Ignore in read-only environment
              }
              redirectResponse.cookies.set(name, value, options);
            });
          },
        },
      },
    );

    let authError = null;
    if (tokenHash && rawType) {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: rawType as EmailOtpType,
      });
      authError = error;
    } else if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      authError = error;
    }

    if (!authError) {
      // Ensure all current session cookies are mirrored to outgoing redirect response
      cookieStore.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
      });
      return redirectResponse;
    }

    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(authError.message)}`,
    );
  }

  // No code provided; redirect to login
  return NextResponse.redirect(`${origin}/login`);
}
