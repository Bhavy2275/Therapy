'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { IconHeart } from '@/components/Icons';

function ClientLoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const redirectTo = params.get('redirectTo') ?? '/dashboard';

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

      // Check role strictly: this portal is for clients
      const { data: userRow } = await supabase
        .from('users')
        .select('role')
        .eq('id', authData.user.id)
        .single();

      if (userRow?.role === 'therapist') {
        // Sign out immediately to preserve role separation
        await supabase.auth.signOut();
        setRoleMismatch(true);
        setError('This account is registered as a Therapist. Please sign in via the Therapist Portal.');
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
              color: 'hsl(var(--foreground))',
              fontSize: '0.8rem',
              fontWeight: 600,
              padding: '0.3rem 0.85rem',
              borderRadius: '2rem',
            }}
          >
            <IconHeart size={14} color="hsl(var(--accent))" />
            <span>Client Portal · I Need Help</span>
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
          Welcome Back
        </h1>
        <p style={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.875rem' }}>
          Sign in to connect with therapists and access sessions
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
            htmlFor="client-email"
            style={{
              fontSize: '0.85rem',
              color: 'hsl(var(--foreground))',
              display: 'block',
              marginBottom: '0.4rem',
              fontWeight: 600,
            }}
          >
            Email Address
          </label>
          <input
            id="client-email"
            type="email"
            className={`input${error ? ' input-error' : ''}`}
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>

        <div>
          <label
            htmlFor="client-password"
            style={{
              fontSize: '0.85rem',
              color: 'hsl(var(--foreground))',
              display: 'block',
              marginBottom: '0.4rem',
              fontWeight: 600,
            }}
          >
            Password
          </label>
          <input
            id="client-password"
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
            {roleMismatch && (
              <div style={{ marginTop: '0.6rem' }}>
                <Link
                  href="/login/therapist"
                  className="btn-primary"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    fontSize: '0.8rem',
                    padding: '0.4rem 0.9rem',
                    background: 'hsl(var(--accent))',
                    textDecoration: 'none',
                    borderRadius: '0.4rem',
                  }}
                >
                  <span>Go to Therapist Portal Login</span>
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
            background: 'hsl(var(--foreground))',
            color: 'hsl(var(--background))',
            borderRadius: '0.5rem',
          }}
        >
          {loading ? <span className="spinner" style={{ width: 18, height: 18 }} /> : null}
          {loading ? 'Signing in…' : 'Sign In as Client'}
        </button>
      </form>

      {/* Switcher to Therapist Login */}
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
          Don&apos;t have an account?{' '}
          <Link
            href="/register?role=client"
            style={{ color: 'hsl(var(--accent))', textDecoration: 'none', fontWeight: 600 }}
          >
            Sign up to get help
          </Link>
        </p>

        <p style={{ margin: 0, fontSize: '0.825rem', color: 'hsl(var(--muted-foreground))' }}>
          Are you a therapist?{' '}
          <Link
            href="/login/therapist"
            style={{ color: 'hsl(var(--accent))', textDecoration: 'none', fontWeight: 600 }}
          >
            Sign in to Therapist Portal →
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function ClientLoginPage() {
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
      <ClientLoginForm />
    </Suspense>
  );
}
