'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { IconLock, IconCheck, IconAlertCircle } from '@/components/Icons';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasValidSession, setHasValidSession] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    async function checkAuth() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setHasValidSession(true);
        } else {
          setHasValidSession(false);
        }
      } catch {
        setHasValidSession(false);
      } finally {
        setCheckingSession(false);
      }
    }
    checkAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: string, session: unknown) => {
      if (event === 'PASSWORD_RECOVERY') {
        setHasValidSession(true);
        setCheckingSession(false);
      } else if (event === 'SIGNED_OUT' || !session) {
        setHasValidSession(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        setError(updateError.message);
        setLoading(false);
        return;
      }

      setSuccess(true);
      setLoading(false);
      // Wait 3 seconds and redirect to dashboard
      setTimeout(() => {
        router.push('/dashboard');
        router.refresh();
      }, 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update password.';
      setError(msg);
      setLoading(false);
    }
  }

  if (checkingSession) {
    return (
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
        <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto' }} />
      </div>
    );
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

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.25rem', marginBottom: '0.75rem' }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: 'hsl(var(--accent) / 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IconLock size={24} color="hsl(var(--accent))" />
          </div>
        </div>

        <h1
          style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            marginBottom: '0.35rem',
            color: 'hsl(var(--foreground))',
          }}
        >
          Create New Password
        </h1>
        <p style={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.875rem' }}>
          Choose a strong password with at least 8 characters.
        </p>
      </div>

      {!hasValidSession ? (
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '0.75rem',
              padding: '1.25rem',
              marginBottom: '1.5rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}>
              <IconAlertCircle size={28} color="#dc2626" />
            </div>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#991b1b', margin: '0 0 0.4rem 0' }}>
              Session Expired or Invalid Link
            </h3>
            <p style={{ fontSize: '0.875rem', color: '#b91c1c', margin: 0, lineHeight: 1.5 }}>
              Your password reset session could not be verified. Password reset links expire after single use or time limit.
            </p>
          </div>

          <Link
            href="/forgot-password"
            className="btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              padding: '0.75rem',
              fontSize: '0.95rem',
              fontWeight: 600,
              textDecoration: 'none',
              borderRadius: '0.5rem',
              background: 'hsl(var(--foreground))',
              color: 'hsl(var(--background))',
            }}
          >
            Request New Reset Link
          </Link>
        </div>
      ) : success ? (
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              borderRadius: '0.75rem',
              padding: '1.25rem',
              marginBottom: '1.5rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}>
              <IconCheck size={28} color="#059669" />
            </div>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#065f46', margin: '0 0 0.4rem 0' }}>
              Password Updated Successfully!
            </h3>
            <p style={{ fontSize: '0.875rem', color: '#047857', margin: 0, lineHeight: 1.5 }}>
              Your password has been changed. Redirecting to your dashboard…
            </p>
          </div>

          <Link
            href="/dashboard"
            className="btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              padding: '0.75rem',
              fontSize: '0.95rem',
              fontWeight: 600,
              textDecoration: 'none',
              borderRadius: '0.5rem',
              background: 'hsl(var(--foreground))',
              color: 'hsl(var(--background))',
            }}
          >
            Continue to Dashboard →
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label
              htmlFor="new-password"
              style={{
                fontSize: '0.85rem',
                color: 'hsl(var(--foreground))',
                display: 'block',
                marginBottom: '0.4rem',
                fontWeight: 600,
              }}
            >
              New Password
            </label>
            <input
              id="new-password"
              type="password"
              className={`input${error ? ' input-error' : ''}`}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoFocus
              autoComplete="new-password"
            />
          </div>

          <div>
            <label
              htmlFor="confirm-password"
              style={{
                fontSize: '0.85rem',
                color: 'hsl(var(--foreground))',
                display: 'block',
                marginBottom: '0.4rem',
                fontWeight: 600,
              }}
            >
              Confirm New Password
            </label>
            <input
              id="confirm-password"
              type="password"
              className={`input${error ? ' input-error' : ''}`}
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
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
            </div>
          )}

          <button
            type="submit"
            className="btn-primary"
            disabled={loading || !password || !confirmPassword}
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
            {loading ? 'Updating…' : 'Update Password'}
          </button>
        </form>
      )}
    </div>
  );
}
