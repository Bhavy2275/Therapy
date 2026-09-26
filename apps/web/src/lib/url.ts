/**
 * Canonical Site URL resolver for authentication redirects, verification links,
 * and password recovery emails.
 *
 * Priority order:
 * 1. Explicit production URL via NEXT_PUBLIC_SITE_URL or NEXT_PUBLIC_APP_URL
 * 2. Vercel system production domain via NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL
 * 3. Vercel deployment domain via NEXT_PUBLIC_VERCEL_URL
 * 4. Client-side browser origin (window.location.origin)
 * 5. Default development fallback (http://localhost:3000)
 */
export function getSiteUrl(): string {
  let url =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL}`
      : undefined) ||
    (process.env.NEXT_PUBLIC_VERCEL_URL
      ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
      : undefined) ||
    (typeof window !== 'undefined' && window.location.origin
      ? window.location.origin
      : undefined) ||
    'http://localhost:3000';

  // Ensure protocol is present
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }

  // Strip trailing slashes
  return url.replace(/\/+$/, '');
}
