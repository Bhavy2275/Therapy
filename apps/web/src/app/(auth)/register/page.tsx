'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { IconUser, IconClipboard, IconHeart, IconShield } from '@/components/Icons';

const TIMEZONES = [
  'Asia/Kolkata',
  'America/New_York',
  'America/Los_Angeles',
  'America/Chicago',
  'Europe/London',
  'Europe/Paris',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
  'UTC',
];

type Role = 'client' | 'therapist';
type TherapistType = 'volunteer' | 'certified';

function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();

  const [role, setRole] = useState<Role>((params.get('role') as Role) ?? 'client');
  const [therapistType, setTherapistType] = useState<TherapistType>('certified');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [honeypot, setHoneypot] = useState('');

  useEffect(() => {
    // Try to detect user timezone
    try {
      setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    } catch {}
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (honeypot) {
      // Silent discard for automated bot submissions
      return;
    }
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const metadata: Record<string, string> = { full_name: fullName, role, timezone };
    if (role === 'therapist') {
      metadata.therapist_type = therapistType;
    }
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    // Supabase sends a confirmation email by default.
    // Show success state; redirect after confirmation.
    setSuccess(true);
    setLoading(false);
  }

  if (success) {
    return (
      <div className="glass fade-in-up" style={{ width: '100%', maxWidth: 420, borderRadius: '1.25rem', padding: '2.5rem', textAlign: 'center' }}>
        <div style={{ marginBottom: '1rem', color: '#3b82f6' }}><IconUser size={44} /></div>
        <h1 style={{ fontSize: '1.35rem', fontWeight: 700, marginBottom: '0.5rem' }}>Check your email</h1>
        <p style={{ color: '#9ca3af', fontSize: '0.9rem', lineHeight: 1.6 }}>
          We sent a confirmation link to <strong style={{ color: '#f9fafb' }}>{email}</strong>.
          Click it to activate your account.
        </p>
        <Link href="/login" className="btn-ghost" style={{ display: 'block', textAlign: 'center', marginTop: '1.5rem', textDecoration: 'none' }}>
          Back to Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="glass fade-in-up" style={{ width: '100%', maxWidth: 460, borderRadius: '1.25rem', padding: '2.5rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.75rem', textAlign: 'center' }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <span style={{ fontSize: '1.5rem', fontWeight: 800 }}>
            <span className="gradient-text">Jarwis</span>{' '}
            <span style={{ color: '#1e293b' }}>Help Me!</span>
          </span>
        </Link>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '1.25rem', marginBottom: '0.35rem', color: '#1e293b' }}>
          Create your account
        </h1>
        <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Join Jarwis Help Me! — it&apos;s free</p>
      </div>

      {/* Role toggle */}
      <div style={{
        display: 'flex', background: '#f1f5f9',
        borderRadius: '0.65rem', padding: '0.25rem', marginBottom: '1.25rem',
        border: '1px solid #e2e8f0',
      }}>
        {(['client', 'therapist'] as const).map((r) => (
          <button
            key={r}
            type="button"
            id={`role-${r}`}
            onClick={() => setRole(r)}
            style={{
              flex: 1, padding: '0.55rem', borderRadius: '0.45rem',
              border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600,
              transition: 'all 0.2s',
              background: role === r
                ? '#3b82f6'
                : 'transparent',
              color: role === r ? '#ffffff' : '#64748b',
              boxShadow: role === r ? '0 2px 8px rgba(59, 130, 246, 0.25)' : 'none',
            }}
          >
            {r === 'client'
              ? <><IconHeart size={14} style={{ verticalAlign: 'middle', marginRight: '0.3rem' }} />I need help</>
              : <><IconClipboard size={14} style={{ verticalAlign: 'middle', marginRight: '0.3rem' }} />I&apos;m here to help</>
            }
          </button>
        ))}
      </div>

      {/* Therapist type sub-selection */}
      {role === 'therapist' && (
        <div style={{ marginBottom: '1.25rem' }}>
          <p style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600, marginBottom: '0.6rem', letterSpacing: '0.02em' }}>
            How are you joining?
          </p>
          <div style={{ display: 'flex', gap: '0.65rem' }}>
            {/* Volunteer card */}
            <button
              type="button"
              id="therapist-type-volunteer"
              onClick={() => setTherapistType('volunteer')}
              style={{
                flex: 1,
                padding: '0.85rem 0.7rem',
                borderRadius: '0.65rem',
                border: `2px solid ${therapistType === 'volunteer' ? '#3b82f6' : '#e2e8f0'}`,
                cursor: 'pointer',
                textAlign: 'center',
                background: therapistType === 'volunteer' ? 'rgba(59, 130, 246, 0.07)' : '#f8fafc',
                transition: 'all 0.2s',
                boxShadow: therapistType === 'volunteer' ? '0 0 0 3px rgba(59,130,246,0.12)' : 'none',
              }}
            >
              <IconHeart
                size={22}
                color={therapistType === 'volunteer' ? '#3b82f6' : '#94a3b8'}
                style={{ display: 'block', margin: '0 auto 0.4rem' }}
              />
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: therapistType === 'volunteer' ? '#1e40af' : '#475569', display: 'block' }}>
                Volunteer
              </span>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8', lineHeight: 1.4, display: 'block', marginTop: '0.2rem' }}>
                Offer free support
              </span>
            </button>

            {/* Certified card */}
            <button
              type="button"
              id="therapist-type-certified"
              onClick={() => setTherapistType('certified')}
              style={{
                flex: 1,
                padding: '0.85rem 0.7rem',
                borderRadius: '0.65rem',
                border: `2px solid ${therapistType === 'certified' ? '#3b82f6' : '#e2e8f0'}`,
                cursor: 'pointer',
                textAlign: 'center',
                background: therapistType === 'certified' ? 'rgba(59, 130, 246, 0.07)' : '#f8fafc',
                transition: 'all 0.2s',
                boxShadow: therapistType === 'certified' ? '0 0 0 3px rgba(59,130,246,0.12)' : 'none',
              }}
            >
              <IconShield
                size={22}
                color={therapistType === 'certified' ? '#3b82f6' : '#94a3b8'}
                style={{ display: 'block', margin: '0 auto 0.4rem' }}
              />
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: therapistType === 'certified' ? '#1e40af' : '#475569', display: 'block' }}>
                I&apos;m Certified
              </span>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8', lineHeight: 1.4, display: 'block', marginTop: '0.2rem' }}>
                Licensed professional
              </span>
            </button>
          </div>
        </div>
      )}

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
          <label htmlFor="reg-name" style={{ fontSize: '0.85rem', color: '#64748b', display: 'block', marginBottom: '0.4rem', fontWeight: 500 }}>
            Full Name
          </label>
          <input
            id="reg-name"
            type="text"
            className="input"
            placeholder="Jane Doe"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            autoComplete="name"
          />
        </div>

        <div>
          <label htmlFor="reg-email" style={{ fontSize: '0.85rem', color: '#64748b', display: 'block', marginBottom: '0.4rem', fontWeight: 500 }}>
            Email
          </label>
          <input
            id="reg-email"
            type="email"
            className="input"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>

        <div>
          <label htmlFor="reg-password" style={{ fontSize: '0.85rem', color: '#64748b', display: 'block', marginBottom: '0.4rem', fontWeight: 500 }}>
            Password
          </label>
          <input
            id="reg-password"
            type="password"
            className="input"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>

        <div>
          <label htmlFor="reg-timezone" style={{ fontSize: '0.85rem', color: '#64748b', display: 'block', marginBottom: '0.4rem', fontWeight: 500 }}>
            Timezone
          </label>
          <select
            id="reg-timezone"
            className="input"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            style={{ appearance: 'none' }}
          >
            {TIMEZONES.includes(timezone)
              ? null
              : <option value={timezone}>{timezone}</option>}
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
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

        {role === 'therapist' && therapistType === 'certified' && (
          <div style={{
            background: 'rgba(132, 169, 140, 0.14)', border: '1px solid rgba(132, 169, 140, 0.35)',
            borderRadius: '0.5rem', padding: '0.65rem 0.9rem', fontSize: '0.82rem', color: '#2d5a3c',
          }}>
            🎓 Certified therapist accounts require license verification before going live. You&apos;ll complete your profile after registration.
          </div>
        )}

        {role === 'therapist' && therapistType === 'volunteer' && (
          <div style={{
            background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.25)',
            borderRadius: '0.5rem', padding: '0.65rem 0.9rem', fontSize: '0.82rem', color: '#1e40af',
          }}>
            💙 Volunteers provide free emotional support. Your profile will be reviewed by our team before you go live.
          </div>
        )}

        <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: '0.5rem' }}>
          {loading ? <span className="spinner" /> : null}
          {loading ? 'Creating account…' : 'Create Account'}
        </button>
      </form>

      <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.875rem', color: '#64748b' }}>
        Already have an account?{' '}
        <Link href="/login" style={{ color: '#3b82f6', textDecoration: 'none', fontWeight: 600 }}>
          Sign in
        </Link>
      </p>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="glass" style={{ width: '100%', maxWidth: 460, borderRadius: '1.25rem', padding: '4rem 2rem', textAlign: 'center' }}>
        <div className="spinner" style={{ width: 32, height: 32 }} />
      </div>
    }>
      <RegisterForm />
    </Suspense>
  );
}
