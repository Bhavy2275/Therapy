'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { IconHeart, IconClipboard } from '@/components/Icons';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const redirectTo = params.get('redirectTo') ?? '/dashboard';
  const roleParam = params.get('role');

  const [activePortal, setActivePortal] = useState<'client' | 'therapist'>(
    roleParam === 'therapist' ? 'therapist' : 'client',
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(params.get('error'));
  const [roleMismatch, setRoleMismatch] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [honeypot, setHoneypot] = useState('');

  const isClient = activePortal === 'client';

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

      // Check role strictly against the chosen portal
      const { data: userRow } = await supabase
        .from('users')
        .select('role')
        .eq('id', authData.user.id)
        .single();

      const userRole = userRow?.role;

      if (isClient && userRole === 'therapist') {
        await supabase.auth.signOut();
        setRoleMismatch(true);
        setError('This account is registered as a Therapist. Please sign in via the Therapist Portal.');
        setLoading(false);
        return;
      }

      if (!isClient && userRole === 'client') {
        await supabase.auth.signOut();
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

  function handleSwitchPortal(portal: 'client' | 'therapist') {
    setActivePortal(portal);
    setError(null);
    setRoleMismatch(false);
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
      <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <span style={{ fontSize: '1.45rem', fontWeight: 800, fontFamily: 'var(--font-body)' }}>
            <span className="gradient-text">Jarwis</span>{' '}
            <span style={{ color: 'hsl(var(--foreground))' }}>Help Me!</span>
          </span>
        </Link>
        <h1
          style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            marginTop: '1.25rem',
            marginBottom: '0.3rem',
            color: '#1e293b',
          }}
        >
          {isClient ? 'Client Sign In' : 'Therapist Sign In'}
        </h1>
        <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
          {isClient
            ? 'Sign in to request sessions and receive confidential support'
            : 'Sign in to access your clinical room, availability & patients'}
        </p>
      </div>

      {/* Role Portal Switcher Tabs */}
      <div
        style={{
          display: 'flex',
          background: '#f1f5f9',
          borderRadius: '0.65rem',
          padding: '0.25rem',
          marginBottom: '1.5rem',
          border: '1px solid #e2e8f0',
        }}
      >
        <button
          type="button"
          onClick={() => handleSwitchPortal('client')}
          style={{
            flex: 1,
            padding: '0.55rem',
            borderRadius: '0.45rem',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: 600,
            transition: 'all 0.2s',
            background: isClient ? 'hsl(var(--foreground))' : 'transparent',
            color: isClient ? 'hsl(var(--background))' : 'hsl(var(--muted-foreground))',
            boxShadow: isClient ? '0 2px 8px rgba(0,0,0,0.18)' : 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.35rem',
          }}
        >
          <IconHeart size={14} color={isClient ? '#ffffff' : '#64748b'} />
          <span>I need help</span>
        </button>

        <button
          type="button"
          onClick={() => handleSwitchPortal('therapist')}
          style={{
            flex: 1,
            padding: '0.55rem',
            borderRadius: '0.45rem',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: 600,
            transition: 'all 0.2s',
            background: !isClient ? 'hsl(var(--accent))' : 'transparent',
            color: !isClient ? 'hsl(var(--accent-foreground))' : 'hsl(var(--muted-foreground))',
            boxShadow: !isClient ? '0 2px 8px hsl(var(--accent) / 0.3)' : 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.35rem',
          }}
        >
          <IconClipboard size={14} color={!isClient ? '#ffffff' : '#64748b'} />
          <span>I&apos;m here to help</span>
        </button>
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
            htmlFor="login-email"
            style={{
              fontSize: '0.85rem',
              color: '#374151',
              display: 'block',
              marginBottom: '0.4rem',
              fontWeight: 600,
            }}
          >
            {isClient ? 'Email Address' : 'Professional Email'}
          </label>
          <input
            id="login-email"
            type="email"
            className={`input${error ? ' input-error' : ''}`}
            placeholder={isClient ? 'you@example.com' : 'therapist@example.com'}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>

        <div>
          <label
            htmlFor="login-password"
            style={{
              fontSize: '0.85rem',
              color: '#374151',
              display: 'block',
              marginBottom: '0.4rem',
              fontWeight: 600,
            }}
          >
            Password
          </label>
          <input
            id="login-password"
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
                <button
                  type="button"
                  onClick={() => handleSwitchPortal(isClient ? 'therapist' : 'client')}
                  className="btn-primary"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    fontSize: '0.8rem',
                    padding: '0.4rem 0.9rem',
                    background: isClient ? '#6366f1' : '#2563eb',
                    border: 'none',
                    borderRadius: '0.4rem',
                    cursor: 'pointer',
                  }}
                >
                  <span>Switch to {isClient ? 'Therapist Portal' : 'Client Portal'}</span>
                  <span>→</span>
                </button>
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
            background: isClient ? 'hsl(var(--foreground))' : 'hsl(var(--accent))',
            borderRadius: '0.5rem',
          }}
        >
          {loading ? <span className="spinner" style={{ width: 18, height: 18 }} /> : null}
          {loading
            ? 'Signing in…'
            : isClient
            ? 'Sign In as Client'
            : 'Sign In as Therapist'}
        </button>
      </form>

      {/* Switcher Footer */}
      <div
        style={{
          marginTop: '1.75rem',
          paddingTop: '1.25rem',
          borderTop: '1px solid #f1f5f9',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.6rem',
        }}
      >
        <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b' }}>
          Don&apos;t have an account?{' '}
          <Link
            href={isClient ? '/register?role=client' : '/register?role=therapist'}
            style={{
              color: isClient ? 'hsl(var(--accent))' : 'hsl(var(--accent))',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            {isClient ? 'Sign up to get help' : 'Apply as a therapist'}
          </Link>
        </p>

        <p style={{ margin: 0, fontSize: '0.825rem', color: '#64748b' }}>
          Direct portal links:{' '}
          <Link
            href="/login/client"
            style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}
          >
            Client Portal
          </Link>{' '}
          •{' '}
          <Link
            href="/login/therapist"
            style={{ color: '#6366f1', textDecoration: 'none', fontWeight: 600 }}
          >
            Therapist Portal
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
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
      <LoginForm />
    </Suspense>
  );
}
