'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getSiteUrl } from '@/lib/url';
import { IconShield, IconMail, IconCheck } from '@/components/Icons';

function VerifyForm() {
  const router = useRouter();
  const params = useSearchParams();
  const initialEmail = params.get('email') ?? '';

  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    if (!initialEmail && typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('pendingVerifyEmail');
      if (stored) {
        setEmail(stored);
        sessionStorage.removeItem('pendingVerifyEmail');
      }
    }
  }, [initialEmail]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    const cleanEmail = email.trim();
    const cleanCode = code.trim();

    if (!cleanEmail) {
      setError('Please enter your email address.');
      return;
    }
    if (!cleanCode) {
      setError('Please enter the verification code.');
      return;
    }

    setError(null);
    setLoading(true);

    const supabase = createClient();
    let { data, error: otpErr } = await supabase.auth.verifyOtp({
      email: cleanEmail,
      token: cleanCode,
      type: 'signup',
    });

    if (otpErr) {
      // Fallback to 'email' type if provider settings use standard email OTP
      const fallback = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token: cleanCode,
        type: 'email',
      });
      if (!fallback.error && fallback.data?.session) {
        data = fallback.data;
        otpErr = null;
      }
    }

    if (otpErr || !data?.session) {
      setError(otpErr?.message || 'Invalid or expired verification code. Please check and try again.');
      setLoading(false);
      return;
    }

    setVerified(true);
    setLoading(false);
    setTimeout(() => {
      router.push('/dashboard');
      router.refresh();
    }, 800);
  }

  async function handleResend() {
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError('Please enter your email address to receive a verification code.');
      return;
    }
    if (resendCooldown > 0 || resending) return;

    setResending(true);
    setError(null);
    setResendMessage(null);

    const supabase = createClient();
    const { error: resendErr } = await supabase.auth.resend({
      type: 'signup',
      email: cleanEmail,
      options: {
        emailRedirectTo: `${getSiteUrl()}/auth/callback`,
      },
    });

    setResending(false);
    if (resendErr) {
      setError(resendErr.message);
    } else {
      setResendMessage(`A new verification code has been sent to ${cleanEmail}.`);
      setResendCooldown(60);
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

        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'hsl(var(--secondary))',
            color: 'hsl(var(--accent))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '1.25rem auto 0.75rem',
          }}
        >
          <IconShield size={28} />
        </div>

        <h1
          style={{
            fontSize: '1.45rem',
            fontWeight: 700,
            marginBottom: '0.35rem',
            color: 'hsl(var(--foreground))',
          }}
        >
          Verify Your Email
        </h1>
        <p style={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.875rem' }}>
          Enter the 6-digit code sent to your email inbox
        </p>
      </div>

      {verified ? (
        <div
          style={{
            background: '#ecfdf5',
            border: '1px solid #6ee7b7',
            color: '#065f46',
            padding: '1.25rem',
            borderRadius: '0.75rem',
            textAlign: 'center',
            fontSize: '0.925rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
          }}
        >
          <IconCheck size={20} color="#059669" />
          <span>Email verified! Redirecting to dashboard...</span>
        </div>
      ) : (
        <form onSubmit={handleVerify} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {error && (
            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#991b1b',
                padding: '0.75rem',
                borderRadius: '0.5rem',
                fontSize: '0.85rem',
                lineHeight: 1.4,
              }}
            >
              {error}
            </div>
          )}

          {resendMessage && (
            <div
              style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                color: '#166534',
                padding: '0.75rem',
                borderRadius: '0.5rem',
                fontSize: '0.85rem',
                lineHeight: 1.4,
              }}
            >
              {resendMessage}
            </div>
          )}

          <div>
            <label
              htmlFor="verify-email"
              style={{
                display: 'block',
                fontSize: '0.825rem',
                fontWeight: 600,
                marginBottom: '0.35rem',
                color: 'hsl(var(--foreground))',
              }}
            >
              Email Address
            </label>
            <input
              id="verify-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem',
                borderRadius: '0.5rem',
                border: '1px solid hsl(var(--border))',
                background: 'hsl(var(--secondary))',
                color: 'hsl(var(--foreground))',
                fontSize: '0.9rem',
              }}
            />
          </div>

          <div>
            <label
              htmlFor="verify-code"
              style={{
                display: 'block',
                fontSize: '0.825rem',
                fontWeight: 600,
                marginBottom: '0.35rem',
                color: 'hsl(var(--foreground))',
              }}
            >
              Verification Code
            </label>
            <input
              id="verify-code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              required
              autoFocus
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                borderRadius: '0.65rem',
                border: '1px solid hsl(var(--border))',
                background: 'hsl(var(--secondary))',
                color: 'hsl(var(--foreground))',
                fontSize: '1.25rem',
                fontWeight: 700,
                textAlign: 'center',
                letterSpacing: '0.35em',
                fontFamily: 'monospace',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading || !email.trim() || code.trim().length !== 6}
            className="btn-accent"
            style={{
              width: '100%',
              padding: '0.75rem',
              borderRadius: '0.65rem',
              border: 'none',
              cursor: loading || !email.trim() || code.trim().length !== 6 ? 'not-allowed' : 'pointer',
              opacity: loading || !email.trim() || code.trim().length !== 6 ? 0.7 : 1,
              fontWeight: 600,
              fontSize: '0.925rem',
              marginTop: '0.25rem',
            }}
          >
            {loading ? 'Verifying...' : 'Verify Code & Sign In'}
          </button>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.825rem',
              marginTop: '0.25rem',
            }}
          >
            <button
              type="button"
              onClick={handleResend}
              disabled={resending || resendCooldown > 0 || !email.trim()}
              style={{
                background: 'none',
                border: 'none',
                color: resendCooldown > 0 || !email.trim() ? 'hsl(var(--muted-foreground))' : 'hsl(var(--accent))',
                cursor: resendCooldown > 0 || resending || !email.trim() ? 'not-allowed' : 'pointer',
                padding: 0,
                fontWeight: 600,
                textDecoration: resendCooldown > 0 ? 'none' : 'underline',
              }}
            >
              {resending
                ? 'Sending...'
                : resendCooldown > 0
                ? `Resend code in ${resendCooldown}s`
                : 'Resend verification code'}
            </button>
          </div>
        </form>
      )}

      {/* Footer links */}
      <div
        style={{
          marginTop: '1.75rem',
          textAlign: 'center',
          fontSize: '0.85rem',
          color: 'hsl(var(--muted-foreground))',
          borderTop: '1px solid hsl(var(--border))',
          paddingTop: '1rem',
        }}
      >
        <span>Already verified or need an account? </span>
        <div style={{ marginTop: '0.4rem', display: 'flex', justifyContent: 'center', gap: '1rem' }}>
          <Link href="/login" style={{ color: 'hsl(var(--accent))', fontWeight: 600, textDecoration: 'none' }}>
            Sign In
          </Link>
          <span style={{ color: 'hsl(var(--border))' }}>•</span>
          <Link href="/register" style={{ color: 'hsl(var(--accent))', fontWeight: 600, textDecoration: 'none' }}>
            Register
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="glass" style={{ width: '100%', maxWidth: 440, padding: '2.5rem', textAlign: 'center' }}>
          <p style={{ color: 'hsl(var(--muted-foreground))' }}>Loading verification...</p>
        </div>
      }
    >
      <VerifyForm />
    </Suspense>
  );
}
