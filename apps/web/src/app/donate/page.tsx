'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  IconHeart,
  IconGift,
  IconShield,
  IconCheck,
  IconBolt,
  IconUser,
} from '@/components/Icons';

interface DonationStats {
  totalRaisedUsd: number;
  totalDonors: number;
  sessionsSponsored: number;
}

const PRESET_TIERS = [
  {
    amount: 5,
    title: 'A Safe Moment',
    desc: 'Covers live WebSocket routing and encrypted rooms for someone seeking guidance.',
  },
  {
    amount: 15,
    title: 'Community Care',
    desc: 'Supports high-availability matchmaking for 3 individuals in immediate distress.',
  },
  {
    amount: 25,
    title: 'Angel Sponsor',
    desc: 'Subsidizes an urgent on-demand video session for someone unable to afford care.',
  },
  {
    amount: 50,
    title: 'Sustaining Guardian',
    desc: 'Completely funds a 45-minute scheduled consultation with a verified therapist.',
  },
];

export default function DonatePage() {
  const [selectedAmount, setSelectedAmount] = useState<number>(25);
  const [isCustom, setIsCustom] = useState<boolean>(false);
  const [customAmount, setCustomAmount] = useState<string>('30');
  const [donorMessage, setDonorMessage] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<DonationStats>({
    totalRaisedUsd: 1250,
    totalDonors: 42,
    sessionsSponsored: 25,
  });

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    fetch(`${apiUrl}/api/v1/donations/stats`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setStats(data);
      })
      .catch(() => {
        // Safe fallback metrics
      });
  }, []);

  const activeAmount = isCustom ? Math.max(1, parseInt(customAmount, 10) || 0) : selectedAmount;

  async function handleDonate(e: React.FormEvent) {
    e.preventDefault();
    if (activeAmount < 1) {
      setError('Please choose a donation amount of at least $1.00');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const res = await fetch(`${apiUrl}/api/v1/donations/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountCents: activeAmount * 100,
          donorMessage: donorMessage.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to initialize secure checkout.');
      }

      const { checkoutUrl } = await res.json();
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
      } else {
        throw new Error('No checkout URL received.');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', position: 'relative', background: '#f8f9fa' }}>
      <div className="mesh-bg" />

      {/* Navigation */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        borderBottom: '1px solid #e2e8f0',
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(16px)',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '4rem' }}>
          <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 800 }}>
              <span className="gradient-text">Jarwis</span>{' '}
              <span style={{ color: '#1e293b' }}>Help Me!</span>
            </span>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Link href="/dashboard" className="btn-ghost" style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}>
              Dashboard
            </Link>
            <Link href="/dashboard/session/new" className="btn-primary" style={{ padding: '0.45rem 1.15rem', fontSize: '0.85rem' }}>
              Find Help Now
            </Link>
          </div>
        </div>
      </nav>

      <main style={{ maxWidth: 960, margin: '0 auto', padding: '3.5rem 1.5rem 6rem' }}>
        {/* Header */}
        <div className="fade-in-up" style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.45rem',
            background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.25)',
            color: '#2563eb', padding: '0.35rem 0.9rem', borderRadius: '2rem',
            fontSize: '0.85rem', fontWeight: 600, marginBottom: '1.25rem',
          }}>
            <IconHeart size={16} color="#2563eb" />
            <span>Voluntary Mission Support</span>
          </div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#1e293b', marginBottom: '0.75rem', letterSpacing: '-0.02em' }}>
            Help Keep Mental Health Support <span className="gradient-text">Accessible</span>
          </h1>
          <p style={{ color: '#64748b', fontSize: '1.05rem', maxWidth: 620, margin: '0 auto', lineHeight: 1.6 }}>
            Jarwis Help Me! is built so that anyone in acute distress can find a verified human therapist when they need it most. Your voluntary contributions subsidize sessions for those who cannot afford care and maintain our 24/7 low-latency matching network.
          </p>
        </div>

        {/* Impact Transparency Stats */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1.25rem', marginBottom: '3rem',
        }}>
          <div className="glass" style={{ borderRadius: '1rem', padding: '1.5rem', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}>
              <IconGift size={24} color="#3b82f6" />
            </div>
            <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#1e293b' }}>
              ${stats.totalRaisedUsd.toLocaleString()}
            </div>
            <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>
              Voluntary Support Raised
            </div>
          </div>

          <div className="glass" style={{ borderRadius: '1rem', padding: '1.5rem', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}>
              <IconUser size={24} color="#059669" />
            </div>
            <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#1e293b' }}>
              {stats.totalDonors}
            </div>
            <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>
              Individual Community Donors
            </div>
          </div>

          <div className="glass" style={{ borderRadius: '1rem', padding: '1.5rem', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}>
              <IconBolt size={24} color="#d97706" />
            </div>
            <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#1e293b' }}>
              {stats.sessionsSponsored}+
            </div>
            <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>
              Subsidized Therapy Sessions
            </div>
          </div>
        </div>

        {/* Donation Form Card */}
        <div className="glass fade-in-up" style={{ borderRadius: '1.5rem', padding: '2.5rem', marginBottom: '3rem' }}>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#1e293b', marginBottom: '1.25rem' }}>
            Select Your Contribution
          </h2>

          {error && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '0.65rem', padding: '0.85rem 1.25rem', color: '#dc2626',
              fontSize: '0.875rem', marginBottom: '1.5rem',
            }}>
              {error}
            </div>
          )}

          {/* Tier Cards Grid */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem', marginBottom: '1.5rem',
          }}>
            {PRESET_TIERS.map((tier) => {
              const isSelected = !isCustom && selectedAmount === tier.amount;
              return (
                <div
                  key={tier.amount}
                  onClick={() => {
                    setSelectedAmount(tier.amount);
                    setIsCustom(false);
                  }}
                  style={{
                    borderRadius: '1rem',
                    padding: '1.25rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    border: isSelected ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                    background: isSelected ? 'rgba(59, 130, 246, 0.05)' : '#ffffff',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '1.5rem', fontWeight: 800, color: isSelected ? '#2563eb' : '#1e293b' }}>
                      ${tier.amount}
                    </span>
                    {isSelected && <IconCheck size={18} color="#2563eb" />}
                  </div>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#1e293b', marginBottom: '0.35rem' }}>
                    {tier.title}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', lineHeight: 1.45 }}>
                    {tier.desc}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Custom Amount Button/Input */}
          <div style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setIsCustom(true)}
                style={{
                  padding: '0.65rem 1.25rem',
                  borderRadius: '0.65rem',
                  border: isCustom ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                  background: isCustom ? 'rgba(59, 130, 246, 0.05)' : '#ffffff',
                  color: isCustom ? '#2563eb' : '#64748b',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                }}
              >
                Custom Amount
              </button>

              {isCustom && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>$</span>
                  <input
                    type="number"
                    min="1"
                    max="5000"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    placeholder="25"
                    className="input"
                    style={{ width: 120, padding: '0.6rem 0.75rem', fontSize: '1rem', fontWeight: 600 }}
                  />
                  <span style={{ color: '#64748b', fontSize: '0.85rem' }}>USD</span>
                </div>
              )}
            </div>
          </div>

          {/* Optional Donor Note */}
          <div style={{ marginBottom: '2rem' }}>
            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: '#1e293b', marginBottom: '0.4rem' }}>
              Words of Encouragement (Optional)
            </label>
            <input
              type="text"
              value={donorMessage}
              onChange={(e) => setDonorMessage(e.target.value)}
              placeholder="e.g. Hope this brings someone peace today. You are not alone."
              className="input"
              maxLength={200}
            />
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.35rem' }}>
              Your note will be displayed anonymously in our community encouragement board.
            </div>
          </div>

          {/* Submit Action */}
          <button
            type="button"
            onClick={handleDonate}
            disabled={loading}
            className="btn-primary"
            style={{
              width: '100%',
              padding: '1rem',
              fontSize: '1.05rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.6rem',
            }}
          >
            <IconHeart size={20} color="#FFFFFF" />
            <span>
              {loading ? 'Preparing Secure Checkout...' : `Contribute $${activeAmount} Securely via Stripe`}
            </span>
          </button>

          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.5rem',
            marginTop: '1.25rem', fontSize: '0.8rem', color: '#64748b', flexWrap: 'wrap',
          }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <IconShield size={14} color="#059669" />
              <span>256-Bit SSL Encrypted</span>
            </span>
            <span>•</span>
            <span>Zero Platform Fees Taken</span>
            <span>•</span>
            <span>Tax-Deductible Nonprofit Support</span>
          </div>
        </div>

        {/* Values Section */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '1.5rem',
        }}>
          <div className="glass" style={{ borderRadius: '1rem', padding: '1.75rem' }}>
            <div style={{ marginBottom: '0.75rem' }}>
              <IconShield size={24} color="#3b82f6" />
            </div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.35rem' }}>
              Strict Privacy by Design
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', lineHeight: 1.55 }}>
              Donations never link your financial identity to private consultations. Sessions remain completely confidential and encrypted.
            </p>
          </div>

          <div className="glass" style={{ borderRadius: '1rem', padding: '1.75rem' }}>
            <div style={{ marginBottom: '0.75rem' }}>
              <IconBolt size={24} color="#3b82f6" />
            </div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.35rem' }}>
              No Waitlists, Instant Reach
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', lineHeight: 1.55 }}>
              Traditional care takes weeks to schedule. Your support helps verified therapists stay on call for people facing emergencies today.
            </p>
          </div>

          <div className="glass" style={{ borderRadius: '1rem', padding: '1.75rem' }}>
            <div style={{ marginBottom: '0.75rem' }}>
              <IconCheck size={24} color="#3b82f6" />
            </div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.35rem' }}>
              100% Direct Allocation
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', lineHeight: 1.55 }}>
              Every dollar goes directly into clinical subsidization and the infrastructure required to route calls with zero ads or tracking.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
