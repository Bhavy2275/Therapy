'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const redirectTo = params.get('redirectTo') ?? '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [honeypot, setHoneypot] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (honeypot) {
      // Silent discard for automated bot submissions
      return;
    }
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    router.push(redirectTo);
    router.refresh();
  }

  return (
    <div className="glass fade-in-up" style={{
      width: '100%', maxWidth: 420, borderRadius: '1.25rem', padding: '2.5rem',
    }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <span style={{ fontSize: '1.5rem', fontWeight: 800 }}>
            <span className="gradient-text">Jarwis</span>{' '}
            <span style={{ color: '#1e293b' }}>Help Me!</span>
          </span>
        </Link>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '1.25rem', marginBottom: '0.35rem', color: '#1e293b' }}>
          Welcome back
        </h1>
        <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Sign in to your account</p>
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
          <label htmlFor="login-email" style={{ fontSize: '0.85rem', color: '#64748b', display: 'block', marginBottom: '0.4rem', fontWeight: 500 }}>
            Email
          </label>
          <input
            id="login-email"
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
          <label htmlFor="login-password" style={{ fontSize: '0.85rem', color: '#64748b', display: 'block', marginBottom: '0.4rem', fontWeight: 500 }}>
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
          <div style={{
            background: 'rgba(159, 18, 57, 0.08)', border: '1px solid rgba(159, 18, 57, 0.25)',
            borderRadius: '0.5rem', padding: '0.65rem 0.9rem',
            fontSize: '0.85rem', color: '#9f1239', fontWeight: 500,
          }}>
            {error}
          </div>
        )}

        <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: '0.5rem' }}>
          {loading ? <span className="spinner" /> : null}
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>

      <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.875rem', color: '#64748b' }}>
        Don&apos;t have an account?{' '}
        <Link href="/register" style={{ color: '#3b82f6', textDecoration: 'none', fontWeight: 600 }}>
          Sign up
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="glass" style={{ width: '100%', maxWidth: 420, borderRadius: '1.25rem', padding: '4rem 2rem', textAlign: 'center' }}>
        <div className="spinner" style={{ width: 32, height: 32 }} />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
