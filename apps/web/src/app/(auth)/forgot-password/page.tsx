'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { IconKey, IconCheck } from '@/components/Icons';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const origin = window.location.origin;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${origin}/auth/callback?next=/reset-password`,
      });

      if (resetError) {
        setError(resetError.message);
        setLoading(false);
        return;
      }

      setSubmitted(true);
      setLoading(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred.';
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
            <IconKey size={24} color="hsl(var(--accent))" />
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
          Reset Password
        </h1>
        <p style={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.875rem', lineHeight: 1.5 }}>
          Enter your registered email address and we&apos;ll send you a link to reset your password.
        </p>
      </div>

      {submitted ? (
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
              Check your inbox
            </h3>
            <p style={{ fontSize: '0.875rem', color: '#047857', margin: 0, lineHeight: 1.5 }}>
              If an account is associated with <strong>{email}</strong>, you will receive an email shortly with instructions to reset your password.
            </p>
          </div>

          <Link
            href="/login"
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
            Back to Sign In
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label
              htmlFor="reset-email"
              style={{
                fontSize: '0.85rem',
                color: 'hsl(var(--foreground))',
                display: 'block',
                marginBottom: '0.4rem',
                fontWeight: 600,
              }}
            >
              Account Email
            </label>
            <input
              id="reset-email"
              type="email"
              className={`input${error ? ' input-error' : ''}`}
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              autoComplete="email"
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
            disabled={loading || !email.trim()}
            style={{
              padding: '0.75rem',
              fontSize: '0.95rem',
              fontWeight: 600,
              background: 'hsl(var(--foreground))',
              color: 'hsl(var(--background))',
              borderRadius: '0.5rem',
            }}
          >
            {loading ? <span className="spinner" style={{ width: 18, height: 18 }} /> : null}
            {loading ? 'Sending link…' : 'Send Reset Link'}
          </button>

          <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
            <Link
              href="/login"
              style={{
                fontSize: '0.85rem',
                color: 'hsl(var(--muted-foreground))',
                textDecoration: 'none',
                fontWeight: 500,
              }}
            >
              ← Back to Sign In
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}
