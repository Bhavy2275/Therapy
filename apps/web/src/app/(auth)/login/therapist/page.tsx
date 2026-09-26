'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient, resetClient } from '@/lib/supabase/client';
import { IconClipboard } from '@/components/Icons';

function safeRedirect(to: string | null): string {
  if (!to) return '/dashboard';
  if (to.startsWith('/') && !to.startsWith('//') && !to.startsWith('/\\')) {
    return to;
  }
  return '/dashboard';
}

function TherapistLoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const redirectTo = safeRedirect(params.get('redirectTo'));

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(params.get('error'));
  const [roleMismatch, setRoleMismatch] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [honeypot, setHoneypot] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (honeypot) return;

    setError(null);
    setRoleMismatch(false);
    setLoading(true);

    try {
      const supabase = createClient();
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError || !authData.user) {
        setError(authError?.message || 'Invalid email or password.');
        setLoading(false);
        return;
      }

      // Check role strictly: this portal is for therapists
      const { data: userRow, error: roleError } = await supabase
        .from('users')
        .select('role')
        .eq('id', authData.user.id)
        .single();

      // Guard: differentiate database connectivity errors from deleted profile (PGRST116)
      if (roleError && roleError.code !== 'PGRST116') {
        await supabase.auth.signOut();
        resetClient();
        setError('Unable to verify your account right now. Please try again.');
        setLoading(false);
        return;
      }

      if (!userRow) {
        await supabase.auth.signOut();
        resetClient();
        setError('This account no longer exists. Please contact support.');
        setLoading(false);
        return;
      }

      if (userRow?.role === 'client') {
        // Sign out immediately to preserve role separation
        await supabase.auth.signOut();
        resetClient();
        setRoleMismatch(true);
        setError('This account is registered as a Client seeking therapy. Please sign in via the Client Portal.');
        setLoading(false);
        return;
      }

      router.push(redirectTo);
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An error occurred during sign in.';
      setError(msg);
      setLoading(false);
    }
  }

  return (
    <div
      className="glass fade-in-up"
      style={{
        width: '100%',
        maxWidth: 440,
        borderRadius: '1.25rem',
        padding: '2.5rem',
        border: '1px solid hsl(var(--border))',
        background: 'hsl(var(--background))',
        boxShadow: '0 10px 40px rgba(0,0,0,0.08)',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: '1.75rem', textAlign: 'center' }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <span style={{ fontSize: '1.45rem', fontWeight: 800, fontFamily: 'var(--font-body)' }}>
            <span className="gradient-text">Jarwis</span>{' '}
            <span style={{ color: 'hsl(var(--foreground))' }}>Help Me!</span>
          </span>
        </Link>

        {/* Portal Identifier Badge */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              background: 'hsl(var(--secondary))',
              border: '1px solid hsl(var(--border))',
              color: 'hsl(var(--accent))',
              fontSize: '0.8rem',
              fontWeight: 600,
              padding: '0.3rem 0.85rem',
              borderRadius: '2rem',
            }}
          >
            <IconClipboard size={14} color="hsl(var(--accent))" />
            <span>Therapist Portal · I&apos;m Here to Help</span>
          </span>
        </div>

        <h1
          style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            marginTop: '1rem',
            marginBottom: '0.3rem',
            color: 'hsl(var(--foreground))',
          }}
        >
          Clinical Sign In
        </h1>
        <p style={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.875rem' }}>
          Manage your schedule, availability & consultations
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <input
          type="text"
          name="bot_field"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
          style={{ display: 'none', position: 'absolute', opacity: 0, zIndex: -1, pointerEvents: 'none' }}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
        />

        <div>
          <label
            htmlFor="therapist-email"
            style={{
              fontSize: '0.85rem',
              color: 'hsl(var(--foreground))',
              display: 'block',
              marginBottom: '0.4rem',
              fontWeight: 600,
            }}
          >
            Professional Email
          </label>
          <input
            id="therapist-email"
            type="email"
            className={`input${error ? ' input-error' : ''}`}
            placeholder="therapist@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <label
              htmlFor="therapist-password"
              style={{
                fontSize: '0.85rem',
                color: 'hsl(var(--foreground))',
                fontWeight: 600,
                margin: 0,
              }}
            >
              Password
            </label>
            <Link
              href="/forgot-password"
              style={{
                fontSize: '0.8rem',
                color: 'hsl(var(--accent))',
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              Forgot password?
            </Link>
          </div>
          <input
            id="therapist-password"
            type="password"
            className={`input${error ? ' input-error' : ''}`}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>

        {error && (
          <div
            style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '0.65rem',
              padding: '0.75rem 0.9rem',
              fontSize: '0.85rem',
              color: '#b91c1c',
              lineHeight: 1.5,
            }}
          >
            <p style={{ margin: 0 }}>{error}</p>
            {error.toLowerCase().includes('not confirmed') && (
              <div style={{ marginTop: '0.6rem' }}>
                <Link
                  href="/verify"
                  onClick={() => {
                    if (typeof window !== 'undefined' && email) {
                      sessionStorage.setItem('pendingVerifyEmail', email);
                    }
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    fontSize: '0.8rem',
                    padding: '0.4rem 0.9rem',
                    background: 'hsl(var(--accent))',
                    color: 'hsl(var(--accent-foreground))',
                    borderRadius: '0.4rem',
                    textDecoration: 'none',
                    fontWeight: 600,
                  }}
                >
                  <span>Enter verification code</span>
                  <span>→</span>
                </Link>
              </div>
            )}
            {roleMismatch && (
              <div style={{ marginTop: '0.6rem' }}>
                <Link
                  href="/login/client"
                  className="btn-primary"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    fontSize: '0.8rem',
                    padding: '0.4rem 0.9rem',
                    background: 'hsl(var(--foreground))',
                    color: 'hsl(var(--background))',
                    textDecoration: 'none',
                    borderRadius: '0.4rem',
                  }}
                >
                  <span>Go to Client Portal Login</span>
                  <span>→</span>
                </Link>
              </div>
            )}
          </div>
        )}

        <button
          type="submit"
          className="btn-primary"
          disabled={loading}
          style={{
            marginTop: '0.5rem',
            padding: '0.75rem',
            fontSize: '0.95rem',
            fontWeight: 600,
            background: 'hsl(var(--accent))',
            color: 'hsl(var(--accent-foreground))',
            borderRadius: '0.5rem',
          }}
        >
          {loading ? <span className="spinner" style={{ width: 18, height: 18 }} /> : null}
          {loading ? 'Signing in…' : 'Sign In as Therapist'}
        </button>
      </form>

      {/* Switcher to Client Login */}
      <div
        style={{
          marginTop: '1.75rem',
          paddingTop: '1.25rem',
          borderTop: '1px solid hsl(var(--border))',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.6rem',
        }}
      >
        <p style={{ margin: 0, fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))' }}>
          New practitioner?{' '}
          <Link
            href="/register?role=therapist"
            style={{ color: 'hsl(var(--accent))', textDecoration: 'none', fontWeight: 600 }}
          >
            Apply to join our network
          </Link>
        </p>

        <p style={{ margin: 0, fontSize: '0.825rem', color: 'hsl(var(--muted-foreground))' }}>
          Looking for therapy?{' '}
          <Link
            href="/login/client"
            style={{ color: 'hsl(var(--accent))', textDecoration: 'none', fontWeight: 600 }}
          >
            Sign in to Client Portal →
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function TherapistLoginPage() {
  return (
    <Suspense
      fallback={
        <div
          className="glass"
          style={{
            width: '100%',
            maxWidth: 440,
            borderRadius: '1.25rem',
            padding: '4rem 2rem',
            textAlign: 'center',
          }}
        >
          <div className="spinner" style={{ width: 32, height: 32 }} />
        </div>
      }
    >
      <TherapistLoginForm />
    </Suspense>
  );
}
