'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import SignOutButton from '@/components/SignOutButton';
import {
  IconSettings,
  IconUser,
  IconGlobe,
  IconCheck,
  IconAlertCircle,
  IconArrowLeft,
} from '@/components/Icons';

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

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setEmail(user.email ?? '');

      const { data: row } = await supabase
        .from('users')
        .select('full_name, timezone, role')
        .eq('id', user.id)
        .single();

      if (row) {
        setFullName(row.full_name ?? '');
        setTimezone(row.timezone ?? 'UTC');
        setRole(row.role ?? 'client');
      }
      setLoading(false);
    }
    load();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess(false);

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const res = await fetch(`${API_BASE}/api/v1/users/me`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ fullName, timezone }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? 'Failed to save');
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'hsl(var(--background))' }}>
        <div className="spinner" style={{ width: 36, height: 36 }} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'hsl(var(--secondary))' }}>
      {/* Nav */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        borderBottom: '1px solid hsl(var(--border))',
        background: 'hsl(var(--background) / 0.95)',
        backdropFilter: 'blur(16px)',
      }}>
        <div style={{ maxWidth: 820, margin: '0 auto', padding: '0 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '4rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Link
              href="/dashboard"
              className="btn-ghost"
              style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <IconArrowLeft size={15} />
              Dashboard
            </Link>
            <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <IconSettings size={18} color="#3b82f6" />
              Account Settings
            </span>
          </div>
        </div>
      </nav>

      <main style={{ maxWidth: 820, margin: '0 auto', padding: '2.5rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* Success / Error banners */}
        {success && (
          <div className="fade-in-up" style={{
            background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
            borderRadius: '0.75rem', padding: '0.85rem 1.25rem',
            display: 'flex', alignItems: 'center', gap: '0.65rem', color: '#047857',
          }}>
            <IconCheck size={18} color="#10b981" />
            <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Changes saved successfully.</span>
          </div>
        )}
        {error && (
          <div className="fade-in-up" style={{
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
            borderRadius: '0.75rem', padding: '0.85rem 1.25rem',
            display: 'flex', alignItems: 'center', gap: '0.65rem', color: '#dc2626',
          }}>
            <IconAlertCircle size={18} color="#ef4444" />
            <span style={{ fontSize: '0.9rem' }}>{error}</span>
          </div>
        )}

        {/* Profile Card */}
        <form onSubmit={handleSave}>
          <div className="glass fade-in-up" style={{ borderRadius: '1rem', padding: '2rem' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#1e293b' }}>
              <IconUser size={18} color="#3b82f6" />
              Profile Information
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>
              {/* Full Name */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: '#64748b', marginBottom: '0.4rem' }}>
                  Full Name
                </label>
                <input
                  type="text"
                  className="input"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your display name"
                  required
                />
              </div>

              {/* Email (read-only) */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: '#64748b', marginBottom: '0.4rem' }}>
                  Email Address
                </label>
                <input
                  type="email"
                  className="input"
                  value={email}
                  disabled
                  style={{ opacity: 0.6, cursor: 'not-allowed' }}
                />
                <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.3rem' }}>
                  Email cannot be changed here.
                </p>
              </div>
            </div>

            {/* Timezone */}
            <div style={{ marginBottom: '1.75rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 500, color: '#64748b', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <IconGlobe size={14} color="#64748b" />
                Timezone
              </label>
              <select
                className="input"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                style={{ cursor: 'pointer' }}
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </div>

            {/* Role badge (display only) */}
            <div style={{ marginBottom: '1.75rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: '#64748b', marginBottom: '0.4rem' }}>
                Account Role
              </label>
              <span style={{
                display: 'inline-block',
                background: 'rgba(59,130,246,0.1)', color: '#1d4ed8',
                border: '1px solid rgba(59,130,246,0.25)',
                borderRadius: '0.45rem', padding: '0.25rem 0.75rem',
                fontSize: '0.85rem', fontWeight: 600, textTransform: 'capitalize',
              }}>
                {role}
              </span>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.3rem' }}>
                Role cannot be changed after registration.
              </p>
            </div>

            <button
              type="submit"
              className="btn-primary"
              disabled={saving}
              style={{ padding: '0.65rem 1.75rem', fontWeight: 600 }}
            >
              {saving ? (
                <><div className="spinner" style={{ width: 14, height: 14, marginRight: '0.5rem' }} />Saving...</>
              ) : (
                <><IconCheck size={15} style={{ marginRight: '0.4rem', verticalAlign: 'middle' }} />Save Changes</>
              )}
            </button>
          </div>
        </form>

        {/* Sign Out Card */}
        <div className="glass fade-in-up" style={{ borderRadius: '1rem', padding: '1.75rem', borderColor: '#fca5a5' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem', color: '#1e293b' }}>
            Sign Out
          </h2>
          <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '1.25rem' }}>
            You will be signed out of your account on this device.
          </p>
          <SignOutButton
            className="btn-ghost"
            style={{ padding: '0.6rem 1.5rem', color: '#dc2626', borderColor: '#fca5a5' }}
          >
            Sign Out
          </SignOutButton>
        </div>

      </main>
    </div>
  );
}
